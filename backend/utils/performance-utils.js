// أدوات تحسين الأداء للباك إند
const performanceUtils = {
  // قياس وقت التنفيذ
  measureExecutionTime: (fn, label = 'Function') => {
    const start = Date.now();
    const result = fn();
    const end = Date.now();
    console.log(`⚡ ${label} executed in ${end - start}ms`);
    return result;
  },

  // قياس وقت التنفيذ للدوال غير المتزامنة
  measureAsyncExecutionTime: async (fn, label = 'Async Function') => {
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    console.log(`⚡ ${label} executed in ${end - start}ms`);
    return result;
  },

  // تحسين الاستعلامات
  optimizeQuery: (query, params = []) => {
    console.log(`🔍 Executing optimized query: ${query.substring(0, 100)}...`);
    return { query, params };
  },

  // تحسين الإشعارات
  sendNotificationAsync: async (userId, title, message, type, referenceId) => {
    process.nextTick(async () => {
      try {
        const { insertNotification } = require('../models/notfications-utils');
        await insertNotification(userId, title, message, type, referenceId);
      } catch (error) {
        console.error('Notification error:', error);
      }
    });
  },

  // تحسين توليد PDF
  generatePDFAsync: async (generateFunction, ...args) => {
    process.nextTick(async () => {
      try {
        await generateFunction(...args);
      } catch (error) {
        console.error('PDF generation error:', error);
      }
    });
  },

  // تحسين العمليات المتزامنة
  executeConcurrently: async (tasks) => {
    const start = Date.now();
    const results = await Promise.all(tasks);
    const end = Date.now();
    console.log(`⚡ Concurrent tasks executed in ${end - start}ms`);
    return results;
  },

  // تحسين التخزين المؤقت
  cache: new Map(),
  cacheTimeout: 5 * 60 * 1000, // 5 دقائق

  getCachedData: (key) => {
    const cached = performanceUtils.cache.get(key);
    if (cached && Date.now() - cached.timestamp < performanceUtils.cacheTimeout) {
      return cached.data;
    }
    return null;
  },

  setCachedData: (key, data) => {
    performanceUtils.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  },

  clearCache: () => {
    performanceUtils.cache.clear();
  },

  // تحسين استعلامات قاعدة البيانات
  optimizedDbQuery: async (db, query, params = []) => {
    const start = Date.now();
    try {
      const result = await db.execute(query, params);
      const end = Date.now();
      console.log(`⚡ DB Query executed in ${end - start}ms`);
      return result;
    } catch (error) {
      console.error('DB Query error:', error);
      throw error;
    }
  },

  // تحسين العمليات المجمعة
  batchProcess: async (items, processFunction, batchSize = 10) => {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results = [];
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(item => processFunction(item))
      );
      results.push(...batchResults);
    }

    return results;
  },

  // تحسين العمليات المتسلسلة
  sequentialProcess: async (items, processFunction) => {
    const results = [];
    for (const item of items) {
      const result = await processFunction(item);
      results.push(result);
    }
    return results;
  },

  // تحسين العمليات مع إعادة المحاولة
  retryOperation: async (operation, maxRetries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.log(`Retry attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  },

  // تحسين العمليات مع timeout
  withTimeout: async (promise, timeoutMs = 10000) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  },

  // تحسين العمليات مع التقدم
  withProgress: async (items, processFunction, progressCallback) => {
    const results = [];
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
      const result = await processFunction(items[i]);
      results.push(result);
      
      if (progressCallback) {
        const progress = ((i + 1) / total) * 100;
        progressCallback(progress, i + 1, total);
      }
    }

    return results;
  }
};

// تنظيف التخزين المؤقت كل 10 دقائق
setInterval(() => {
  performanceUtils.clearCache();
}, 10 * 60 * 1000);

module.exports = performanceUtils;
