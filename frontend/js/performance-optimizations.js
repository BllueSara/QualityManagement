// تحسينات الأداء للفرونت إند
const PerformanceOptimizations = {
  // تخزين مؤقت للبيانات
  cache: new Map(),
  cacheTimeout: 5 * 60 * 1000, // 5 دقائق

  // دالة للحصول على البيانات من التخزين المؤقت
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  },

  // دالة لحفظ البيانات في التخزين المؤقت
  setCachedData(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  },

  // دالة لتنظيف التخزين المؤقت
  clearCache() {
    this.cache.clear();
  },

  // دالة لتحسين طلبات API
  async optimizedFetch(url, options = {}) {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  },

  // دالة لتحسين طلبات التوقيع
  async optimizedSignatureRequest(url, data) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      const endTime = Date.now();
      
      console.log(`✅ التوقيع مكتمل في ${endTime - startTime}ms`);
      
      return result;
    } catch (error) {
      console.error('❌ خطأ في التوقيع:', error);
      throw error;
    }
  },

  // دالة لتحسين تحميل الصفحات
  preloadCriticalData() {
    // تحميل البيانات المهمة مسبقاً
    const criticalEndpoints = [
      'http://localhost:3006/api/auth/user-info',
      'http://localhost:3006/api/departments',
      'http://localhost:3006/api/permissions/definitions/permissions'
    ];

    criticalEndpoints.forEach(endpoint => {
      this.optimizedFetch(endpoint).catch(() => {
        // تجاهل الأخطاء في التحميل المسبق
      });
    });
  },

  // دالة لتحسين عرض النوافذ المنبثقة
  showOptimizedModal(content, options = {}) {
    // إزالة النوافذ المنبثقة السابقة
    const existingModals = document.querySelectorAll('.modal, .popup');
    existingModals.forEach(modal => modal.remove());

    // إنشاء نافذة منبثقة محسنة
    const modal = document.createElement('div');
    modal.className = 'modal optimized-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        ${content}
      </div>
    `;

    document.body.appendChild(modal);

    // إغلاق النافذة المنبثقة
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => modal.remove();

    // إغلاق عند النقر خارج النافذة
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    return modal;
  },

  // دالة لتحسين التحديثات
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // دالة لتحسين البحث
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// تطبيق التحسينات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  // تحميل البيانات المهمة مسبقاً
  PerformanceOptimizations.preloadCriticalData();
  
  // تنظيف التخزين المؤقت كل 10 دقائق
  setInterval(() => {
    PerformanceOptimizations.clearCache();
  }, 10 * 60 * 1000);
});

// تصدير للاستخدام في الملفات الأخرى
window.PerformanceOptimizations = PerformanceOptimizations;
