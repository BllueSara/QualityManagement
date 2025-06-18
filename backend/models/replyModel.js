const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

class Reply {
static async create({ ticketId, text, authorId }) {
  try {
    console.log('📥 Params:', { ticketId, text, authorId });

    const [result] = await pool.execute(
      'INSERT INTO ticket_replies (ticket_id, text, author_id) VALUES (?, ?, ?)',
      [ticketId, text, authorId]
    );
    return result.insertId;
  } catch (error) {
    console.error('Error creating reply:', error);
    throw new Error('Failed to create reply.');
  }
}

}

module.exports = Reply; 