// إعدادات الأداء المحسنة للنظام
const performanceConfig = {
  // إعدادات قاعدة البيانات
  database: {
    connectionLimit: 25, // زيادة عدد الاتصالات المتزامنة
    acquireTimeout: 30000, // تقليل وقت الانتظار للحصول على اتصال
    timeout: 30000, // تقليل وقت الانتظار للاستعلامات
    queueLimit: 0, // عدم تحديد حد للطابور
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  },

  // إعدادات PDF
  pdf: {
    maxConcurrentGenerations: 3, // عدد عمليات توليد PDF المتزامنة
    generationTimeout: 60000, // وقت أقصى لتوليد PDF
    useBackgroundProcessing: true // استخدام المعالجة في الخلفية
  },

  // إعدادات الإشعارات
  notifications: {
    batchSize: 10, // عدد الإشعارات المرسلة في الدفعة الواحدة
    sendInBackground: true, // إرسال الإشعارات في الخلفية
    retryAttempts: 2 // عدد محاولات إعادة الإرسال
  },

  // إعدادات التخزين المؤقت
  cache: {
    enabled: true,
    ttl: 300, // 5 دقائق
    maxSize: 1000 // عدد العناصر المخزنة مؤقتاً
  },

  // إعدادات الاستعلامات
  queries: {
    maxExecutionTime: 10000, // 10 ثواني كحد أقصى
    useIndexes: true,
    optimizeJoins: true
  }
};

module.exports = performanceConfig;
