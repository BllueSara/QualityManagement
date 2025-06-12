// controllers/dashboardController.js
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});

/**
 * Fetch summary statistics for tickets
 */
const getStats = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        SUM(ta.status = 'rejected')                AS rejected,
        SUM(latest.status = 'مغلق')                AS closed,
        SUM(t.status IN ('جديد','قيد المراجعة'))   AS current,
        SUM(DATE(t.created_at) = CURDATE())         AS new_tickets
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
    `);

    res.status(200).json({
      status: 'success',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء جلب إحصائيات لوحة القيادة'
    });
  }
};
const getClosedWeek = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        DATE(h.created_at) AS date,
        COUNT(*)           AS closed_count
      FROM ticket_status_history h
      WHERE h.status = 'مغلق'
        AND h.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(h.created_at)
      ORDER BY DATE(h.created_at) ASC
    `);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching closed-week data:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء جلب بيانات التذاكر المغلقة'
    });
  }
};

module.exports = {
  getStats,
  getClosedWeek
};