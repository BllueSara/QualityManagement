const fs = require('fs');
const path = require('path');
const { buildJobNameFirstLast } = require('../models/userUtils');

// دالة محسنة لمعالجة النص العربي
const processArabicText = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // تنظيف المسافات المتعددة مع الحفاظ على محارف السطر الجديد
    let cleaned = text.replace(/[^\S\r\n]+/g, ' ').trim();
    
    // تحسين عرض النص العربي في PDF
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    if (arabicPattern.test(cleaned)) {
        // إزالة المسافات الصغيرة التي تم إضافتها سابقاً
        cleaned = cleaned.replace(/\u200B/g, '');
        cleaned = cleaned.replace(/\u200C/g, '');
        cleaned = cleaned.replace(/\u200D/g, '');
        
        // تحسين المسافات بين الكلمات العربية مع الحفاظ على محارف السطر الجديد
        cleaned = cleaned.replace(/[^\S\r\n]+/g, ' ');
        
        console.log('🔍 Processed Arabic text:', cleaned);
    }
    
    return cleaned;
};

// دالة تجهيز النص العربي مع تحسينات إضافية
const prepareArabic = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // استخدام الدالة الجديدة لمعالجة النص العربي مع الحفاظ على الأسطر
    let processed = processArabicText(text);
    
    // تحسينات إضافية للنص العربي
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    if (arabicPattern.test(processed)) {
        // إزالة المسافات الزائدة في بداية ونهاية النص
        processed = processed.trim();
        
        // تحسين المسافات بين الكلمات العربية مع الحفاظ على محارف السطر الجديد
        processed = processed.replace(/[^\S\r\n]+/g, ' ');
        
        // إزالة أي مسافات صغيرة متبقية
        processed = processed.replace(/\u200B/g, '');
        processed = processed.replace(/\u200C/g, '');
        processed = processed.replace(/\u200D/g, '');
        
        // تحسين عرض النص العربي بإضافة مسافات مناسبة
        processed = processed.replace(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])\s+([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])/g, '$1 $2');
        
        console.log('🔍 Final processed Arabic text:', processed);
    }
    
    return processed;
};

// دالة مساعدة لحل مشكلة ترتيب الكلمات العربية
// دالة مساعدة لحل مشكلة ترتيب الكلمات العربية (تعمل مع عدة أسطر)
const fixArabicOrder = (text) => {
    if (typeof text === 'string' && /[\u0600-\u06FF]/.test(text)) {
        // تقسيم النص لأسطر
        return text
            .split(/\r?\n/) // يدعم \n و \r\n
            .map(line => {
                // عكس الكلمات في السطر الواحد
                return line
                    .split(' ')
                    .reverse()
                    .join(' ');
            })
            .join('\n'); // إعادة الأسطر كما هي
    }
    return text;
};



// دالة تنسيق التاريخ
const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        // تنسيق التاريخ بالشكل العربي
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        console.log('📅 Formatting date:', dateString, '->', `${day}/${month}/${year}`);
        return `${day}/${month}/${year}`;
    } catch (error) {
        console.log('❌ Error formatting date:', dateString, error);
        return '';
    }
};

// دالة ترتيب المدة بحيث يأتي الرقم قبل الكلمة (مثال: "10 أيام" بدلاً من "أيام 10")
// تطبق عكس مسبق لمواجهة العكس التلقائي في pdfmake
const normalizeDuration = (value) => {
    if (!value || value === ' ') return '';
    
    const raw = String(value).trim().replace(/\s+/g, ' ');
    if (!raw) return '';
    
    // البحث عن جميع الأرقام (عربية وإنجليزية)
    const allNumbers = raw.match(/[\u0660-\u0669\d]+/g);
    
    if (!allNumbers || allNumbers.length === 0) {
        return raw; // لا توجد أرقام، نعيد النص كما هو
    }
    
    // أخذ أول رقم
    const number = allNumbers[0];
    
    // إزالة جميع الأرقام من النص للحصول على الكلمات فقط
    let textOnly = raw.replace(/[\u0660-\u0669\d]+/g, '').replace(/\s+/g, ' ').trim();
    
    if (!textOnly) {
        return number; // فقط رقم
    }
    
    // نطبق العكس المسبق على جميع النصوص لمواجهة العكس التلقائي في pdfmake
    // لأن pdfmake يعكس جميع النصوص في السياق العربي (RTL context)
    return `${textOnly} ${number}`;
};


// تقسيم نص عربي إلى أسطر منطقية عندما لا توجد \n باستخدام عدد كلمات تقريبي لكل سطر
const splitArabicIntoLinesByWords = (text, maxWordsPerLine = 12) => {
    if (!text || typeof text !== 'string') return [];
    // إذا كان هناك \n بالفعل استخدمها كما هي
    if (/\r?\n/.test(text)) {
        return text.split(/\r?\n/);
    }
    const words = text.trim().split(/\s+/);
    const lines = [];
    for (let i = 0; i < words.length; i += maxWordsPerLine) {
        lines.push(words.slice(i, i + maxWordsPerLine).join(' '));
    }
    return lines;
};


// دالة إنشاء PDF للمحضر
async function generateProtocolPDF(protocolData, db) {
    try {
        // إعداد pdfmake
        const PdfPrinter = require('pdfmake/src/printer');
        
        // تعريف خط Amiri العربي - استخدام الملف المتاح فقط
        const fonts = {
            Amiri: {
                normal: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
                bold: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
                italics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
                bolditalics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf')
            }
        };

        let printer;
        try {
            printer = new PdfPrinter(fonts);
        } catch (fontError) {
            console.log('⚠️ Error with Amiri font, using default fonts');
            printer = new PdfPrinter();
        }

        // إنشاء محتوى المحضر
        const content = [];

        // تحميل شعاري النظام والمستشفى وإضافتهما أعلى الصفحة
        let systemTitleDataUrl = null;
        let hospitalLogoDataUrl = null;
        try {
            const systemTitlePath = path.join(__dirname, '../../frontend/images/system-title.png');
            if (fs.existsSync(systemTitlePath)) {
                const base64 = fs.readFileSync(systemTitlePath).toString('base64');
                systemTitleDataUrl = 'data:image/png;base64,' + base64;
            }
        } catch (e) {
            console.log('⚠️ system-title.png not found or unreadable');
        }
        try {
            const hospitalLogoPath = path.join(__dirname, '../../frontend/images/hospital-logo.png');
            if (fs.existsSync(hospitalLogoPath)) {
                const base64 = fs.readFileSync(hospitalLogoPath).toString('base64');
                hospitalLogoDataUrl = 'data:image/png;base64,' + base64;
            }
        } catch (e) {
            console.log('⚠️ hospital-logo.png not found or unreadable');
        }

        if (systemTitleDataUrl || hospitalLogoDataUrl) {
            content.push({
                columns: [
                    // يسار: شعار المستشفى
                    hospitalLogoDataUrl ? { image: hospitalLogoDataUrl, width: 110, alignment: 'left' } : { text: '' },
                    { text: '', width: '*' },
                    // يمين: شعار النظام
                    systemTitleDataUrl ? { image: systemTitleDataUrl, width: 110, alignment: 'right' } : { text: '' }
                ],
                // ارفع الشعارين للأعلى قليلًا بمقدار 12px
                margin: [0, -12, 0, 10]
            });
        }

        // معلومات المحضر الأساسية في جدول منظم
         const infoTableBody = [
             [
                 { text: formatDate(protocolData.created_at), style: 'infoCell', alignment: 'center' },
                 { text: fixArabicOrder('تاريخ المحضر'), style: 'infoHeader', alignment: 'center' },
             ],
             [
                 { text: fixArabicOrder(prepareArabic(protocolData.createdByName || protocolData.created_by_name || ' ')), style: 'infoCell', alignment: 'center' },
                 { text: fixArabicOrder('صاحب المحضر'), style: 'infoHeader', alignment: 'center' },
             ]
         ];

        content.push({
            table: {
                headerRows: 0,
                widths: ['50%', '50%'],
                body: infoTableBody
            },
            layout: {
                hLineWidth: function(i, node) {
                    return 1;
                },
                vLineWidth: function(i, node) {
                    return 1;
                },
                hLineColor: function(i, node) {
                    return '#000000';
                },
                vLineColor: function(i, node) {
                    return '#000000';
                }
            },
            margin: [0, 0, 0, 30]
        });

        // مواضيع المحضر في جدول منظم
        if (protocolData.topics && protocolData.topics.length > 0) {

            // عنوان المحضر يوضع فوق جدول المواضيع
            content.push({
                text: fixArabicOrder(prepareArabic(protocolData.title)),
                style: 'title',
                alignment: 'center',
                margin: [0, 0, 0, 20]
            });

            // إنشاء جدول منظم للمواضيع
            const topicsTableBody = [];
            
                         // إضافة رأس الجدول (من اليمين لليسار)
             topicsTableBody.push([
                 { text: fixArabicOrder('تاريخ الانتهاء'), style: 'tableHeader', alignment: 'center' },
                 { text: fixArabicOrder('المدة'), style: 'tableHeader', alignment: 'center' },
                 { text: fixArabicOrder('المناقشة'), style: 'tableHeader', alignment: 'center' },
                 { text: fixArabicOrder('الموضوع'), style: 'tableHeader', alignment: 'center' }
             ]);

                        // إضافة بيانات المواضيع (من اليمين لليسار)
            protocolData.topics.forEach((topic, index) => {
                // تقسيم المناقشة والموضوع إلى أسطر كما أُدخلت (تشخيص للترتيب)
                const discussionLines = splitArabicIntoLinesByWords(String(topic.discussion || ' '));
                const subjectLines = splitArabicIntoLinesByWords(String(topic.subject || ''));
                console.log('🧪 Topic #'+(index+1)+' discussion lines (top→bottom):', discussionLines);
                console.log('🧪 Topic #'+(index+1)+' subject lines (top→bottom):', subjectLines);

                // حساب عدد المناقشات الجانبية الصالحة
                const validSideDiscussions = topic.sideDiscussions && Array.isArray(topic.sideDiscussions) 
                    ? topic.sideDiscussions.filter(sd => sd.content && sd.content.trim()) 
                    : [];
                const totalRows = 1 + validSideDiscussions.length; // الصف الرئيسي + المناقشات الجانبية

                // إضافة صف الموضوع الرئيسي
                topicsTableBody.push([
                    { 
                        text: topic.end_date ? formatDate(topic.end_date) : ' ', 
                        style: 'tableCell',
                        alignment: 'center'
                    },
                    { 
                        text: normalizeDuration(topic.duration), 
                        style: 'tableCell',
                        alignment: 'center',
                        bidi: false
                    },
                    {
                        // عرض المناقشة الرئيسية كسطور منفصلة والحفاظ على ترتيب الأسطر، مع عكس الكلمات داخل السطر للعربية
                        stack: discussionLines.map(line => fixArabicOrder(prepareArabic(line))),
                        style: 'rtlCell',
                        alignment: 'right',
                        lineHeight: 1.2
                    },
                    {
                        // دعم أسطر متعددة في الموضوع مع عكس الكلمات داخل السطر والحفاظ على ترتيب الأسطر
                        // دمج الصفوف لتشمل جميع المناقشات الجانبية
                        stack: subjectLines.map(line => fixArabicOrder(prepareArabic(line))),
                        style: 'tableCell',
                        alignment: 'center',
                        lineHeight: 1.2,
                        rowSpan: totalRows
                    }
                ]);

                // إضافة المناقشات الجانبية كصفوف منفصلة
                validSideDiscussions.forEach((sideDiscussion, sideIndex) => {
                    const sideDiscussionLines = splitArabicIntoLinesByWords(String(sideDiscussion.content));
                    // إضافة رقم قبل المناقشة الجانبية
                    const numberedDiscussion = [`${sideIndex + 1}- ${sideDiscussionLines[0] || ''}`];
                    // إضافة باقي الأسطر بدون رقم
                    for (let i = 1; i < sideDiscussionLines.length; i++) {
                        numberedDiscussion.push(sideDiscussionLines[i]);
                    }
                    
                    topicsTableBody.push([
                        { 
                            text: sideDiscussion.end_date ? formatDate(sideDiscussion.end_date) : ' ', 
                            style: 'tableCell',
                            alignment: 'center'
                        },
                        { 
                            text: normalizeDuration(sideDiscussion.duration) || ' ', 
                            style: 'tableCell',
                            alignment: 'center',
                            bidi: false
                        },
                        {
                            // عرض المناقشة الجانبية مع الرقم كسطور منفصلة
                            stack: numberedDiscussion.map(line => fixArabicOrder(prepareArabic(line))),
                            style: 'rtlCell',
                            alignment: 'right',
                            lineHeight: 1.2
                        },
                        // لا نضيف خانة الموضوع هنا لأنها مدمجة في الصف الأول
                        {}
                    ]);
                });
            });

            // إضافة جدول المواضيع
            content.push({
                table: {
                    headerRows: 1,
                    widths: ['15%', '15%', '45%', '25%'],
                    body: topicsTableBody
                },
                layout: {
                    hLineWidth: function(i, node) {
                        return 1;
                    },
                    vLineWidth: function(i, node) {
                        return 1;
                    },
                    hLineColor: function(i, node) {
                        return '#000000';
                    },
                    vLineColor: function(i, node) {
                        return '#000000';
                    },
                    fillColor: function(rowIndex, node, columnIndex) {
                        return (rowIndex === 0) ? '#e6e6e6' : null;
                    }
                },
                margin: [0, 0, 0, 20]
            });
        }

        // إضافة صفحة الاعتمادات مع البيانات الفعلية أو الفارغة
        if (protocolData.approvers && protocolData.approvers.length > 0) {
            // إنشاء جدول الاعتمادات
            const approvalTableBody = [];
            
            // إضافة رأس الجدول باللغة الإنجليزية
            approvalTableBody.push([
                { text: 'Approvals', style: 'tableHeader' },
                { text: 'Name', style: 'tableHeader' },
                { text: 'Position', style: 'tableHeader' },
                { text: 'Approval Method', style: 'tableHeader' },
                { text: 'Signature', style: 'tableHeader' },
                { text: 'Date', style: 'tableHeader' }
            ]);

            // جلب بيانات الاعتمادات الفعلية إذا كانت موجودة
            let approvalLogs = [];
            try {
                const [logs] = await db.pool.execute(`
                    SELECT
                        pal.signed_as_proxy,
                        pal.approver_id,
                        pal.signature,
                        pal.electronic_signature,
                        pal.created_at,
                        pal.delegated_by,
                        u.first_name,
                        u.last_name,
                        jt.title as job_title,
                        jn.name as job_name
                    FROM protocol_approval_logs pal
                    JOIN users u ON pal.approver_id = u.id
                    LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                    LEFT JOIN job_names jn ON u.job_name_id = jn.id
                    WHERE pal.protocol_id = ? AND pal.status = 'approved'
                    ORDER BY pal.created_at
                `, [protocolData.id]);
                approvalLogs = logs;
            } catch (error) {
                console.log('⚠️ Could not fetch approval logs:', error);
            }
            
            console.log(`🔍 Fetched ${approvalLogs.length} approval logs`);
            approvalLogs.forEach((log, index) => {
                console.log(`🔍 Log ${index + 1}: approver_id=${log.approver_id}, signed_as_proxy=${log.signed_as_proxy}, delegated_by=${log.delegated_by}`);
            });

            // إضافة صفوف لكل معتمد
            for (let index = 0; index < protocolData.approvers.length; index++) {
                const approver = protocolData.approvers[index];
                // استخدام buildJobNameFirstLast لبناء الاسم
                const approverName = buildJobNameFirstLast(
                    approver.job_name,
                    approver.first_name,
                    approver.last_name
                ) || approver.approver_name || 'N/A';

                const approvalType = index === 0 ? 'Reviewed' : 
                                    index === protocolData.approvers.length - 1 ? 'Approver' : 'Reviewed';

                // البحث عن بيانات الاعتماد الفعلية - نبحث أولاً عن التوقيع بالنيابة
                let actualApproval = approvalLogs.find(log => log.approver_id === approver.user_id && log.signed_as_proxy === 1);
                
                // إذا لم نجد توقيع بالنيابة، نبحث عن التوقيع الشخصي
                if (!actualApproval) {
                    actualApproval = approvalLogs.find(log => log.approver_id === approver.user_id && log.signed_as_proxy === 0);
                }
                
                console.log(`🔍 Selected approval for approver ${approver.user_id}: signed_as_proxy=${actualApproval ? actualApproval.signed_as_proxy : 'N/A'}, delegated_by=${actualApproval ? actualApproval.delegated_by : 'N/A'}`);
                
                let approvalMethod = '';
                let signature = '';
                let approvalDate = '';

                if (actualApproval) {
                    // إذا كان هناك اعتماد فعلي
                    approvalMethod = actualApproval.signature ? 'Hand Signature' : 
                                    actualApproval.electronic_signature ? 'Electronic Signature' : 'Not Specified';
                    
                    if (actualApproval.signature && actualApproval.signature.startsWith('data:image')) {
                        signature = { image: actualApproval.signature, width: 40, height: 20, alignment: 'center' };
                    } else if (actualApproval.electronic_signature) {
                        // قراءة ختم الاعتماد الإلكتروني
                        try {
                            const electronicSealBase64 = fs.readFileSync(path.join(__dirname, '../e3teamdelc.png')).toString('base64');
                            const electronicSealDataUrl = 'data:image/png;base64,' + electronicSealBase64;
                            signature = { image: electronicSealDataUrl, width: 40, height: 20, alignment: 'center' };
                        } catch (e) {
                            signature = { text: '✓', style: 'tableCell' };
                        }
                    } else {
                        signature = { text: '✓', style: 'tableCell' };
                    }
                    
                    approvalDate = new Date(actualApproval.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                } else {
                    // إذا لم يكن هناك اعتماد فعلي، اترك الحقول فارغة
                    signature = { text: '', style: 'tableCell' };
                }

                // تحديد نوع الاعتماد بناءً على ما إذا كان التوقيع بالنيابة أم لا
                let finalApprovalType = approvalType;
                console.log(`🔍 Approver ${approver.user_id}: signed_as_proxy = ${actualApproval ? actualApproval.signed_as_proxy : 'N/A'}`);
                if (actualApproval && actualApproval.signed_as_proxy === 1) {
                    finalApprovalType = approvalType + ' (Proxy)';
                    console.log(`✅ Setting ${finalApprovalType} for proxy signature`);
                }
                
                approvalTableBody.push([
                    { text: finalApprovalType, style: 'tableCell' },
                    { text: approverName, style: 'tableCell' },
                    { text: approver.job_title || 'Not Specified', style: 'tableCell' },
                    { text: approvalMethod, style: 'tableCell' },
                    signature,
                    { text: approvalDate, style: 'tableCell' }
                ]);

                // إذا كان هناك توقيع بالنيابة، أضف صف "Proxy for" يوضح من هو المفوض الأصلي
                if (actualApproval && actualApproval.signed_as_proxy === 1 && actualApproval.delegated_by) {
                    // جلب اسم المفوض الأصلي
                    let originalUser = null;
                    try {
                        const [originalUserRows] = await db.pool.execute(`
                            SELECT 
                                u.first_name,
                                u.last_name,
                                jt.title as job_title,
                                jn.name as job_name
                            FROM users u
                            LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                            LEFT JOIN job_names jn ON u.job_name_id = jn.id
                            WHERE u.id = ?
                        `, [actualApproval.delegated_by]);
                        
                        if (originalUserRows.length > 0) {
                            originalUser = originalUserRows[0];
                        }
                    } catch (error) {
                        console.log('⚠️ Could not fetch original user data:', error);
                    }

                    if (originalUser) {
                        // بناء اسم المفوض الأصلي
                        const originalUserName = buildJobNameFirstLast(
                            originalUser.job_name,
                            originalUser.first_name,
                            originalUser.last_name
                        ) || 'N/A';

                        // إضافة صف "Proxy for"
                        approvalTableBody.push([
                            { text: '(Proxy for)', style: 'proxyCell' },
                            { text: originalUserName, style: 'proxyCell' },
                            { text: originalUser.job_title || 'Not Specified', style: 'proxyCell' },
                            { text: 'Delegated', style: 'proxyCell' },
                            { text: '', style: 'proxyCell' },
                            { text: '', style: 'proxyCell' }
                        ]);
                    }
                }
            }

            // إضافة جدول الاعتمادات
            content.push({
                pageBreak: 'before', // بدء صفحة جديدة
                table: {
                    headerRows: 1,
                    widths: ['15%', '20%', '20%', '20%', '10%', '15%'],
                    body: approvalTableBody
                },
                layout: {
                    hLineWidth: function(i, node) {
                        return 1;
                    },
                    vLineWidth: function(i, node) {
                        return 1;
                    },
                    hLineColor: function(i, node) {
                        return '#000000';
                    },
                    vLineColor: function(i, node) {
                        return '#000000';
                    },
                    fillColor: function(rowIndex, node, columnIndex) {
                        return (rowIndex === 0) ? '#e6e6e6' : null;
                    }
                },
                margin: [0, 0, 0, 20]
            });
        }

        // إنشاء تعريف المستند
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
            
            defaultStyle: {
                font: 'Amiri',
                fontSize: 12
            },
            styles: {
                title: {
                    fontSize: 22,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                sectionTitle: {
                    fontSize: 18,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 20, 0, 15]
                },
                topicTitle: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 10, 0, 5]
                },
                infoHeader: {
                    bold: true,
                    fontSize: 12,
                    color: 'black',
                    alignment: 'center',
                    fillColor: '#f0f0f0'
                },
                infoCell: {
                    fontSize: 11,
                    alignment: 'center'
                },
                tableHeader: {
                    bold: true,
                    fontSize: 11,
                    color: 'black',
                    alignment: 'center',
                    fillColor: '#e6e6e6'
                },
                tableCell: {
                    fontSize: 10,
                    alignment: 'center'
                },
                rtlCell: {
                    fontSize: 10,
                    alignment: 'right'
                },
                proxyCell: {
                    fontSize: 9,
                    alignment: 'center',
                    color: '#666666',
                    fillColor: '#f9f9f9'
                }
            },
            content: content
        };

        // إنشاء PDF
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const pdfChunks = [];
        
        return new Promise((resolve, reject) => {
            pdfDoc.on('data', (chunk) => {
                pdfChunks.push(chunk);
            });
            
            pdfDoc.on('end', () => {
                try {
                    const pdfBuffer = Buffer.concat(pdfChunks);
                    resolve(pdfBuffer);
                } catch (error) {
                    reject(error);
                }
            });
            
            pdfDoc.on('error', (error) => {
                reject(error);
            });
            
            pdfDoc.end();
        });

    } catch (error) {
        console.error('❌ Error generating protocol PDF:', error);
        throw error;
    }
}

// دالة حفظ PDF للمحضر
async function saveProtocolPDF(protocolId, protocolData, db) {
    try {
        // إنشاء مجلد المحاضر إذا لم يكن موجوداً
        const uploadsDir = path.join(__dirname, '../../uploads/protocols');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // إنشاء اسم الملف
        const fileName = `protocol_${protocolId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);
        const relativePath = `protocols/${fileName}`;

        // إنشاء PDF
        const pdfBuffer = await generateProtocolPDF(protocolData, db);

        // حفظ الملف
        fs.writeFileSync(filePath, pdfBuffer);

        // تحديث مسار الملف في قاعدة البيانات
        await db.updatePdfPath(protocolId, relativePath);

        console.log(`✅ Protocol PDF saved: ${filePath}`);
        return { success: true, filePath: relativePath, fullPath: filePath };

    } catch (error) {
        console.error('❌ Error saving protocol PDF:', error);
        throw error;
    }
}

// دالة جديدة لتحديث PDF بعد كل اعتماد فوري (نفس تصميم approvalController.js)
async function updateProtocolPDFAfterApproval(protocolId, db) {
    try {
        // 1) جلب مسار الملف
        const [fileRows] = await db.pool.execute(
            `SELECT file_path FROM protocols WHERE id = ? AND deleted_at IS NULL`,
            [protocolId]
        );
        if (!fileRows.length) {
            return console.error('📁 Protocol not found for ID', protocolId);
        }
        const relativePath = fileRows[0].file_path;
        const fullPath = path.join(__dirname, '../../uploads/', relativePath);
        if (!fs.existsSync(fullPath)) {
            return console.error('❌ File not found on disk:', fullPath);
        }

        // 2) تحميل وثيقة الـ PDF الأصلية
        let originalPdfBytes;
        let electronicSealDataUrl;
        try {
            originalPdfBytes = fs.readFileSync(fullPath);
            // قراءة ختم الاعتماد الإلكتروني كـ base64 مرة واحدة
            const electronicSealBase64 = fs.readFileSync(path.join(__dirname, '../e3teamdelc.png')).toString('base64');
            electronicSealDataUrl = 'data:image/png;base64,' + electronicSealBase64;
        } catch (err) {
            return console.error('❌ Failed to load original PDF or electronic seal:', err);
        }

        // 3) جلب سجلات الاعتماد بما فيها التفويض مع معلومات إضافية
        const [logs] = await db.pool.execute(`
            SELECT
                pal.signed_as_proxy,
                CONCAT(
                    COALESCE(u_actual.first_name, ''),
                    CASE WHEN u_actual.second_name IS NOT NULL AND u_actual.second_name != '' THEN CONCAT(' ', u_actual.second_name) ELSE '' END,
                    CASE WHEN u_actual.third_name IS NOT NULL AND u_actual.third_name != '' THEN CONCAT(' ', u_actual.third_name) ELSE '' END,
                    CASE WHEN u_actual.last_name IS NOT NULL AND u_actual.last_name != '' THEN CONCAT(' ', u_actual.last_name) ELSE '' END
                ) AS actual_signer,
                CONCAT(
                    COALESCE(u_original.first_name, ''),
                    CASE WHEN u_original.second_name IS NOT NULL AND u_original.second_name != '' THEN CONCAT(' ', u_original.second_name) ELSE '' END,
                    CASE WHEN u_original.third_name IS NOT NULL AND u_original.third_name != '' THEN CONCAT(' ', u_actual.third_name) ELSE '' END,
                    CASE WHEN u_original.last_name IS NOT NULL AND u_original.last_name != '' THEN CONCAT(' ', u_original.last_name) ELSE '' END
                ) AS original_user,
                u_actual.first_name AS actual_first_name,
                u_actual.second_name AS actual_second_name,
                u_actual.third_name AS actual_third_name,
                u_actual.last_name AS actual_last_name,
                u_original.first_name AS original_first_name,
                u_original.second_name AS original_second_name,
                u_original.third_name AS original_third_name,
                u_original.last_name AS original_last_name,
                pal.signature,
                pal.electronic_signature,
                pal.comments,
                pal.created_at,
                jt_actual.title AS signer_job_title,
                jt_original.title AS original_job_title,
                jn_actual.name AS signer_job_name,
                jn_original.name AS original_job_name
            FROM protocol_approval_logs pal
            JOIN users u_actual
                ON pal.approver_id = u_actual.id
            LEFT JOIN job_titles jt_actual
                ON u_actual.job_title_id = jt_actual.id
            LEFT JOIN job_names jn_actual
                ON u_actual.job_name_id = jn_actual.id
            LEFT JOIN users u_original
                ON pal.delegated_by = u_original.id
            LEFT JOIN job_titles jt_original
                ON u_original.job_title_id = jt_original.id
            LEFT JOIN job_names jn_original
                ON u_original.job_name_id = jn_original.id
            WHERE pal.protocol_id = ? AND pal.status = 'approved'
            ORDER BY pal.created_at
        `, [protocolId]);

        if (!logs.length) {
            console.warn('⚠️ No approved signatures found for protocol', protocolId);
            return;
        }
        
        console.log(`🔍 Fetched ${logs.length} approval logs for updateProtocolPDFAfterApproval`);
        logs.forEach((log, index) => {
            console.log(`🔍 Log ${index + 1}: signed_as_proxy=${log.signed_as_proxy}, delegated_by=${log.delegated_by}`);
        });

        // 4) إعداد pdfmake
        const PdfPrinter = require('pdfmake/src/printer');

        // دالة مساعدة لبناء الاسم الكامل من الأجزاء
        const buildFullName = (firstName, secondName, thirdName, lastName) => {
            const nameParts = [firstName, secondName, thirdName, lastName].filter(part => part && part.trim());
            return nameParts.join(' ');
        };

        // تعريف خط Amiri العربي
        const fonts = {
            Amiri: {
                normal: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
                bold: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
                italics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf'),
                bolditalics: path.join(__dirname, '../../fonts/Amiri-Regular.ttf')
            }
        };

        let printer;
        try {
            printer = new PdfPrinter(fonts);
        } catch (fontError) {
            console.log('⚠️ Error with Amiri font, using default fonts');
            printer = new PdfPrinter();
        }

        // 5) إنشاء محتوى صفحة الاعتمادات المحدثة باستخدام pdfmake
        const approvalTableBody = [];
        
        // إضافة رأس الجدول
        approvalTableBody.push([
            { text: 'Approvals', style: 'tableHeader' },
            { text: 'Name', style: 'tableHeader' },
            { text: 'Position', style: 'tableHeader' },
            { text: 'Approval Method', style: 'tableHeader' },
            { text: 'Signature', style: 'tableHeader' },
            { text: 'Date', style: 'tableHeader' }
        ]);

        // تجميع التوقيعات لتجنب التكرار في التفويض الجماعي
        const groupedSignatures = new Map();
        
        for (const log of logs) {
            const signerId = log.actual_signer;
            
            if (!groupedSignatures.has(signerId)) {
                groupedSignatures.set(signerId, {
                    personalLog: null,
                    proxyLog: null,
                    signerData: log
                });
            }
            
            const group = groupedSignatures.get(signerId);
            if (log.signed_as_proxy === 0) {
                group.personalLog = log;
            } else if (log.signed_as_proxy === 1) {
                group.proxyLog = log;
            }
        }

        // إضافة بيانات الاعتمادات
        let rowIndex = 1;
        const getSignatureCell = (log) => {
            if (log.signature && log.signature.startsWith('data:image')) {
                return { image: log.signature, width: 40, height: 20, alignment: 'center' };
            } else if (log.electronic_signature) {
                return { image: electronicSealDataUrl, width: 40, height: 20, alignment: 'center' };
            } else {
                return { text: '✓', style: 'tableCell' };
            }
        };

        for (const [signerId, group] of groupedSignatures) {
            // استخدام البيانات الشخصية إذا كانت متوفرة، وإلا استخدام بيانات التفويض
            const mainLog = group.personalLog || group.proxyLog;
            
            const approvalType = rowIndex === 1 ? 'Reviewed' : 
                                rowIndex === groupedSignatures.size ? 'Approver' : 'Reviewed';
            
            const approvalMethod = mainLog.signature ? 'Hand Signature' : 
                                  mainLog.electronic_signature ? 'Electronic Signature' : 'Not Specified';
            
            const approvalDate = new Date(mainLog.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            // بناء الاسم مع job_name + الاسم الأول + الاسم الأخير فقط
            const actualSignerFullNameWithJobName = buildJobNameFirstLast(
                mainLog.signer_job_name,
                mainLog.actual_first_name,
                mainLog.actual_last_name
            ) || mainLog.actual_signer || 'N/A';

            // تحديد نوع الاعتماد بناءً على ما إذا كان التوقيع بالنيابة أم لا
            let finalApprovalType = approvalType;
            console.log(`🔍 MainLog signed_as_proxy = ${mainLog.signed_as_proxy}`);
            if (mainLog.signed_as_proxy === 1) {
                finalApprovalType = approvalType + ' (Proxy)';
                console.log(`✅ Setting ${finalApprovalType} for proxy signature in updateProtocolPDFAfterApproval`);
            }
            
            // إضافة صف الموقّع الرئيسي
            approvalTableBody.push([
                { text: finalApprovalType, style: 'tableCell' },
                { text: actualSignerFullNameWithJobName, style: 'tableCell' },
                { text: mainLog.signer_job_title || 'Not Specified', style: 'tableCell' },
                { text: approvalMethod, style: 'tableCell' },
                getSignatureCell(mainLog),
                { text: approvalDate, style: 'tableCell' }
            ]);

            // إذا كان هناك توقيع بالنيابة، أضف صف "Proxy for"
            if (group.proxyLog && group.proxyLog.original_user) {
                // بناء الاسم مع job_name + الاسم الأول + الاسم الأخير فقط للمفوض الأصلي
                const originalUserFullNameWithJobName = buildJobNameFirstLast(
                    group.proxyLog.original_job_name,
                    group.proxyLog.original_first_name,
                    group.proxyLog.original_last_name
                ) || group.proxyLog.original_user || 'N/A';

                approvalTableBody.push([
                    { text: '(Proxy for)', style: 'proxyCell' },
                    { text: originalUserFullNameWithJobName, style: 'proxyCell' },
                    { text: group.proxyLog.original_job_title || 'Not Specified', style: 'proxyCell' },
                    { text: 'Delegated', style: 'proxyCell' },
                    { text: '', style: 'proxyCell' },
                    { text: '', style: 'proxyCell' }
                ]);
            }

            rowIndex++;
        }

        // 6) إنشاء تعريف المستند باستخدام pdfmake
        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
            defaultStyle: {
                font: 'Amiri',
                fontSize: 10
            },
            styles: {
                title: {
                    fontSize: 18,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                tableHeader: {
                    bold: true,
                    fontSize: 9,
                    color: 'black',
                    alignment: 'center',
                    fillColor: '#e6e6e6'
                },
                tableCell: {
                    fontSize: 8,
                    alignment: 'center'
                },
                proxyCell: {
                    fontSize: 8,
                    alignment: 'center',
                    color: '#666666',
                    fillColor: '#f9f9f9'
                }
            },
            content: [
                {
                    table: {
                        headerRows: 1,
                        widths: ['15%', '20%', '20%', '20%', '10%', '15%'],
                        body: approvalTableBody
                    },
                    layout: {
                        hLineWidth: function(i, node) {
                            return 1;
                        },
                        vLineWidth: function(i, node) {
                            return 1;
                        },
                        vLineColor: function(i, node) {
                            return '#000000';
                        },
                        hLineColor: function(i, node) {
                            return '#000000';
                        }
                    }
                }
            ]
        };

        // 7) إنشاء PDF جديد باستخدام pdfmake
        const approvalPdfDoc = printer.createPdfKitDocument(docDefinition);
        const approvalPdfChunks = [];
        
        approvalPdfDoc.on('data', (chunk) => {
            approvalPdfChunks.push(chunk);
        });
        
        approvalPdfDoc.on('end', async () => {
            try {
                const approvalPdfBuffer = Buffer.concat(approvalPdfChunks);
                
                // 8) إنشاء PDF جديد كامل مع البيانات المحدثة
                try {
                    // نحتاج إلى جلب بيانات المحضر الكاملة مع المعتمدين الحاليين
                    const protocol = await db.getProtocolById(protocolId, 1); // استخدام admin ID = 1
                    if (protocol) {
                        // إنشاء PDF جديد يحتوي على جدول الاعتمادات المحدث
                        const newPdfBuffer = await generateProtocolPDF(protocol, db);
                        fs.writeFileSync(fullPath, newPdfBuffer);
                        console.log(`✅ Protocol PDF completely regenerated with updated approval data: ${fullPath}`);
                    } else {
                        // إذا لم نتمكن من جلب البيانات، نحفظ PDF الأصلي كما هو
                        fs.writeFileSync(fullPath, originalPdfBytes);
                        console.log(`✅ Preserved original PDF (could not regenerate): ${fullPath}`);
                    }
                } catch (regenerateError) {
                    console.error('❌ Error regenerating PDF:', regenerateError);
                    // في حالة الفشل، نحفظ PDF الأصلي كما هو
                    fs.writeFileSync(fullPath, originalPdfBytes);
                    console.log(`✅ Preserved original PDF due to regeneration error: ${fullPath}`);
                }
            } catch (mergeError) {
                console.error('❌ Error updating PDF:', mergeError);
                try {
                    // في حالة الفشل، نحفظ PDF الأصلي كما هو
                    fs.writeFileSync(fullPath, originalPdfBytes);
                    console.log(`✅ Preserved original PDF due to update error: ${fullPath}`);
                } catch (saveError) {
                    console.error('❌ Error preserving original PDF:', saveError);
                }
            }
        });
        
        approvalPdfDoc.on('error', (error) => {
            console.error('❌ Error in PDF generation:', error);
        });
        
        approvalPdfDoc.end();
    } catch (err) {
        console.error('❌ Error updating protocol PDF after approval:', err);
    }
}

module.exports = {
    generateProtocolPDF,
    saveProtocolPDF,
    updateProtocolPDFAfterApproval,
    prepareArabic,
    fixArabicOrder,
    formatDate
};
