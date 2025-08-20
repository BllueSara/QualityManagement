const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// جلب تقارير الاعتمادات (القسم + اللجنة)
exports.getApprovalsReports = async (req, res) => {
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
      WHERE up.user_id = ? AND p.deleted_at IS NULL
    `, [userId]);
    const perms = new Set(permRows.map(r => r.permission_key));
    const canViewAll = userRole === 'admin' || userRole === 'super_admin' || perms.has('view_all_reports_approvals');
    const canViewOwn = perms.has('view_reports_by_person_approvals');

    // استعلام تقارير القسم فقط مع startDate و endDate من جدول contents
    let deptWhere = '';
    let deptParams = [];
    if (!canViewAll) {
      if (canViewOwn) {
        deptWhere = 'WHERE c.created_by = ?';
        deptParams = [userId];
      } else {
        // لا يملك صلاحية
        return res.status(403).json({ status: 'error', message: 'ليس لديك صلاحية عرض التقارير.' });
      }
    }
    const deptQuery = `
      SELECT
        c.id,
        c.title AS fileName,
        d.name AS department,
        c.start_date AS startDate,
        c.end_date AS endDate,
        'department' AS type
      FROM contents c
      JOIN folders f ON c.folder_id = f.id
      LEFT JOIN departments d ON f.department_id = d.id
      WHERE c.deleted_at IS NULL AND f.deleted_at IS NULL ${deptWhere ? 'AND ' + deptWhere.replace('WHERE ', '') : ''}
    `;

    // تنفيذ الاستعلام
    const [deptRows] = await db.execute(deptQuery, deptParams);

    // ترتيب النتائج
    deptRows.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    res.json({ status: 'success', data: deptRows });
  } catch (err) {
    console.error('getApprovalsReports error:', err);
    res.status(500).json({ status: 'error', message: 'فشل جلب تقارير الاعتمادات.' });
  }
}; 