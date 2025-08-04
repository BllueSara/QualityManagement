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

    // جلب إحصائيات الأقسام
    let departmentStatsSql, departmentStatsParams = [];
    if (canViewAll) {
      departmentStatsSql = `
        SELECT 
          d.name AS department_name,
          COUNT(c.id) AS total_contents,
          SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents,
          ROUND((SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) / COUNT(c.id)) * 100, 1) AS approval_rate
        FROM departments d
        LEFT JOIN folders f ON f.department_id = d.id
        LEFT JOIN contents c ON c.folder_id = f.id
        GROUP BY d.id, d.name
        HAVING total_contents > 0
        ORDER BY approval_rate DESC, total_contents DESC
        LIMIT 10
      `;
    } else {
      departmentStatsSql = `
        SELECT 
          d.name AS department_name,
          COUNT(c.id) AS total_contents,
          SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents,
          ROUND((SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) / COUNT(c.id)) * 100, 1) AS approval_rate
        FROM departments d
        LEFT JOIN folders f ON f.department_id = d.id
        LEFT JOIN contents c ON c.folder_id = f.id
        WHERE d.id IN (
          SELECT DISTINCT department_id 
          FROM user_departments 
          WHERE user_id = ?
        )
        GROUP BY d.id, d.name
        HAVING total_contents > 0
        ORDER BY approval_rate DESC, total_contents DESC
        LIMIT 10
      `;
      departmentStatsParams.push(userId);
    }

    const [departmentStatsRows] = await db.execute(departmentStatsSql, departmentStatsParams);

    // جلب إحصائيات اللجان
    let committeeStatsSql, committeeStatsParams = [];
    if (canViewAll) {
      committeeStatsSql = `
        SELECT 
          c.name AS committee_name,
          COUNT(cc.id) AS total_contents,
          SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN cc.approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_contents,
          SUM(CASE WHEN cc.approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_contents,
          ROUND((SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) / COUNT(cc.id)) * 100, 1) AS approval_rate
        FROM committees c
        LEFT JOIN committee_folders cf ON cf.committee_id = c.id
        LEFT JOIN committee_contents cc ON cc.folder_id = cf.id
        GROUP BY c.id, c.name
        HAVING total_contents > 0
        ORDER BY approval_rate DESC, total_contents DESC
        LIMIT 10
      `;
    } else {
      committeeStatsSql = `
        SELECT 
          c.name AS committee_name,
          COUNT(cc.id) AS total_contents,
          SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN cc.approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_contents,
          SUM(CASE WHEN cc.approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_contents,
          ROUND((SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) / COUNT(cc.id)) * 100, 1) AS approval_rate
        FROM committees c
        LEFT JOIN committee_folders cf ON cf.committee_id = c.id
        LEFT JOIN committee_contents cc ON cc.folder_id = cf.id
        WHERE c.id IN (
          SELECT DISTINCT committee_id 
          FROM committee_members 
          WHERE user_id = ?
        )
        GROUP BY c.id, c.name
        HAVING total_contents > 0
        ORDER BY approval_rate DESC, total_contents DESC
        LIMIT 10
      `;
      committeeStatsParams.push(userId);
    }

    const [committeeStatsRows] = await db.execute(committeeStatsSql, committeeStatsParams);

    // جلب الأداء الشهري
    let monthlyStatsSql, monthlyStatsParams = [];
    if (canViewAll) {
      monthlyStatsSql = `
        SELECT 
          DATE_FORMAT(c.created_at, '%Y-%m') AS month,
          COUNT(c.id) AS total_contents,
          SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents
        FROM contents c
        LEFT JOIN folders f ON f.id = c.folder_id
        WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(c.created_at, '%Y-%m')
        ORDER BY month ASC
      `;
    } else {
      monthlyStatsSql = `
        SELECT 
          DATE_FORMAT(c.created_at, '%Y-%m') AS month,
          COUNT(c.id) AS total_contents,
          SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents
        FROM contents c
        LEFT JOIN folders f ON f.id = c.folder_id
        WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND f.department_id IN (
            SELECT DISTINCT department_id 
            FROM user_departments 
            WHERE user_id = ?
          )
        GROUP BY DATE_FORMAT(c.created_at, '%Y-%m')
        ORDER BY month ASC
      `;
      monthlyStatsParams.push(userId);
    }

    const [monthlyStatsRows] = await db.execute(monthlyStatsSql, monthlyStatsParams);

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

    // ورقة إحصائيات الأقسام
    const departmentSheet = workbook.addWorksheet('إحصائيات الأقسام');
    
    // إضافة عنوان
    const deptTitleRow = departmentSheet.addRow(['إحصائيات الأقسام - تحليل المحتويات والاعتماد']);
    deptTitleRow.font = { bold: true, size: 18, color: { argb: 'FF2E86AB' } };
    deptTitleRow.alignment = { horizontal: 'center' };
    departmentSheet.mergeCells('A1:F1');
    
    // إضافة مسافة
    departmentSheet.addRow([]);
    
    // رؤوس الأعمدة
    const deptHeaders = departmentSheet.addRow([
      'اسم القسم',
      'إجمالي المحتويات',
      'المحتويات المعتمدة',
      'المحتويات بانتظار الاعتماد',
      'معدل الاعتماد (%)',
      'التقييم'
    ]);
    deptHeaders.font = { bold: true, size: 12 };
    deptHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    // دالة معالجة اسم القسم حسب اللغة
    function getDepartmentNameByLanguage(departmentNameData) {
      try {
        // إذا كان الاسم JSON يحتوي على اللغتين
        if (typeof departmentNameData === 'string' && departmentNameData.startsWith('{')) {
          const parsed = JSON.parse(departmentNameData);
          return parsed['ar'] || parsed['en'] || departmentNameData;
        }
        // إذا كان نص عادي
        return departmentNameData || 'غير معروف';
      } catch (error) {
        // في حالة فشل التحليل، إرجاع النص كما هو
        return departmentNameData || 'غير معروف';
      }
    }

    // بيانات الأقسام
    departmentStatsRows.forEach(row => {
      const rate = parseFloat(row.approval_rate) || 0;
      let evaluation = '';
      if (rate >= 80) evaluation = 'ممتاز';
      else if (rate >= 60) evaluation = 'جيد';
      else if (rate >= 40) evaluation = 'مقبول';
      else evaluation = 'يحتاج تحسين';
      
      departmentSheet.addRow([
        getDepartmentNameByLanguage(row.department_name),
        row.total_contents,
        row.approved_contents,
        row.pending_contents,
        `${rate}%`,
        evaluation
      ]);
    });
    
    // تنسيق ورقة الأقسام
    departmentSheet.columns.forEach(column => {
      column.width = 20;
    });
    
    // إضافة حدود للخلايا
    for (let i = 1; i <= departmentSheet.rowCount; i++) {
      const row = departmentSheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }

    // ورقة إحصائيات اللجان
    const committeeSheet = workbook.addWorksheet('إحصائيات اللجان');
    
    // إضافة عنوان
    const commTitleRow = committeeSheet.addRow(['إحصائيات اللجان - تحليل المحتويات والاعتماد']);
    commTitleRow.font = { bold: true, size: 18, color: { argb: 'FF2E86AB' } };
    commTitleRow.alignment = { horizontal: 'center' };
    committeeSheet.mergeCells('A1:G1');
    
    // إضافة مسافة
    committeeSheet.addRow([]);
    
    // رؤوس الأعمدة
    const commHeaders = committeeSheet.addRow([
      'اسم اللجنة',
      'إجمالي المحتويات',
      'المحتويات المعتمدة',
      'المحتويات بانتظار الاعتماد',
      'المحتويات المرفوضة',
      'معدل الاعتماد (%)',
      'التقييم'
    ]);
    commHeaders.font = { bold: true, size: 12 };
    commHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    // دالة معالجة اسم اللجنة حسب اللغة
    function getCommitteeNameByLanguage(committeeNameData) {
      try {
        // إذا كان الاسم object يحتوي على اللغتين
        if (typeof committeeNameData === 'object' && committeeNameData !== null) {
          // إذا كان object يحتوي على خصائص اللغة
          if (committeeNameData['ar']) {
            return committeeNameData['ar'];
          }
          if (committeeNameData['en']) {
            return committeeNameData['en'];
          }
          // إذا لم تكن هناك خصائص لغة، جرب الخصائص الأخرى
          if (committeeNameData.name) {
            return committeeNameData.name;
          }
          if (committeeNameData.title) {
            return committeeNameData.title;
          }
          if (committeeNameData.text) {
            return committeeNameData.text;
          }
          if (committeeNameData.value) {
            return committeeNameData.value;
          }
          // كحل أخير، إرجاع string representation
          const result = JSON.stringify(committeeNameData);
          return result;
        }
        // إذا كان الاسم JSON string يحتوي على اللغتين
        if (typeof committeeNameData === 'string' && committeeNameData.startsWith('{')) {
          const parsed = JSON.parse(committeeNameData);
          return parsed['ar'] || parsed['en'] || committeeNameData;
        }
        // إذا كان نص عادي
        return committeeNameData || 'غير معروف';
      } catch (error) {
        console.error('Error in getCommitteeNameByLanguage:', error);
        // في حالة فشل التحليل، إرجاع النص كما هو
        return String(committeeNameData) || 'غير معروف';
      }
    }

    // بيانات اللجان
    committeeStatsRows.forEach(row => {
      const rate = parseFloat(row.approval_rate) || 0;
      let evaluation = '';
      if (rate >= 80) evaluation = 'ممتاز';
      else if (rate >= 60) evaluation = 'جيد';
      else if (rate >= 40) evaluation = 'مقبول';
      else evaluation = 'يحتاج تحسين';
      
      committeeSheet.addRow([
        getCommitteeNameByLanguage(row.committee_name),
        row.total_contents,
        row.approved_contents,
        row.pending_contents,
        row.rejected_contents,
        `${rate}%`,
        evaluation
      ]);
    });
    
    // تنسيق ورقة اللجان
    committeeSheet.columns.forEach(column => {
      column.width = 18;
    });
    
    // إضافة حدود للخلايا
    for (let i = 1; i <= committeeSheet.rowCount; i++) {
      const row = committeeSheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }

    // ورقة الأداء الشهري
    const monthlySheet = workbook.addWorksheet('الأداء الشهري');
    
    // إضافة عنوان
    const monthTitleRow = monthlySheet.addRow(['الأداء الشهري - تحليل المحتويات على مدار 6 أشهر']);
    monthTitleRow.font = { bold: true, size: 18, color: { argb: 'FF2E86AB' } };
    monthTitleRow.alignment = { horizontal: 'center' };
    monthlySheet.mergeCells('A1:E1');
    
    // إضافة مسافة
    monthlySheet.addRow([]);
    
    // رؤوس الأعمدة
    const monthHeaders = monthlySheet.addRow([
      'الشهر',
      'إجمالي المحتويات',
      'المحتويات المعتمدة',
      'المحتويات بانتظار الاعتماد',
      'معدل الاعتماد (%)'
    ]);
    monthHeaders.font = { bold: true, size: 12 };
    monthHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F8FF' }
    };
    
    // بيانات الأداء الشهري
    monthlyStatsRows.forEach(row => {
      const total = row.total_contents || 0;
      const approved = row.approved_contents || 0;
      const rate = total > 0 ? ((approved / total) * 100).toFixed(1) : 0;
      
      // تنسيق الشهر
      const [year, month] = row.month.split('-');
      const monthName = new Date(year, month - 1).toLocaleDateString('ar-SA', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      monthlySheet.addRow([
        monthName,
        total,
        approved,
        row.pending_contents || 0,
        `${rate}%`
      ]);
    });
    
    // تنسيق ورقة الأداء الشهري
    monthlySheet.columns.forEach(column => {
      column.width = 22;
    });
    
    // إضافة حدود للخلايا
    for (let i = 1; i <= monthlySheet.rowCount; i++) {
      const row = monthlySheet.getRow(i);
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

const getDepartmentStats = async (req, res) => {
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
            d.name AS department_name,
            COUNT(c.id) AS total_contents,
            SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
            SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents,
            ROUND((SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) / COUNT(c.id)) * 100, 1) AS approval_rate
          FROM departments d
          LEFT JOIN folders f ON f.department_id = d.id
          LEFT JOIN contents c ON c.folder_id = f.id
          GROUP BY d.id, d.name
          HAVING total_contents > 0
          ORDER BY approval_rate DESC, total_contents DESC
          LIMIT 10
        `;
      } else {
        sql = `
          SELECT
            d.name AS department_name,
            COUNT(c.id) AS total_contents,
            SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
            SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents,
            ROUND((SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) / COUNT(c.id)) * 100, 1) AS approval_rate
          FROM departments d
          LEFT JOIN folders f ON f.department_id = d.id
          LEFT JOIN contents c ON c.folder_id = f.id
          WHERE d.id IN (
            SELECT DISTINCT department_id
            FROM user_departments
            WHERE user_id = ?
          )
          GROUP BY d.id, d.name
          HAVING total_contents > 0
          ORDER BY approval_rate DESC, total_contents DESC
          LIMIT 10
        `;
        params.push(userId);
      }

    const [rows] = await db.execute(sql, params);
    return res.status(200).json({ status: 'success', data: rows });

  } catch (err) {
    console.error('getDepartmentStats error:', err);
    res.status(500).json({ message: 'Error getting department statistics.' });
  }
};

const getCommitteeStats = async (req, res) => {
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
            c.name AS committee_name,
            COUNT(cc.id) AS total_contents,
            SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) AS approved_contents,
            SUM(CASE WHEN cc.approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_contents,
            SUM(CASE WHEN cc.approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_contents,
            ROUND((SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) / COUNT(cc.id)) * 100, 1) AS approval_rate
          FROM committees c
          LEFT JOIN committee_folders cf ON cf.committee_id = c.id
          LEFT JOIN committee_contents cc ON cc.folder_id = cf.id
          GROUP BY c.id, c.name
          HAVING total_contents > 0
          ORDER BY approval_rate DESC, total_contents DESC
          LIMIT 10
        `;
      } else {
        sql = `
          SELECT
            c.name AS committee_name,
            COUNT(cc.id) AS total_contents,
            SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) AS approved_contents,
            SUM(CASE WHEN cc.approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_contents,
            SUM(CASE WHEN cc.approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_contents,
            ROUND((SUM(CASE WHEN cc.approval_status = 'approved' THEN 1 ELSE 0 END) / COUNT(cc.id)) * 100, 1) AS approval_rate
          FROM committees c
          LEFT JOIN committee_folders cf ON cf.committee_id = c.id
          LEFT JOIN committee_contents cc ON cc.folder_id = cf.id
          WHERE c.id IN (
            SELECT DISTINCT committee_id
            FROM committee_members
            WHERE user_id = ?
          )
          GROUP BY c.id, c.name
          HAVING total_contents > 0
          ORDER BY approval_rate DESC, total_contents DESC
          LIMIT 10
        `;
        params.push(userId);
      }

    const [rows] = await db.execute(sql, params);
    return res.status(200).json({ status: 'success', data: rows });

  } catch (err) {
    console.error('getCommitteeStats error:', err);
    res.status(500).json({ message: 'Error getting committee statistics.' });
  }
};

const getMonthlyPerformance = async (req, res) => {
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
          DATE_FORMAT(c.created_at, '%Y-%m') AS month,
          COUNT(c.id) AS total_contents,
          SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents,
          ROUND((SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) / COUNT(c.id)) * 100, 1) AS approval_rate
        FROM contents c
        WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(c.created_at, '%Y-%m')
        ORDER BY month ASC
      `;
    } else {
      sql = `
        SELECT 
          DATE_FORMAT(c.created_at, '%Y-%m') AS month,
          COUNT(c.id) AS total_contents,
          SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) AS approved_contents,
          SUM(CASE WHEN c.is_approved = 0 THEN 1 ELSE 0 END) AS pending_contents,
          ROUND((SUM(CASE WHEN c.is_approved = 1 THEN 1 ELSE 0 END) / COUNT(c.id)) * 100, 1) AS approval_rate
        FROM contents c
        JOIN folders f ON c.folder_id = f.id
        WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND f.department_id IN (
            SELECT DISTINCT department_id 
            FROM user_departments 
            WHERE user_id = ?
          )
        GROUP BY DATE_FORMAT(c.created_at, '%Y-%m')
        ORDER BY month ASC
      `;
      params.push(userId);
    }

    const [rows] = await db.execute(sql, params);
    return res.status(200).json({ status: 'success', data: rows });

  } catch (err) {
    console.error('getMonthlyPerformance error:', err);
    res.status(500).json({ message: 'Error getting monthly performance.' });
  }
};

module.exports = { getStats, getClosedWeek, exportDashboardExcel, getDepartmentStats, getCommitteeStats, getMonthlyPerformance };
