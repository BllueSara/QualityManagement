-- تحسينات أداء قاعدة البيانات لزيادة سرعة التوقيع والإرسال

-- 1. إضافة فهارس مهمة لجدول approval_logs
CREATE INDEX idx_approval_logs_content_status ON approval_logs(content_id, status);
CREATE INDEX idx_approval_logs_approver_status ON approval_logs(approver_id, status);
CREATE INDEX idx_approval_logs_created_at ON approval_logs(created_at);
CREATE INDEX idx_approval_logs_delegated_by ON approval_logs(delegated_by);

-- 2. إضافة فهارس مهمة لجدول committee_approval_logs
CREATE INDEX idx_committee_approval_logs_content_status ON committee_approval_logs(content_id, status);
CREATE INDEX idx_committee_approval_logs_approver_status ON committee_approval_logs(approver_id, status);
CREATE INDEX idx_committee_approval_logs_created_at ON committee_approval_logs(created_at);
CREATE INDEX idx_committee_approval_logs_delegated_by ON committee_approval_logs(delegated_by);

-- 3. إضافة فهارس مهمة لجدول contents
CREATE INDEX idx_contents_created_by ON contents(created_by);
CREATE INDEX idx_contents_approval_status ON contents(approval_status);
CREATE INDEX idx_contents_is_approved ON contents(is_approved);
CREATE INDEX idx_contents_folder_id ON contents(folder_id);

-- 4. إضافة فهارس مهمة لجدول committee_contents
CREATE INDEX idx_committee_contents_created_by ON committee_contents(created_by);
CREATE INDEX idx_committee_contents_approval_status ON committee_contents(approval_status);
CREATE INDEX idx_committee_contents_is_approved ON committee_contents(is_approved);
CREATE INDEX idx_committee_contents_folder_id ON committee_contents(folder_id);

-- 5. إضافة فهارس مهمة لجدول content_approvers
CREATE INDEX idx_content_approvers_content_user ON content_approvers(content_id, user_id);
CREATE INDEX idx_content_approvers_user ON content_approvers(user_id);

-- 6. إضافة فهارس مهمة لجدول committee_content_approvers
CREATE INDEX idx_committee_content_approvers_content_user ON committee_content_approvers(content_id, user_id);
CREATE INDEX idx_committee_content_approvers_user ON committee_content_approvers(user_id);

-- 7. إضافة فهارس مهمة لجدول active_delegations
CREATE INDEX idx_active_delegations_user ON active_delegations(user_id);
CREATE INDEX idx_active_delegations_delegate ON active_delegations(delegate_id);

-- 8. إضافة فهارس مهمة لجدول users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_status ON users(status);

-- 9. إضافة فهارس مهمة لجدول notifications
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- 10. تحسين إعدادات MySQL للأداء
-- يمكن إضافة هذه الإعدادات في ملف my.cnf أو my.ini

-- 11. تحسين استعلامات التوقيع - إضافة فهارس مركبة
CREATE INDEX idx_approval_logs_composite ON approval_logs(content_id, approver_id, signed_as_proxy, delegated_by);
CREATE INDEX idx_committee_approval_logs_composite ON committee_approval_logs(content_id, approver_id, signed_as_proxy, delegated_by);

-- 12. إضافة فهارس لجدول protocols إذا كان موجوداً
-- CREATE INDEX idx_protocols_created_by ON protocols(created_by);
-- CREATE INDEX idx_protocols_approval_status ON protocols(approval_status);

-- 13. تحسين فهارس الجداول المرتبطة
CREATE INDEX idx_folders_department_id ON folders(department_id);
CREATE INDEX idx_committee_folders_committee_id ON committee_folders(committee_id);

-- 14. إضافة فهارس للمستخدمين حسب الصلاحيات
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission_id);

-- 15. تحسين فهارس التذاكر
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);

-- 16. إضافة فهارس لجدول ticket_status_history
CREATE INDEX idx_ticket_status_history_ticket ON ticket_status_history(ticket_id);
CREATE INDEX idx_ticket_status_history_changed_by ON ticket_status_history(changed_by);

-- 17. تحسين فهارس الإشعارات
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);

-- 18. إضافة فهارس للجداول الجديدة
CREATE INDEX idx_classifications_name ON classifications(name_ar, name_en);
CREATE INDEX idx_harm_levels_code ON harm_levels(code);

-- 19. تحسين فهارس جداول التفويض
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_assigned_to ON ticket_assignments(assigned_to);

-- 20. إضافة فهارس لجدول user_committees
CREATE INDEX idx_user_committees_user ON user_committees(user_id);
CREATE INDEX idx_user_committees_committee ON user_committees(committee_id);

-- ملاحظة: هذه الفهارس ستساعد في تسريع استعلامات التوقيع والإرسال بشكل كبير
