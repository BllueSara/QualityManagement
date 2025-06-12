const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');


require('dotenv').config();

// قاعدة البيانات
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// جلب التواقيع المعلقة للمستخدم
const getUserPendingApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const [rows] = await db.execute(`
      SELECT 
        id, title, file_path, notes, approval_status, approvers_required, approvals_log, created_at
      FROM contents
      WHERE is_approved = 0
        AND JSON_CONTAINS(approvers_required, JSON_ARRAY(?))
    `, [userId]);

    res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error('Error getUserPendingApprovals:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في السيرفر' });
  }
};

// اعتماد/رفض ملف
const handleApproval = async (req, res) => {
  const { contentId } = req.params;
  const { approved, signature, notes, electronic_signature } = req.body;

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'البيانات ناقصة' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // التحقق أن أحد التوقيعين موجود
    if (!signature && !electronic_signature) {
      return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
    }

    // حفظ التوقيع أو التوقيع الإلكتروني
    await db.execute(`
      INSERT INTO approval_logs 
        (content_id, approver_id, status, signature, electronic_signature, comments, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        signature = VALUES(signature),
        electronic_signature = VALUES(electronic_signature),
        comments = VALUES(comments),
        created_at = NOW()
    `, [
      contentId,
      userId,
      approved ? 'approved' : 'rejected',
      signature || null,
      electronic_signature || null,
      notes || ''
    ]);

    // التحقق إذا الكل وافق
    const [remaining] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM content_approvers ca
      LEFT JOIN approval_logs al 
        ON ca.content_id = al.content_id AND ca.user_id = al.approver_id
      WHERE ca.content_id = ? AND (al.status IS NULL OR al.status != 'approved')
    `, [contentId]);

    if (remaining[0].count === 0) {
      await generateFinalSignedPDF(contentId);
      await db.execute(`
        UPDATE contents
        SET is_approved = 1,
            approval_status = 'approved',
            approved_by = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [userId, contentId]);
    }

    res.status(200).json({ status: 'success', message: 'تم التوقيع' });
  } catch (err) {
    console.error('handleApproval Error:', err);
    res.status(500).json({ status: 'error', message: 'فشل التوقيع' });
  }
};


// توليد نسخة نهائية موقعة من PDF


async function generateFinalSignedPDF(contentId) {
  const [rows] = await db.execute(`SELECT file_path FROM contents WHERE id = ?`, [contentId]);
  if (!rows.length) return console.error('📁 المحتوى غير موجود');

  const relativePath = rows[0].file_path;
  const fullPath = path.join(__dirname, '../../uploads', relativePath);
  if (!fs.existsSync(fullPath)) return console.error('❌ الملف غير موجود:', fullPath);

  let pdfDoc;
  try {
    const pdfBytes = fs.readFileSync(fullPath);
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch (err) {
    return console.error('❌ فشل تحميل PDF:', err);
  }

  const [logs] = await db.execute(`
    SELECT 
      u.username AS username,
      al.signature,
      al.electronic_signature,
      al.signed_as_proxy,
      al.comments
    FROM approval_logs al
    JOIN users u ON al.approver_id = u.id
    WHERE al.content_id = ? AND al.status = 'approved'
  `, [contentId]);

  if (!logs.length) return console.warn('⚠️ لا يوجد تواقيع حالياً');

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  let y = 750;

  page.drawText('Signatures Summary', {
    x: 200,
    y,
    size: 18,
    font,
    color: rgb(0, 0, 0)
  });

  y -= 50;

  for (const log of logs) {
    const isProxy = !!log.signed_as_proxy;
    const label = isProxy ? 'Signed on behalf of' : 'Signed by';

    page.drawText(`${label}: ${log.username}`, {
      x: 50,
      y: y,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });

    y -= 20;

    if (log.signature && log.signature.startsWith('data:image')) {
      try {
        const base64Data = log.signature.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        const img = await pdfDoc.embedPng(imageBytes);
        const dims = img.scale(0.4);

        page.drawText(`Signature:`, {
          x: 50,
          y: y - dims.height - 10,
          size: 12,
          font,
          color: rgb(0, 0, 0)
        });

        page.drawImage(img, {
          x: 130,
          y: y - dims.height - 15,
          width: dims.width,
          height: dims.height
        });

        y -= dims.height + 60;
      } catch (err) {
        console.warn('⚠️ فشل تضمين توقيع صورة:', err);
        y -= 40;
      }
    } else if (log.electronic_signature) {
      try {
        const stampPath = path.join(__dirname, '../e3teamdelc.png');
        
        // يجب أن تكون الصورة موجودة
        const stampImageBytes = fs.readFileSync(stampPath);
        const stampImg = await pdfDoc.embedPng(stampImageBytes);
        const dims = stampImg.scale(0.5);

        page.drawImage(stampImg, {
          x: 200,
          y: y,
          width: dims.width,
          height: dims.height
        });

        y -= dims.height + 10;

        page.drawText(`المستخدم: ${log.username}`, {
          x: 200,
          y: y,
          size: 12,
          font,
          color: rgb(0.2, 0.2, 0.2)
        });

        y -= 40;
      } catch (err) {
        console.warn('⚠️ فشل إدراج ختم إلكتروني:', err);
        page.drawText(`تم الاعتماد إلكترونيًا`, {
          x: 200,
          y: y,
          size: 16,
          font,
          color: rgb(0.0, 0.4, 0.8)
        });

        y -= 30;
      }
    }

    if (y < 100) {
      page = pdfDoc.addPage();
      y = 750;
    }
  }

  const finalBytes = await pdfDoc.save();
  fs.writeFileSync(fullPath, finalBytes);
  console.log(`✅ صفحة التواقيع مضافة: ${fullPath}`);
}





module.exports = { generateFinalSignedPDF };


// جلب الملفات المكلف بها المستخدم
const getAssignedApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const [rows] = await db.execute(`
      SELECT 
        c.id,
        c.title,
        c.approval_status,
        d.name AS department_name,
        al.status,
        al.signed_as_proxy,
        u2.username AS delegated_by_name
      FROM content_approvers ca
      JOIN contents c ON ca.content_id = c.id
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN departments d ON f.department_id = d.id
      LEFT JOIN approval_logs al ON ca.content_id = al.content_id AND al.approver_id = ca.user_id
      LEFT JOIN users u2 ON al.delegated_by = u2.id
      WHERE ca.user_id = ? AND (al.status IS NULL OR al.status = 'pending')
    `, [userId]);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getAssignedApprovals error:', err);
    res.status(500).json({ status: 'error', message: 'خطأ في جلب البيانات' });
  }
};



const delegateApproval = async (req, res) => {
  const contentId = req.params.id;
  const { delegateTo, notes } = req.body;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const currentUserId = payload.id; // ✅ تعديل هنا

    if (!contentId || !delegateTo || !currentUserId) {
      console.error('❌ قيم ناقصة:', { contentId, delegateTo, currentUserId });
      return res.status(400).json({ status: 'error', message: 'بيانات مفقودة للتفويض' });
    }

    await db.execute(`
      INSERT INTO approval_logs (content_id, approver_id, delegated_by, signed_as_proxy, status, comments, created_at)
      VALUES (?, ?, ?, 1, 'pending', ?, NOW())
    `, [contentId, delegateTo, currentUserId, notes || null]);

    res.status(200).json({
      status: 'success',
      message: '✅ تم التفويض بالنيابة بنجاح'
    });

  } catch (err) {
    console.error('خطأ أثناء التفويض بالنيابة:', err);
    res.status(500).json({ status: 'error', message: 'فشل التفويض بالنيابة' });
  }
};



const getProxyApprovals = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const [rows] = await db.execute(`
      SELECT 
        al.id AS approval_id,
        c.title AS file_title,
        u.username AS delegated_by_name
      FROM approval_logs al
      JOIN contents c ON al.content_id = c.id
      JOIN users u ON al.delegated_by = u.id
      WHERE al.approver_id = ? AND al.signed_as_proxy = 1 AND al.status = 'pending'
    `, [userId]);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('خطأ في getProxyApprovals:', err);
    res.status(500).json({ status: 'error', message: 'فشل في تحميل التواقيع بالنيابة' });
  }
};

module.exports = {
  getUserPendingApprovals,
  handleApproval,
  delegateApproval,
  getAssignedApprovals,
  getProxyApprovals // ✅ أضف هذه
};


