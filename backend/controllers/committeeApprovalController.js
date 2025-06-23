const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { logAction } = require('../models/logger');
const { insertNotification } = require('../models/notfications-utils');
require('dotenv').config();

// Create a MySQL pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/**
 * 1. Get pending committee approvals for the logged-in user
 */
async function getUserPendingCommitteeApprovals(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const { id: userId } = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.execute(`
      SELECT
        CONCAT('comm-', cc.id) AS id,
        cc.title,
        cc.file_path,
        cc.notes,
        cc.approval_status,
        CAST(cc.approvers_required AS CHAR) AS approvers_required,
        cc.created_at,
        cf.name AS folderName,
  com.name  AS source_name,    -- ← هكذا ترسل اسم اللجنة إلى واجهة المستخدم
  'committee' AS type,         -- ← يعلّم الجافاسكربت بأن هذا عنصر لجنة
        GROUP_CONCAT(DISTINCT u2.username) AS assigned_approvers
      FROM committee_contents cc
      JOIN committee_folders cf     ON cc.folder_id = cf.id
      JOIN committees com           ON cf.committee_id = com.id
      LEFT JOIN committee_content_approvers cca ON cca.content_id = cc.id
      LEFT JOIN users u2            ON cca.user_id = u2.id
      WHERE cc.is_approved = 0
        AND JSON_CONTAINS(cc.approvers_required, JSON_ARRAY(?))
      GROUP BY cc.id
      ORDER BY cc.created_at DESC
    `, [userId]);

    // parse JSON fields
    rows.forEach(r => {
      try {
        r.approvers_required = JSON.parse(r.approvers_required);
      } catch {
        r.approvers_required = [];
      }
    });

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'خطأ في جلب الموافقات المعلقة للجان' });
  }
}

/**
 * 2. Approve or reject a committee content
 */
async function handleCommitteeApproval(req, res) {
  const originalId = req.params.contentId;        // e.g. "comm-123"
  const { approved, signature, electronic_signature, notes, on_behalf_of } = req.body;

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'البيانات ناقصة' });
  }

  // extract numeric ID
  const contentId = parseInt(originalId.replace(/^comm-/, ''), 10);
  if (isNaN(contentId)) {
    return res.status(400).json({ status: 'error', message: 'معرّف غير صالح' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    const approverId  = on_behalf_of || currentUserId;
    const isProxy     = Boolean(on_behalf_of);
    const delegatedBy = isProxy ? currentUserId : null;

    if (approved && !signature && !electronic_signature) {
      return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
    }

    // Insert or update the approval log
    await db.execute(`
      INSERT INTO committee_approval_logs (
        content_id,
        approver_id,
        delegated_by,
        signed_as_proxy,
        status,
        signature,
        electronic_signature,
        comments,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        delegated_by         = VALUES(delegated_by),
        signed_as_proxy      = VALUES(signed_as_proxy),
        status               = VALUES(status),
        signature            = VALUES(signature),
        electronic_signature = VALUES(electronic_signature),
        comments             = VALUES(comments),
        created_at           = NOW();
    `, [
      contentId,
      approverId,
      delegatedBy,
      isProxy ? 1 : 0,
      approved ? 'approved' : 'rejected',
      signature || null,
      electronic_signature || null,
      notes || ''
    ]);

    // Fetch details for logging
    const [contentDetails] = await db.execute(`
        SELECT cc.title, com.name as committee_name
        FROM committee_contents cc
        JOIN committee_folders cf ON cc.folder_id = cf.id
        JOIN committees com ON cf.committee_id = com.id
        WHERE cc.id = ?
    `, [contentId]);

    const title = contentDetails.length ? contentDetails[0].title : `ID ${contentId}`;
    const committeeName = contentDetails.length ? contentDetails[0].committee_name : '';

    const logDescription = {
        ar: `تم ${approved ? 'اعتماد' : 'رفض'} ملف اللجنة: "${getContentNameByLanguage(title, 'ar')}" في لجنة: "${getCommitteeNameByLanguage(committeeName, 'ar')}"${isProxy ? ' كمفوض عن مستخدم آخر' : ''}`,
        en: `${approved ? 'Approved' : 'Rejected'} committee content: "${getContentNameByLanguage(title, 'en')}" in committee: "${getCommitteeNameByLanguage(committeeName, 'en')}"${isProxy ? ' as a proxy' : ''}`
    };

    await logAction(
      currentUserId,
      approved ? 'approve_committee_content' : 'reject_committee_content',
      JSON.stringify(logDescription),
      'committee_content',
      contentId
    );
    
    // إشعار للمفوض له إذا تم التوقيع بالنيابة
    if (isProxy && approverId) {
      await insertNotification(
        approverId,
        'تم تفويضك للتوقيع',
        `تم تفويضك للتوقيع بالنيابة عن مستخدم آخر على ملف لجنة رقم ${contentId}`,
        'proxy'
      );
    }

    // إشعار لصاحب الملف عند قبول أو رفض التوقيع
    // جلب صاحب الملف
    let [ownerRows] = await db.execute(`SELECT created_by, title FROM committee_contents WHERE id = ?`, [contentId]);
    if (ownerRows.length) {
      const ownerId = ownerRows[0].created_by;
      const fileTitle = ownerRows[0].title || '';
      await insertNotification(
        ownerId,
        approved ? 'تم اعتماد ملفك' : 'تم رفض ملفك',
        `ملف اللجنة "${fileTitle}" ${approved ? 'تم اعتماده' : 'تم رفضه'} من قبل الإدارة.`,
        approved ? 'approval' : 'rejected'
      );
    }

    // If proxy approval, ensure the approver is added to the approvers list
    if (approved && isProxy) {
      await db.execute(`
        INSERT IGNORE INTO committee_content_approvers (content_id, user_id)
        VALUES(?, ?)
      `, [contentId, approverId]);
    }

    // Check if any approvers remain
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS cnt
      FROM committee_content_approvers cca
      LEFT JOIN committee_approval_logs al
        ON cca.content_id = al.content_id
       AND cca.user_id    = al.approver_id
      WHERE cca.content_id = ?
        AND (al.status IS NULL OR al.status != 'approved')
    `, [contentId]);

    // If none remain, finalize
    if (remaining[0].cnt === 0) {
      await generateFinalSignedCommitteePDF(contentId);
      await db.execute(`
        UPDATE committee_contents
        SET is_approved     = 1,
            approval_status = 'approved',
            approved_by     = ?,
            updated_at      = NOW()
        WHERE id = ?
      `, [approverId, contentId]);
    }

    res.json({ status: 'success', message: 'تم التوقيع بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'خطأ أثناء معالجة الاعتماد' });
  }
}

/**
 * 3. List all committee contents assigned to me or created by me
 */
async function getAssignedCommitteeApprovals(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) 
      return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded   = jwt.verify(token, process.env.JWT_SECRET);
    const userId    = decoded.id;
    const userRole  = decoded.role;

    // 1) جلب صلاحيات المستخدم
    const [permRows] = await db.execute(`
      SELECT p.permission_key
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ?
    `, [userId]);
    const perms = new Set(permRows.map(r => r.permission_key));
    const canViewAll = (userRole === 'admin' || perms.has('transfer_credits'));

    // 2) قاعدة الاستعلام
    let baseQuery = `
      SELECT 
        CONCAT('comm-', cc.id)                AS id,
        cc.title,
        cc.file_path,
        cc.approval_status,
        GROUP_CONCAT(DISTINCT u2.username)    AS assigned_approvers,
        com.name                              AS source_name,
        u.username                            AS created_by_username,
        'committee'                           AS type,
        CAST(cc.approvers_required AS CHAR)   AS approvers_required,
        cc.created_at
      FROM committee_contents cc
      JOIN committee_folders cf       ON cc.folder_id = cf.id
      JOIN committees com             ON cf.committee_id = com.id
      JOIN users u                    ON cc.created_by = u.id
    `;

    const params = [];

    if (!canViewAll) {
      // 3) لو ما عنده صلاحية عرض الكل: نضيق عبر INNER JOIN
      baseQuery += `
        -- ربط الموافقات بحيث يجلب فقط الصفوف المعينة للمستخدم
        JOIN committee_content_approvers cca 
          ON cca.content_id = cc.id 
         AND cca.user_id = ?

        LEFT JOIN users u2 
          ON u2.id = cca.user_id

        WHERE 
          cc.approval_status = 'pending'
          OR cc.created_by = ?
      `;
      params.push(userId, userId);

    } else {
      // 4) للمفوّضين/المسؤولين نستخدم LEFT JOIN عادي لعرض كل الصفوف المعلقة
      baseQuery += `
        LEFT JOIN committee_content_approvers cca 
          ON cca.content_id = cc.id

        LEFT JOIN users u2 
          ON u2.id = cca.user_id

        WHERE cc.approval_status = 'pending'
      `;
    }

    // 5) تجميع وترتيب
    baseQuery += `
      GROUP BY cc.id
      ORDER BY cc.created_at DESC
    `;

    // 6) تنفيذ الاستعلام
    const [rows] = await db.execute(baseQuery, params);

    // 7) تحويل الحقل من JSON نصي إلى مصفوفة
    rows.forEach(r => {
      try {
        r.approvers_required = JSON.parse(r.approvers_required);
      } catch {
        r.approvers_required = [];
      }
    });

    return res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error in getAssignedCommitteeApprovals:', err);
    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
}

/**
 * 4. Delegate my committee approval to someone else
 */
// دالة مساعدة لتحويل title من JSON أو إعادته كما هو
function parseTitleByLang(jsonOrString, lang = 'ar') {
  if (!jsonOrString) return '';
  try {
    const obj = JSON.parse(jsonOrString);
    return obj[lang] || obj.ar || obj.en || '';
  } catch {
    return jsonOrString;
  }
}

async function delegateCommitteeApproval(req, res) {
  // 1) احصل على الرقم من "comm-<id>"
  const contentId = parseInt(req.params.id.replace(/^comm-/, ''), 10);
  const { delegateTo, notes } = req.body;

  if (!contentId || !delegateTo) {
    return res.status(400).json({
      status: 'error',
      message: 'بيانات مفقودة للتفويض'
    });
  }

  try {
    // 2) فكّ التوكن
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.id;

    // 3) سجّل التفويض في جدول اللجان
    await db.execute(`
      INSERT INTO committee_approval_logs (
        content_id, approver_id, delegated_by,
        signed_as_proxy, status, comments, created_at
      ) VALUES (?, ?, ?, 1, 'pending', ?, NOW())
      ON DUPLICATE KEY UPDATE
        delegated_by    = VALUES(delegated_by),
        signed_as_proxy = 1,
        status          = 'pending',
        comments        = VALUES(comments),
        created_at      = NOW()
    `, [contentId, delegateTo, currentUserId, notes || null]);

    // 4) جلب اسم المفوَّض
    const [delegateeRows] = await db.execute(
      'SELECT username FROM users WHERE id = ?', 
      [delegateTo]
    );
    const delegateeUsername = delegateeRows.length
      ? delegateeRows[0].username
      : String(delegateTo);

    // 5) جلب عنوان المحتوى من جدول committee_contents
    const [contentRows] = await db.execute(
      'SELECT title FROM committee_contents WHERE id = ?', 
      [contentId]
    );
    const rawTitle = contentRows.length
      ? contentRows[0].title
      : '';

    // 6) تحويل العنوان إلى نصوص عربية وإنجليزية
    const titleAr = parseTitleByLang(rawTitle, 'ar') || 'غير معروف';
    const titleEn = parseTitleByLang(rawTitle, 'en') || 'Unknown';

    // 7) سجل الحركة (باستخدام reference_type = 'approval' لأنه ضمن enum)
    const logDescription = {
      ar: `تم تفويض التوقيع للمستخدم: ${delegateeUsername} على ملف اللجنة: "${titleAr}"`,
      en: `Delegated signature to user: ${delegateeUsername} for committee file: "${titleEn}"`
    };
    await logAction(
      currentUserId,
      'delegate_committee_signature',
      JSON.stringify(logDescription),
      'approval',      // تأكد أن 'approval' موجودة في enum
      contentId
    );

    // 8) أرسل رد بنجاح
    return res.json({
      status: 'success',
      message: '✅ تم التفويض بالنيابة بنجاح'
    });

  } catch (err) {
    console.error('خطأ في delegateCommitteeApproval:', err);
    return res.status(500).json({
      status: 'error',
      message: 'فشل التفويض بالنيابة'
    });
  }
}


/**
 * 5. Get pending approvals where I'm the proxy
 */
async function getProxyCommitteeApprovals(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const { id: userId } = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.execute(`
      SELECT
        CONCAT('comm-', al.content_id) AS id,
        cc.title,
        cc.approval_status,
        com.name AS committeeName,
        u.username AS delegated_by
      FROM committee_approval_logs al
      JOIN committee_contents cc   ON al.content_id = cc.id
      JOIN committee_folders cf    ON cc.folder_id = cf.id
      JOIN committees com          ON cf.committee_id = com.id
      JOIN users u                 ON al.delegated_by = u.id
      WHERE al.approver_id = ? 
        AND al.signed_as_proxy = 1
        AND al.status = 'pending'
    `, [userId]);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'فشل جلب الموافقات بالوكالة' });
  }
}


/**
 * Helper: generate final signed PDF for committee
 */
async function generateFinalSignedCommitteePDF(contentId) {
  const [rows] = await db.execute(`SELECT file_path FROM committee_contents WHERE id = ?`, [contentId]);
  if (!rows.length) return console.error('Committee content not found');

  const fullPath = path.join(__dirname, '../../uploads', rows[0].file_path);
  if (!fs.existsSync(fullPath)) return console.error('File not found', fullPath);

  const pdfBytes = fs.readFileSync(fullPath);
  const pdfDoc   = await PDFDocument.load(pdfBytes);

  const [logs] = await db.execute(`
    SELECT u.username, al.signature, al.electronic_signature, al.signed_as_proxy, al.comments
    FROM committee_approval_logs al
    JOIN users u ON al.approver_id = u.id
    WHERE al.content_id = ? AND al.status = 'approved'
    ORDER BY al.created_at
  `, [contentId]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  let y    = 750;

  page.drawText('Committee Signatures Summary', { x: 200, y, size: 20, font, color: rgb(0,0,0) });
  y -= 40;

  for (const log of logs) {
    if (y < 200) { page = pdfDoc.addPage(); y = 750; }
    const label = log.signed_as_proxy ? 'Signed on behalf of' : 'Signed by';
    page.drawText(`${label}: ${log.username}`, { x: 50, y, size: 14, font });
    y -= 25;

    // embed hand signature
    if (log.signature?.startsWith('data:image')) {
      const imgBytes = Buffer.from(log.signature.split(',')[1], 'base64');
      const img      = await pdfDoc.embedPng(imgBytes);
      const dims     = img.scale(0.4);
      page.drawImage(img, { x: 150, y: y - dims.height + 10, width: dims.width, height: dims.height });
      y -= dims.height + 30;
    }

    // embed e-stamp
    if (log.electronic_signature) {
      const stampPath     = path.join(__dirname, '../e3teamdelc.png');
      const stampBytes    = fs.readFileSync(stampPath);
      const stampImage    = await pdfDoc.embedPng(stampBytes);
      const stampDims     = stampImage.scale(0.5);
      page.drawImage(stampImage, { x: 150, y: y - stampDims.height + 10, width: stampDims.width, height: stampDims.height });
      y -= stampDims.height + 30;
    }

    if (log.comments) {
      page.drawText(`Comments: ${log.comments}`, { x:50, y, size:12, font });
      y -= 20;
    }

    page.drawLine({ start:{x:50,y}, end:{x:550,y}, thickness:1, color:rgb(0.8,0.8,0.8) });
    y -= 30;
  }

  const finalBytes = await pdfDoc.save();
  fs.writeFileSync(fullPath, finalBytes);
  console.log('✅ Committee signature page added:', fullPath);
}

// Helper function to get committee name by language
function getCommitteeNameByLanguage(committeeNameData, userLanguage = 'ar') {
    try {
        if (typeof committeeNameData === 'string' && committeeNameData.startsWith('{')) {
            const parsed = JSON.parse(committeeNameData);
            return parsed[userLanguage] || parsed['ar'] || committeeNameData;
        }
        return committeeNameData || 'غير معروف';
    } catch (error) {
        return committeeNameData || 'غير معروف';
    }
}

// Helper function to get content title by language
function getContentNameByLanguage(contentNameData, userLanguage = 'ar') {
    try {
        if (typeof contentNameData === 'string' && contentNameData.startsWith('{')) {
            const parsed = JSON.parse(contentNameData);
            return parsed[userLanguage] || parsed['ar'] || contentNameData;
        }
        return contentNameData || 'غير معروف';
    } catch (error) {
        return contentNameData || 'غير معروف';
    }
}

module.exports = {
  getUserPendingCommitteeApprovals,
  handleCommitteeApproval,
  getAssignedCommitteeApprovals,
  delegateCommitteeApproval,
  getProxyCommitteeApprovals
};
