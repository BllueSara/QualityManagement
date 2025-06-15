// utils/notificationUtils.js
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality'
});


async function insertNotification(userId, title, message, type = 'ticket') {
  await db.execute(
    `INSERT INTO notifications 
     (user_id, title, message, type, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [userId, title, message, type]
  );
}

module.exports = {
  insertNotification
};
