const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// تقرير التذاكر المغلقة شهريًا
exports.getClosedTicketsReport = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const userRole = decoded.role;

    // جلب صلاحيات المستخدم
    const [permRows] = await db.execute(`
      SELECT p.permission_key
      FROM permissions p
      JOIN user_permissions up ON up.permission_id = p.id
      WHERE up.user_id = ?
    `, [userId]);
    const perms = new Set(permRows.map(r => r.permission_key));
    const canViewAll = userRole === 'admin' || userRole === 'manager_ovr' || perms.has('view_all_reports_tickets');
    const canViewOwn = perms.has('view_reports_by_person_tickets');

    // فلترة حسب الصلاحية
    let where = 'WHERE h.status = \'مغلق\'';
    let params = [];
    if (!canViewAll) {
      if (canViewOwn) {
        where += ' AND t.created_by = ?';
        params.push(userId);
      } else {
        return res.status(403).json({ status: 'error', message: 'ليس لديك صلاحية عرض تقارير الاحداث العارضة.' });
      }
    }
    // فلترة حسب الشهر والسنة إذا تم إرسالها
    const { month, year } = req.query;
    if (month) {
      where += ' AND MONTH(h.created_at) = ?';
      params.push(Number(month));
    }
    if (year) {
      where += ' AND YEAR(h.created_at) = ?';
      params.push(Number(year));
    }

    // جلب عدد التذاكر المغلقة لكل تصنيف ولكل شهر
    const sql = `
      SELECT
        tc.classification,
        MONTH(h.created_at) AS month,
        YEAR(h.created_at) AS year,
        COUNT(DISTINCT t.id) AS closed_count
      FROM tickets t
      JOIN ticket_status_history h ON h.ticket_id = t.id
      JOIN ticket_classifications tc ON tc.ticket_id = t.id
      ${where}
      GROUP BY tc.classification, year, month
      ORDER BY year DESC, month DESC, tc.classification
    `;
    const [rows] = await db.execute(sql, params);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('getClosedTicketsReport error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب تقرير الاحداث العارضة.' });
  }
}; 