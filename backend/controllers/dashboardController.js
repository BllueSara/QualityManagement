// controllers/dashboardController.js
require('dotenv').config();
const jwt   = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// مساعدة لجلب صلاحيات المستخدم
async function getUserPerms(userId) {
  const [rows] = await db.execute(`
    SELECT p.permission_key
    FROM permissions p
    JOIN user_permissions up ON up.permission_id = p.id
    WHERE up.user_id = ?
  `, [userId]);
  return new Set(rows.map(r => r.permission_key));
}

const getStats = async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    const token = auth.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.id;
    const userRole = payload.role;

    const permsSet = await getUserPerms(userId);
    const canViewAll = (userRole === 'admin') || permsSet.has('view_dashboard');

    let sql, params = [];
    if (canViewAll) {
      sql = `
        SELECT
          COUNT(DISTINCT CASE WHEN ta.status = 'rejected'         THEN t.id END) AS rejected,
          COUNT(DISTINCT CASE WHEN latest.status = 'مغلق'         THEN t.id END) AS closed,
          COUNT(DISTINCT CASE WHEN t.status IN ('جديد','قيد المراجعة') THEN t.id END) AS current,
          COUNT(DISTINCT CASE WHEN latest.status = 'جديد'        THEN t.id END) AS new_tickets
        FROM tickets t
        LEFT JOIN ticket_assignments ta ON ta.ticket_id = t.id
        LEFT JOIN (
          SELECT h1.ticket_id, h1.status
          FROM ticket_status_history h1
          INNER JOIN (
            SELECT ticket_id, MAX(id) AS max_id
            FROM ticket_status_history
            GROUP BY ticket_id
          ) h2 ON h1.ticket_id = h2.ticket_id AND h1.id = h2.max_id
        ) AS latest ON latest.ticket_id = t.id
      `;
    } else {
      sql = `
        SELECT
          COUNT(DISTINCT CASE WHEN ta.status = 'rejected'         THEN t.id END) AS rejected,
          COUNT(DISTINCT CASE WHEN latest.status = 'مغلق'         THEN t.id END) AS closed,
          COUNT(DISTINCT CASE WHEN t.status IN ('جديد','قيد المراجعة') THEN t.id END) AS current,
          COUNT(DISTINCT CASE WHEN latest.status = 'جديد'        THEN t.id END) AS new_tickets
        FROM tickets t
        LEFT JOIN ticket_assignments ta ON ta.ticket_id = t.id
        LEFT JOIN (
          SELECT h1.ticket_id, h1.status
          FROM ticket_status_history h1
          INNER JOIN (
            SELECT ticket_id, MAX(id) AS max_id
            FROM ticket_status_history
            GROUP BY ticket_id
          ) h2 ON h1.ticket_id = h2.ticket_id AND h1.id = h2.max_id
        ) AS latest ON latest.ticket_id = t.id
        WHERE t.created_by = ?
           OR EXISTS (
             SELECT 1 FROM ticket_assignments x
             WHERE x.ticket_id   = t.id
               AND x.assigned_to = ?
           )
      `;
      params.push(userId, userId);
    }

    const [rows] = await db.execute(sql, params);

    const [[userStats]] = await db.execute(`
      SELECT COUNT(*) AS total_users,
             SUM(role = 'admin') AS admins
      FROM users
    `);

    const [[contentStats]] = await db.execute(`
      SELECT
        COUNT(*) AS pending_contents,
        SUM(is_approved = 1) AS approved_contents
      FROM contents
    `);

    const [[committeeStats]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM committees) AS committees,
        (SELECT COUNT(*) FROM committee_contents WHERE approval_status = 'pending') AS committee_contents_pending
    `);

    return res.status(200).json({
      status: 'success',
      data: {
        ...rows[0],
        ...userStats,
        ...contentStats,
        ...committeeStats
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Error getting dashboard stats.' });
  }
};


const getClosedWeek = async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ status:'error', message:'Unauthorized' });
    }
    const token   = auth.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId   = payload.id;
    const userRole = payload.role;

    const permsSet  = await getUserPerms(userId);
    const canViewAll = (userRole === 'admin') || permsSet.has('view_dashboard');

    let sql, params = [];
    if (canViewAll) {
      sql = `
        SELECT DATE(h.created_at) AS date, COUNT(*) AS closed_count
        FROM ticket_status_history h
        WHERE h.status = 'مغلق'
          AND h.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(h.created_at)
        ORDER BY DATE(h.created_at) ASC
      `;
    } else {
      sql = `
        SELECT DATE(h.created_at) AS date, COUNT(*) AS closed_count
        FROM ticket_status_history h
        JOIN tickets t ON t.id = h.ticket_id
        WHERE h.status = 'مغلق'
          AND h.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND (t.created_by = ? OR EXISTS (
              SELECT 1 FROM ticket_assignments x
              WHERE x.ticket_id = t.id
                AND x.assigned_to = ?
          ))
        GROUP BY DATE(h.created_at)
        ORDER BY DATE(h.created_at) ASC
      `;
      params.push(userId, userId);
    }

    const [rows] = await db.execute(sql, params);
    return res.status(200).json({ status:'success', data: rows });

  } catch (err) {
    // console.error('getClosedWeek error:', err);
    res.status(500).json({ message: 'Error getting closed tickets by week.' });
  }
};

const exportDashboardExcel = async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    const token = auth.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.id;
    const userRole = payload.role;

    const permsSet = await getUserPerms(userId);
    const canViewAll = (userRole === 'admin') || permsSet.has('view_dashboard');

    // جلب البيانات الإحصائية للأحداث العارضة
    let statsSql, statsParams = [];
    if (canViewAll) {
      statsSql = `
        SELECT
          COUNT(DISTINCT CASE WHEN ta.status = 'rejected' THEN t.id END) AS rejected,
          COUNT(DISTINCT CASE WHEN latest.status = 'مغلق' THEN t.id END) AS closed,
          COUNT(DISTINCT CASE WHEN t.status IN ('جديد','قيد المراجعة') THEN t.id END) AS current,
          COUNT(DISTINCT CASE WHEN latest.status = 'جديد' THEN t.id END) AS new_tickets
        FROM tickets t
        LEFT JOIN ticket_assignments ta ON ta.ticket_id = t.id
        LEFT JOIN (
          SELECT h1.ticket_id, h1.status
          FROM ticket_status_history h1
          INNER JOIN (
            SELECT ticket_id, MAX(id) AS max_id
            FROM ticket_status_history
            GROUP BY ticket_id
          ) h2 ON h1.ticket_id = h2.ticket_id AND h1.id = h2.max_id
        ) AS latest ON latest.ticket_id = t.id
      `;
    } else {
      statsSql = `
        SELECT
          COUNT(DISTINCT CASE WHEN ta.status = 'rejected' THEN t.id END) AS rejected,
          COUNT(DISTINCT CASE WHEN latest.status = 'مغلق' THEN t.id END) AS closed,
          COUNT(DISTINCT CASE WHEN t.status IN ('جديد','قيد المراجعة') THEN t.id END) AS current,
          COUNT(DISTINCT CASE WHEN latest.status = 'جديد' THEN t.id END) AS new_tickets
        FROM tickets t
        LEFT JOIN ticket_assignments ta ON ta.ticket_id = t.id
        LEFT JOIN (
          SELECT h1.ticket_id, h1.status
          FROM ticket_status_history h1
          INNER JOIN (
            SELECT ticket_id, MAX(id) AS max_id
            FROM ticket_status_history
            GROUP BY ticket_id
          ) h2 ON h1.ticket_id = h2.ticket_id AND h1.id = h2.max_id
        ) AS latest ON latest.ticket_id = t.id
        WHERE t.created_by = ?
           OR EXISTS (
             SELECT 1 FROM ticket_assignments x
             WHERE x.ticket_id = t.id
               AND x.assigned_to = ?
           )
      `;
      statsParams.push(userId, userId);
    }

    const [statsRows] = await db.execute(statsSql, statsParams);
    const stats = statsRows[0];

    // جلب إحصائيات المستخدمين
    const [[userStats]] = await db.execute(`
      SELECT COUNT(*) AS total_users,
             SUM(role = 'admin') AS admins
      FROM users
    `);

    // جلب إحصائيات المحتويات
    const [[contentStats]] = await db.execute(`
      SELECT
        COUNT(*) AS pending_contents,
        SUM(is_approved = 1) AS approved_contents
      FROM contents
    `);

    // جلب إحصائيات اللجان
    const [[committeeStats]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM committees) AS committees,
        (SELECT COUNT(*) FROM committee_contents WHERE approval_status = 'pending') AS committee_contents_pending
    `);

    // جلب بيانات الأحداث المغلقة خلال الأسبوع
    let weekSql, weekParams = [];
    if (canViewAll) {
      weekSql = `
        SELECT DATE(h.created_at) AS date, COUNT(*) AS closed_count
        FROM ticket_status_history h
        WHERE h.status = 'مغلق'
          AND h.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(h.created_at)
        ORDER BY DATE(h.created_at) ASC
      `;
    } else {
      weekSql = `
        SELECT DATE(h.created_at) AS date, COUNT(*) AS closed_count
        FROM ticket_status_history h
        JOIN tickets t ON t.id = h.ticket_id
        WHERE h.status = 'مغلق'
          AND h.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND (t.created_by = ? OR EXISTS (
              SELECT 1 FROM ticket_assignments x
              WHERE x.ticket_id = t.id
                AND x.assigned_to = ?
          ))
        GROUP BY DATE(h.created_at)
        ORDER BY DATE(h.created_at) ASC
      `;
      weekParams.push(userId, userId);
    }

    const [weekRows] = await db.execute(weekSql, weekParams);

    // إنشاء ملف Excel
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // ورقة الإحصائيات العامة
    const statsSheet = workbook.addWorksheet('التقرير العام');
    
    // إضافة العنوان الرئيسي
    const titleRow = statsSheet.addRow(['تقرير لوحة التحكم - نظام إدارة الجودة والسلامة']);
    titleRow.height = 40;
    titleRow.font = { bold: true, size: 18, color: { argb: 'FF2E86AB' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    statsSheet.mergeCells('A1:D1');
    
    // إضافة التاريخ
    const dateRow = statsSheet.addRow([`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`]);
    dateRow.font = { size: 12, color: { argb: 'FF666666' } };
    dateRow.alignment = { horizontal: 'right' };
    statsSheet.mergeCells('A2:D2');
    
    // إضافة مسافة
    statsSheet.addRow([]);
    
    // إحصائيات الأحداث العارضة
    const eventsTitleRow = statsSheet.addRow(['إحصائيات الأحداث العارضة']);
    eventsTitleRow.font = { bold: true, size: 16, color: { argb: 'FF2E86AB' } };
    eventsTitleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4FD' }
    };
    statsSheet.mergeCells('A4:D4');
    
    // رؤوس الأعمدة للأحداث
    const eventsHeaders = statsSheet.addRow(['الأحداث المغلقة', 'الأحداث الجديدة']);
    eventsHeaders.font = { bold: true, size: 12 };
    eventsHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    // بيانات الأحداث
    const eventsData = statsSheet.addRow([
      stats.closed || 0,
      stats.new_tickets || 0
    ]);
    eventsData.font = { size: 14, bold: true };
    eventsData.alignment = { horizontal: 'center' };
    
    // إضافة مسافة
    statsSheet.addRow([]);
    statsSheet.addRow([]);
    
    // إحصائيات المستخدمين
    const usersTitleRow = statsSheet.addRow(['إحصائيات المستخدمين']);
    usersTitleRow.font = { bold: true, size: 16, color: { argb: 'FF2E86AB' } };
    usersTitleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4FD' }
    };
    statsSheet.mergeCells('A8:D8');
    
    const usersHeaders = statsSheet.addRow(['إجمالي المستخدمين', 'عدد المشرفين']);
    usersHeaders.font = { bold: true, size: 12 };
    usersHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    const usersData = statsSheet.addRow([
      userStats.total_users || 0,
      userStats.admins || 0
    ]);
    usersData.font = { size: 14, bold: true };
    usersData.alignment = { horizontal: 'center' };
    
    // إضافة مسافة
    statsSheet.addRow([]);
    statsSheet.addRow([]);
    
    // إحصائيات المحتويات
    const contentTitleRow = statsSheet.addRow(['إحصائيات المحتويات']);
    contentTitleRow.font = { bold: true, size: 16, color: { argb: 'FF2E86AB' } };
    contentTitleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4FD' }
    };
    statsSheet.mergeCells('A13:D13');
    
    const contentHeaders = statsSheet.addRow(['محتويات بانتظار الاعتماد', 'المحتويات المعتمدة']);
    contentHeaders.font = { bold: true, size: 12 };
    contentHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    const contentData = statsSheet.addRow([
      contentStats.pending_contents || 0,
      contentStats.approved_contents || 0
    ]);
    contentData.font = { size: 14, bold: true };
    contentData.alignment = { horizontal: 'center' };
    
    // إضافة مسافة
    statsSheet.addRow([]);
    statsSheet.addRow([]);
    
    // إحصائيات اللجان
    const committeeTitleRow = statsSheet.addRow(['إحصائيات اللجان']);
    committeeTitleRow.font = { bold: true, size: 16, color: { argb: 'FF2E86AB' } };
    committeeTitleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4FD' }
    };
    statsSheet.mergeCells('A18:D18');
    
    const committeeHeaders = statsSheet.addRow(['عدد اللجان', 'محتويات اللجان بانتظار الاعتماد']);
    committeeHeaders.font = { bold: true, size: 12 };
    committeeHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    const committeeData = statsSheet.addRow([
      committeeStats.committees || 0,
      committeeStats.committee_contents_pending || 0
    ]);
    committeeData.font = { size: 14, bold: true };
    committeeData.alignment = { horizontal: 'center' };
    
    // ضبط عرض الأعمدة - زيادة العرض لحل مشكلة النص العربي
    statsSheet.columns.forEach(column => {
      column.width = 35;
    });
    
    // إضافة حدود للخلايا
    for (let i = 1; i <= statsSheet.rowCount; i++) {
      const row = statsSheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // ورقة البيانات التفصيلية
    const dataSheet = workbook.addWorksheet('البيانات التفصيلية');
    
    // إضافة عنوان
    const dataTitleRow = dataSheet.addRow(['البيانات التفصيلية - تحليل الأحداث العارضة']);
    dataTitleRow.font = { bold: true, size: 18, color: { argb: 'FF2E86AB' } };
    dataTitleRow.alignment = { horizontal: 'center' };
    dataSheet.mergeCells('A1:C1');
    
    // إضافة مسافة
    dataSheet.addRow([]);
    
    // بيانات الأحداث للتحليل
    dataSheet.addRow(['نوع الحدث', 'العدد', 'النسبة المئوية']);
    dataSheet.addRow(['الأحداث المغلقة', stats.closed || 0, `${((stats.closed || 0) / Math.max(1, (stats.closed || 0) + (stats.new_tickets || 0)) * 100).toFixed(1)}%`]);
    dataSheet.addRow(['الأحداث الجديدة', stats.new_tickets || 0, `${((stats.new_tickets || 0) / Math.max(1, (stats.closed || 0) + (stats.new_tickets || 0)) * 100).toFixed(1)}%`]);
    
    // إضافة مسافة
    dataSheet.addRow([]);
    dataSheet.addRow([]);
    
    // تحليل الأداء
    dataSheet.addRow(['تحليل الأداء']);
    dataSheet.addRow(['المؤشر', 'القيمة', 'التقييم']);
    
    const totalEvents = (stats.closed || 0) + (stats.new_tickets || 0);
    const closureRate = totalEvents > 0 ? ((stats.closed || 0) / totalEvents * 100).toFixed(1) : 0;
    
    dataSheet.addRow(['معدل الإغلاق', `${closureRate}%`, closureRate >= 70 ? 'ممتاز' : closureRate >= 50 ? 'جيد' : 'يحتاج تحسين']);
    dataSheet.addRow(['الأحداث النشطة', stats.new_tickets || 0, (stats.new_tickets || 0) <= 5 ? 'ممتاز' : (stats.new_tickets || 0) <= 10 ? 'جيد' : 'يحتاج متابعة']);
    
    // إضافة مسافة
    dataSheet.addRow([]);
    dataSheet.addRow([]);
    
    // بيانات الأسبوع للتحليل
    dataSheet.addRow(['التاريخ', 'عدد الأحداث المغلقة', 'التغير عن اليوم السابق']);
    let previousCount = 0;
    weekRows.forEach((row, index) => {
      const currentCount = row.closed_count;
      const change = index === 0 ? 0 : currentCount - previousCount;
      const changeText = change === 0 ? 'لا تغيير' : change > 0 ? `+${change}` : `${change}`;
      
      dataSheet.addRow([
        new Date(row.date).toLocaleDateString('ar-SA'),
        currentCount,
        changeText
      ]);
      previousCount = currentCount;
    });
    
    // تنسيق ورقة البيانات
    dataSheet.columns.forEach(column => {
      column.width = 20;
    });
    
    // تنسيق رؤوس الأعمدة
    const headerRows = [3, 9, 11, 13];
    headerRows.forEach(rowNum => {
      const row = dataSheet.getRow(rowNum);
      row.font = { bold: true, size: 12 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F8FF' }
      };
    });
    
    // تنسيق العناوين الرئيسية
    const titleRows = [1, 9, 11];
    titleRows.forEach(rowNum => {
      const row = dataSheet.getRow(rowNum);
      row.font = { bold: true, size: 14, color: { argb: 'FF2E86AB' } };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F4FD' }
      };
    });
    
    // إضافة حدود للخلايا في ورقة البيانات
    for (let i = 1; i <= dataSheet.rowCount; i++) {
      const row = dataSheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
    
    // إرسال الملف
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=dashboard-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('خطأ في تصدير التقرير:', err);
    res.status(500).json({ message: 'خطأ في تصدير التقرير' });
  }
};

module.exports = { getStats, getClosedWeek, exportDashboardExcel };
