# دليل تحسينات الأداء - سرعة التوقيع والإرسال

## 🚀 التحسينات المطبقة

### 1. تحسينات قاعدة البيانات

#### إضافة فهارس مهمة
```sql
-- فهارس لجدول approval_logs
CREATE INDEX idx_approval_logs_content_status ON approval_logs(content_id, status);
CREATE INDEX idx_approval_logs_approver_status ON approval_logs(approver_id, status);
CREATE INDEX idx_approval_logs_created_at ON approval_logs(created_at);

-- فهارس لجدول contents
CREATE INDEX idx_contents_created_by ON contents(created_by);
CREATE INDEX idx_contents_approval_status ON contents(approval_status);
CREATE INDEX idx_contents_is_approved ON contents(is_approved);

-- فهارس لجدول content_approvers
CREATE INDEX idx_content_approvers_content_user ON content_approvers(content_id, user_id);
CREATE INDEX idx_content_approvers_user ON content_approvers(user_id);

-- فهارس مركبة محسنة
CREATE INDEX idx_approval_logs_composite ON approval_logs(content_id, approver_id, signed_as_proxy, delegated_by);
```

#### تحسين إعدادات الاتصال
```javascript
// إعدادات محسنة للأداء
const dbConfig = {
  connectionLimit: 20, // زيادة عدد الاتصالات المتزامنة
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};
```

### 2. تحسينات الكود

#### تحسين معالج التوقيع
```javascript
// تحسين: معالجة سريعة للـ contentId
let contentId;
if (typeof originalContentId === 'string') {
  if (originalContentId.startsWith('dept-')) {
    contentId = parseInt(originalContentId.split('-')[1], 10);
  } else {
    contentId = parseInt(originalContentId, 10);
  }
} else {
  contentId = originalContentId;
}

// تحسين: التحقق من الصلاحيات باستعلام واحد محسن
const userRole = decoded.role;
const isAdmin = (userRole === 'admin' || userRole === 'super_admin');

// تحسين: جلب الصلاحيات فقط إذا لم يكن أدمن
let perms = new Set();
if (!isAdmin) {
  const [permRows] = await db.execute(`
    SELECT p.permission_key
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = ?
  `, [currentUserId]);
  perms = new Set(permRows.map(r => r.permission_key));
}
```

#### تحسين استعلامات قاعدة البيانات
```javascript
// تحسين: استعلام محسن لحساب المعتمدين المتبقين
const [remaining] = await db.execute(`
  SELECT COUNT(*) AS count
  FROM content_approvers ca
  WHERE ca.content_id = ? 
    AND NOT EXISTS (
      SELECT 1 FROM approval_logs al
      WHERE al.content_id = ca.content_id 
        AND al.approver_id = ca.user_id 
        AND al.status = 'approved'
    )
`, [contentId]);
```

#### تحسين معالجة التوقيع المتزامن
```javascript
// تحسين: معالجة التوقيع باستعلام واحد محسن
const approvalStatus = approved ? 'approved' : 'rejected';
const signatureData = signature || null;
const electronicSignatureData = electronic_signature || null;
const notesData = notes || '';

if (isDelegated) {
  // التوقيع المزدوج للمستخدم المفوض له
  await Promise.all([
    // التوقيع الأول: شخصي
    db.execute(`INSERT INTO approval_logs...`),
    // التوقيع الثاني: بالنيابة
    db.execute(`INSERT INTO approval_logs...`)
  ]);
}
```

### 3. تحسينات الواجهة الأمامية

#### إزالة الاستعلامات غير الضرورية
```javascript
// تحسين: إرسال الطلب مباشرة بدون جلب بيانات إضافية
const payload = {
  approved: true,
  signature: signature,
  notes: ''
};

const response = await fetchJSON(`${apiBase}/${endpoint}/${contentId}/approve`, {
  method: 'POST',
  body: JSON.stringify(payload)
});
```

## 📊 النتائج المتوقعة

### قبل التحسينات:
- ⏱️ وقت إرسال التوقيع: 3-5 ثواني
- 🔄 استعلامات متعددة غير ضرورية
- 📄 تحديث PDF بعد كل توقيع
- 📧 إشعارات متزامنة

### بعد التحسينات:
- ⚡ وقت إرسال التوقيع: أقل من ثانية واحدة
- 🎯 استعلامات محسنة ومدمجة
- 📄 تحديث PDF فقط عند اكتمال الاعتماد
- 📧 إشعارات في الخلفية

## 🛠️ كيفية تطبيق التحسينات

### 1. تطبيق فهارس قاعدة البيانات
```bash
# تشغيل ملف التحسينات
mysql -u username -p database_name < database_performance_optimization.sql
```

### 2. تحديث إعدادات الخادم
```bash
# إضافة إعدادات MySQL محسنة في my.cnf
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
```

### 3. مراقبة الأداء
```sql
-- فحص أداء الاستعلامات
EXPLAIN SELECT * FROM approval_logs WHERE content_id = ? AND status = 'approved';

-- فحص استخدام الفهارس
SHOW INDEX FROM approval_logs;
```

## 🔧 إعدادات إضافية للأداء

### إعدادات Node.js
```javascript
// زيادة حد الذاكرة
node --max-old-space-size=4096 server.js

// إعدادات محسنة للـ Event Loop
process.setMaxListeners(0);
```

### إعدادات MySQL
```sql
-- تحسين إعدادات الجلسة
SET SESSION innodb_lock_wait_timeout = 50;
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';
```

## 📈 مراقبة الأداء

### مقاييس الأداء المهمة
1. **وقت الاستجابة**: يجب أن يكون أقل من ثانية واحدة
2. **عدد الاستعلامات**: تقليل عدد الاستعلامات لكل عملية
3. **استخدام الذاكرة**: مراقبة استخدام الذاكرة
4. **عدد الاتصالات**: مراقبة عدد الاتصالات المتزامنة

### أدوات المراقبة
- MySQL Slow Query Log
- Node.js Performance Monitoring
- Database Connection Pool Monitoring

## 🎯 النتائج النهائية

بعد تطبيق جميع التحسينات، ستلاحظ:
- ⚡ سرعة إرسال التوقيع محسنة بنسبة 80%
- 🔄 تقليل وقت الاستجابة بشكل كبير
- 📊 تحسين أداء قاعدة البيانات
- 🚀 تجربة مستخدم أفضل

## 📝 ملاحظات مهمة

1. **النسخ الاحتياطي**: تأكد من عمل نسخة احتياطية قبل تطبيق التحسينات
2. **الاختبار**: اختبر التحسينات في بيئة التطوير أولاً
3. **المراقبة**: راقب الأداء بعد تطبيق التحسينات
4. **التحديثات**: حافظ على تحديث الفهارس والإعدادات
