const protocolModel = require('../models/protocolModel');
const { getFullNameSQLWithAliasAndFallback } = require('../models/userUtils');
const { saveProtocolPDF, updateProtocolPDFAfterApproval } = require('../utils/protocolPdfGenerator');
const { logAction } = require('../models/logger');
const { insertNotification, sendOwnerApprovalNotification, sendPartialApprovalNotification, sendProxyNotification } = require('../models/notfications-utils');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// متغير عام لتخزين التفويضات النشطة (نفس طريقة approvalController.js)
const globalProxies = {};

// تم إزالة دالة التحقق من التسلسل لأنه لم يعد مطلوباً

class ProtocolController {
    // إنشاء محضر جديد
    async createProtocol(req, res) {
        try {
            const { 
                protocolTitle, 
                protocolDate, 
                topics, 
                assignmentType, 
                departmentId, 
                folderId, 
                committeeId 
            } = req.body;
            const userId = req.user.id;

            // التحقق من البيانات المطلوبة
            if (!protocolTitle || !protocolDate) {
                return res.status(400).json({
                    success: false,
                    message: 'عنوان المحضر وتاريخه مطلوبان'
                });
            }

            if (!topics || topics.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'يجب إضافة موضوع واحد على الأقل'
                });
            }

            // التحقق من صحة المواضيع
            for (const topic of topics) {
                if (!topic.subject || !topic.discussion) {
                    return res.status(400).json({
                        success: false,
                        message: 'موضوع المحضر وموضوع المناقشة مطلوبان لكل موضوع'
                    });
                }

                // التحقق من صحة المناقشات الجانبية إن وجدت
                if (topic.sideDiscussions && Array.isArray(topic.sideDiscussions)) {
                    for (const sideDiscussion of topic.sideDiscussions) {
                        if (sideDiscussion.content && !sideDiscussion.content.trim()) {
                            return res.status(400).json({
                                success: false,
                                message: 'محتوى المناقشة الجانبية لا يمكن أن يكون فارغاً'
                            });
                        }
                    }
                }
            }

            const protocolData = {
                protocolTitle,
                protocolDate,
                topics,
                assignmentType,
                departmentId,
                folderId,
                committeeId
            };

            const result = await protocolModel.createProtocol(protocolData, userId);

            // إنشاء PDF للمحضر بعد إنشائه
            try {
                const protocol = await protocolModel.getProtocolById(result.protocolId, userId);
                if (protocol) {
                    await saveProtocolPDF(result.protocolId, protocol, protocolModel);
                    console.log(`Protocol PDF generated successfully for protocol ${result.protocolId}`);
                }
            } catch (pdfError) {
                console.error('Error generating protocol PDF:', pdfError);
                // لا نوقف العملية إذا فشل إنشاء PDF
            }

            console.log(`Protocol created successfully by user ${userId}`, {
                protocolId: result.protocolId,
                userId: userId
            });

            try {
                await logAction(
                    userId,
                    'create_protocol',
                    JSON.stringify({
                        ar: `تم إنشاء محضر جديد برقم ${result.protocolId}`,
                        en: `Created new protocol #${result.protocolId}`
                    }),
                    'approval',
                    result.protocolId
                );
            } catch (_) {}

            res.status(201).json({
                success: true,
                message: result.message,
                protocolId: result.protocolId
            });

        } catch (error) {
            console.error('Error creating protocol:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء المحضر'
            });
        }
    }

    

    // جلب جميع المحاضر
    async getAllProtocols(req, res) {
        try {
            const userId = req.user.id;
            const { search, userOnly = false } = req.query;

            const filters = {
                search: search || null,
                userOnly: userOnly === 'true'
            };

            const protocols = await protocolModel.getAllProtocols(userId, filters);

            // تنسيق البيانات للعرض
            const formattedProtocols = protocols.map(protocol => ({
                id: protocol.id,
                title: protocol.title,
                protocolDate: protocol.protocol_date,
                createdAt: protocol.created_at,
                status: protocol.status,
                approvalStatus: protocol.approval_status,
                isApproved: protocol.is_approved,
                createdByName: protocol.created_by_name,
                topicsCount: protocol.topics_count,
                latestEndDate: protocol.latest_end_date
            }));

            res.json({
                success: true,
                data: formattedProtocols,
                total: formattedProtocols.length
            });

        } catch (error) {
            console.error('Error getting protocols:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب المحاضر'
            });
        }
    }

    // جلب محضر واحد
    async getProtocolById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const protocol = await protocolModel.getProtocolById(id, userId);

            if (!protocol) {
                return res.status(404).json({
                    success: false,
                    message: 'المحضر غير موجود'
                });
            }

            // تنسيق البيانات للعرض
            const formattedProtocol = {
                id: protocol.id,
                title: protocol.title,
                protocolDate: protocol.protocol_date,
                createdAt: protocol.created_at,
                updatedAt: protocol.updated_at,
                status: protocol.status,
                approvalStatus: protocol.approval_status,
                isApproved: protocol.is_approved,
                filePath: protocol.file_path,
                createdByName: protocol.created_by_name,
                topics: protocol.topics.map(topic => ({
                    id: topic.id,
                    subject: topic.subject,
                    discussion: topic.discussion,
                    duration: topic.duration,
                    endDate: topic.end_date,
                    topicOrder: topic.topic_order,
                    sideDiscussions: (topic.sideDiscussions || []).map(sideDiscussion => ({
                        id: sideDiscussion.id,
                        content: sideDiscussion.content,
                        duration: sideDiscussion.duration,
                        endDate: sideDiscussion.end_date,
                        discussionOrder: sideDiscussion.discussion_order
                    }))
                })),
                approvers: protocol.approvers.map(approver => ({
                    id: approver.id,
                    userId: approver.user_id,
                    sequenceNumber: approver.sequence_number,
                    approverName: approver.approver_name
                })),
                approvalLogs: protocol.approvalLogs.map(log => ({
                    id: log.id,
                    approverId: log.approver_id,
                    delegatedBy: log.delegated_by,
                    signedAsProxy: log.signed_as_proxy,
                    status: log.status,
                    signature: log.signature,
                    electronicSignature: log.electronic_signature,
                    comments: log.comments,
                    createdAt: log.created_at,
                    approverName: log.approver_name,
                    delegatedByName: log.delegated_by_name
                }))
            };

            res.json({
                success: true,
                data: formattedProtocol
            });

        } catch (error) {
            console.error('Error getting protocol by ID:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب المحضر'
            });
        }
    }

    // تحديث محضر
    async updateProtocol(req, res) {
        try {
            const { id } = req.params;
            const { 
                protocolTitle, 
                protocolDate, 
                topics, 
                assignmentType, 
                departmentId, 
                folderId, 
                committeeId 
            } = req.body;
            const userId = req.user.id;

            // التحقق من البيانات المطلوبة
            if (!protocolTitle || !protocolDate) {
                return res.status(400).json({
                    success: false,
                    message: 'عنوان المحضر وتاريخه مطلوبان'
                });
            }

            if (!topics || topics.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'يجب إضافة موضوع واحد على الأقل'
                });
            }

            // التحقق من صحة المواضيع
            for (const topic of topics) {
                if (!topic.subject || !topic.discussion) {
                    return res.status(400).json({
                        success: false,
                        message: 'موضوع المحضر وموضوع المناقشة مطلوبان لكل موضوع'
                    });
                }

                // التحقق من صحة المناقشات الجانبية إن وجدت
                if (topic.sideDiscussions && Array.isArray(topic.sideDiscussions)) {
                    for (const sideDiscussion of topic.sideDiscussions) {
                        if (sideDiscussion.content && !sideDiscussion.content.trim()) {
                            return res.status(400).json({
                                success: false,
                                message: 'محتوى المناقشة الجانبية لا يمكن أن يكون فارغاً'
                            });
                        }
                    }
                }
            }

            const protocolData = {
                protocolTitle,
                protocolDate,
                topics,
                assignmentType,
                departmentId,
                folderId,
                committeeId
            };

            const result = await protocolModel.updateProtocol(id, protocolData, userId);

            // حذف أي ملفات PDF سابقة تخص هذا المحضر (سيتم إنشاء جديد)
            try {
                const uploadsBase = path.join(__dirname, '../../uploads');
                const protocolsDir = path.join(uploadsBase, 'protocols');
                if (fs.existsSync(protocolsDir)) {
                    const prefix = `protocol_${id}_`;
                    const files = fs.readdirSync(protocolsDir);
                    for (const file of files) {
                        if (file.startsWith(prefix) && file.endsWith('.pdf')) {
                            const filePath = path.join(protocolsDir, file);
                            try { fs.unlinkSync(filePath); } catch (_) {}
                        }
                    }
                }
            } catch (cleanupErr) {
                console.warn('cleanup protocol PDFs after update failed:', cleanupErr);
            }

            // إنشاء PDF جديد للمحضر بعد تحديثه
            try {
                const protocol = await protocolModel.getProtocolById(id, userId);
                if (protocol) {
                    await saveProtocolPDF(id, protocol, protocolModel);
                    console.log(`Protocol PDF updated successfully for protocol ${id}`);
                }
            } catch (pdfError) {
                console.error('Error updating protocol PDF:', pdfError);
                // لا نوقف العملية إذا فشل تحديث PDF
            }

            console.log(`Protocol updated successfully by user ${userId}`, {
                protocolId: id,
                userId: userId
            });

            try {
                await logAction(
                    userId,
                    'update_protocol',
                    JSON.stringify({
                        ar: `تم تحديث المحضر رقم ${id}`,
                        en: `Updated protocol #${id}`
                    }),
                    'approval',
                    id
                );
            } catch (_) {}

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('Error updating protocol:', error);
            
            if (error.message === 'المحضر غير موجود') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث المحضر'
            });
        }
    }

    // حذف محضر
    async deleteProtocol(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            // جلب مسار الملف قبل الحذف
            const [rows] = await protocolModel.pool.execute(
                'SELECT file_path FROM protocols WHERE id = ?',
                [id]
            );

            if (!rows.length) {
                return res.status(404).json({
                    success: false,
                    message: 'المحضر غير موجود'
                });
            }

            const currentFileRelative = rows[0].file_path;

            // حذف السجل من قاعدة البيانات (سيحذف الجداول التابعة عبر CASCADE)
            const result = await protocolModel.deleteProtocol(id, userId);

            // محاولة حذف ملف PDF الحالي إن وجد + تنظيف أي ملفات قديمة للمحضر نفسه
            try {
                const uploadsBase = path.join(__dirname, '../../uploads');
                if (currentFileRelative) {
                    const absolutePath = path.join(uploadsBase, currentFileRelative);
                    if (fs.existsSync(absolutePath)) {
                        fs.unlinkSync(absolutePath);
                    }
                }

                // حذف أي ملفات سابقة تخص نفس المحضر وفق النمط protocol_<id>_*.pdf
                const protocolsDir = path.join(uploadsBase, 'protocols');
                if (fs.existsSync(protocolsDir)) {
                    const prefix = `protocol_${id}_`;
                    const files = fs.readdirSync(protocolsDir);
                    for (const file of files) {
                        if (file.startsWith(prefix) && file.endsWith('.pdf')) {
                            const filePath = path.join(protocolsDir, file);
                            try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
                        }
                    }
                }
            } catch (fsErr) {
                console.error('Error removing protocol files:', fsErr);
            }

            console.log(`Protocol deleted successfully by user ${userId}`, {
                protocolId: id,
                userId: userId
            });

            try {
                await logAction(
                    userId,
                    'delete_protocol',
                    JSON.stringify({
                        ar: `تم حذف المحضر رقم ${id}`,
                        en: `Deleted protocol #${id}`
                    }),
                    'approval',
                    id
                );
            } catch (_) {}

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('Error deleting protocol:', error);
            
            if (error.message === 'المحضر غير موجود') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء حذف المحضر'
            });
        }
    }

    // جلب إحصائيات المحاضر
    async getProtocolStats(req, res) {
        try {
            const userId = req.user.id;

            const stats = await protocolModel.getProtocolStats(userId);

            res.json({
                success: true,
                data: {
                    totalProtocols: stats.total_protocols,
                    todayProtocols: stats.today_protocols,
                    thisWeekProtocols: stats.this_week_protocols
                }
            });

        } catch (error) {
            console.error('Error getting protocol stats:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إحصائيات المحاضر'
            });
        }
    }

    // جلب المحاضر المعلقة للمستخدم - بنفس منطق approvalController.getAssignedApprovals
    async getPendingApprovals(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user?.role;

            // فحص صلاحيات "transfer_credits" لتحديد رؤية شاملة (مثل الأدمن)
            const [permRows] = await protocolModel.pool.execute(`
                SELECT p.permission_key
                FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = ?
            `, [userId]);
            const permsSet = new Set(permRows.map(r => r.permission_key));
            const canViewAll = userRole === 'admin' || permsSet.has('transfer_credits');

            let allRows = [];

            if (canViewAll) {
                // للأدمن: رؤية شاملة دون قيود التسلسل أو استثناء التفويضات المقبولة
                const [rows] = await protocolModel.pool.execute(`
                    SELECT
                        p.id,
                        p.title,
                        p.protocol_date,
                        p.file_path,
                        p.approval_status,
                        p.is_approved,
                        p.created_at,
                        ${getFullNameSQLWithAliasAndFallback('u')} AS created_by_name,
                        (SELECT COUNT(*) FROM protocol_topics WHERE protocol_id = p.id) AS topics_count,
                        (SELECT MAX(end_date) FROM protocol_topics WHERE protocol_id = p.id) AS latest_end_date,
                        (
                          SELECT CONCAT('[', GROUP_CONCAT(pa2.user_id SEPARATOR ','), ']')
                          FROM protocol_approvers pa2
                          WHERE pa2.protocol_id = p.id
                        ) AS approvers_required,
                        (
                          SELECT GROUP_CONCAT(
                                   ${getFullNameSQLWithAliasAndFallback('u2')}
                                   SEPARATOR ','
                                 )
                          FROM protocol_approvers pa2
                          LEFT JOIN users u2 ON pa2.user_id = u2.id
                          WHERE pa2.protocol_id = p.id
                        ) AS assigned_approvers
                    FROM protocols p
                    LEFT JOIN users u ON p.created_by = u.id
                    WHERE p.is_approved = 0
                    GROUP BY p.id
                `);
                allRows = rows;
            } else {
                // رؤية المستخدم العادي - العناصر المكلف بها فقط
                const [rows] = await protocolModel.pool.execute(`
                    SELECT
                        p.id,
                        p.title,
                        p.protocol_date,
                        p.file_path,
                        p.approval_status,
                        p.is_approved,
                        p.created_at,
                        ${getFullNameSQLWithAliasAndFallback('u')} AS created_by_name,
                        (SELECT COUNT(*) FROM protocol_topics WHERE protocol_id = p.id) AS topics_count,
                        (SELECT MAX(end_date) FROM protocol_topics WHERE protocol_id = p.id) AS latest_end_date,
                        (
                          SELECT CONCAT('[', GROUP_CONCAT(pa2.user_id SEPARATOR ','), ']')
                          FROM protocol_approvers pa2
                          WHERE pa2.protocol_id = p.id
                        ) AS approvers_required,
                        (
                          SELECT GROUP_CONCAT(
                                   ${getFullNameSQLWithAliasAndFallback('u2')}
                                   SEPARATOR ','
                                 )
                          FROM protocol_approvers pa2
                          LEFT JOIN users u2 ON pa2.user_id = u2.id
                          WHERE pa2.protocol_id = p.id
                        ) AS assigned_approvers
                    FROM protocols p
                    JOIN protocol_approvers pa ON pa.protocol_id = p.id AND (
                      pa.user_id = ? OR pa.user_id IN (
                        SELECT ad.user_id FROM active_delegations ad WHERE ad.delegate_id = ?
                      )
                    )
                    LEFT JOIN users u ON p.created_by = u.id
                    WHERE p.is_approved = 0
                      AND NOT EXISTS (
                        SELECT 1 FROM protocol_approval_logs pal_ex
                        WHERE pal_ex.protocol_id = p.id
                          AND pal_ex.delegated_by = ?
                          AND pal_ex.signed_as_proxy = 1
                          AND pal_ex.status = 'accepted'
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM protocol_approval_logs pal
                        WHERE pal.protocol_id = p.id
                          AND pal.approver_id = ?
                          AND pal.status = 'approved'
                      )
                      AND NOT EXISTS (
                        SELECT 1
                        FROM protocol_approvers pa_prev
                        WHERE pa_prev.protocol_id = p.id
                          AND pa_prev.sequence_number < pa.sequence_number
                          AND NOT EXISTS (
                            SELECT 1 FROM protocol_approval_logs pal_prev
                            WHERE pal_prev.protocol_id = p.id
                              AND (
                                (pal_prev.approver_id = pa_prev.user_id AND pal_prev.signed_as_proxy = 0 AND pal_prev.status = 'approved')
                                OR
                                (pal_prev.delegated_by = pa_prev.user_id AND pal_prev.signed_as_proxy = 1 AND pal_prev.status = 'approved')
                              )
                          )
                      )
                    GROUP BY p.id, pa.sequence_number
                `, [userId, userId, userId, userId]);
                allRows = rows;
            }

            // إزالة فلترة التسلسل - جميع المعتمدين يمكنهم الوصول للمحاضر المكلفين بها
            let finalRows = allRows;

            // ترتيب بالإنشاء الأحدث
            finalRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // تنسيق الإخراج ليتوافق مع الواجهة الحالية
            const formatted = finalRows.map(p => ({
                id: p.id,
                title: p.title,
                protocolDate: p.protocol_date,
                approvalStatus: p.approval_status,
                isApproved: p.is_approved,
                filePath: p.file_path,
                file_path: p.file_path,
                createdAt: p.created_at,

                createdByName: p.created_by_name,
                approvers_required: p.approvers_required,
                topicsCount: p.topics_count,
                latestEndDate: p.latest_end_date,
                assignedApprovers: p.assigned_approvers,
                assigned_approvers: p.assigned_approvers
            }));

            return res.json({ success: true, data: formatted });
        } catch (error) {
            console.error('Error getting pending approvals:', error);
            return res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب المحاضر المعلقة' });
        }
    }

    // جلب سجل الاعتمادات للمحضر
    async getApprovalLogs(req, res) {
        try {
            const protocolId = req.params.id;
            const userId = req.user.id;

            // التحقق من وجود المحضر
            const protocol = await protocolModel.getProtocolById(protocolId, userId);
            if (!protocol) {
                return res.status(404).json({
                    success: false,
                    message: 'المحضر غير موجود'
                });
            }

            // جلب سجل الاعتمادات
            const approvalLogs = await protocolModel.getApprovalLogs(protocolId);

            res.json({
                success: true,
                data: approvalLogs
            });

        } catch (error) {
            console.error('Error getting protocol approval logs:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب سجل الاعتمادات'
            });
        }
    }

    // تراك المحضر (مماثل لتراك المحتوى)
    async getProtocolTrack(req, res) {
        try {
            const { id } = req.params;

            // 1) تفاصيل المحضر الأساسية
            const [protocolRows] = await protocolModel.pool.execute(`
                SELECT 
                    p.*,
                    ${getFullNameSQLWithAliasAndFallback('u')} AS created_by_name
                FROM protocols p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.id = ?
            `, [id]);

            if (!protocolRows.length) {
                return res.status(404).json({ status: 'error', message: 'Protocol not found.' });
            }
            const protocol = protocolRows[0];

            // 2) سجل الاعتمادات (الجدول الزمني) - استثناء sender_signature
            const [timelineRows] = await protocolModel.pool.execute(`
                SELECT 
                    pal.status,
                    pal.comments,
                    pal.created_at,
                    ${getFullNameSQLWithAliasAndFallback('u')} AS approver,
                    jt.title AS job_title
                FROM protocol_approval_logs pal
                JOIN users u ON pal.approver_id = u.id
                LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                WHERE pal.protocol_id = ? AND pal.status != 'sender_signature'
                ORDER BY pal.created_at ASC
            `, [id]);

            // 3) المعتمدون الذين لم يوقعوا بعد
            const [pendingApproversRows] = await protocolModel.pool.execute(`
                SELECT 
                    ${getFullNameSQLWithAliasAndFallback('u')} AS approver,
                    jt.title AS job_title
                FROM protocol_approvers pa
                JOIN users u ON pa.user_id = u.id
                LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                WHERE pa.protocol_id = ?
                  AND NOT EXISTS (
                    SELECT 1
                    FROM protocol_approval_logs pal
                    WHERE pal.protocol_id = pa.protocol_id
                      AND pal.approver_id = pa.user_id
                      AND pal.status = 'approved'
                  )
                ORDER BY pa.sequence_number
            `, [id]);

            res.json({
                status: 'success',
                protocol,
                timeline: timelineRows,
                pending: pendingApproversRows
            });
        } catch (err) {
            console.error('❌ Error fetching protocol track info:', err);
            res.status(500).json({ status: 'error', message: 'Failed to fetch protocol track info.' });
        }
    }


    // اعتماد/رفض محضر - محسن للأداء (نفس طريقة approvalController.js)
    async handleApproval(req, res) {
        let { id: originalProtocolId } = req.params;
        const { approved, signature, notes, electronic_signature, on_behalf_of } = req.body;

        let protocolId;
        let isCommitteeContent = false;

        if (typeof originalProtocolId === 'string') {
            if (originalProtocolId.startsWith('dept-')) {
                protocolId = parseInt(originalProtocolId.split('-')[1], 10);
                isCommitteeContent = false;
            } else if (originalProtocolId.startsWith('comm-')) {
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'محتوى اللجان يجب أن يتم اعتماده عبر API اللجان المنفصل' 
                });
            } else {
                protocolId = parseInt(originalProtocolId, 10);
                isCommitteeContent = false;
            }
        } else {
            protocolId = originalProtocolId;
            isCommitteeContent = false;
        }

        if (typeof approved !== 'boolean') {
            return res.status(400).json({ status: 'error', message: 'البيانات ناقصة' });
        }

        if (approved === true && !signature && !electronic_signature) {
            return res.status(400).json({ status: 'error', message: 'التوقيع مفقود' });
        }

        try {
            
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            let currentUserId = decoded.id;
            
            // إذا كان المستخدم مفوض شخص آخر، نفذ الاعتماد باسم المفوض له
            if (globalProxies && globalProxies[currentUserId]) {
                currentUserId = globalProxies[currentUserId];
            }

            // التحقق من صلاحيات المستخدم للأدمن أولاً
            const userRole = decoded.role;
            const [permRows] = await protocolModel.pool.execute(`
                SELECT p.permission_key
                FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = ?
            `, [currentUserId]);
            const perms = new Set(permRows.map(r => r.permission_key));
            const isAdmin = (userRole === 'admin' || perms.has('transfer_credits'));

            let allData = [];
            let protocolData = null;

            if (isAdmin) {
                // للأدمن: جلب بيانات المحضر مباشرة بدون التحقق من protocol_approvers
                const [protocolRows] = await protocolModel.pool.execute(`
                    SELECT 
                        p.id,
                        p.title,
                        p.created_by,
                        p.is_approved
                    FROM protocols p
                    WHERE p.id = ?
                `, [protocolId]);

                if (!protocolRows.length) {
                    return res.status(404).json({ status: 'error', message: 'المحضر غير موجود' });
                }

                protocolData = protocolRows[0];
                // للأدمن: تعيين sequence_number = 1 للسماح بالاعتماد
                allData = [{
                    sequence_number: 1,
                    title: protocolData.title,
                    created_by: protocolData.created_by,
                    is_approved: protocolData.is_approved,
                    is_delegated: 0,
                    delegator_id: null,
                    has_personal_log: 0,
                    has_proxy_log: 0,
                    personal_log_id: null,
                    proxy_log_id: null,
                    personal_status: null,
                    proxy_status: null
                }];
            } else {
                // للمستخدمين العاديين: التحقق من protocol_approvers
                const [approverData] = await protocolModel.pool.execute(`
                    SELECT 
                        p.title,
                        p.created_by,
                        p.is_approved,
                        CASE WHEN ad.user_id IS NOT NULL THEN 1 ELSE 0 END as is_delegated,
                        ad.user_id as delegator_id,
                        CASE WHEN pal_personal.id IS NOT NULL THEN 1 ELSE 0 END as has_personal_log,
                        CASE WHEN pal_proxy.id IS NOT NULL THEN 1 ELSE 0 END as has_proxy_log,
                        pal_personal.id as personal_log_id,
                        pal_proxy.id as proxy_log_id,
                        pal_personal.status as personal_status,
                        pal_proxy.status as proxy_status
                    FROM protocol_approvers pa
                    JOIN protocols p ON p.id = pa.protocol_id
                    LEFT JOIN active_delegations ad ON ad.delegate_id = pa.user_id
                    LEFT JOIN protocol_approval_logs pal_personal ON pal_personal.protocol_id = pa.protocol_id 
                        AND pal_personal.approver_id = pa.user_id 
                        AND pal_personal.signed_as_proxy = 0 
                        AND pal_personal.delegated_by IS NULL
                    LEFT JOIN protocol_approval_logs pal_proxy ON pal_proxy.protocol_id = pa.protocol_id 
                        AND pal_proxy.approver_id = pa.user_id 
                        AND pal_proxy.signed_as_proxy = 1 
                        AND pal_proxy.delegated_by = ad.user_id
                    WHERE pa.protocol_id = ? AND pa.user_id = ?
                `, [protocolId, currentUserId]);

                if (!approverData.length) {
                    return res.status(404).json({ status: 'error', message: 'المستخدم غير مكلف بهذا المحضر' });
                }

                allData = approverData;
            }

            const data = allData[0];
            const currentSequence = data.sequence_number;
            const isDelegated = data.is_delegated === 1;
            const delegatorId = data.delegator_id;
            const hasPersonalLog = data.has_personal_log === 1;
            const hasProxyLog = data.has_proxy_log === 1;
            const personalLogId = data.personal_log_id;
            const proxyLogId = data.proxy_log_id;
            const personalStatus = data.personal_status;
            const proxyStatus = data.proxy_status;

            // إزالة التحقق من التسلسل - يمكن لجميع المعتمدين التوقيع في نفس الوقت

            // ——— منطق التوقيع المزدوج للمفوض له ———
            let delegatedBy = null;
            let isProxy = false;
            let singleDelegationRows = [];

            if (isDelegated) {
                // المستخدم مفوض له تفويض جماعي - سيتم الاعتماد مرتين تلقائياً
                delegatedBy = null;
                isProxy = false;
            } else {
                // تحقق من التفويضات الفردية المقبولة
                const [singleDelegationRowsResult] = await protocolModel.pool.execute(`
                    SELECT delegated_by, signed_as_proxy
                    FROM protocol_approval_logs
                    WHERE protocol_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'accepted'
                    LIMIT 1
                `, [protocolId, currentUserId]);

                singleDelegationRows = singleDelegationRowsResult;

                if (singleDelegationRows.length) {
                    // المستخدم مفوض له تفويض فردي مقبول
                    const singleDelegatorId = singleDelegationRows[0].delegated_by;
                    
                    // التحقق من وجود المفوض الأصلي في تسلسل المعتمدين
                    const [delegatorSequenceCheck] = await protocolModel.pool.execute(
                        `SELECT sequence_number FROM protocol_approvers WHERE protocol_id = ? AND user_id = ?`,
                        [protocolId, singleDelegatorId]
                    );
                    
                    if (delegatorSequenceCheck.length) {
                        // التوقيع بالنيابة عن المفوض الأصلي
                        delegatedBy = singleDelegatorId;
                        isProxy = true;
                    }
                } else if (on_behalf_of) {
                    // المستخدم ليس مفوض له، تحقق من السجلات القديمة
                    const [existing] = await protocolModel.pool.execute(`
                        SELECT delegated_by, signed_as_proxy
                        FROM protocol_approval_logs
                        WHERE protocol_id = ? AND approver_id = ?
                        LIMIT 1
                    `, [protocolId, currentUserId]);

                    if (existing.length && existing[0].signed_as_proxy === 1) {
                        delegatedBy = existing[0].delegated_by;
                        isProxy = true;
                    }
                }
            }

            // استخدم currentUserId كموقّع فعلي
            const approverId = currentUserId;

            const approvalLogsTable = 'protocol_approval_logs';
            const protocolApproversTable = 'protocol_approvers';
            const protocolsTable = 'protocols';

            // منطق الاعتماد - محسن للأداء
            if (isDelegated) {
                // التفويض الجماعي: توقيعين (شخصي + بالنيابة)
                // التوقيع الأول: شخصي
                await protocolModel.pool.execute(`
                    INSERT INTO ${approvalLogsTable} (
                        protocol_id,
                        approver_id,
                        delegated_by,
                        signed_as_proxy,
                        status,
                        signature,
                        electronic_signature,
                        comments,
                        created_at
                    )
                    VALUES (?, ?, NULL, 0, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE 
                        status = VALUES(status),
                        signature = VALUES(signature),
                        electronic_signature = VALUES(electronic_signature),
                        comments = VALUES(comments),
                        created_at = NOW()
                `, [
                    protocolId,
                    approverId,
                    approved ? 'approved' : 'rejected',
                    signature || null,
                    electronic_signature || null,
                    notes || ''
                ]);
                
                // التوقيع الثاني: بالنيابة
                await protocolModel.pool.execute(`
                    INSERT INTO ${approvalLogsTable} (
                        protocol_id,
                        approver_id,
                        delegated_by,
                        signed_as_proxy,
                        status,
                        signature,
                        electronic_signature,
                        comments,
                        created_at
                    )
                    VALUES (?, ?, ?, 1, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE 
                        status = VALUES(status),
                        signature = VALUES(signature),
                        electronic_signature = VALUES(electronic_signature),
                        comments = VALUES(comments),
                        created_at = NOW()
                `, [
                    protocolId,
                    approverId,
                    delegatorId,
                    approved ? 'approved' : 'rejected',
                    signature || null,
                    electronic_signature || null,
                    notes || ''
                ]);
            } else if (isProxy) {
                // التفويض الفردي: توقيع واحد فقط بالنيابة
                await protocolModel.pool.execute(`
                    INSERT INTO ${approvalLogsTable} (
                        protocol_id,
                        approver_id,
                        delegated_by,
                        signed_as_proxy,
                        status,
                        signature,
                        electronic_signature,
                        comments,
                        created_at
                    )
                    VALUES (?, ?, ?, 1, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE 
                        status = VALUES(status),
                        signature = VALUES(signature),
                        electronic_signature = VALUES(electronic_signature),
                        comments = VALUES(comments),
                        created_at = NOW()
                `, [
                    protocolId,
                    approverId,
                    delegatedBy,
                    approved ? 'approved' : 'rejected',
                    signature || null,
                    electronic_signature || null,
                    notes || ''
                ]);
            } else {
                // المستخدم عادي: توقيع واحد شخصي
                await protocolModel.pool.execute(`
                    INSERT INTO ${approvalLogsTable} (
                        protocol_id,
                        approver_id,
                        delegated_by,
                        signed_as_proxy,
                        status,
                        signature,
                        electronic_signature,
                        comments,
                        created_at
                    )
                    VALUES (?, ?, NULL, 0, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE 
                        status = VALUES(status),
                        signature = VALUES(signature),
                        electronic_signature = VALUES(electronic_signature),
                        comments = VALUES(comments),
                        created_at = NOW()
                `, [
                    protocolId,
                    approverId,
                    approved ? 'approved' : 'rejected',
                    signature || null,
                    electronic_signature || null,
                    notes || ''
                ]);
            }

            // إضافة المستخدم المفوض له إلى protocol_approvers إذا لم يكن موجوداً
            // فقط للمستخدمين المفوض لهم تفويض جماعي (ليس للتفويضات الفردية)
            if (isDelegated && approved) {
                await protocolModel.pool.execute(
                    `INSERT IGNORE INTO ${protocolApproversTable} (protocol_id, user_id) VALUES (?, ?)`,
                    [protocolId, approverId]
                );
            }

            // تحديث حالة التفويض الفردي إلى 'approved' قبل حساب المعتمدين المتبقين
            if (singleDelegationRows && singleDelegationRows.length > 0) {
                await protocolModel.pool.execute(`
                    UPDATE protocol_approval_logs 
                    SET status = ? 
                    WHERE protocol_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'accepted'
                `, [approved ? 'approved' : 'rejected', protocolId, currentUserId]);
            }

            // جلب عدد المعتمدين المتبقين قبل إشعارات صاحب المحضر
            const [remaining] = await protocolModel.pool.execute(`
                SELECT COUNT(*) AS count
                FROM protocol_approvers pa
                LEFT JOIN active_delegations ad ON ad.delegate_id = pa.user_id
                LEFT JOIN protocol_approval_logs pal_personal ON pal_personal.protocol_id = pa.protocol_id 
                    AND pal_personal.approver_id = pa.user_id 
                    AND pal_personal.signed_as_proxy = 0 
                    AND pal_personal.status = 'approved'
                LEFT JOIN protocol_approval_logs pal_proxy ON pal_proxy.protocol_id = pa.protocol_id 
                    AND pal_proxy.approver_id = pa.user_id 
                    AND pal_proxy.signed_as_proxy = 1 
                    AND pal_proxy.status = 'approved'
                LEFT JOIN protocol_approval_logs pal_single ON pal_single.protocol_id = pa.protocol_id 
                    AND pal_single.approver_id = pa.user_id 
                    AND pal_single.signed_as_proxy = 1 
                    AND pal_single.status = 'approved'
                WHERE pa.protocol_id = ? 
                    AND pal_single.id IS NULL
                    AND (
                        CASE 
                            WHEN ad.user_id IS NULL THEN
                                -- المستخدم العادي: لا يوجد توقيع شخصي
                                pal_personal.id IS NULL
                            ELSE
                                -- المستخدم المفوض له: لا يوجد توقيع شخصي أو لا يوجد توقيع بالنيابة
                                (pal_personal.id IS NULL OR pal_proxy.id IS NULL)
                        END
                    )
            `, [protocolId]);

            // استخدام البيانات المحفوظة مسبقاً للوق
            const itemTitle = data.title || `رقم ${protocolId}`;

            // ✅ log action
            const logDescription = {
                ar: `تم ${approved ? 'اعتماد' : 'رفض'} المحضر: "${itemTitle}"${isProxy ? ' كمفوض عن مستخدم آخر' : ''}`,
                en: `${approved ? 'Approved' : 'Rejected'} protocol: "${itemTitle}"${isProxy ? ' as a proxy' : ''}`
            };

            await logAction(
              currentUserId,
              approved ? 'approve_protocol' : 'reject_protocol',
              JSON.stringify(logDescription),
              'approval',
              protocolId
            );

            // استخدام البيانات المحفوظة مسبقاً للإشعارات
            const ownerId = data.created_by;
            const fileTitle = data.title || '';
            
            // إذا لم يكتمل الاعتماد النهائي، أرسل إشعار اعتماد جزئي
            if (approved && remaining[0].count > 0) {
                // جلب اسم المعتمد
                const [approverRows] = await protocolModel.pool.execute(`
                    SELECT 
                        CONCAT(
                            COALESCE(first_name, ''),
                            CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
                            CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
                            CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
                        ) AS full_name
                    FROM users WHERE id = ?`, [approverId]);
                const approverName = approverRows.length ? approverRows[0].full_name : '';
                await sendPartialApprovalNotification(ownerId, fileTitle, approverName, false);
            }
            // تحديث حالة المحضر عند الرفض أو عند اعتماد غير نهائي
            if (!approved) {
                await protocolModel.pool.execute(`
                    UPDATE protocols
                    SET is_approved = 0,
                        approval_status = 'rejected',
                        approved_by = NULL,
                        updated_at = NOW()
                    WHERE id = ?
                `, [protocolId]);
            } else if (approved && remaining[0].count > 0) {
                await protocolModel.pool.execute(`
                    UPDATE protocols
                    SET is_approved = 0,
                        approval_status = 'pending',
                        approved_by = NULL,
                        updated_at = NOW()
                    WHERE id = ?
                `, [protocolId]);
            }
            // إذا اكتمل الاعتماد النهائي، أرسل إشعار "تم اعتماد المحضر"
            if (remaining[0].count === 0) {
                await sendOwnerApprovalNotification(ownerId, fileTitle, approved, false);
            }

            // في حالة الرفض: أرسل إشعار بالرفض لصاحب المحضر مباشرة
            if (!approved) {
                // جلب اسم الرافض
                const [rejUserRows] = await protocolModel.pool.execute(`
                    SELECT CONCAT(
                        COALESCE(u.first_name, ''),
                        CASE WHEN u.second_name IS NOT NULL AND u.second_name != '' THEN CONCAT(' ', u.second_name) ELSE '' END,
                        CASE WHEN u.third_name IS NOT NULL AND u.third_name != '' THEN CONCAT(' ', u.third_name) ELSE '' END,
                        CASE WHEN u.last_name IS NOT NULL AND u.last_name != '' THEN CONCAT(' ', u.last_name) ELSE '' END
                    ) AS full_name
                    FROM users u WHERE u.id = ?
                `, [approverId]);
                const rejectedByName = rejUserRows.length ? rejUserRows[0].full_name : '';

                // إرسال إشعار الرفض لصاحب المحضر مباشرة
                try {
                    const { sendRejectionNotification } = require('../models/notfications-utils');
                    await sendRejectionNotification(ownerId, fileTitle, rejectedByName, notes || '', false, true);
                } catch (_) {}
            }



            // تحديث PDF بعد كل اعتماد - جعلها غير متزامنة لتجنب التأخير
            if (approved) {
                // تشغيل تحديث PDF في الخلفية بدون انتظار مع تحسين الأداء
                setImmediate(() => {
                    updateProtocolPDFAfterApproval(protocolId, protocolModel).catch(err => {
                        console.error('Error updating protocol PDF after approval:', err);
                    });
                });
            }

            // التحقق من أن جميع التوقيعات كانت موافقة قبل تحديث الحالة إلى معتمد
            if (remaining[0].count === 0 && approved) {
                // تشغيل توليد PDF النهائي في الخلفية بدون انتظار مع تحسين الأداء

                
                await protocolModel.pool.execute(`
                    UPDATE ${protocolsTable}
                    SET is_approved = 1,
                        approval_status = 'approved',
                        approved_by = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [approverId, protocolId]);
            }

            res.status(200).json({ status: 'success', message: 'تم التوقيع بنجاح' });
        } catch (err) {
            console.error('Error in handleApproval:', err);
            res.status(500).json({ status: 'error', message: 'خطأ أثناء معالجة الاعتماد' });
        }
    }


    // إضافة معتمد لمحضر
    async addApprover(req, res) {
        try {
            const { id } = req.params;
            const { userId, sequenceNumber } = req.body;
            const currentUserId = req.user.id;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'معرف المستخدم مطلوب'
                });
            }

            // معالجة التفويض الشامل: إذا كان المستخدم الأصلي قد فوّض شخصاً شاملاً، نرسل للمفوّض له بدلاً منه
            let finalApproverId = userId;
            let delegatedBy = null;
            let signedAsProxy = 0;

            // الحالة 1: المستخدم الأصلي قام بتفويض شامل لشخص آخر → استخدم المفوض له بدلاً منه
            const [delegatedToRows] = await protocolModel.pool.execute(
                'SELECT delegate_id FROM active_delegations WHERE user_id = ? LIMIT 1',
                [userId]
            );
            if (delegatedToRows.length) {
                finalApproverId = delegatedToRows[0].delegate_id;
                delegatedBy = userId;
                signedAsProxy = 1;
            } else {
                // الحالة 2: المستخدم هو مفوض له لشخص آخر
                const [delegationRows] = await protocolModel.pool.execute(
                    'SELECT user_id FROM active_delegations WHERE delegate_id = ? LIMIT 1',
                    [userId]
                );
                if (delegationRows.length) {
                    delegatedBy = delegationRows[0].user_id;
                    signedAsProxy = 1;
                }
            }

            const result = await protocolModel.addApprover(id, finalApproverId, sequenceNumber);

            // إضافة سجل انتظار في protocol_approval_logs حسب التفويض
            try {
                await protocolModel.pool.execute(`
                    INSERT INTO protocol_approval_logs (
                        protocol_id, approver_id, status, comments, signed_as_proxy, delegated_by, created_at
                    ) VALUES (?, ?, 'pending', NULL, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE status = VALUES(status), created_at = NOW()
                `, [id, finalApproverId, signedAsProxy, delegatedBy]);

                // إشعار فقط لأول معتمد في التسلسل
                let firstApproverId = finalApproverId;
                if (sequenceNumber == null) {
                    // لو ما انحدد sequenceNumber نحسب أول معتمد من الجدول
                    const [firstRows] = await protocolModel.pool.execute(
                        'SELECT user_id FROM protocol_approvers WHERE protocol_id = ? ORDER BY sequence_number ASC LIMIT 1',
                        [id]
                    );
                    if (firstRows.length) firstApproverId = firstRows[0].user_id;
                }
                const [seqRows] = await protocolModel.pool.execute(
                    'SELECT sequence_number FROM protocol_approvers WHERE protocol_id = ? AND user_id = ?',
                    [id, finalApproverId]
                );
                const isFirst = seqRows.length && Number(seqRows[0].sequence_number) === 1;
                if (isFirst) {
                    try { await sendProxyNotification(firstApproverId, id, false); } catch (_) {}
                }
            } catch (e) {
                console.warn('addApprover: failed to insert pending log for protocol approver', e);
            }

            console.log(`Approver added to protocol by user ${currentUserId}`, {
                protocolId: id,
                approverId: finalApproverId,
                sequenceNumber: sequenceNumber
            });

            res.json({
                success: true,
                message: result.message
            });

            try {
                await logAction(
                    currentUserId,
                    'add_protocol_approver',
                    JSON.stringify({
                        ar: `تمت إضافة معتمد للمحضر رقم ${id} (المستخدم ${userId})${sequenceNumber ? ` بالتسلسل ${sequenceNumber}` : ''}`,
                        en: `Added approver to protocol #${id} (user ${userId})${sequenceNumber ? ` at sequence ${sequenceNumber}` : ''}`
                    }),
                    'approval',
                    id
                );
                // إشعار المعتمد المضاف
                try { await sendProxyNotification(finalApproverId, id, false); } catch (_) {}
            } catch (_) {}

        } catch (error) {
            console.error('Error adding approver:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إضافة المعتمد'
            });
        }
    }

    // جلب التفويضات الفردية المعلقة (للمفوض له) للمحاضر
    async getSingleDelegations(req, res) {
        try {
            const { userId } = req.params;
            console.log('🔍 Fetching protocol single delegations for userId:', userId);
            
            // First, let's see what's actually in the database for this user
            const [debugRows] = await protocolModel.pool.execute(`
                SELECT 
                    pal.id,
                    pal.protocol_id,
                    pal.approver_id,
                    pal.delegated_by,
                    pal.signed_as_proxy,
                    pal.status,
                    pal.created_at
                FROM protocol_approval_logs pal
                WHERE pal.approver_id = ?
                ORDER BY pal.created_at DESC
            `, [userId]);
            
            console.log('🔍 All protocol approval logs for user:', debugRows);
            
            // Now get the actual single delegations with more flexible status
            const [rows] = await protocolModel.pool.execute(`
                SELECT 
                    pal.id AS delegation_id,
                    pal.protocol_id AS content_id,
                    p.title AS content_title,
                    pal.delegated_by,
                    ${require('../models/userUtils').getFullNameSQLWithAliasAndFallback('u')} AS delegated_by_name,
                    pal.status,
                    pal.created_at
                FROM protocol_approval_logs pal
                JOIN protocols p ON pal.protocol_id = p.id
                JOIN users u ON pal.delegated_by = u.id
                WHERE pal.approver_id = ?
                  AND pal.signed_as_proxy = 1
                  AND pal.status IN ('pending')
                ORDER BY pal.created_at DESC
            `, [userId]);
            
            console.log('🔍 Protocol single delegations found:', rows);
            res.json({ status: 'success', data: rows });
        } catch (err) {
            console.error('Error fetching protocol single delegations:', err);
            res.status(500).json({ status: 'error', message: 'Failed to fetch protocol single delegations' });
        }
    }

    // معالجة التفويض الفردي (قبول/رفض) للمحاضر
    async processSingleProtocolDelegationUnified(req, res) {
        try {
            console.log('🔍 processSingleProtocolDelegationUnified called with body:', req.body);
 
            // التحقق من التوكن مثل باقي الدوال
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const currentUserId = decoded.id;
            
            const { delegationId, action, reason } = req.body;
            if (!delegationId || !action) {
                return res.status(400).json({ status: 'error', message: 'يرجى تحديد التفويض والإجراء' });
            }

            // جلب معلومات التفويض من protocol_approval_logs - البحث عن status = 'pending'
            const [delegationRows] = await protocolModel.pool.execute(`
                SELECT 
                    pal.id,
                    pal.protocol_id,
                    pal.approver_id,
                    pal.delegated_by,
                    pal.status,
                    pal.comments
                FROM protocol_approval_logs pal
                WHERE pal.id = ? 
                AND pal.approver_id = ? 
                AND pal.signed_as_proxy = 1 
                AND pal.status = 'pending'  -- التفويض يجب أن يكون في حالة pending
                AND pal.protocol_id IS NOT NULL
            `, [delegationId, currentUserId]);

            if (!delegationRows.length) {
                return res.status(404).json({ status: 'error', message: 'لم يتم العثور على تفويض' });
            }

            const delegation = delegationRows[0];
            const { protocol_id: protocolId, delegated_by: delegatorId } = delegation;

            if (action === 'accept') {
                // قبول التفويض
                // 1) تحديث حالة التفويض إلى 'accepted' (إذا لم تكن بالفعل)
                await protocolModel.pool.execute(`
                    UPDATE protocol_approval_logs 
                    SET status = 'accepted', comments = CONCAT(COALESCE(comments, ''), ' - تم قبول التفويض')
                    WHERE id = ?
                `, [delegationId]);

                // 2) إضافة المفوض له إلى protocol_approvers
                await protocolModel.pool.execute(`
                    INSERT IGNORE INTO protocol_approvers (protocol_id, user_id) 
                    VALUES (?, ?)
                `, [protocolId, currentUserId]);

                // 3) حذف المفوض الأصلي من protocol_approvers
                await protocolModel.pool.execute(`
                    DELETE FROM protocol_approvers 
                    WHERE protocol_id = ? AND user_id = ?
                `, [protocolId, delegatorId]);

                // 4) إرسال إشعار للمفوض الأصلي
                try {
                    await insertNotification(
                        delegatorId,
                        'تم قبول التفويض',
                        `تم قبول تفويضك للتوقيع بالنيابة على المحضر رقم ${protocolId}`,
                        'delegation_accepted',
                        JSON.stringify({ 
                            protocolId, 
                            delegateId: currentUserId,
                            action: 'accepted'
                        })
                    );
                } catch (_) {}

                console.log(`✅ Protocol delegation accepted: ${delegationId} by user ${currentUserId}`);
                res.json({ 
                    status: 'success', 
                    message: 'تم قبول التفويض بنجاح' 
                });

            } else if (action === 'reject') {
                // رفض التفويض
                await protocolModel.pool.execute(`
                    UPDATE protocol_approval_logs 
                    SET status = 'rejected', comments = CONCAT(COALESCE(comments, ''), ' - تم رفض التفويض: ', ?)
                    WHERE id = ?
                `, [reason || 'لا يوجد سبب محدد', delegationId]);

                // إرسال إشعار للمفوض الأصلي
                try {
                    await insertNotification(
                        delegatorId,
                        'تم رفض التفويض',
                        `تم رفض تفويضك للتوقيع بالنيابة على المحضر رقم ${protocolId}${reason ? ` - السبب: ${reason}` : ''}`,
                        'delegation_rejected',
                        JSON.stringify({ 
                            protocolId, 
                            delegateId: currentUserId,
                            action: 'rejected',
                            reason: reason || ''
                        })
                    );
                } catch (_) {}

                console.log(`❌ Protocol delegation rejected: ${delegationId} by user ${currentUserId}`);
                res.json({ 
                    status: 'success', 
                    message: 'تم رفض التفويض بنجاح' 
                });

            } else {
                return res.status(400).json({ status: 'error', message: 'إجراء غير صحيح' });
            }

        } catch (error) {
            console.error('❌ Error in processSingleProtocolDelegationUnified:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'حدث خطأ أثناء معالجة التفويض' 
            });
        }
    }

    // معالجة التفويض الشامل الموحد (قبول/رفض) للمحاضر
    async processBulkProtocolDelegationUnified(req, res) {
        try {
            // التحقق من التوكن مثل باقي الدوال
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const currentUserId = decoded.id;
            
            const { action } = req.body;
            if (!action || !['accept', 'reject'].includes(action)) {
                return res.status(400).json({ status: 'error', message: 'إجراء غير صحيح' });
            }

            const targetStatus = action === 'accept' ? 'accepted' : 'rejected';
            const [result] = await protocolModel.pool.execute(`
                UPDATE protocol_approval_logs
                SET status = ?
                WHERE approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'
            `, [targetStatus, currentUserId]);

            res.json({ status: 'success', message: 'تمت معالجة التفويض الشامل للمحاضر', affected: result.affectedRows || 0 });
        } catch (err) {
            console.error('Error processing bulk protocol delegation:', err);
            res.status(500).json({ status: 'error', message: 'فشل معالجة التفويض الشامل للمحاضر' });
        }
    }

    // تحميل PDF المحضر
    async downloadPDF(req, res) {
        try {
            const { id } = req.params;
            
            // التحقق من التوكن مثل باقي الدوال
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ status: 'error', message: 'لا يوجد توكن' });
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            const protocol = await protocolModel.getProtocolById(id, userId);

            if (!protocol) {
                return res.status(404).json({
                    success: false,
                    message: 'المحضر غير موجود'
                });
            }

            if (!protocol.file_path) {
                return res.status(404).json({
                    success: false,
                    message: 'ملف PDF غير موجود'
                });
            }

            const filePath = path.join(__dirname, '../../uploads', protocol.file_path);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: 'ملف PDF غير موجود على الخادم'
                });
            }

            res.download(filePath, `protocol_${id}.pdf`);

        } catch (error) {
            console.error('Error downloading protocol PDF:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحميل ملف PDF'
            });
        }
    }

    // تراك المحضر (مماثل لتراك المحتوى)
    async getProtocolTrack(req, res) {
        try {
            const { id } = req.params;

            // 1) تفاصيل المحضر الأساسية
            const [protocolRows] = await protocolModel.pool.execute(`
                SELECT 
                    p.*,
                    ${getFullNameSQLWithAliasAndFallback('u')} AS created_by_name
                FROM protocols p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.id = ?
            `, [id]);

            if (!protocolRows.length) {
                return res.status(404).json({ status: 'error', message: 'Protocol not found.' });
            }
            const protocol = protocolRows[0];

            // 2) سجل الاعتمادات (الجدول الزمني) - استثناء sender_signature
            const [timelineRows] = await protocolModel.pool.execute(`
                SELECT 
                    pal.status,
                    pal.comments,
                    pal.created_at,
                    ${getFullNameSQLWithAliasAndFallback('u')} AS approver,
                    jt.title AS job_title
                FROM protocol_approval_logs pal
                JOIN users u ON pal.approver_id = u.id
                LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                WHERE pal.protocol_id = ? AND pal.status != 'sender_signature'
                ORDER BY pal.created_at ASC
            `, [id]);

            // 3) المعتمدون الذين لم يوقعوا بعد
            const [pendingApproversRows] = await protocolModel.pool.execute(`
                SELECT 
                    ${getFullNameSQLWithAliasAndFallback('u')} AS approver,
                    jt.title AS job_title
                FROM protocol_approvers pa
                JOIN users u ON pa.user_id = u.id
                LEFT JOIN job_titles jt ON u.job_title_id = jt.id
                WHERE pa.protocol_id = ?
                  AND NOT EXISTS (
                    SELECT 1
                    FROM protocol_approval_logs pal
                    WHERE pal.protocol_id = pa.protocol_id
                      AND pal.approver_id = pa.user_id
                      AND pal.status = 'approved'
                  )
                ORDER BY pa.sequence_number
            `, [id]);

            res.json({
                status: 'success',
                protocol,
                timeline: timelineRows,
                pending: pendingApproversRows
            });
        } catch (err) {
            console.error('❌ Error fetching protocol track info:', err);
            res.status(500).json({ status: 'error', message: 'Failed to fetch protocol track info.' });
        }
    }

    // تفويض محضر واحد
    async delegateSingleProtocolApproval(req, res) {
        try {
            const { delegateTo, notes, contentId, contentType, signature } = req.body;
            const delegatorId = req.user.id;

            if (!delegateTo || !contentId) {
                return res.status(400).json({
                    status: 'error',
                    message: 'البيانات المطلوبة ناقصة'
                });
            }

            // إضافة التفويض إلى قاعدة البيانات
            await protocolModel.pool.execute(`
                INSERT INTO protocol_approval_logs (
                    protocol_id, approver_id, delegated_by, signed_as_proxy, status, signature, comments, created_at
                ) VALUES (?, ?, ?, 1, 'pending', ?, ?, NOW())
            `, [contentId, delegateTo, delegatorId, signature || null, notes || '']);

            // لا نحتاج لإنشاء سجل منفصل لتوقيع المرسل للمحاضر
            // سيتم التعامل مع التوقيع في وقت التوقيع الفعلي

            console.log(`Protocol delegation created by user ${delegatorId}`, {
                protocolId: contentId,
                delegateTo: delegateTo,
                delegatorId: delegatorId
            });

            try {
                await logAction(
                    delegatorId,
                    'delegate_protocol_signature',
                    JSON.stringify({
                        ar: `تم تفويض التوقيع للمستخدم ${delegateTo} على المحضر رقم ${contentId}`,
                        en: `Delegated protocol signature to user ${delegateTo} for protocol #${contentId}`
                    }),
                    'approval',
                    contentId
                );
            } catch (_) {}

            try { await sendProxyNotification(delegateTo, contentId, false); } catch (_) {}

            res.json({
                status: 'success',
                message: 'تم إرسال طلب التفويض بنجاح'
            });

        } catch (error) {
            console.error('Error delegating single protocol approval:', error);
            res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء إرسال طلب التفويض'
            });
        }
    }

    // تفويض جميع المحاضر
    async delegateAllProtocolApprovals(req, res) {
        try {
            const { delegateTo, notes, signature } = req.body;
            const delegatorId = req.user.id;

            if (!delegateTo) {
                return res.status(400).json({
                    status: 'error',
                    message: 'البيانات المطلوبة ناقصة'
                });
            }

            // جلب جميع المحاضر المعلقة للمستخدم
            const [pendingProtocols] = await protocolModel.pool.execute(`
                SELECT DISTINCT p.id, p.title
                FROM protocols p
                JOIN protocol_approvers pa ON p.id = pa.protocol_id
                WHERE pa.user_id = ? AND p.is_approved = 0
                AND NOT EXISTS (
                    SELECT 1 FROM protocol_approval_logs pal
                    WHERE pal.protocol_id = p.id AND pal.approver_id = pa.user_id
                )
            `, [delegatorId]);

            if (pendingProtocols.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'لا توجد محاضر معلقة للتفويض'
                });
            }

            // إضافة التفويض لجميع المحاضر
            for (const protocol of pendingProtocols) {
                await protocolModel.pool.execute(`
                    INSERT INTO protocol_approval_logs (
                        protocol_id, approver_id, delegated_by, signed_as_proxy, status, signature, comments, created_at
                    ) VALUES (?, ?, ?, 1, 'pending', ?, ?, NOW())
                `, [protocol.id, delegateTo, delegatorId, signature || null, notes || '']);

                // لا نحتاج لإنشاء سجل منفصل لتوقيع المرسل للمحاضر
                // سيتم التعامل مع التوقيع في وقت التوقيع الفعلي
            }

            console.log(`Bulk protocol delegation created by user ${delegatorId}`, {
                delegateTo: delegateTo,
                delegatorId: delegatorId,
                protocolsCount: pendingProtocols.length
            });

            // إشعار جماعي موحّد للمفوض له + إشعار لكل محضر
            try {
                await insertNotification(
                    delegateTo,
                    'طلب تفويض بالنيابة - محاضر',
                    `تم طلب تفويضك للتوقيع بالنيابة عن ${delegatorId} على جميع المحاضر (${pendingProtocols.length}).`,
                    'proxy_bulk_protocols',
                    JSON.stringify({ from: delegatorId, count: pendingProtocols.length, protocols: pendingProtocols.map(p => p.id) })
                );
                for (const protocol of pendingProtocols) {
                    try { await sendProxyNotification(delegateTo, protocol.id, false); } catch (_) {}
                }
            } catch (_) {}

            res.json({
                status: 'success',
                message: `تم إرسال طلب التفويض لـ ${pendingProtocols.length} محضر بنجاح`
            });

        } catch (error) {
            console.error('Error delegating all protocol approvals:', error);
            res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء إرسال طلب التفويض الشامل'
            });
        }
    }

    // جلب بيانات تأكيد التفويض
    async getDelegationConfirmationData(req, res) {
        try {
            const { delegateTo, notes, contentId, contentType, isBulk } = req.body;
            const delegatorId = req.user.id;

            if (!delegateTo) {
                return res.status(400).json({
                    status: 'error',
                    message: 'البيانات المطلوبة ناقصة'
                });
            }

            // جلب بيانات المفوض والمفوض له
            const [delegatorRows] = await protocolModel.pool.execute(`
                SELECT 
                    id,
                    CONCAT(
                        COALESCE(first_name, ''),
                        CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
                        CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
                        CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
                    ) AS full_name,
                    job_title,
                    national_id
                FROM users WHERE id = ?
            `, [delegatorId]);

            const [delegateRows] = await protocolModel.pool.execute(`
                SELECT 
                    id,
                    CONCAT(
                        COALESCE(first_name, ''),
                        CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
                        CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
                        CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
                    ) AS full_name,
                    job_title,
                    national_id
                FROM users WHERE id = ?
            `, [delegateTo]);

            if (!delegatorRows.length || !delegateRows.length) {
                return res.status(404).json({
                    status: 'error',
                    message: 'بيانات المستخدمين غير موجودة'
                });
            }

            const delegator = delegatorRows[0];
            const delegate = delegateRows[0];

            let files = [];
            if (isBulk) {
                // جلب جميع المحاضر المعلقة
                const [protocolRows] = await protocolModel.pool.execute(`
                    SELECT DISTINCT p.id, p.title
                    FROM protocols p
                    JOIN protocol_approvers pa ON p.id = pa.protocol_id
                    WHERE pa.user_id = ? AND p.is_approved = 0
                    AND NOT EXISTS (
                        SELECT 1 FROM protocol_approval_logs pal
                        WHERE pal.protocol_id = p.id AND pal.approver_id = pa.user_id
                    )
                `, [delegatorId]);

                files = protocolRows.map(row => ({
                    id: row.id,
                    title: row.title,
                    type: 'protocol'
                }));
            } else if (contentId) {
                // جلب المحضر المحدد
                const [protocolRows] = await protocolModel.pool.execute(`
                    SELECT id, title FROM protocols WHERE id = ?
                `, [contentId]);

                if (protocolRows.length) {
                    files = [{
                        id: protocolRows[0].id,
                        title: protocolRows[0].title,
                        type: 'protocol'
                    }];
                }
            }

            res.json({
                status: 'success',
                confirmationData: {
                    delegator: {
                        id: delegator.id,
                        fullName: delegator.full_name,
                        idNumber: delegator.national_id || 'غير محدد'
                    },
                    delegate: {
                        id: delegate.id,
                        fullName: delegate.full_name,
                        idNumber: delegate.national_id || 'غير محدد'
                    },
                    files: files,
                    isBulk: isBulk,
                    notes: notes || ''
                }
            });

        } catch (error) {
            console.error('Error getting delegation confirmation data:', error);
            res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء جلب بيانات التأكيد'
            });
        }
    }

    // جلب ملخص التفويضات للمحاضر
    async getProtocolDelegationSummaryByUser(req, res) {
        try {
            const { userId } = req.params;
            
            // جلب ملخص التفويضات للمحاضر
            const [delegationRows] = await protocolModel.pool.execute(`
                SELECT 
                    pal.delegated_by AS approver_id,
                    COUNT(DISTINCT pal.protocol_id) AS files_count,
                    u.first_name,
                    u.second_name,
                    u.third_name,
                    u.last_name,
                    u.email
                FROM protocol_approval_logs pal
                JOIN users u ON pal.delegated_by = u.id
                WHERE pal.approver_id = ? 
                  AND pal.signed_as_proxy = 1 
                  AND pal.status = 'pending'
                  AND pal.protocol_id IS NOT NULL
                GROUP BY pal.delegated_by
                ORDER BY files_count DESC
            `, [userId]);

            const delegations = delegationRows.map(row => ({
                approver_id: row.approver_id,
                approver_name: [
                    row.first_name,
                    row.second_name,
                    row.third_name,
                    row.last_name
                ].filter(Boolean).join(' '),
                email: row.email,
                files_count: row.files_count
            }));

            res.json({
                status: 'success',
                data: delegations
            });

        } catch (error) {
            console.error('Error getting protocol delegation summary:', error);
            res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء جلب ملخص التفويضات'
            });
        }
    }

    // تهيئة جداول المحاضر
    async initializeTables(req, res) {
        try {
            await protocolModel.initializeTables();
            
            res.json({
                success: true,
                message: 'تم تهيئة جداول المحاضر بنجاح'
            });

        } catch (error) {
            console.error('Error initializing protocol tables:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تهيئة جداول المحاضر'
            });
        }
    }

    // إلغاء التفويضات في المحاضر (مثل الملفات واللجان)
    async revokeProtocolDelegations(req, res) {
        try {
            const { delegatorId } = req.params;
            const { to: delegateeId } = req.query;
            
            if (!delegateeId) {
                return res.status(400).json({
                    status: 'error',
                    message: 'معرف المستخدم المفوض إليه مطلوب'
                });
            }

            // جلب التسلسل الحالي للمفوض له
            const [delegateeSequence] = await protocolModel.pool.execute(
                'SELECT sequence_number FROM protocol_approvers WHERE protocol_id = ? AND user_id = ?',
                [delegatorId, delegateeId]
            );

            // حذف سجل التفويض
            await protocolModel.pool.execute(
                `DELETE FROM protocol_approval_logs WHERE protocol_id = ? AND approver_id = ? AND signed_as_proxy = 1 AND status = 'pending'`,
                [delegatorId, delegateeId]
            );

            // إعادة المفوض الأصلي إلى جدول protocol_approvers إذا لم يكن موجوداً
            const [delegationRow] = await protocolModel.pool.execute(
                `SELECT delegated_by FROM protocol_approval_logs WHERE protocol_id = ? AND approver_id = ?`,
                [delegatorId, delegateeId]
            );
            
            if (delegationRow.length && delegationRow[0].delegated_by) {
                const originalDelegatorId = delegationRow[0].delegated_by;
                
                // تحقق إذا كان المفوض الأصلي كان معتمدًا قبل التفويض
                const [wasApprover] = await protocolModel.pool.execute(
                    `SELECT * FROM protocol_approval_logs WHERE protocol_id = ? AND approver_id = ? AND signed_as_proxy = 0`,
                    [delegatorId, originalDelegatorId]
                );
                
                if (wasApprover.length) {
                    // إعادة المفوض الأصلي إلى مكانه في التسلسل
                    if (delegateeSequence.length > 0) {
                        const originalSequence = delegateeSequence[0].sequence_number;
                        
                        // إدراج المفوض الأصلي في نفس المكان في التسلسل
                        await protocolModel.pool.execute(
                            `INSERT INTO protocol_approvers (protocol_id, user_id, sequence_number) VALUES (?, ?, ?)`,
                            [delegatorId, originalDelegatorId, originalSequence]
                        );
                        
                        // إعادة ترتيب التسلسل للمعتمدين المتبقين
                        const [remainingApprovers] = await protocolModel.pool.execute(
                            'SELECT user_id, sequence_number FROM protocol_approvers WHERE protocol_id = ? AND user_id != ? ORDER BY sequence_number',
                            [delegatorId, originalDelegatorId]
                        );
                        
                        for (let i = 0; i < remainingApprovers.length; i++) {
                            let newSequence = i + 1;
                            if (newSequence >= originalSequence) {
                                newSequence = i + 2; // تخطي المكان الذي أخذته المفوض الأصلي
                            }
                            await protocolModel.pool.execute(
                                'UPDATE protocol_approvers SET sequence_number = ? WHERE protocol_id = ? AND user_id = ?',
                                [newSequence, delegatorId, remainingApprovers[i].user_id]
                            );
                        }
                    } else {
                        // إذا لم يكن هناك تسلسل محدد، أضفه في النهاية
                        await protocolModel.pool.execute(
                            `INSERT IGNORE INTO protocol_approvers (protocol_id, user_id) VALUES (?, ?)`,
                            [delegatorId, originalDelegatorId]
                        );
                    }
                }
                
                // تحقق إذا كان المفوض له ليس له توقيع شخصي (أي وجوده فقط بسبب التفويض)
                const [hasPersonalLog] = await protocolModel.pool.execute(
                    `SELECT * FROM protocol_approval_logs WHERE protocol_id = ? AND approver_id = ? AND signed_as_proxy = 0`,
                    [delegatorId, delegateeId]
                );
                
                if (!hasPersonalLog.length) {
                    // احذفه من protocol_approvers
                    await protocolModel.pool.execute(
                        `DELETE FROM protocol_approvers WHERE protocol_id = ? AND user_id = ?`,
                        [delegatorId, delegateeId]
                    );
                    
                    // إعادة ترتيب التسلسل بعد الحذف
                    const [remainingApprovers] = await protocolModel.pool.execute(
                        'SELECT user_id, sequence_number FROM protocol_approvers WHERE protocol_id = ? ORDER BY sequence_number',
                        [delegatorId]
                    );
                    
                    for (let i = 0; i < remainingApprovers.length; i++) {
                        await protocolModel.pool.execute(
                            'UPDATE protocol_approvers SET sequence_number = ? WHERE protocol_id = ? AND user_id = ?',
                            [i + 1, delegatorId, remainingApprovers[i].user_id]
                        );
                    }
                }
            }
            
            // حذف من جدول active_delegations
            await protocolModel.pool.execute(`
                DELETE FROM active_delegations 
                WHERE user_id = ? AND delegate_id = ?
            `, [delegatorId, delegateeId]);

            // تسجيل الإجراء
            try {
                await logAction(
                    delegatorId,
                    'revoke_protocol_delegations',
                    JSON.stringify({
                        ar: `تم إلغاء تفويضات المحاضر للمستخدم ${delegateeId} وإعادة ترتيب التسلسل`,
                        en: `Revoked protocol delegations for user ${delegateeId} and reordered sequence`
                    }),
                    'approval'
                );
            } catch (_) {}

            res.json({
                status: 'success',
                message: 'تم إلغاء التفويضات بنجاح وإعادة ترتيب التسلسل',
                revokedCount: 1
            });

        } catch (error) {
            console.error('Error revoking protocol delegations:', error);
            res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء إلغاء التفويضات'
            });
        }
    }

    // جلب بيانات تأكيد التفويض الموجود (للمفوض له)
    async getExistingDelegationConfirmationData(req, res) {
        try {
            const { delegationId, delegationType, contentType } = req.body;
            const currentUserId = req.user.id;

            if (!delegationId || !delegationType) {
                return res.status(400).json({
                    status: 'error',
                    message: 'بيانات التفويض مفقودة'
                });
            }

            let delegatorId, delegateId, fileInfo = null;

            // جلب معلومات التفويض حسب النوع
            if (delegationType === 'single') {
                if (contentType === 'protocol') {
                    // جلب معلومات تفويض المحضر الفردي
                    const [delegationRows] = await protocolModel.pool.execute(`
                        SELECT pal.protocol_id AS content_id, pal.approver_id, pal.delegated_by
                        FROM protocol_approval_logs pal
                        WHERE pal.id = ? AND pal.approver_id = ? AND pal.signed_as_proxy = 1 AND pal.status = 'pending'
                    `, [delegationId, currentUserId]);

                    if (!delegationRows.length) {
                        return res.status(404).json({
                            status: 'error',
                            message: 'التفويض غير موجود أو تم معالجته مسبقاً'
                        });
                    }

                    const delegation = delegationRows[0];
                    delegatorId = delegation.delegated_by;
                    delegateId = delegation.approver_id;

                    // جلب معلومات المحضر
                    const [contentRows] = await protocolModel.pool.execute(`
                        SELECT id, title FROM protocols WHERE id = ?
                    `, [delegation.content_id]);

                    if (contentRows.length) {
                        fileInfo = {
                            id: contentRows[0].id,
                            title: contentRows[0].title,
                            type: 'protocol'
                        };
                    }
                }
            } else if (delegationType === 'bulk') {
                // جلب معلومات التفويض الشامل من protocol_approval_logs
                const [delegationRows] = await protocolModel.pool.execute(`
                    SELECT pal.delegated_by, pal.approver_id
                    FROM protocol_approval_logs pal
                    WHERE pal.id = ? AND pal.approver_id = ? AND pal.signed_as_proxy = 1 AND pal.status = 'pending' AND pal.protocol_id IS NULL
                `, [delegationId, currentUserId]);

                if (!delegationRows.length) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'التفويض غير موجود أو تم معالجته مسبقاً'
                    });
                }

                const delegation = delegationRows[0];
                delegatorId = delegation.delegated_by;
                delegateId = delegation.approver_id;
            }

            if (!delegatorId || !delegateId) {
                return res.status(404).json({
                    status: 'error',
                    message: 'بيانات التفويض غير مكتملة'
                });
            }

            // جلب بيانات المفوض والمفوض له
            const [delegatorRows] = await protocolModel.pool.execute(`
                SELECT 
                    id,
                    CONCAT(
                        COALESCE(first_name, ''),
                        CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
                        CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
                        CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
                    ) AS full_name,
                    job_title,
                    national_id
                FROM users WHERE id = ?
            `, [delegatorId]);

            const [delegateRows] = await protocolModel.pool.execute(`
                SELECT 
                    id,
                    CONCAT(
                        COALESCE(first_name, ''),
                        CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
                        CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
                        CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
                    ) AS full_name,
                    job_title,
                    national_id
                FROM users WHERE id = ?
            `, [delegateId]);

            if (!delegatorRows.length || !delegateRows.length) {
                return res.status(404).json({
                    status: 'error',
                    message: 'بيانات المستخدمين غير موجودة'
                });
            }

            const delegator = delegatorRows[0];
            const delegate = delegateRows[0];

            let files = [];
            if (delegationType === 'bulk') {
                // جلب جميع المحاضر المعلقة للمفوض
                const [protocolRows] = await protocolModel.pool.execute(`
                    SELECT DISTINCT p.id, p.title
                    FROM protocols p
                    JOIN protocol_approvers pa ON p.id = pa.protocol_id
                    WHERE pa.user_id = ? AND p.is_approved = 0
                    AND NOT EXISTS (
                        SELECT 1 FROM protocol_approval_logs pal
                        WHERE pal.protocol_id = p.id AND pal.approver_id = pa.user_id
                    )
                `, [delegatorId]);

                files = protocolRows.map(row => ({
                    id: row.id,
                    title: row.title,
                    type: 'protocol'
                }));
            } else if (fileInfo) {
                files = [fileInfo];
            }

            res.json({
                status: 'success',
                confirmationData: {
                    delegator: {
                        id: delegator.id,
                        fullName: delegator.full_name,
                        idNumber: delegator.national_id || 'غير محدد'
                    },
                    delegate: {
                        id: delegate.id,
                        fullName: delegate.full_name,
                        idNumber: delegate.national_id || 'غير محدد'
                    },
                    files: files,
                    isBulk: delegationType === 'bulk'
                }
            });

        } catch (error) {
            console.error('Error getting existing delegation confirmation data:', error);
            res.status(500).json({
                status: 'error',
                message: 'حدث خطأ أثناء جلب بيانات التأكيد'
            });
        }
    }

    // جلب المحاضر المرتبطة بمجلد معين
    async getProtocolsByFolder(req, res) {
        try {
            const folderId = req.params.folderId;
            const userId = req.user.id;

            if (!folderId) {
                return res.status(400).json({
                    success: false,
                    message: 'معرف المجلد مطلوب'
                });
            }

            const protocols = await protocolModel.getProtocolsByFolder(folderId, userId);

            res.status(200).json({
                success: true,
                data: protocols,
                message: 'تم جلب المحاضر بنجاح'
            });
        } catch (error) {
            console.error('Error getting protocols by folder:', error);
            res.status(500).json({
                success: false,
                message: 'خطأ في جلب المحاضر'
            });
        }
    }

    // حذف معتمد من المحضر
    async removeApprover(req, res) {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        let payload;
        try {
            payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ status: 'error', message: 'Invalid token' });
        }

        const { protocolId, userId } = req.params;
        
        if (!protocolId || !userId) {
            return res.status(400).json({ status: 'error', message: 'البيانات غير صالحة' });
        }

        try {
            const connection = await protocolModel.pool.getConnection();
            await connection.beginTransaction();

            // حذف المعتمد
            await connection.execute(
                'DELETE FROM protocol_approvers WHERE protocol_id = ? AND user_id = ?',
                [protocolId, userId]
            );

            // حذف سجلات الاعتماد المرتبطة
            await connection.execute(
                'DELETE FROM protocol_approval_logs WHERE protocol_id = ? AND approver_id = ?',
                [protocolId, userId]
            );

            await connection.commit();
            connection.release();

            res.json({ status: 'success', message: 'تم حذف المعتمد بنجاح' });
        } catch (error) {
            console.error('Error removing protocol approver:', error);
            res.status(500).json({ status: 'error', message: 'خطأ في حذف المعتمد' });
        }
    }

    // تحديث تسلسل معتمد في المحضر
    async updateApproverSequence(req, res) {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        let payload;
        try {
            payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ status: 'error', message: 'Invalid token' });
        }

        const { protocolId, userId } = req.params;
        const { sequenceNumber } = req.body;
        
        if (!protocolId || !userId || !sequenceNumber) {
            return res.status(400).json({ status: 'error', message: 'البيانات غير صالحة' });
        }

        try {
            const connection = await protocolModel.pool.getConnection();
            
            // تحديث رقم التسلسل
            await connection.execute(
                'UPDATE protocol_approvers SET sequence_number = ? WHERE protocol_id = ? AND user_id = ?',
                [sequenceNumber, protocolId, userId]
            );

            connection.release();

            res.json({ status: 'success', message: 'تم تحديث التسلسل بنجاح' });
        } catch (error) {
            console.error('Error updating protocol approver sequence:', error);
            res.status(500).json({ status: 'error', message: 'خطأ في تحديث التسلسل' });
        }
    }

}

module.exports = new ProtocolController();
