document.addEventListener('DOMContentLoaded', () => {
  const fromDateInput    = document.getElementById('from-date');
  const toDateInput      = document.getElementById('to-date');
  const actionTypeSelect = document.getElementById('action-type');
  const userNameSelect   = document.getElementById('user-name');
  const searchInput      = document.getElementById('search-input');
  const logsBody         = document.getElementById('logs-body');

  function authHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // دالة للحصول على الترجمة
  function getTranslation(key) {
    const lang = localStorage.getItem('language') || 'ar';
    const translations = window.translations || {};
    return translations[lang]?.[key] || key;
  }

  // دالة لمعالجة البيانات واستخراج النص الصحيح
  function extractTextFromData(data) {
    if (typeof data === 'string') {
      // محاولة تحليل JSON إذا كان النص يبدو كـ JSON
      if (data.startsWith('{') && data.endsWith('}')) {
        try {
          const parsed = JSON.parse(data);
          const lang = localStorage.getItem('language') || 'ar';
          return parsed[lang] || parsed['ar'] || parsed['en'] || data;
        } catch (e) {
          return data;
        }
      }
      return data;
    } else if (typeof data === 'object' && data !== null) {
      // إذا كان object، محاولة استخراج النص باللغة المناسبة
      const lang = localStorage.getItem('language') || 'ar';
      return data[lang] || data['ar'] || data['en'] || JSON.stringify(data);
    }
    return data || '';
  }

  // دالة لمعالجة النصوص ثنائية اللغة في الوصف
  function processBilingualText(text) {
    if (typeof text !== 'string') return text;
    
    const lang = localStorage.getItem('language') || 'ar';
    
    // إذا كان النص يحتوي على JSON، حاول تحليله أولاً
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        return parsed[lang] || parsed['ar'] || parsed['en'] || text;
      } catch (e) {
        // إذا فشل التحليل، استمر مع المعالجة العادية
      }
    }
    
    // البحث عن أنماط JSON مختلفة في النص
    const jsonPatterns = [
      /\{[^{}]*"ar"[^{}]*"en"[^{}]*\}/g,
      /\{[^{}]*"en"[^{}]*"ar"[^{}]*\}/g,
      /\{[^{}]*"ar"[^{}]*\}/g,
      /\{[^{}]*"en"[^{}]*\}/g
    ];
    
    let processedText = text;
    
    jsonPatterns.forEach(pattern => {
      const matches = processedText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          try {
            const parsed = JSON.parse(match);
            const translatedText = parsed[lang] || parsed['ar'] || parsed['en'] || match;
            processedText = processedText.replace(match, translatedText);
          } catch (e) {
            // إذا فشل التحليل، اترك النص كما هو
            console.log('DEBUG: Failed to parse JSON:', match, e);
          }
        });
      }
    });
    
    return processedText;
  }

  // دالة لاستخراج المعلومات من الوصف
  function extractInfoFromDescription(desc) {
    const info = {
      folderName: '',
      departmentName: '',
      oldName: '',
      newName: '',
      userName: '',
      newRole: '',
      contentName: ''
    };

    // استخراج اسم المجلد
    const folderMatch = desc.match(/مجلد باسم: ([^،]+)/);
    if (folderMatch) {
      info.folderName = folderMatch[1];
    }

    // استخراج اسم القسم
    const deptMatch = desc.match(/في قسم: ([^،]+)/);
    if (deptMatch) {
      info.departmentName = deptMatch[1];
    }

    // استخراج الأسماء القديمة والجديدة (للتعديل)
    const oldNewMatch = desc.match(/من: ([^إ]+) إلى: ([^،]+)/);
    if (oldNewMatch) {
      info.oldName = oldNewMatch[1].trim();
      info.newName = oldNewMatch[2].trim();
    }

    // استخراج اسم المستخدم
    const userMatch = desc.match(/للمستخدم: ([^،]+)/);
    if (userMatch) {
      info.userName = userMatch[1];
    }

    // استخراج الدور الجديد
    const roleMatch = desc.match(/إلى: ([^،]+)/);
    if (roleMatch) {
      info.newRole = roleMatch[1];
    }

    // استخراج اسم المحتوى
    const contentMatch = desc.match(/محتوى: ([^،]+)/);
    if (contentMatch) {
      info.contentName = contentMatch[1];
    }

    return info;
  }

  // دالة لترجمة رسائل السجلات
  function translateLogMessage(description, action, info) {
    const lang = localStorage.getItem('language') || 'ar';
    
    // Debug logging للمعلومات المستخرجة
    console.log('DEBUG: Original description:', description);
    console.log('DEBUG: Action:', action);
    console.log('DEBUG: Extracted info:', info);
    
    // تنظيف الوصف من النصوص المكررة
    let cleanDescription = description;
    if (typeof description === 'string') {
      // إزالة النصوص المكررة مثل "in department: قسم" أو "قسم in department"
      cleanDescription = description
        .replace(/in department:\s*([^،]+)/g, '') // إزالة "in department: قسم"
        .replace(/([^،]+)\s*in department/g, '') // إزالة "قسم in department"
        .replace(/\s+/g, ' ') // إزالة المسافات الزائدة
        .trim();
    }
    
    // ترجمة الرسائل حسب نوع الإجراء مع إضافة المعلومات المستخرجة
    const translations = {
      ar: {
        'create_folder': `تم إنشاء مجلد: ${info.folderName} في قسم: ${info.departmentName}`,
        'update_folder': `تم تعديل مجلد من: ${info.oldName} إلى: ${info.newName} في قسم: ${info.departmentName}`,
        'delete_folder': `تم حذف مجلد: ${info.folderName} من قسم: ${info.departmentName}`,
        'add_folder_name': `تمت إضافة اسم مجلد جديد للأقسام: ${info.folderName}`,
        'update_folder_name': `تم تعديل اسم مجلد للأقسام من: ${info.oldName} إلى: ${info.newName}`,
        'delete_folder_name': `تم حذف اسم مجلد للأقسام: ${info.folderName}`,
        'add_content': `تم إضافة محتوى: ${info.contentName} في مجلد: ${info.folderName}`,
        'update_content': `تم تعديل محتوى من: ${info.oldName} إلى: ${info.newName} في مجلد: ${info.folderName}`,
        'delete_content': `تم حذف محتوى: ${info.contentName} من مجلد: ${info.folderName}`,
        'add_department': `تم إضافة قسم جديد: ${info.departmentName}`,
        'update_department': `تم تعديل قسم من: ${info.oldName} إلى: ${info.newName}`,
        'delete_department': `تم حذف قسم: ${info.departmentName}`,
        'add_user': `تم إضافة مستخدم جديد: ${info.userName}`,
        'update_user': `تم تعديل مستخدم: ${info.userName}`,
        'delete_user': `تم حذف مستخدم: ${info.userName}`,
        'change_role': `تم تغيير دور المستخدم: ${info.userName} إلى: ${info.newRole}`,
        'login': 'تم تسجيل الدخول',
        
        'create_ticket': 'تم إنشاء تذكرة جديدة',
        'update_ticket': 'تم تعديل التذكرة',
        'delete_ticket': 'تم حذف التذكرة',
        'add_reply': 'تم إضافة رد على التذكرة',
        'approve_content': `تم اعتماد المحتوى: ${info.contentName}`,
        'reject_content': `تم رفض المحتوى: ${info.contentName}`,
        'sign_document': 'تم توقيع المستند',
        'delegate_signature': `تم تفويض التوقيع للمستخدم: ${info.userName}`
      },
      en: {
        'create_folder': `Created folder: ${info.folderName} in department: ${info.departmentName}`,
        'update_folder': `Updated folder from: ${info.oldName} to: ${info.newName} in department: ${info.departmentName}`,
        'delete_folder': `Deleted folder: ${info.folderName} from department: ${info.departmentName}`,
        'add_folder_name': `Added new folder name for departments: ${info.folderName}`,
        'update_folder_name': `Updated folder name for departments from: ${info.oldName} to: ${info.newName}`,
        'delete_folder_name': `Deleted folder name for departments: ${info.folderName}`,
        'add_content': `Added content: ${info.contentName} in folder: ${info.folderName}`,
        'update_content': `Updated content from: ${info.oldName} to: ${info.newName} in folder: ${info.folderName}`,
        'delete_content': `Deleted content: ${info.contentName} from folder: ${info.folderName}`,
        'add_department': `Added new department: ${info.departmentName}`,
        'update_department': `Updated department from: ${info.oldName} to: ${info.newName}`,
        'delete_department': `Deleted department: ${info.departmentName}`,
        'add_user': `Added new user: ${info.userName}`,
        'update_user': `Updated user: ${info.userName}`,
        'delete_user': `Deleted user: ${info.userName}`,
        'change_role': `Changed user role: ${info.userName} to: ${info.newRole}`,
        'login': 'User logged in',
        'create_ticket': 'Created new ticket',
        'update_ticket': 'Updated ticket',
        'delete_ticket': 'Deleted ticket',
        'add_reply': 'Added reply to ticket',
        'approve_content': `Approved content: ${info.contentName}`,
        'reject_content': `Rejected content: ${info.contentName}`,
        'sign_document': 'Signed document',
        'delegate_signature': `Delegated signature to user: ${info.userName}`
      }
    };

    // إذا كان الإجراء معروف، استخدم الترجمة
    if (translations[lang] && translations[lang][action]) {
      // التحقق من وجود المعلومات المطلوبة
      const hasRequiredInfo = Object.values(info).some(value => value && value.trim() !== '');
      if (hasRequiredInfo) {
        return translations[lang][action];
      } else {
        // إذا لم تكن هناك معلومات كافية، استخدم الوصف الأصلي المنظف
        console.log('DEBUG: No sufficient info for translation, using cleaned original description');
        return cleanDescription;
      }
    }

    // إذا لم يكن معروف، استخدم الوصف الأصلي المنظف
    return cleanDescription;
  }

  // دالة لترجمة أسماء الإجراءات
  function translateActionName(action) {
    const lang = localStorage.getItem('language') || 'ar';
    
    const actionTranslations = {
      ar: {
        'create_folder': 'إنشاء مجلد',
        'update_folder': 'تعديل مجلد',
        'delete_folder': 'حذف مجلد',
        'add_folder_name': 'إضافة اسم مجلد',
        'update_folder_name': 'تعديل اسم مجلد',
        'delete_folder_name': 'حذف اسم مجلد',
        'add_content': 'إضافة محتوى',
        'update_content': 'تعديل محتوى',
        'delete_content': 'حذف محتوى',
        'add_department': 'إضافة قسم',
        'update_department': 'تعديل قسم',
        'delete_department': 'حذف قسم',
        'add_user': 'إضافة مستخدم',
        'update_user': 'تعديل مستخدم',
        'delete_user': 'حذف مستخدم',
        'change_role': 'تغيير دور',
        'login': 'تسجيل دخول',
        'register_user': 'تسجيل مستخدم جديد',
        'create_ticket': 'إنشاء تذكرة',
        'update_ticket': 'تعديل تذكرة',
        'delete_ticket': 'حذف تذكرة',
        'add_reply': 'إضافة رد',
        'approve_content': 'اعتماد محتوى',
        'reject_content': 'رفض محتوى',
        'sign_document': 'توقيع مستند',
        'delegate_signature': 'تفويض توقيع'
      },
      en: {
        'create_folder': 'Create Folder',
        'update_folder': 'Update Folder',
        'delete_folder': 'Delete Folder',
        'add_folder_name': 'Add Folder Name',
        'update_folder_name': 'Update Folder Name',
        'delete_folder_name': 'Delete Folder Name',
        'add_content': 'Add Content',
        'update_content': 'Update Content',
        'delete_content': 'Delete Content',
        'add_department': 'Add Department',
        'update_department': 'Update Department',
        'delete_department': 'Delete Department',
        'add_user': 'Add User',
        'update_user': 'Update User',
        'delete_user': 'Delete User',
        'change_role': 'Change Role',
        'login': 'Login',
        'register_user': 'Register User',
        'create_ticket': 'Create Ticket',
        'update_ticket': 'Update Ticket',
        'delete_ticket': 'Delete Ticket',
        'add_reply': 'Add Reply',
        'approve_content': 'Approve Content',
        'reject_content': 'Reject Content',
        'sign_document': 'Sign Document',
        'delegate_signature': 'Delegate Signature'
      }
    };

    return actionTranslations[lang] && actionTranslations[lang][action] 
      ? actionTranslations[lang][action] 
      : action;
  }

  // دالة لترجمة أنواع الإجراءات
  function translateActionTypes() {
    const lang = localStorage.getItem('language') || 'ar';
    
    const actionTypeTranslations = {
      ar: {
        'all-actions': 'جميع الإجراءات',
        'create_folder': 'إنشاء مجلد',
        'update_folder': 'تعديل مجلد',
        'delete_folder': 'حذف مجلد',
        'add_folder_name': 'إضافة اسم مجلد',
        'update_folder_name': 'تعديل اسم مجلد',
        'delete_folder_name': 'حذف اسم مجلد',
        'add_content': 'إضافة محتوى',
        'update_content': 'تعديل محتوى',
        'delete_content': 'حذف محتوى',
        'add_department': 'إضافة قسم',
        'update_department': 'تعديل قسم',
        'delete_department': 'حذف قسم',
        'add_user': 'إضافة مستخدم',
        'update_user': 'تعديل مستخدم',
        'delete_user': 'حذف مستخدم',
        'change_role': 'تغيير دور',
        'login': 'تسجيل دخول',
        'create_ticket': 'إنشاء تذكرة',
        'update_ticket': 'تعديل تذكرة',
        'delete_ticket': 'حذف تذكرة',
        'add_reply': 'إضافة رد',
        'approve_content': 'اعتماد محتوى',
        'reject_content': 'رفض محتوى',
        'sign_document': 'توقيع مستند',
        'delegate_signature': 'تفويض توقيع'
      },
      en: {
        'all-actions': 'All Actions',
        'create_folder': 'Create Folder',
        'update_folder': 'Update Folder',
        'delete_folder': 'Delete Folder',
        'add_folder_name': 'Add Folder Name',
        'update_folder_name': 'Update Folder Name',
        'delete_folder_name': 'Delete Folder Name',
        'add_content': 'Add Content',
        'update_content': 'Update Content',
        'delete_content': 'Delete Content',
        'add_department': 'Add Department',
        'update_department': 'Update Department',
        'delete_department': 'Delete Department',
        'add_user': 'Add User',
        'update_user': 'Update User',
        'delete_user': 'Delete User',
        'change_role': 'Change Role',
        'login': 'Login',
        'create_ticket': 'Create Ticket',
        'update_ticket': 'Update Ticket',
        'delete_ticket': 'Delete Ticket',
        'add_reply': 'Add Reply',
        'approve_content': 'Approve Content',
        'reject_content': 'Reject Content',
        'sign_document': 'Sign Document',
        'delegate_signature': 'Delegate Signature'
      }
    };

    // تحديث النص الافتراضي
    const defaultOption = actionTypeSelect.querySelector('option[value=""]');
    if (defaultOption) {
      defaultOption.textContent = actionTypeTranslations[lang]['all-actions'] || 'All Actions';
    }

    // تحديث باقي الخيارات
    actionTypeSelect.querySelectorAll('option').forEach(option => {
      if (option.value && actionTypeTranslations[lang][option.value]) {
        option.textContent = actionTypeTranslations[lang][option.value];
      }
    });
  }

  // دالة لتحديث النصوص بناءً على اللغة
  function updatePageTexts() {
    const lang = localStorage.getItem('language') || 'ar';
    
    // تحديث عناصر HTML
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      const translation = getTranslation(key);
      if (translation && translation !== key) {
        element.textContent = translation;
      }
    });

    // تحديث placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
      const key = element.getAttribute('data-translate-placeholder');
      const translation = getTranslation(key);
      if (translation && translation !== key) {
        element.placeholder = translation;
      }
    });

    // تحديث اتجاه النص للعناصر
    document.querySelectorAll('input, select, textarea').forEach(element => {
      if (lang === 'ar') {
        element.style.direction = 'rtl';
        element.style.textAlign = 'right';
      } else {
        element.style.direction = 'ltr';
        element.style.textAlign = 'left';
      }
    });

    // ترجمة أنواع الإجراءات
    translateActionTypes();
  }

  async function loadLogs() {
    const params = new URLSearchParams();
    if (fromDateInput.value)    params.append('from', fromDateInput.value);
    if (toDateInput.value)      params.append('to', toDateInput.value);
    if (actionTypeSelect.value) params.append('action', actionTypeSelect.value);
    if (userNameSelect.value)   params.append('user', userNameSelect.value);
    if (searchInput.value)      params.append('search', searchInput.value);
    
    // إضافة لغة المستخدم
    const userLanguage = localStorage.getItem('language') || 'ar';
    params.append('lang', userLanguage);

    try {
      const res = await fetch('http://localhost:3006/api/users/logs?' + params.toString(), {
        headers: authHeader()
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const json = await res.json();

      logsBody.innerHTML = '';

      if (json.data && Array.isArray(json.data)) {
        json.data.forEach(log => {
          const tr = document.createElement('tr');
          tr.dataset.date   = log.created_at;
          tr.dataset.user   = log.user;
          tr.dataset.action = log.action;

          // تحديد اللغة الحالية
          const lang = localStorage.getItem('language') || document.documentElement.lang || 'ar';
          const locale = lang === 'en' ? 'en-US' : 'ar-SA';

          // معالجة البيانات باستخدام الدالة الجديدة
          const user = extractTextFromData(log.user) || '-';
          let description = extractTextFromData(log.description) || '';
          const action = extractTextFromData(log.action) || '';

          // معالجة النصوص ثنائية اللغة
          const processedUser = processBilingualText(user);
          let processedDescription = processBilingualText(description);

          // تنظيف الوصف من النصوص المكررة
          if (typeof processedDescription === 'string') {
            processedDescription = processedDescription
              .replace(/in department:\s*([^،]+)/g, '') // إزالة "in department: قسم"
              .replace(/([^،]+)\s*in department/g, '') // إزالة "قسم in department"
              .replace(/\s+/g, ' ') // إزالة المسافات الزائدة
              .trim();
          }

          // استخدام المعلومات المستخرجة من الباك اند إذا كانت متوفرة
          let info = {};
          if (log.extracted_info) {
            info = log.extracted_info;
            // تنظيف المعلومات المستخرجة أيضاً
            Object.keys(info).forEach(key => {
              if (info[key] && typeof info[key] === 'string') {
                info[key] = processBilingualText(info[key]);
                info[key] = info[key]
                  .replace(/in department:\s*([^،]+)/g, '')
                  .replace(/([^،]+)\s*in department/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
              }
            });
            console.log('DEBUG: Using backend extracted info:', info);
          } else {
            // استخراج المعلومات من الوصف إذا لم تكن متوفرة من الباك اند
            info = extractInfoFromDescription(processedDescription);
            // معالجة النصوص ثنائية اللغة في المعلومات المستخرجة
            Object.keys(info).forEach(key => {
              if (info[key]) {
                info[key] = processBilingualText(info[key]);
                if (typeof info[key] === 'string') {
                  info[key] = info[key]
                    .replace(/in department:\s*([^،]+)/g, '')
                    .replace(/([^،]+)\s*in department/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
              }
            });
            console.log('DEBUG: Using frontend extracted info:', info);
          }

          // التحقق من صحة المعلومات المستخرجة
          const hasValidInfo = Object.values(info).some(value => 
            value && 
            value.trim() !== '' && 
            value !== '[object Object]' && 
            !value.includes('undefined')
          );
          
          if (!hasValidInfo) {
            console.log('DEBUG: No valid info extracted, using original description');
            info = {};
          }

          // التحقق من أن الوصف الأصلي صحيح
          if (processedDescription.includes('[object Object]') || 
              processedDescription.includes('undefined') ||
              processedDescription.trim() === '') {
            console.log('DEBUG: Invalid original description, using fallback');
            processedDescription = getTranslation('log-' + action) || action;
          }

          // ترجمة رسالة السجل واسم الإجراء
          const translatedDescription = translateLogMessage(processedDescription, action, info);
          const translatedAction = translateActionName(action);

          // Debug logging
          if (description.includes('[object Object]')) {
            console.log('DEBUG: Original description:', log.description);
            console.log('DEBUG: Extracted description:', description);
          }

          tr.innerHTML = `
            <td>${processedUser}</td>
            <td>${translatedDescription}</td>
            <td>${new Date(log.created_at).toLocaleString(locale)}</td>
            <td><span class="action-text">${translatedAction}</span></td>
          `;
          logsBody.appendChild(tr);
        });
      } else {
        // عرض رسالة إذا لم تكن هناك بيانات
        logsBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 20px;">
              ${getTranslation('no-logs-found') || 'لا توجد سجلات'}
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      logsBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 20px; color: red;">
            ${getTranslation('error-loading-logs') || 'خطأ في تحميل السجلات'}
          </td>
        </tr>
      `;
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch('http://localhost:3006/api/users?roles', { headers: authHeader() });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const json = await res.json();
      
      if (json.data && Array.isArray(json.data)) {
        json.data.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.name;
          opt.textContent = u.name;
          userNameSelect.appendChild(opt);
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  async function fetchActionTypes() {
    try {
      const res = await fetch('http://localhost:3006/api/users/action-types', { headers: authHeader() });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const json = await res.json();
      
      if (json.data && Array.isArray(json.data)) {
        // مسح الخيارات الحالية (باستثناء الخيار الافتراضي)
        const defaultOption = actionTypeSelect.querySelector('option[value=""]');
        actionTypeSelect.innerHTML = '';
        if (defaultOption) {
          actionTypeSelect.appendChild(defaultOption);
        }
        
        // إضافة الخيارات الجديدة
        json.data.forEach(actionType => {
          const opt = document.createElement('option');
          opt.value = actionType.action;
          opt.textContent = translateActionName(actionType.action);
          actionTypeSelect.appendChild(opt);
        });
      }
    } catch (error) {
      console.error('Error fetching action types:', error);
    }
  }

  // ✅ فلترة مباشرة عند التغيير
  [fromDateInput, toDateInput, actionTypeSelect, userNameSelect].forEach(el => {
    el.addEventListener('change', loadLogs);
  });

  searchInput.addEventListener('input', () => {
    setTimeout(loadLogs, 300); // قليل من التأخير لتحسين التجربة
  });

  // مراقبة تغيير اللغة
  window.addEventListener('languageChanged', () => {
    updatePageTexts();
    loadLogs(); // إعادة تحميل السجلات لتحديث التواريخ
  });

  // أول تحميل
  updatePageTexts();
  fetchUsers();
  fetchActionTypes();
  loadLogs();
});
