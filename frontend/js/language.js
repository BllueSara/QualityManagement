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
        'reset-password-description': 'أدخل بريدك الإلكتروني الوزاري لإعادة تعيين كلمة المرور.',
        'email': 'البريد الإلكتروني الوزاري',
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
        'cancel': 'إلغاء / عودة',
        'delete': 'حذف',
        'edit': 'تعديل',
        'view': 'عرض',
        'create-ticket': 'إنشاء تذكرة جديدة',
        'pending': 'قيد الانتظار',
        'in-progress': 'قيد المعالجة',
        'completed': 'تم الرد',
        'closed': 'مغلقة',
        'new': 'جديد',
        'sent': 'تم الارسال',

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
        'placeholder-date': 'yyyy/mm/dd',
        'placeholder-event-location': 'ادخل موقع الحدث هنا',
        'placeholder-select-dept': 'اختر القسم',
        'placeholder-other-depts': 'إذا وجد، اذكر الأقسام الأخرى',
        'placeholder-patient-name': 'ادخل اسم المريض',
        'placeholder-medical-record': 'ادخل رقم الملف الطبي',
        'placeholder-reporter-name': 'ادخل اسم المبلغ',
        'placeholder-reporter-position': 'ادخل المسمي الوظيفي',
        'placeholder-phone': '05XXXXXXXX',
        'placeholder-event-description': 'اكتب وصفاً مفصلاً للحدث هنا',
        'placeholder-actions': 'صف الإجراءات التي تم اتخاذها',
        'placeholder-short-desc': 'أي تفاصيل قصيرة عن الحدث',

        // Departments modals and search
        'search-department': 'ابحث عن قسم',
        'delete-department-title': 'تأكيد حذف القسم',
        'delete-department-confirm': 'أنت متأكد من حذف هذا القسم؟',
   'submit-ticket': 'ارسال التذكرة',
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
        'department-name-required': 'اسم القسم مطلوب',
        'department-image-required': 'صورة القسم مطلوبة',
        'department-added-success': 'تم إضافة القسم بنجاح',
        'department-updated-success': 'تم تحديث القسم بنجاح',
        'department-deleted-success': 'تم حذف القسم بنجاح',
        'please-login': 'يرجى تسجيل الدخول أولاً',
        'error-fetching-departments': 'حدث خطأ في جلب الأقسام',
        'error-adding-department': 'حدث خطأ في إضافة القسم',
        'error-updating-department': 'حدث خطأ في تحديث القسم',
        'error-deleting-department': 'حدث خطأ في حذف القسم',
        'approvals-title': 'الاعتمادات',
        'approvals-subtitle': 'إدارة الاعتمادات الخاصة بك',
        'my-requests': 'طلباتي',
        'my-requests-desc': 'عرض طلبات الاعتماد التي تقدمت بها',
        'received-requests': 'الطلبات المرسلة لك',
        'received-requests-desc': 'الاعتمادات الموجهة إليك للمراجعة',
        'proxy-signature': 'توقيع بالنيابة',
        'proxy-signature-desc': 'التوقيع على الوثائق نيابةً عن الآخرين',
        'approval-files': 'ملفات الاعتمادات',
        'approval-files-desc': 'قراءة ملفات الاعتمادات',

        // Approvals page specific translations
        'all-departments-committees': 'جميع الأقسام/اللجان',
        'department': 'قسم',
        'committee': 'لجنة',
        'committee-file': 'ملف لجنة',
        'department-report': 'تقرير قسم',
        'track': 'تتبع',
        'error-fetching-files': 'فشل جلب الملفات المرفوعة',
        'error-connection': 'حدث خطأ في الاتصال بجلب الملفات المرفوعة',
        'error-fetching-departments': 'حدث خطأ في جلب الأقسام',
        'all-statuses': 'جميع الحالات',
        'all-departments': 'جميع الأقسام',
        'all-folders': 'جميع المجلدات',
        'filter-results': 'تصفية النتائج',
        'folder': 'المجلد',
        'source': 'المصدر',
        'upload-date': 'تاريخ الرفع',
        'actions': 'الإجراءات',
        'no-uploaded-files': 'لا يوجد ملفات مرفوعة بواسطة هذا المستخدم',
        'showing': 'عرض',
        'of': 'من',
        'requests': 'طلب',
        'total-requests': 'إجمالي الطلبات',
        'back': 'رجوع',
        'home': 'الرئيسية',
        'my-requests': 'طلباتي',
        'search': 'بحث...',

        // Track Request Page Translations
        'track-request-title': 'تتبع الطلب - نظام إدارة الجودة والسلامة',
        'track-request': 'تتبع الطلب',
        'next-department': 'القسم التالي:',
        'status-under-review': 'قيد المراجعة في قسم التفتيش',
        'last-update': 'آخر تحديث',
        'request-progress': 'تقدم الطلب',
        'steps-completed': 'خطوات مكتملة',
        'approved': 'معتمد',
        'request-approved': 'تم اعتماد الطلب بنجاح',
        'under-review': 'قيد المراجعة',
        'reviewing-documents': 'جاري مراجعة المستندات المطلوبة',
        'expected-date': 'متوقع',
        'waiting': 'في الانتظار',
        'request-id-missing': 'معرف الطلب غير موجود!',
        'failed-to-load-request': 'فشل تحميل معلومات الطلب',
        'no-department-assigned': 'لم يتم تعيين أي جهة لاعتماد الطلب بعد',
        'waiting-first-department': 'في انتظار التوقيع من القسم الأول',
        'all-departments-signed': 'تم التوقيع من الجميع',
        'not-approved-yet': 'لم يتم الاعتماد بعد',
        'rejected': 'مرفوض',
        'status': 'الحالة',
        'no-notes': 'بدون ملاحظات',
        'error-loading-data': 'حدث خطأ أثناء تحميل البيانات',

        // Approvals Received Page Translations
        'approvals-received-title': 'الاعتمادات المرسلة لك - نظام إدارة الجودة والسلامة',
        'approvals-received': 'الاعتمادات المرسلة لك',
        'search-files': 'البحث في الملفات...',
        'select-date': 'اختر التاريخ',
        'file-name': 'اسم الملف',
        'response': 'الرد',
        'approval': 'الاعتماد',
        'signature': 'توقيع',
        'confirm-signature': 'تأكيد التوقيع',
        'clear': 'مسح',
        'reject-request': 'رفض الطلب',
        'enter-reject-reason': 'يرجى كتابة سبب الرفض',
        'send-reason': 'إرسال السبب',
        'electronic-approval': 'الاعتماد الإلكتروني',
        'electronic-approval-desc': 'سيتم اعتماد هذا الملف بشكل إلكتروني ولن تكون هناك حاجة للتوقيع اليدوي.',
        'electronic-approve': 'اعتماد إلكتروني',
        'sign-on-behalf': 'توقيع بالنيابة عن',
        'user-name': 'اسم المستخدم',
        'select-user': 'اختر المستخدم',
        'notes': 'ملاحظات',
        'confirm': 'تأكيد',
        'cancel': 'إلغاء',
        'sign': 'توقيع',
        'delegate': 'توقيع بالنيابة',
        'electronic': 'اعتماد إلكتروني',
        'reject': 'رفض',
        'preview': 'عرض',
        'content-type': 'نوع المحتوى',
        'committee-file': 'ملف لجنة',
        'department-report': 'تقرير قسم',
        'no-content': 'لا يوجد محتوى مرتبط',
        'error-loading': 'حدث خطأ أثناء تحميل البيانات',
        'error-sending': 'حدث خطأ أثناء الإرسال',
        'success-sent': 'تم الإرسال بنجاح',
        'success-approved': 'تم الاعتماد بنجاح',
        'success-rejected': 'تم الرفض بنجاح',
        'success-delegated': 'تم التفويض بنجاح',
        'please-login': 'يرجى تسجيل الدخول أولاً',
        'please-select-user': 'يرجى اختيار المستخدم',
        'please-enter-reason': 'يرجى كتابة سبب الرفض',

        // Sign page translations
        'sign-title': 'توقيع بالنيابة - نظام إدارة الجودة والسلامة',
        'sign-page-title': 'توقيع بالنيابة',
        'sign-page-subtitle': 'المستندات التي تحتاج توقيعك بالنيابة عن الآخرين',
        'file-name': 'اسم الملف',
        'delegated-by': 'من وكلك',
        'actions': 'الإجراءات',
        'accept': 'قبول',
        'reject': 'رفض',
        'back': 'رجوع',
        'home': 'الرئيسية',
        'no-documents': 'لا توجد مستندات للتوقيع بالنيابة',
        'reject-reason': 'اكتب سبب الرفض هنا…',
        'continue': 'متابعة',
        'cancel': 'إلغاء',
        'accept-message': '✅ سيتم تحويلك إلى صفحة الاعتمادات لتوقيع الملف بالطريقة المناسبة لك.',
        'reject-message': '⚠️ يرجى كتابة سبب الرفض ثم اضغط متابعة.',
        'reject-success': '❌ تم رفض المستند',
        'error-loading': 'حدث خطأ أثناء جلب بيانات التفويض',
        'error-rejecting': 'حدث خطأ أثناء الرفض',
        'reason-required': '⚠️ يرجى كتابة سبب الرفض',

        // Pending Approvals Page
        'pending-approvals-title': 'ملفات بانتظار الاعتماد - نظام إدارة الجودة والسلامة',
        'pending-approvals': 'ملفات بانتظار الاعتماد',
        'report': 'التقرير',
        'department': 'القسم',
        'selected': 'المُختارون',
        'will-be-sent-to': 'سيتم الارسال الى',
        'action': 'الإجراء',
        'select-department': 'اختر القسم',
        'select-department-first': 'اختر القسم أولاً',
        'select-people': 'اختر الأشخاص',
        'selected-count': 'مختار',
        'departments-count': 'أقسام',
        'search-department': 'ابحث القسم...',
        'search-person': 'ابحث الشخص...',
        'sent': 'تم الإرسال',
        'waiting-send': 'بانتظار الإرسال',
        'send': 'إرسال',
        'view': 'عرض',
        'please-select-users': 'الرجاء اختيار مستخدمين أولاً.',
        'file-link-unavailable': 'رابط الملف غير متوفر.',
        'send-failed': 'فشل إرسال المعتمدين',
        'committee-file': 'ملف لجنة',
        'department-report': 'تقرير قسم',
        'back': 'رجوع',
        'home': 'الرئيسية',

        // OVR Page Translations
        'tickets-page-title': 'التذاكر - نظام إدارة الجودة والسلامة',
        'tickets-page-subtitle': 'إدارة وإنشاء التذاكر الخاصة بك',
        'create-ticket-title': 'إنشاء تذكرة',
        'create-ticket-desc': 'إنشاء تذكرة دعم فني جديدة',
        'create-new-ticket': 'إنشاء تذكرة جديدة',
        'view-tickets-title': 'عرض التذاكر',
        'view-tickets-desc': 'استعراض وإدارة التذاكر الحالية',
        'view-all-tickets': 'عرض جميع التذاكر',
        'transfer-tickets-title': 'تحويل التذاكر',
        'transfer-tickets-desc': 'إدارة وتحويل التذاكر الحالية بسلاسة',
        'start-transfer': 'ابدأ عملية التحويل',

        // Ticket Creation Page Translations
        'create-ticket-page-title': 'نظام إدارة الجودة والسلامة - إنشاء تذكرة',
        'event-time-location': 'وقت وموقع الحدث',
        'event-date': 'تاريخ الحدث',
        'event-time': 'وقت الحدث',
        'morning': 'صباحاً',
        'evening': 'مساءً',
        'event-location': 'موقع الحدث',
        'enter-event-location': 'ادخل موقع الحدث هنا',
        'reporting-dept': 'القسم المبلغ',
        'responding-dept': 'القسم المستجيب',
        'select-dept': 'اختر القسم',
        'other-depts': 'الأقسام الأخرى المعنية',
        'enter-other-depts': 'إذا وجد، اذكر الأقسام الأخرى',
        
        'patient-info': 'معلومات المريض',
        'patient-name': 'اسم المريض',
        'enter-patient-name': 'ادخل اسم المريض',
        'medical-record': 'رقم الملف الطبي',
        'enter-medical-record': 'ادخل رقم الملف الطبي',
        'dob': 'تاريخ الميلاد',
        'gender': 'الجنس',
        'male': 'ذكر',
        'female': 'أنثى',
        'patient-type': 'نوع المريض',
        'inpatient': 'منوم',
        'outpatient': 'مراجع',
        'staff': 'موظف',
        'visitor': 'زائر',
        'other': 'أخرى',
        
        'report-type': 'نوع البلاغ',
        'select-report-type': 'اختر نوع البلاغ',
        'accident': 'حادث',
        'near-miss': 'حدث قابل للتبليغ',
        'serious': 'حدث جسيم',
        'error': 'تنبيه خطأ',
        'unsafe': 'وضع غير آمن',
        'event-description': 'وصف الحدث',
        'enter-event-description': 'اكتب وصفاً مفصلاً للحدث هنا',
        
        'reporter-info': 'معلومات المبلغ',
        'reporter-name': 'اسم المبلغ',
        'enter-reporter-name': 'ادخل اسم المبلغ',
        'report-date': 'تاريخ الإبلاغ',
        'reporter-position': 'المسمي الوظيفي',
        'enter-reporter-position': 'ادخل المسمي الوظيفي',
        'reporter-phone': 'رقم الجوال',
        'reporter-email': 'البريد الإلكتروني',
        
        'actions-taken': 'الإجراءات المتخذة',
        'enter-actions': 'صف الإجراءات التي تم اتخاذها',
        
        'event-classification': 'تصنيف الحدث',
        'cleaning': 'النظافة',
        'skin-integrity': 'تكامل الجلد',
        'fall': 'السقوط',
        'supply-chain': 'مشكلات سلسلة الإمداد',
        'security': 'قضايا أمنية',
        'patient-care': 'إدارة رعاية المرضى',
        'medical-equipment': 'مشكلات الأجهزة الطبية',
        'housing': 'الإسكان',
        'food-services': 'خدمات الطعام',
        'occupational-health': 'الصحة المهنية',
        'hypertension': 'فرط الضغط',
        'communication': 'مشاكل التواصل',
        'maternal': 'قضايا الولادة',
        'serious-incidents': 'أحداث جسيمة',
        'staff-issues': 'قضايا الموظفين',
        'medical-procedures': 'إجراءات طبية',
        'environment-safety': 'البيئة / السلامة',
        'medical-imaging': 'التصوير الطبي',
        'identity-docs': 'الهوية / المستندات / الموافقات',
        'infection-control': 'قضايا مكافحة العدوى',
        'iv-injection': 'الحقن الوريدي',
        'medication': 'الدواء',
        'radiation-therapy': 'العلاج الإشعاعي',
        'lab-services': 'خدمات المختبر',
        'facility-maintenance': 'صيانة المنشأة',
        'it-issues': 'قضايا تقنية المعلومات',
        'clinical-nutrition': 'التغذية السريرية',
        
        'injury-details': 'تفاصيل الإصابة',
        'had-injury': 'هل حدثت إصابة؟',
        'yes': 'نعم',
        'no': 'لا',
        'injury-type': 'نوع الإصابة',
        'physical': 'جسدية',
        'psychic': 'نفسية',
        
        'attachments': 'المرفقات',
        'upload-attachments': 'رفع المرفقات',
        'upload-hint': 'يمكنك رفع أكثر من ملف في آنٍ واحد (jpg, png, pdf, doc).',
        
        'cancel': 'إلغاء / عودة',

        // Ticket List Page Translations
        'ticket-list-title': 'قائمة التذاكر - نظام إدارة الجودة والسلامة',
        'ticket-list': 'قائمة التذاكر',
        'search': 'بحث...',
        'filter': 'تصفية',
        'ticket-number': 'رقم التذكرة',
        'response': 'الرد',
        'location': 'الموقع',
        'date': 'التاريخ',
        'actions': 'الإجراءات',
        'view': 'عرض',
        'track': 'تتبع',
        'edit': 'تعديل',
        'delete': 'حذف',
        'showing': 'عرض',
        'of': 'من',
        'tickets': 'تذكرة',
        'previous': 'السابق',
        'next': 'التالي',
        'back': 'رجوع',
        'home': 'الرئيسية',
        'confirm-delete': 'هل أنت متأكد من حذف هذه التذكرة؟',
        'delete-failed': 'فشل حذف التذكرة',
        'error-fetching-tickets': 'حدث خطأ أثناء جلب التذاكر.',
        'no-tickets': 'لا توجد تذاكر',
        'pending': 'قيد الانتظار',
        'in-progress': 'قيد المعالجة',
        'completed': 'تم الرد',
        'closed': 'مغلقة',

        // Ticket Details Page Translations
        'view-ticket': 'عرض التذكرة',
        'event-details': 'تفاصيل الحدث',
        'event-date': 'تاريخ الحدث',
        'event-time': 'وقت الحدث',
        'morning': 'صباحاً',
        'evening': 'مساءً',
        'event-location': 'موقع الحدث',
        'reporting-dept': 'القسم المبلغ',
        'responding-dept': 'القسم المستجيب',
        
        'patient-info': 'معلومات المريض',
        'patient-name': 'اسم المريض',
        'medical-record-no': 'رقم الملف الطبي',
        'gender': 'الجنس',
        'male': 'ذكر',
        'female': 'أنثى',
        
        'report-type': 'نوع البلاغ',
        'accident': 'حادث',
        'near-miss': 'شبه خطأ',
        
        'event-description': 'وصف الحدث',
        'has-attachments': 'يوجد مرفقات',
        
        'reporter-info': 'بيانات المبلغ',
        'reporter-name': 'الاسم',
        'reporter-phone': 'رقم الجوال',
        'reporter-position': 'المسمي الوظيفي',
        'reporter-email': 'البريد الإلكتروني',
        
        'actions-taken': 'الإجراءات المتخذة',
        
        'event-classification': 'تصنيف الحدث',
        'medical-equipment': 'الأجهزة الطبية',
        'infrastructure': 'البنية',
        'security-issues': 'قضايا أمنية',
        
        'injury-details': 'تفاصيل الإصابة',
        'had-injury': 'هل حدثت إصابة؟',
        'yes': 'نعم',
        'no': 'لا',
        'injury-type': 'نوع الإصابة',
        'physical': 'جسدية',
        'psychological': 'نفسية',
        
        'add-reply': 'إضافة رد / إجراء من الجهة المختصة',
        'write-reply': 'اكتب ردّك هنا...',
        'send-reply': 'إرسال الرد',
        'sending': 'جاري الإرسال…',
        
        'previous-replies': 'الردود السابقة',
        'user': 'مستخدم',
        
        'back': 'رجوع',
        'home': 'الرئيسية',
        'ticket-not-found': 'لم يتم العثور على معرف التذكرة',
        'error-loading-ticket': 'حدث خطأ أثناء جلب بيانات التذكرة.',
        'error-loading-replies': 'تعذر تحميل الردود.',
        'error-sending-reply': 'خطأ أثناء إرسال الرد: ',
        'write-reply-first': 'اكتب ردّك أولاً',

        // Track Request Ticket Page Translations
        'track-ticket': 'تتبع التذكرة',
        'track-request': 'تتبع الطلب',
        'next-department': 'القسم التالي:',
        'track-status-title': 'حالة التتبع',
        'last-update': 'آخر تحديث:',
        'progress-label': 'تقدم الطلب',
        'progress-steps': 'خطوات مكتملة',
        'completed': 'مكتمل',
        'pending': 'قيد المراجعة',
        'waiting': 'في الانتظار',
        'closed': 'مغلق',
        'approved': 'معتمد',
        'reply': 'رد',
        'sent': 'تم الإرسال',
        'expected': 'متوقع:',
        'no-data': '—',
        'error-loading-data': 'حدث خطأ أثناء تحميل البيانات.',
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
        'reset-password-description': 'Enter your ministerial email to reset your password.',
        'email': 'Ministerial Email',
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
        'submit-ticket': 'Submit Ticket',
        'cancel': 'Cancel / Back',
        'delete': 'Delete',
        'edit': 'Edit',
        'view': 'View',
        'create-ticket': 'Create New Ticket',
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'completed': 'Completed',
        'closed': 'Closed',
        'new': 'New',
        'sent': 'Sent',

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
        'placeholder-date': 'yyyy/mm/dd',
        'placeholder-event-location': 'Enter event location here',
        'placeholder-select-dept': 'Select Department',
        'placeholder-other-depts': 'If any, list other departments',
        'placeholder-patient-name': 'Enter patient name',
        'placeholder-medical-record': 'Enter medical record number',
        'placeholder-reporter-name': 'Enter reporter name',
        'placeholder-reporter-position': 'Enter job title',
        'placeholder-phone': '05XXXXXXXX',
        'placeholder-email': 'example@domain.com',
        'placeholder-event-description': 'Write a detailed description of the event here',
        'placeholder-actions': 'Describe the actions taken',
        'placeholder-short-desc': 'Any brief details about the event',

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
        'department-name-required': 'Department name is required',
        'department-image-required': 'Department image is required',
        'department-added-success': 'Department added successfully',
        'department-updated-success': 'Department updated successfully',
        'department-deleted-success': 'Department deleted successfully',
        'please-login': 'Please login first',
        'error-fetching-departments': 'Error fetching departments',
        'error-adding-department': 'Error adding department',
        'error-updating-department': 'Error updating department',
        'error-deleting-department': 'Error deleting department',
        'approvals-title': 'Approvals',
        'approvals-subtitle': 'Manage your approvals',
        'my-requests': 'My Requests',
        'my-requests-desc': 'View approval requests you have submitted',
        'received-requests': 'Requests Sent to You',
        'received-requests-desc': 'Approvals directed to you for review',
        'proxy-signature': 'Proxy Signature',
        'proxy-signature-desc': 'Sign documents on behalf of others',
        'approval-files': 'Approval Files',
        'approval-files-desc': 'Read approval files',

        // Approvals page specific translations
        'all-departments-committees': 'All Departments/Committees',
        'department': 'Department',
        'committee': 'Committee',
        'committee-file': 'Committee File',
        'department-report': 'Department Report',
        'track': 'Track',
        'error-fetching-files': 'Failed to fetch uploaded files',
        'error-connection': 'Error connecting to fetch uploaded files',
        'error-fetching-departments': 'Error fetching departments',
        'all-statuses': 'All Statuses',
        'all-departments': 'All Departments',
        'all-folders': 'All Folders',
        'filter-results': 'Filter Results',
        'folder': 'Folder',
        'source': 'Source',
        'upload-date': 'Upload Date',
        'actions': 'Actions',
        'no-uploaded-files': 'No files uploaded by this user',
        'showing': 'Showing',
        'of': 'of',
        'requests': 'requests',
        'total-requests': 'Total Requests',
        'back': 'Back',
        'home': 'Home',
        'my-requests': 'My Requests',
        'search': 'Search...',

        // Track Request Page Translations
        'track-request-title': 'Track Request - Quality and Safety Management System',
        'track-request': 'Track Request',
        'next-department': 'Next Department:',
        'status-under-review': 'Under Review in Inspection Department',
        'last-update': 'Last Update',
        'request-progress': 'Request Progress',
        'steps-completed': 'steps completed',
        'approved': 'Approved',
        'request-approved': 'Request has been successfully approved',
        'under-review': 'Under Review',
        'reviewing-documents': 'Reviewing required documents',
        'expected-date': 'Expected',
        'waiting': 'Waiting',
        'request-id-missing': 'Request ID is missing!',
        'failed-to-load-request': 'Failed to load request information',
        'no-department-assigned': 'No department has been assigned for approval yet',
        'waiting-first-department': 'Waiting for signature from first department',
        'all-departments-signed': 'All departments have signed',
        'not-approved-yet': 'Not approved yet',
        'rejected': 'Rejected',
        'status': 'Status',
        'no-notes': 'No notes',
        'error-loading-data': 'Error loading data',

        // Approvals Received Page Translations
        'approvals-received-title': 'Approvals Sent to You - Quality and Safety Management System',
        'approvals-received': 'Approvals Sent to You',
        'search-files': 'Search files...',
        'select-date': 'Select Date',
        'file-name': 'File Name',
        'response': 'Response',
        'approval': 'Approval',
        'signature': 'Signature',
        'confirm-signature': 'Confirm Signature',
        'clear': 'Clear',
        'reject-request': 'Reject Request',
        'enter-reject-reason': 'Please enter rejection reason',
        'send-reason': 'Send Reason',
        'electronic-approval': 'Electronic Approval',
        'electronic-approval-desc': 'This file will be electronically approved and no manual signature will be required.',
        'electronic-approve': 'Electronically Approve',
        'sign-on-behalf': 'Sign on Behalf',
        'user-name': 'User Name',
        'select-user': 'Select User',
        'notes': 'Notes',
        'confirm': 'Confirm',
        'cancel': 'Cancel',
        'sign': 'Sign',
        'delegate': 'Delegate',
        'electronic': 'Electronic',
        'reject': 'Reject',
        'preview': 'Preview',
        'content-type': 'Content Type',
        'committee-file': 'Committee File',
        'department-report': 'Department Report',
        'no-content': 'No content associated',
        'error-loading': 'Error loading data',
        'error-sending': 'Error sending data',
        'success-sent': 'Successfully sent',
        'success-approved': 'Successfully approved',
        'success-rejected': 'Successfully rejected',
        'success-delegated': 'Successfully delegated',
        'please-login': 'Please login first',
        'please-select-user': 'Please select a user',
        'please-enter-reason': 'Please enter rejection reason',

        // Sign page translations
        'sign-title': 'Proxy Signature - Quality and Safety Management System',
        'sign-page-title': 'Proxy Signature',
        'sign-page-subtitle': 'Documents that need your proxy signature',
        'file-name': 'File Name',
        'delegated-by': 'Delegated By',
        'actions': 'Actions',
        'accept': 'Accept',
        'reject': 'Reject',
        'back': 'Back',
        'home': 'Home',
        'no-documents': 'No documents for proxy signature',
        'reject-reason': 'Enter rejection reason here...',
        'continue': 'Continue',
        'cancel': 'Cancel',
        'accept-message': '✅ You will be redirected to the approvals page to sign the file in your preferred way.',
        'reject-message': '⚠️ Please enter the rejection reason and click continue.',
        'reject-success': '❌ Document has been rejected',
        'error-loading': 'Error loading delegation data',
        'error-rejecting': 'Error rejecting document',
        'reason-required': '⚠️ Please enter rejection reason',

        // Pending Approvals Page
        'pending-approvals-title': 'Pending Approvals - Quality and Safety Management System',
        'pending-approvals': 'Pending Approvals',
        'report': 'Report',
        'department': 'Department',
        'selected': 'Selected',
        'will-be-sent-to': 'Will be sent to',
        'action': 'Action',
        'select-department': 'Select Department',
        'select-department-first': 'Select Department First',
        'select-people': 'Select People',
        'selected-count': 'selected',
        'departments-count': 'departments',
        'search-department': 'Search department...',
        'search-person': 'Search person...',
        'sent': 'Sent',
        'waiting-send': 'Waiting to Send',
        'send': 'Send',
        'view': 'View',
        'please-select-users': 'Please select users first.',
        'file-link-unavailable': 'File link is unavailable.',
        'send-failed': 'Failed to send approvers',
        'committee-file': 'Committee File',
        'department-report': 'Department Report',
        'back': 'Back',
        'home': 'Home',

        // OVR Page Translations
        'tickets-page-title': 'OVR - Quality and Safety Management System',
        'tickets-page-subtitle': 'Manage and create your OVR',
        'create-ticket-title': 'Create OVR',
        'create-ticket-desc': 'Create a new support OVR',
        'create-new-ticket': 'Create New OVR',
        'view-tickets-title': 'View OVR',
        'view-tickets-desc': 'Browse and manage current OVR',
        'view-all-tickets': 'View All OVR',
        'transfer-tickets-title': 'Transfer OVR',
        'transfer-tickets-desc': 'Manage and transfer current OVR smoothly',
        'start-transfer': 'Start Transfer Process',

        // Ticket Creation Page Translations
        'create-ticket-page-title': 'Quality and Safety Management System - Create OVR',
        'event-time-location': 'Event Time and Location',
        'event-date': 'Event Date',
        'event-time': 'Event Time',
        'morning': 'Morning',
        'evening': 'Evening',
        'event-location': 'Event Location',
        'enter-event-location': 'Enter event location here',
        'reporting-dept': 'Reporting Department',
        'responding-dept': 'Responding Department',
        'select-dept': 'Select Department',
        'other-depts': 'Other Concerned Departments',
        'enter-other-depts': 'If any, list other departments',
        
        'patient-info': 'Patient Information',
        'patient-name': 'Patient Name',
        'enter-patient-name': 'Enter patient name',
        'medical-record': 'Medical Record Number',
        'enter-medical-record': 'Enter medical record number',
        'dob': 'Date of Birth',
        'gender': 'Gender',
        'male': 'Male',
        'female': 'Female',
        'patient-type': 'Patient Type',
        'inpatient': 'Inpatient',
        'outpatient': 'Outpatient',
        'staff': 'Staff',
        'visitor': 'Visitor',
        'other': 'Other',
        
        'report-type': 'Report Type',
        'select-report-type': 'Select Report Type',
        'accident': 'Accident',
        'near-miss': 'Near Miss',
        'serious': 'Serious Event',
        'error': 'Error Alert',
        'unsafe': 'Unsafe Condition',
        'event-description': 'Event Description',
        'enter-event-description': 'Write a detailed description of the event here',
        
        'reporter-info': 'Reporter Information',
        'reporter-name': 'Reporter Name',
        'enter-reporter-name': 'Enter reporter name',
        'report-date': 'Report Date',
        'reporter-position': 'Job Title',
        'enter-reporter-position': 'Enter job title',
        'reporter-phone': 'Mobile Number',
        'reporter-email': 'Email',
        
        'actions-taken': 'Actions Taken',
        'enter-actions': 'Describe the actions that were taken',
        
        'event-classification': 'Event Classification',
        'cleaning': 'Cleaning',
        'skin-integrity': 'Skin Integrity',
        'fall': 'Fall',
        'supply-chain': 'Supply Chain Issues',
        'security': 'Security Issues',
        'patient-care': 'Patient Care Management',
        'medical-equipment': 'Medical Equipment Issues',
        'housing': 'Housing',
        'food-services': 'Food Services',
        'occupational-health': 'Occupational Health',
        'hypertension': 'Hypertension',
        'communication': 'Communication Issues',
        'maternal': 'Maternal Issues',
        'serious-incidents': 'Serious Incidents',
        'staff-issues': 'Staff Issues',
        'medical-procedures': 'Medical Procedures',
        'environment-safety': 'Environment / Safety',
        'medical-imaging': 'Medical Imaging',
        'identity-docs': 'Identity / Documents / Consents',
        'infection-control': 'Infection Control Issues',
        'iv-injection': 'IV Injection',
        'medication': 'Medication',
        'radiation-therapy': 'Radiation Therapy',
        'lab-services': 'Laboratory Services',
        'facility-maintenance': 'Facility Maintenance',
        'it-issues': 'IT Issues',
        'clinical-nutrition': 'Clinical Nutrition',
        
        'injury-details': 'Injury Details',
        'had-injury': 'Was there an injury?',
        'yes': 'Yes',
        'no': 'No',
        'injury-type': 'Injury Type',
        'physical': 'Physical',
        'psychic': 'Psychological',
        
        'attachments': 'Attachments',
        'upload-attachments': 'Upload Attachments',
        'upload-hint': 'You can upload multiple files at once (jpg, png, pdf, doc).',
        
        'cancel': 'Cancel / Back',

        // Ticket List Page Translations
        'ticket-list-title': 'Ticket List - Quality and Safety Management System',
        'ticket-list': 'Ticket List',
        'search': 'Search...',
        'filter': 'Filter',
        'ticket-number': 'Ticket Number',
        'response': 'Response',
        'location': 'Location',
        'date': 'Date',
        'actions': 'Actions',
        'view': 'View',
        'track': 'Track',
        'edit': 'Edit',
        'delete': 'Delete',
        'showing': 'Showing',
        'of': 'of',
        
        'previous': 'Previous',
        'next': 'Next',
        'back': 'Back',
        'home': 'Home',
        'confirm-delete': 'Are you sure you want to delete this ticket?',
        'delete-failed': 'Failed to delete ticket',
        'error-fetching-tickets': 'Error fetching tickets.',
        'no-tickets': 'No tickets found',
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'completed': 'Completed',
        'closed': 'Closed',

        // Ticket Details Page Translations
        'view-ticket': 'View Ticket',
        'event-details': 'Event Details',
        'event-date': 'Event Date',
        'event-time': 'Event Time',
        'morning': 'Morning',
        'evening': 'Evening',
        'event-location': 'Event Location',
        'reporting-dept': 'Reporting Department',
        'responding-dept': 'Responding Department',
        
        'patient-info': 'Patient Information',
        'patient-name': 'Patient Name',
        'medical-record-no': 'Medical Record Number',
        'gender': 'Gender',
        'male': 'Male',
        'female': 'Female',
        
        'report-type': 'Report Type',
        'accident': 'Accident',
        'near-miss': 'Near Miss',
        
        'event-description': 'Event Description',
        'has-attachments': 'Has Attachments',
        
        'reporter-info': 'Reporter Information',
        'reporter-name': 'Name',
        'reporter-phone': 'Mobile Number',
        'reporter-position': 'Job Title',
        'reporter-email': 'Email',
        
        'actions-taken': 'Actions Taken',
        
        'event-classification': 'Event Classification',
        'medical-equipment': 'Medical Equipment',
        'infrastructure': 'Infrastructure',
        'security-issues': 'Security Issues',
        
        'injury-details': 'Injury Details',
        'had-injury': 'Was there an injury?',
        'yes': 'Yes',
        'no': 'No',
        'injury-type': 'Injury Type',
        'physical': 'Physical',
        'psychological': 'Psychological',
        
        'add-reply': 'Add Reply / Action from Concerned Authority',
        'write-reply': 'Write your reply here...',
        'send-reply': 'Send Reply',
        'sending': 'Sending...',
        
        'previous-replies': 'Previous Replies',
        'user': 'User',
        
        'back': 'Back',
        'home': 'Home',
        'ticket-not-found': 'Ticket ID not found',
        'error-loading-ticket': 'Error loading ticket data.',
        'error-loading-replies': 'Failed to load replies.',
        'error-sending-reply': 'Error sending reply: ',
        'write-reply-first': 'Write your reply first',

        // Track Request Ticket Page Translations
        'track-ticket': 'Track Ticket',
        'track-request': 'Track Request',
        'next-department': 'Next Department:',
        'track-status-title': 'Track Status',
        'last-update': 'Last Update:',
        'progress-label': 'Request Progress',
        'progress-steps': 'steps completed',
        'completed': 'Completed',
        'pending': 'Under Review',
        'waiting': 'Waiting',
        'closed': 'Closed',
        'approved': 'Approved',
        'reply': 'Reply',
        'sent': 'Sent',
        'expected': 'Expected:',
        'no-data': '—',
        'error-loading-data': 'Error loading data.',
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

    // Update label alignment based on language
    document.querySelectorAll('.form-group label').forEach(label => {
        if (lang === 'ar') {
            label.style.textAlign = 'right';
            label.style.direction = 'rtl';
        } else {
            label.style.textAlign = 'left';
            label.style.direction = 'ltr';
        }
    });

    // Update placeholders and input fields
    document.querySelectorAll('[data-translate-placeholder], [data-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder') || element.getAttribute('data-placeholder');
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

    // Update textarea direction for ticket details page
    document.querySelectorAll('textarea').forEach(textarea => {
        if (lang === 'ar') {
            textarea.style.setProperty('direction', 'rtl', 'important');
            textarea.style.setProperty('text-align', 'right', 'important');
        } else {
            textarea.style.setProperty('direction', 'ltr', 'important');
            textarea.style.setProperty('text-align', 'left', 'important');
        }
    });

    // Update main content direction for ticket details page
    const ticketMainContent = document.querySelector('main.content-wrapper');
    if (ticketMainContent) {
        if (lang === 'ar') {
            ticketMainContent.style.setProperty('direction', 'rtl', 'important');
            ticketMainContent.style.setProperty('text-align', 'right', 'important');
        } else {
            ticketMainContent.style.setProperty('direction', 'ltr', 'important');
            ticketMainContent.style.setProperty('text-align', 'left', 'important');
        }
    }
    
    // Update language button text
    const languageButton = document.querySelector('.language-switcher > a span');
    if (languageButton) {
        languageButton.textContent = lang === 'ar' ? 'عربي' : 'English';
    }

    // Update language button text for ticket details page
    const ticketLanguageBtn = document.querySelector('.language-btn span');
    if (ticketLanguageBtn) {
        ticketLanguageBtn.textContent = lang === 'ar' ? 'عربي' : 'English';
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
  
  // Handle both data-translate-placeholder and data-placeholder attributes
  document.querySelectorAll('[data-translate-placeholder], [data-placeholder]').forEach(element => {
    const key = element.getAttribute('data-translate-placeholder') || element.getAttribute('data-placeholder');
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

function updateTicketDetailsPage(lang) {
  // Update field labels alignment
  document.querySelectorAll('.field-label, .field-label-inline').forEach(label => {
    label.style.textAlign = lang === 'ar' ? 'right' : 'left';
    label.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update field values alignment
  document.querySelectorAll('.field-value').forEach(value => {
    value.style.textAlign = lang === 'ar' ? 'right' : 'left';
    value.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update section titles alignment
  document.querySelectorAll('.section-title').forEach(title => {
    title.style.textAlign = lang === 'ar' ? 'right' : 'left';
    title.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update tags alignment
  document.querySelectorAll('.tag').forEach(tag => {
    tag.style.textAlign = lang === 'ar' ? 'right' : 'left';
    tag.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update timeline content alignment
  document.querySelectorAll('.timeline-text, .timeline-author').forEach(el => {
    el.style.textAlign = lang === 'ar' ? 'right' : 'left';
    el.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update language button text
  const languageBtn = document.querySelector('.language-btn span');
  if (languageBtn) {
    languageBtn.textContent = lang === 'ar' ? 'عربي' : 'English';
  }

  // Update body direction
  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

function updateTrackRequestPage(lang) {
  // Update page title alignment
  document.querySelectorAll('.page-title').forEach(title => {
    title.style.textAlign = lang === 'ar' ? 'right' : 'left';
    title.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update track status title alignment
  document.querySelectorAll('.track-status-title').forEach(title => {
    title.style.textAlign = lang === 'ar' ? 'right' : 'left';
    title.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update progress info alignment
  document.querySelectorAll('.progress-info').forEach(info => {
    info.style.textAlign = lang === 'ar' ? 'right' : 'left';
    info.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update timeline content alignment
  document.querySelectorAll('.timeline-content').forEach(content => {
    content.style.textAlign = lang === 'ar' ? 'right' : 'left';
    content.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update timeline details alignment
  document.querySelectorAll('.timeline-details').forEach(details => {
    details.style.textAlign = lang === 'ar' ? 'right' : 'left';
    details.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
  });

  // Update body direction
  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

// Call all on load and whenever language changes
function applyLanguageUI(lang) {
  updateMainBackBtn(lang);
  updateActionsAlignment(lang);
  updateSearchIcon(lang);
  updateHomeBtn(lang);
  updateModalTexts(lang);
  updateDynamicTextDirection(lang);
  updateTicketDetailsPage(lang);
  updateTrackRequestPage(lang);
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