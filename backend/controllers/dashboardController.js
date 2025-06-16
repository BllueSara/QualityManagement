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
    // 1) خذ التوكن من الهيدر
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ status:'error', message:'Unauthorized' });
    }
    const token = auth.slice(7);
    // 2) فكّ التوكن وتحقّق منه
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId   = payload.id;
    const userRole = payload.role;

    // 3) جلب صلاحيات المستخدم
    const permsSet = await getUserPerms(userId);
    const canViewAll = (userRole === 'admin') || permsSet.has('view_dashboard');

    // 4) اختر الاستعلام بناءً على الصلاحية
let sql, params = [];
if (canViewAll) {
  sql = `
    SELECT
      COUNT(DISTINCT CASE WHEN ta.status = 'rejected'         THEN t.id END) AS rejected,
      COUNT(DISTINCT CASE WHEN latest.status = 'مغلق'         THEN t.id END) AS closed,
      COUNT(DISTINCT CASE WHEN t.status IN ('جديد','قيد المراجعة') THEN t.id END) AS current,
      -- التعديل هنا: نعد التذاكر التي آخر حالتها "جديد"
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
return res.status(200).json({ status:'success', data: rows[0] });


  } catch (err) {
    // console.error('getStats error:', err);
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

module.exports = { getStats, getClosedWeek };
