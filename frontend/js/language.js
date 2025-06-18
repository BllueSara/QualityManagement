// Language translations
const translations = {
    ar: {
        // Navigation
        'home': 'الرئيسية',
        'account': 'الحساب',
        'logs': 'السجلات',
        'notifications': 'الإشعارات',
        'language': 'عربي',
        
        // Main content
        'main-title': 'الصفحة الرئيسية',
        'tickets': 'التذاكر',
        'departments': 'الأقسام',
        'statistics': 'الإحصائيات',
        'approvals': 'الإعتمادات',
        'permissions': 'الصلاحيات',
        'committees': 'اللجان والواجهات',
        'click-to-enter': 'اضغط للدخول',
        
        // System title
        'system-title': 'نظام إدارة الجودة والسلامة',

        // Login & Register
        'login': 'تسجيل الدخول',
        'login-description': 'يرجى إدخال بيانات الدخول الخاصة بك',
        'register': 'إنشاء حساب',
        'forgot-password': 'نسيت كلمة المرور؟',
        'reset-password': 'إعادة تعيين كلمة المرور',
        'email': 'البريد الإلكتروني',
        'password': 'كلمة المرور',
        'confirm-password': 'تأكيد كلمة المرور',
        'name': 'الاسم',
        'username': 'اسم المستخدم',
        'submit': 'إرسال',
        'back-to-login': 'العودة لتسجيل الدخول',
        'no-account': 'ليس لديك حساب؟',
        'have-account': 'لديك حساب بالفعل؟',
        'register-description': 'أدخل بياناتك لإنشاء حساب جديد',


        // Dashboard
        'dashboard': 'لوحة التحكم',
        'total-tickets': 'إجمالي التذاكر',
        'pending-tickets': 'التذاكر المعلقة',
        'completed-tickets': 'التذاكر المكتملة',
        'total-departments': 'إجمالي الأقسام',
        'total-users': 'إجمالي المستخدمين',

        // Tickets
        'ticket-list': 'قائمة التذاكر',
        'ticket-details': 'تفاصيل التذكرة',
        'ticket-edit': 'تعديل التذكرة',
        'ticket-status': 'حالة التذكرة',
        'ticket-priority': 'أولوية التذكرة',
        'ticket-type': 'نوع التذكرة',
        'ticket-description': 'وصف التذكرة',
        'ticket-date': 'تاريخ التذكرة',
        'ticket-assigned': 'تم تعيينه إلى',
        'ticket-created': 'تم الإنشاء بواسطة',
        'ticket-updated': 'تم التحديث بواسطة',
        'ticket-comments': 'التعليقات',
        'add-comment': 'إضافة تعليق',
        'save': 'حفظ',
        'cancel': 'إلغاء',
        'delete': 'حذف',
        'edit': 'تعديل',
        'view': 'عرض',
        'create-ticket': 'إنشاء تذكرة جديدة',
        'pending': 'معلق',
        'in-progress': 'قيد التنفيذ',
        'completed': 'مكتمل',
        'cancelled': 'ملغي',

        // Departments
        'department-list': 'قائمة الأقسام',
        'department-details': 'تفاصيل القسم',
        'department-name': 'اسم القسم',
        'department-manager': 'مدير القسم',
        'department-members': 'أعضاء القسم',
        'add-department': 'إضافة قسم',
        'edit-department': 'تعديل القسم',

        // Approvals
        'approval-list': 'قائمة الاعتمادات',
        'approval-details': 'تفاصيل الاعتماد',
        'approval-status': 'حالة الاعتماد',
        'approval-type': 'نوع الاعتماد',
        'approval-date': 'تاريخ الاعتماد',
        'approval-requested': 'تم الطلب بواسطة',
        'approval-approved': 'تم الاعتماد بواسطة',
        'approval-rejected': 'تم الرفض بواسطة',
        'approval-comments': 'ملاحظات الاعتماد',
        'request-approval': 'طلب اعتماد',
        'approve': 'اعتماد',
        'reject': 'رفض',

        // Profile
        'profile': 'الملف الشخصي',
        'personal-info': 'المعلومات الشخصية',
        'change-password': 'تغيير كلمة المرور',
        'current-password': 'كلمة المرور الحالية',
        'new-password': 'كلمة المرور الجديدة',
        'update-profile': 'تحديث الملف الشخصي',
        

        // Notifications
        'notification-list': 'قائمة الإشعارات',
        'notification-details': 'تفاصيل الإشعار',
        'notification-date': 'تاريخ الإشعار',
        'notification-type': 'نوع الإشعار',
        'mark-as-read': 'تحديد كمقروء',
        'mark-all-read': 'تحديد الكل كمقروء',

        // Logs
        'log-list': 'قائمة السجلات',
        'log-details': 'تفاصيل السجل',
        'log-type': 'نوع السجل',
        'log-date': 'تاريخ السجل',
        'log-user': 'المستخدم',
        'log-action': 'الإجراء',
        'log-details': 'التفاصيل',

        // Permissions
        'permission-list': 'قائمة الصلاحيات',
        'permission-details': 'تفاصيل الصلاحية',
        'permission-name': 'اسم الصلاحية',
        'permission-description': 'وصف الصلاحية',
        'assign-permission': 'تعيين صلاحية',
        'remove-permission': 'إزالة صلاحية',

        // Register specific
        'employee-number': 'الرقم الوظيفي',
        'enter-employee-number': 'أدخل الرقم الوظيفي',
        'department': 'القسم',
        'select-department': 'اختر القسم',
        'add-new-department': 'إضافة قسم جديد',
        'department-name': 'اسم القسم',
        'enter-department-name': 'أدخل اسم القسم',
        'department-image': 'مسار الصورة',
        
        // Labels
        'identifier-label': 'اسم المستخدم / البريد / الرقم الوظيفي',
        
        // Placeholders
        'enter-username': 'اسم المستخدم / البريد / الرقم الوظيفي',
        'enter-email': 'name@moh.gov.sa',
        'enter-password': 'أدخل كلمة المرور',
        'confirm-password-placeholder': 'تأكيد كلمة المرور',

        // Departments modals and search
        'search-department': 'ابحث عن قسم',
        'delete-department-title': 'تأكيد حذف القسم',
        'delete-department-confirm': 'أنت متأكد من حذف هذا القسم؟',

        // Department content page and modals
        'department-content-title': 'محتويات القسم',
        'add-folder': 'إضافة مجلد+',
        'choose-folder-name': 'اختر اسم المجلد',
        'create': 'إنشاء',
        'add-content': 'إضافة محتوى للمجلد',
        'content-name': 'اسم المحتوى',
        'search-folder': 'ابحث عن مجلد',
        'search-content': 'ابحث عن محتوى',
        'search-content-name': 'ابحث عن اسم…',
        'add-content-name': '+ إضافة اسم جديد',
        'choose-file': 'اختر ملف لإرفاقه',
        'pdf-only': 'ملفات PDF فقط',
        'add': 'إضافة',
        'update': 'تحديث',
        'edit-folder': 'تعديل مجلد',
        'edit-content': 'تعديل محتوى للمجلد',
        'delete-folder-title': 'تأكيد حذف المجلد',
        'delete-folder-confirm': 'هل أنت متأكد أنك تريد حذف هذا المجلد؟ سيؤدي هذا إلى حذف جميع المحتويات بداخله.',
        'delete-content-title': 'تأكيد حذف المحتوى',
        'delete-content-confirm': 'هل أنت متأكد أنك تريد حذف هذا المحتوى؟',
        'folder-content-title': 'محتويات المجلد',
        'choose-from-list': 'اختر من القائمة...',
        'choose-name': 'اختر اسماً…',
        'file-upload-success': 'تم رفع الملف بنجاح',
        'file-upload-error': 'حدث خطأ أثناء رفع الملف',
        'folder-create-success': 'تم إنشاء المجلد بنجاح',
        'folder-update-success': 'تم تحديث المجلد بنجاح',
        'folder-delete-success': 'تم حذف المجلد بنجاح',
        'content-create-success': 'تم إضافة المحتوى بنجاح',
        'content-update-success': 'تم تحديث المحتوى بنجاح',
        'content-delete-success': 'تم حذف المحتوى بنجاح',
        'content-approve-success': 'تم اعتماد المحتوى بنجاح',
        'error-occurred': 'حدث خطأ',
        'please-try-again': 'يرجى المحاولة مرة أخرى',
        'no-folders': 'لا يوجد مجلدات في هذا القسم.',
        'no-contents': 'لا يوجد محتويات في هذا المجلد.',
        'back-to-files': 'العودة للملفات',
        'search': 'ابحث...',
        'folder-name-required': 'يرجى اختيار اسم المجلد',
        'content-title-required': 'يرجى اختيار اسم المحتوى',
        'select-folder': 'يرجى اختيار مجلد',
        'select-content': 'يرجى اختيار اسم المحتوى وملف',
        'missing-folder-id': 'معرف المجلد مفقود',
        'missing-content-id': 'معرف المحتوى مفقود',
        'folder-fetch-error': 'حدث خطأ في جلب بيانات المجلد',
        'folder-added-success': 'تم إضافة المجلد بنجاح',
        'folder-updated-success': 'تم تحديث المجلد بنجاح',
        'folder-deleted-success': 'تم حذف المجلد بنجاح',
        'content-added-success': 'تم إضافة المحتوى بنجاح',
        'content-updated-success': 'تم تحديث المحتوى بنجاح',
        'content-deleted-success': 'تم حذف المحتوى بنجاح',
        'content-approved-success': 'تم اعتماد المحتوى بنجاح',
        'error-occurred': 'حدث خطأ',
        'please-try-again': 'يرجى المحاولة مرة أخرى',
        'edit-folder-prompt': 'أدخل اسم المجلد الجديد:',
        'edit-content-prompt': 'أدخل اسم المحتوى الجديد:',
        'add-folder-prompt': 'أدخل اسم المجلد:',
        'add-content-prompt': 'أدخل اسم المحتوى:',
          'status-approved': 'معتمد',
  'status-awaiting': 'في انتظار الاعتماد',

    },
    en: {
        // Navigation
        'home': 'Home',
        'back': 'Back',
        'account': 'Account',
        'logs': 'Logs',
        'notifications': 'Notifications',
        'language': 'English',
        
        // Main content
        'main-title': 'Home Page',
        'tickets': 'OVR',
        'departments': 'Departments',
        'statistics': 'Statistics',
        'approvals': 'Approvals',
        'permissions': 'Permissions',
        'committees': 'Committees',
        'click-to-enter': 'Click to Enter',
        
        // System title
        'system-title': 'Quality and Safety Management System',

        // Login & Register
        'login': 'Login',
        'login-description': 'Please enter your login details',
        'register': 'Register',
        'forgot-password': 'Forgot Password?',
        'reset-password': 'Reset Password',
        'email': 'Email',
        'password': 'Password',
        'confirm-password': 'Confirm Password',
        'name': 'Name',
        'username': 'Username',
        'submit': 'Submit',
        'back-to-login': 'Back to Login',
        'no-account': 'Don\'t have an account?',
        'have-account': 'Already have an account?',
        'register-description': 'Please enter your registration details',
        // Dashboard
        'dashboard': 'Dashboard',
        'total-tickets': 'Total Tickets',
        'pending-tickets': 'Pending Tickets',
        'completed-tickets': 'Completed Tickets',
        'total-departments': 'Total Departments',
        'total-users': 'Total Users',

        // Tickets
        'ticket-list': 'Ticket List',
        'ticket-details': 'Ticket Details',
        'ticket-edit': 'Edit Ticket',
        'ticket-status': 'Ticket Status',
        'ticket-priority': 'Ticket Priority',
        'ticket-type': 'Ticket Type',
        'ticket-description': 'Ticket Description',
        'ticket-date': 'Ticket Date',
        'ticket-assigned': 'Assigned To',
        'ticket-created': 'Created By',
        'ticket-updated': 'Updated By',
        'ticket-comments': 'Comments',
        'add-comment': 'Add Comment',
        'save': 'Save',
        'cancel': 'Cancel',
        'delete': 'Delete',
        'edit': 'Edit',
        'view': 'View',
        'create-ticket': 'Create New Ticket',
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled',

        // Departments
        'department-list': 'Department List',
        'department-details': 'Department Details',
        'department-name': 'Department Name',
        'department-manager': 'Department Manager',
        'department-members': 'Department Members',
        'add-department': 'Add Department',
        'edit-department': 'Edit Department',

        // Approvals
        'approval-list': 'Approval List',
        'approval-details': 'Approval Details',
        'approval-status': 'Approval Status',
        'approval-type': 'Approval Type',
        'approval-date': 'Approval Date',
        'approval-requested': 'Requested By',
        'approval-approved': 'Approved By',
        'approval-rejected': 'Rejected By',
        'approval-comments': 'Approval Comments',
        'request-approval': 'Request Approval',
        'approve': 'Approve',
        'reject': 'Reject',

        // Profile
        'profile': 'Profile',
        'personal-info': 'Personal Information',
        'change-password': 'Change Password',
        'current-password': 'Current Password',
        'new-password': 'New Password',
        'update-profile': 'Update Profile',

        // Notifications
        'notification-list': 'Notification List',
        'notification-details': 'Notification Details',
        'notification-date': 'Notification Date',
        'notification-type': 'Notification Type',
        'mark-as-read': 'Mark as Read',
        'mark-all-read': 'Mark All as Read',

        // Logs
        'log-list': 'Log List',
        'log-details': 'Log Details',
        'log-type': 'Log Type',
        'log-date': 'Log Date',
        'log-user': 'User',
        'log-action': 'Action',
        'log-details': 'Details',

        // Permissions
        'permission-list': 'Permission List',
        'permission-details': 'Permission Details',
        'permission-name': 'Permission Name',
        'permission-description': 'Permission Description',
        'assign-permission': 'Assign Permission',
        'remove-permission': 'Remove Permission',

        // Register specific
        'employee-number': 'Employee Number',
        'enter-employee-number': 'Enter employee number',
        'department': 'Department',
        'select-department': 'Select Department',
        'add-new-department': 'Add New Department',
        'department-name': 'Department Name',
        'enter-department-name': 'Enter department name',
        'department-image': 'Image Path',
        
        // Labels
        'identifier-label': 'Username / Email / Employee ID',
        
        // Placeholders
        'enter-username': 'Username / Email / Employee ID',
        'enter-email': 'name@moh.gov.sa',
        'enter-password': 'Enter password',
        'confirm-password-placeholder': 'Confirm password',
        'choose-from-list' : 'Choose from list',

        // Departments modals and search
        'search-department': 'Search department',
        'delete-department-title': 'Delete Department Confirmation',
        'delete-department-confirm': 'Are you sure you want to delete this department?',

        // Department content page and modals
        'department-content-title': 'Department Content',
        'add-folder': 'Add Folder+',
        'choose-folder-name': 'Choose folder name',
        'create': 'Create',
        'add-content': 'Add Content to Folder',
        'content-name': 'Content Name',
        'search-folder': 'Search folder',
        'search-content': 'Search content',
        'search-content-name': 'Search name…',
        'add-content-name': '+ Add New Name',
        'choose-file': 'Choose file to attach',
        'pdf-only': 'PDF files only',
        'add': 'Add',
        'update': 'Update',
        'edit-folder': 'Edit Folder',
        'edit-content': 'Edit Folder Content',
        'delete-folder-title': 'Confirm Folder Deletion',
        'delete-folder-confirm': 'Are you sure you want to delete this folder? This will delete all contents inside it.',
        'delete-content-title': 'Confirm Content Deletion',
        'delete-content-confirm': 'Are you sure you want to delete this content?',
        'folder-content-title': 'Folder Contents',
        'choose-from-list': 'Choose from list...',
        'choose-name': 'Choose a name…',
        'file-upload-success': 'File uploaded successfully',
        'file-upload-error': 'Error uploading file',
        'folder-create-success': 'Folder created successfully',
        'folder-update-success': 'Folder updated successfully',
        'folder-delete-success': 'Folder deleted successfully',
        'content-create-success': 'Content added successfully',
        'content-update-success': 'Content updated successfully',
        'content-delete-success': 'Content deleted successfully',
        'content-approve-success': 'Content approved successfully',
        'error-occurred': 'An error occurred',
        'please-try-again': 'Please try again',
        'no-folders': 'No folders in this department.',
        'no-contents': 'No contents in this folder.',
        'back-to-files': 'Back to Files',
        'search': 'Search...',
        'folder-name-required': 'Please select a folder name',
        'content-title-required': 'Please select a content name',
        'select-folder': 'Please select a folder',
        'select-content': 'Please select content name and file',
        'missing-folder-id': 'Folder ID is missing',
        'missing-content-id': 'Content ID is missing',
        'folder-fetch-error': 'Error fetching folder data',
        'folder-added-success': 'Folder added successfully',
        'folder-updated-success': 'Folder updated successfully',
        'folder-deleted-success': 'Folder deleted successfully',
        'content-added-success': 'Content added successfully',
        'content-updated-success': 'Content updated successfully',
        'content-deleted-success': 'Content deleted successfully',
        'content-approved-success': 'Content approved successfully',
        'error-occurred': 'An error occurred',
        'please-try-again': 'Please try again',
        'edit-folder-prompt': 'Enter new folder name:',
        'edit-content-prompt': 'Enter new content name:',
        'add-folder-prompt': 'Enter folder name:',
        'add-content-prompt': 'Enter content name:',
          'status-approved': 'Approved',
  'status-awaiting': 'Awaiting Approval',
    }
};
window.translations = translations;

// Language switching functionality
document.addEventListener('DOMContentLoaded', () => {
    // Support both .language-switcher (login/register) and .language (index)
    const languageButton = document.querySelector('.language-switcher > a, .language > a');
    const languageDropdown = document.querySelector('.language-switcher .dropdown, .language .dropdown');
    
    // Set initial language from localStorage or default to Arabic
    const currentLang = localStorage.getItem('language') || 'ar';
    setLanguage(currentLang);
    
    // Toggle dropdown on language button click
    if (languageButton) {
        languageButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (languageDropdown) {
                languageDropdown.classList.toggle('show');
            }
        });
    }
    
    // Handle language selection
    document.querySelectorAll('.language-switcher .dropdown a, .language .dropdown a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const lang = e.target.textContent.toLowerCase() === 'english' ? 'en' : 'ar';
            setLanguage(lang);
            if (languageDropdown) {
                languageDropdown.classList.remove('show');
            }
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.language-switcher') && !e.target.closest('.language') && languageDropdown) {
            languageDropdown.classList.remove('show');
        }
    });
});

function setLanguage(lang) {
    const htmlElement = document.documentElement;
    const mainContent = document.querySelector('main');
    const header = document.querySelector('header');
    const body = document.body;
    
    // Update HTML attributes
    htmlElement.lang = lang;
    
    // Update direction for main content only
    if (mainContent) {
        mainContent.dir = lang === 'ar' ? 'rtl' : 'ltr';
        mainContent.style.textAlign = lang === 'ar' ? 'right' : 'left';
    } else {
        // If no main content (like in login/register pages), update body
        body.dir = lang === 'ar' ? 'rtl' : 'ltr';
        body.style.textAlign = lang === 'ar' ? 'right' : 'left';
    }
    
    // Keep header direction unchanged if it exists
    if (header) {
        header.dir = 'rtl';
        header.style.textAlign = 'right';
    }
    
    // Update font family
    body.style.fontFamily = lang === 'ar' ? 'Tajawal, sans-serif' : 'Arial, sans-serif';
    
    // Update text content
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    // Update labels
    document.querySelectorAll('label').forEach(label => {
        if (label.getAttribute('for') === 'identifier') {
            label.textContent = translations[lang]['identifier-label'];
        }
        // Update label text alignment
        label.style.textAlign = lang === 'ar' ? 'right' : 'left';
    });

    // Update placeholders and input fields
    document.querySelectorAll('[data-placeholder]').forEach(element => {
        const key = element.getAttribute('data-placeholder');
        if (translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
        // Force direction and textAlign with !important
        if (lang === 'ar') {
            element.style.setProperty('direction', 'rtl', 'important');
            element.style.setProperty('text-align', 'right', 'important');
        } else {
            element.style.setProperty('direction', 'ltr', 'important');
            element.style.setProperty('text-align', 'left', 'important');
        }
        // Update icon position (icon always opposite to placeholder start)
        const iconWrapper = element.closest('.input-icon-wrapper');
        if (iconWrapper) {
            const icon = iconWrapper.querySelector('img');
            if (icon) {
                if (lang === 'ar') {
                    iconWrapper.style.flexDirection = 'row';
                    icon.style.order = '0';
                    icon.style.marginRight = '10px';
                    icon.style.marginLeft = '0';
                } else {
                    iconWrapper.style.flexDirection = 'row-reverse';
                    icon.style.order = '1';
                    icon.style.marginLeft = '10px';
                    icon.style.marginRight = '0';
                }
            }
        }
    });
    // Force direction and textAlign for all text/password inputs and textareas
    document.querySelectorAll('input[type="text"], input[type="password"], textarea').forEach(element => {
        if (lang === 'ar') {
            element.style.setProperty('direction', 'rtl', 'important');
            element.style.setProperty('text-align', 'right', 'important');
        } else {
            element.style.setProperty('direction', 'ltr', 'important');
            element.style.setProperty('text-align', 'left', 'important');
        }
    });
    // Update font family for all buttons
    document.querySelectorAll('button, .btn-primary').forEach(btn => {
        btn.style.fontFamily = lang === 'ar' ? 'Tajawal, sans-serif' : 'Arial, sans-serif';
    });
    
    // Update language button text
    const languageButton = document.querySelector('.language-switcher > a span');
    if (languageButton) {
        languageButton.textContent = lang === 'ar' ? 'عربي' : 'English';
    }
    
    // Save language preference
    localStorage.setItem('language', lang);

    // زر الرجوع في صفحة الأقسام
    const backBtn = document.getElementById('backBtn');
    const backIcon = document.getElementById('backIcon');
    if (backBtn && backIcon) {
        if (lang === 'ar') {
            backBtn.style.right = '50px';
            backBtn.style.left = 'auto';
            backBtn.style.justifyContent = 'flex-end';
            backIcon.classList.remove('fa-arrow-right');
            backIcon.classList.add('fa-arrow-left');
        } else {
            backBtn.style.left = '50px';
            backBtn.style.right = 'auto';
            backBtn.style.justifyContent = 'flex-start';
            backIcon.classList.remove('fa-arrow-left');
            backIcon.classList.add('fa-arrow-right');
        }
    }
}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('language') || 'ar';
    setLanguage(savedLang);
});

// --- Language/translation helpers moved from HTML ---
function updateMainBackBtn(lang) {
  const backBtn = document.getElementById('mainBackBtn');
  const backIcon = document.getElementById('mainBackBtnIcon');
  const backBtnText = document.getElementById('mainBackBtnText');
  const backBtnContainer = document.getElementById('mainBackBtnContainer');
  if (backBtn && backIcon && backBtnText && backBtnContainer) {
    if (lang === 'ar') {
      backIcon.classList.remove('fa-arrow-left');
      backIcon.classList.add('fa-arrow-right');
      backBtnContainer.style.justifyContent = 'flex-end';
      backBtnContainer.style.marginRight = '0';
      backBtnContainer.style.marginLeft = 'auto';
      backBtnText.textContent = 'رجوع';
    } else {
      backIcon.classList.remove('fa-arrow-right');
      backIcon.classList.add('fa-arrow-left');
      backBtnContainer.style.justifyContent = 'flex-start';
      backBtnContainer.style.marginLeft = '0';
      backBtnContainer.style.marginRight = 'auto';
      backBtnText.textContent = 'Back';
    }
  }
}
function updateActionsAlignment(lang) {
  document.querySelectorAll('.actions').forEach(actions => {
    actions.style.justifyContent = 'flex-end';
    actions.style.marginRight = '0';
    actions.style.marginLeft = 'auto';
  });
}
function updateSearchIcon(lang) {
  document.querySelectorAll('.search-bar').forEach(bar => {
    const input = bar.querySelector('input');
    const icon = bar.querySelector('.search-icon');
    if (input && icon) {
      if (lang === 'ar') {
        icon.style.right = '10px';
        icon.style.left = 'auto';
        input.style.paddingRight = '35px';
        input.style.paddingLeft = '';
      } else {
        icon.style.left = '10px';
        icon.style.right = 'auto';
        input.style.paddingLeft = '35px';
        input.style.paddingRight = '';
      }
    }
  });
}
function updateHomeBtn(lang) {
  const homeBtn = document.querySelector('.home-btn span');
  if (homeBtn) {
    homeBtn.textContent = (window.translations && window.translations[lang] && window.translations[lang]['home']) ? window.translations[lang]['home'] : 'Home';
  }
}
function updateModalTexts(lang) {
  document.querySelectorAll('[data-translate]').forEach(element => {
    const key = element.getAttribute('data-translate');
    if (translations[lang][key]) {
      element.textContent = translations[lang][key];
    }
  });
  document.querySelectorAll('[data-placeholder]').forEach(element => {
    const key = element.getAttribute('data-placeholder');
    if (translations[lang][key]) {
      element.placeholder = translations[lang][key];
    }
  });
}
function updateDynamicTextDirection(lang) {
  document.querySelectorAll('.folder-name, .file-name, .label').forEach(el => {
    el.style.textAlign = lang === 'ar' ? 'right' : 'left';
    el.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });
}
// Call all on load and whenever language changes
function applyLanguageUI(lang) {
  updateMainBackBtn(lang);
  updateActionsAlignment(lang);
  updateSearchIcon(lang);
  updateHomeBtn(lang);
  updateModalTexts(lang);
  updateDynamicTextDirection(lang);
}
document.addEventListener('DOMContentLoaded', function() {
  const lang = localStorage.getItem('language') || 'ar';
  applyLanguageUI(lang);
  window.addEventListener('storage', function(e) {
    if (e.key === 'language') {
      const lang = localStorage.getItem('language') || 'ar';
      applyLanguageUI(lang);
    }
  });
  if (typeof setLanguage === 'function') {
    const origSetLanguage = setLanguage;
    window.setLanguage = function(lang) {
      origSetLanguage(lang);
      applyLanguageUI(lang);
    };
  }
});

function getTranslation(key) {
  const lang = localStorage.getItem('language') || 'ar';
  if (window.translations && window.translations[lang] && window.translations[lang][key]) {
    return window.translations[lang][key];
  }
  return key;
} 