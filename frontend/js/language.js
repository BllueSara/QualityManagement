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
        'register-description': 'أدخل بياناتك لإنشاء حساب جديد',
        'select-department': 'اختر القسم',
        'add-new-department': 'إضافة قسم جديد',
        'department-image': 'مسار الصورة',

        // Placeholders
        'enter-username': 'أدخل اسم المستخدم',
        'enter-email': 'name@moh.gov.sa',
        'enter-password': 'أدخل كلمة المرور',
        'confirm-password-placeholder': 'تأكيد كلمة المرور',
        'enter-department-name': 'أدخل اسم القسم',
    },
    en: {
        // Navigation
        'home': 'Home',
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
        'register-description': 'Enter your details to create a new account',
        'select-department': 'Select Department',
        'add-new-department': 'Add New Department',
        'department-image': 'Image Path',

        // Placeholders
        'enter-username': 'Enter username',
        'enter-email': 'name@moh.gov.sa',
        'enter-password': 'Enter password',
        'confirm-password-placeholder': 'Confirm password',
        'enter-department-name': 'Enter department name',
    }
};

// Language switching functionality
document.addEventListener('DOMContentLoaded', () => {
    const languageButton = document.querySelector('.language a');
    const languageDropdown = document.querySelector('.language .dropdown');
    const htmlElement = document.documentElement;
    
    // Set initial language from localStorage or default to Arabic
    const currentLang = localStorage.getItem('language') || 'ar';
    setLanguage(currentLang);
    
    // Toggle dropdown on language button click
    if (languageButton) {
        languageButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (languageDropdown) {
                languageDropdown.classList.toggle('show');
            }
        });
    }
    
    // Handle language selection
    document.querySelectorAll('.language .dropdown a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = e.target.textContent.toLowerCase() === 'english' ? 'en' : 'ar';
            setLanguage(lang);
            if (languageDropdown) {
                languageDropdown.classList.remove('show');
            }
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.language') && languageDropdown) {
            languageDropdown.classList.remove('show');
        }
    });
});

function setLanguage(lang) {
    const htmlElement = document.documentElement;
    
    // Update HTML attributes
    htmlElement.lang = lang;
    htmlElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    // Update font family
    document.body.style.fontFamily = lang === 'ar' ? 'Tajawal, sans-serif' : 'Arial, sans-serif';
    
    // Update text content
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-placeholder]').forEach(element => {
        const key = element.getAttribute('data-placeholder');
        if (translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });
    
    // Update language button text
    const languageButton = document.querySelector('.language a');
    if (languageButton) {
        languageButton.textContent = lang === 'ar' ? 'عربي' : 'English';
    }
    
    // Save language preference
    localStorage.setItem('language', lang);
} 