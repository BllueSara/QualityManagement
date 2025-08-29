const mysql = require('mysql2/promise');
const performanceConfig = require('./performance');

// إعدادات قاعدة البيانات محسنة للأداء
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'Quality',

  // إعدادات محسنة للأداء
  waitForConnections: true,
  connectionLimit: performanceConfig.database.connectionLimit, // 25 اتصال متزامن
  queueLimit: performanceConfig.database.queueLimit,

  // إعدادات محسنة للاستعلامات
  acquireTimeout: performanceConfig.database.acquireTimeout, // 30 ثانية
  timeout: performanceConfig.database.timeout, // 30 ثانية
  reconnect: true,

  // إعدادات محسنة للذاكرة
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',

  // إعدادات محسنة للأداء
  multipleStatements: false, // أمان أفضل
  dateStrings: true, // تحسين معالجة التواريخ

  // إعدادات محسنة للاتصال
  connectTimeout: 30000, // تقليل وقت الاتصال
  enableKeepAlive: performanceConfig.database.enableKeepAlive,
  keepAliveInitialDelay: performanceConfig.database.keepAliveInitialDelay,

  // إعدادات محسنة للاستعلامات
  namedPlaceholders: true,
  decimalNumbers: true,

  // إعدادات محسنة للذاكرة
  maxIdle: 30000, // تقليل وقت الخمول
  idleTimeout: 30000 // تقليل وقت الخمول
};

// إنشاء pool محسن للأداء
const pool = mysql.createPool(dbConfig);

// دالة للحصول على اتصال من الـ pool
const getConnection = async () => {
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('Error getting database connection:', error);
    throw error;
  }
};

// دالة لتنفيذ استعلام مع إدارة الاتصال تلقائياً
const executeQuery = async (sql, params = []) => {
  let connection;
  try {
    connection = await getConnection();
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// دالة لتنفيذ استعلام مع إدارة الاتصال تلقائياً (مع إرجاع النتائج كاملة)
const executeQueryWithRows = async (sql, params = []) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows, fields] = await connection.execute(sql, params);
    return { rows, fields };
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// دالة لبدء transaction
const beginTransaction = async () => {
  const connection = await getConnection();
  await connection.beginTransaction();
  return connection;
};

// دالة لتنفيذ استعلام في transaction
const executeInTransaction = async (connection, sql, params = []) => {
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error executing transaction query:', error);
    throw error;
  }
};

// دالة لcommit transaction
const commitTransaction = async (connection) => {
  try {
    await connection.commit();
  } catch (error) {
    console.error('Error committing transaction:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// دالة لrollback transaction
const rollbackTransaction = async (connection) => {
  try {
    await connection.rollback();
  } catch (error) {
    console.error('Error rolling back transaction:', error);
  } finally {
    connection.release();
  }
};

// دالة لإغلاق الـ pool
const closePool = async () => {
  try {
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// دالة لفحص حالة الاتصال
const checkConnection = async () => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
};

module.exports = {
  pool,
  getConnection,
  executeQuery,
  executeQueryWithRows,
  beginTransaction,
  executeInTransaction,
  commitTransaction,
  rollbackTransaction,
  closePool,
  checkConnection,
  dbConfig
};
