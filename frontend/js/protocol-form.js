// فورم المحضر - JavaScript
let topicCounter = 0;

document.addEventListener('DOMContentLoaded', function() {
    // إظهار المحتوى بعد تحميل اللغة
    const hiddenElements = document.querySelectorAll('.content-hidden');
    hiddenElements.forEach(element => {
        element.classList.remove('content-hidden');
        element.classList.add('content-visible');
    });

    // تهيئة النموذج (وضع إنشاء أو تعديل)
    initializeForm();
    maybeLoadProtocolForEdit();
    
    // إضافة مستمعي الأحداث
    addEventListeners();
});

// تهيئة النموذج
function initializeForm() {
    // تعيين التاريخ الحالي كتاريخ افتراضي
    const today = new Date().toISOString().split('T')[0];
    const protocolDateInput = document.getElementById('protocolDate');
    if (protocolDateInput) {
        protocolDateInput.value = today;
    }
    
    // تعيين الوقت الحالي كوقت افتراضي
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const protocolTimeInput = document.getElementById('protocolTime');
    if (protocolTimeInput) {
        protocolTimeInput.value = `${hours}:${minutes}`;
    }
    
    // تحميل الأقسام واللجان
    loadDepartments();
    loadCommittees();
}

// فحص إذا كنا في وضع التعديل وجلب بيانات المحضر
async function maybeLoadProtocolForEdit() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const mode = params.get('mode');
    if (!id || mode !== 'edit') return;

    try {
        showToast('جاري تحميل بيانات المحضر...', 'info');
        const token = getAuthToken();
        const res = await fetch(`http://localhost:3006/api/protocols/${encodeURIComponent(id)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'فشل تحميل بيانات المحضر');
        const data = json.data;

        // تعبئة الحقول الأساسية
        const titleInput = document.getElementById('protocolTitle');
        const dateInput = document.getElementById('protocolDate');
        const timeInput = document.getElementById('protocolTime');
        const roomInput = document.getElementById('protocolRoom');
        
        console.log('🔍 البيانات القادمة من الباك إند:', data);
        console.log('🔍 protocolTime:', data.protocolTime);
        console.log('🔍 room:', data.room);
        console.log('🔍 department_id:', data.department_id);
        console.log('🔍 committee_id:', data.committee_id);
        console.log('🔍 folder_id:', data.folder_id);
        
        if (titleInput) titleInput.value = data.title || '';
        if (dateInput) dateInput.value = (data.protocolDate || '').split('T')[0] || '';
        if (timeInput) timeInput.value = data.protocolTime || '';
        if (roomInput) roomInput.value = data.room || '';

        // تعبئة حقول القسم والمجلد واللجنة
        // تأكد من تحميل الأقسام واللجان أولاً
        await Promise.all([
            loadDepartments(),
            loadCommittees()
        ]);

        if (data.department_id) {
            console.log('🔍 تعيين القسم:', data.department_id);
            const departmentSelect = document.getElementById('protocolDepartment');
            if (departmentSelect) {
                departmentSelect.value = data.department_id;
                console.log('✅ تم تعيين القسم:', departmentSelect.value);
                // تحميل مجلدات القسم
                await loadFoldersForDepartment();
                if (data.folder_id) {
                    const folderSelect = document.getElementById('protocolFolder');
                    if (folderSelect) {
                        folderSelect.value = data.folder_id;
                        console.log('✅ تم تعيين المجلد:', folderSelect.value);
                    }
                }
            }
        } else {
            console.log('⚠️ لا يوجد department_id في البيانات');
        }

        if (data.committee_id) {
            console.log('🔍 تعيين اللجنة:', data.committee_id);
            const committeeSelect = document.getElementById('protocolCommittee');
            if (committeeSelect) {
                committeeSelect.value = data.committee_id;
                console.log('✅ تم تعيين اللجنة:', committeeSelect.value);
                // تحميل مجلدات اللجنة
                await loadFoldersForCommittee();
                if (data.folder_id) {
                    const committeeFolderSelect = document.getElementById('committeeFolder');
                    if (committeeFolderSelect) {
                        committeeFolderSelect.value = data.folder_id;
                        console.log('✅ تم تعيين مجلد اللجنة:', committeeFolderSelect.value);
                    }
                }
            }
        } else {
            console.log('⚠️ لا يوجد committee_id في البيانات');
        }

        // تحديد نوع التخصيص
        if (data.department_id && data.committee_id) {
            const bothOption = document.getElementById('optionBoth');
            if (bothOption) bothOption.checked = true;
        } else if (data.department_id) {
            const departmentOption = document.getElementById('optionDepartment');
            if (departmentOption) departmentOption.checked = true;
        } else if (data.committee_id) {
            const committeeOption = document.getElementById('optionCommittee');
            if (committeeOption) committeeOption.checked = true;
        }
        
        // تطبيق نوع التخصيص
        toggleAssignmentType();

        // إنشاء المواضيع وملؤها
        const topics = Array.isArray(data.topics) ? data.topics : [];
        const topicsContainer = document.getElementById('topicsContainer');
        const topicsSection = document.getElementById('topicsSection');
        topicsContainer.innerHTML = '';
        topicCounter = 0;
        if (topics.length > 0) {
            topics.forEach((t) => {
                addTopic();
                const idx = topicCounter;
                document.getElementById(`topicSubject-${idx}`).value = t.subject || '';
                document.getElementById(`topicDiscussion-${idx}`).value = t.discussion || '';
                document.getElementById(`topicDuration-${idx}`).value = t.duration || '';
                document.getElementById(`topicEndDate-${idx}`).value = t.endDate ? String(t.endDate).split('T')[0] : '';
                document.getElementById(`topicRecommendations-${idx}`).value = t.recommendations || '';
                document.getElementById(`topicResponsibility-${idx}`).value = t.responsibility || '';
                
                // تحميل المناقشات الجانبية إن وجدت
                if (Array.isArray(t.sideDiscussions) && t.sideDiscussions.length > 0) {
                    t.sideDiscussions.forEach((sideDiscussion) => {
                        addSideDiscussion(idx);
                        
                        // العثور على آخر مناقشة جانبية مضافة وملء بياناتها
                        const sideDiscussionsContainer = document.getElementById(`sideDiscussions-${idx}`);
                        const lastSideDiscussion = sideDiscussionsContainer.lastElementChild;
                        if (lastSideDiscussion) {
                            const sideId = lastSideDiscussion.id.replace('sideDiscussion-', '');
                            const contentField = document.getElementById(`sideDiscussionContent-${sideId}`);
                            const durationField = document.getElementById(`sideDiscussionDuration-${sideId}`);
                            const endDateField = document.getElementById(`sideDiscussionEndDate-${sideId}`);
                            const recommendationsField = document.getElementById(`sideDiscussionRecommendations-${sideId}`);
                            const responsibilityField = document.getElementById(`sideDiscussionResponsibility-${sideId}`);
                            
                            if (contentField) contentField.value = sideDiscussion.content || '';
                            if (durationField) durationField.value = sideDiscussion.duration || '';
                            if (endDateField) endDateField.value = sideDiscussion.endDate ? String(sideDiscussion.endDate).split('T')[0] : '';
                            if (recommendationsField) recommendationsField.value = sideDiscussion.recommendations || '';
                            if (responsibilityField) responsibilityField.value = sideDiscussion.responsibility || '';
                        }
                    });
                }
            });
            topicsSection.style.display = 'block';
        }

        // تخزين الـ id في النموذج لاستخدامه عند الإرسال
        const form = document.getElementById('protocolForm');
        form.dataset.editId = id;

        showToast('تم تحميل بيانات المحضر', 'success');
    } catch (err) {
        console.error('Failed to load protocol for edit:', err);
        showToast(err.message || 'فشل تحميل بيانات المحضر', 'error');
    }
}

// إضافة مستمعي الأحداث
function addEventListeners() {
    const form = document.getElementById('protocolForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        
        // منع إرسال الفورم بـ Enter ولكن السماح بالانتقال بين الحقول
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // منع الإرسال فقط، لكن اسمح بالانتقال للحقل التالي
                e.preventDefault();
                
                // العثور على الحقل التالي القابل للتركيز
                const focusableElements = form.querySelectorAll(
                    'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
                );
                
                const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);
                if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
                    focusableElements[currentIndex + 1].focus();
                }
                
                return false;
            }
        });
        
        // منع Submit من أزرار Enter في جميع الحقول
        const allFields = form.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select');
        allFields.forEach(field => {
            field.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    
                    // للـ textarea، السماح بـ Enter إذا كان Shift مضغوط (للسطر الجديد)
                    if (field.tagName.toLowerCase() === 'textarea' && e.shiftKey) {
                        // إدراج سطر جديد يدوياً
                        const start = field.selectionStart;
                        const end = field.selectionEnd;
                        const value = field.value;
                        
                        field.value = value.substring(0, start) + '\n' + value.substring(end);
                        field.selectionStart = field.selectionEnd = start + 1;
                        return;
                    }
                    
                    // طريقة مبسطة للانتقال للحقل التالي
                    moveToNextField(field);
                }
            });
        });
    }

    // التحقق من صحة عنوان المحضر
    const protocolTitleInput = document.getElementById('protocolTitle');
    if (protocolTitleInput) {
        protocolTitleInput.addEventListener('input', validateProtocolTitle);
    }
    
    // إضافة مستمعي الأحداث للقوائم المنسدلة
    const departmentSelect = document.getElementById('protocolDepartment');
    if (departmentSelect) {
        departmentSelect.addEventListener('change', loadFoldersForDepartment);
    }
    
    const committeeSelect = document.getElementById('protocolCommittee');
    if (committeeSelect) {
        committeeSelect.addEventListener('change', loadFoldersForCommittee);
    }
    
    // إضافة مستمعي الأحداث لتبديل نوع التخصيص
    const assignmentRadios = document.querySelectorAll('input[name="assignmentType"]');
    assignmentRadios.forEach(radio => {
        radio.addEventListener('change', toggleAssignmentType);
    });
}

// إنشاء المواضيع حسب العدد المحدد
function generateTopics() {
    const topicsCount = parseInt(document.getElementById('topicsCount').value);
    
    if (topicsCount < 1 || topicsCount > 20) {
        const lang = localStorage.getItem('language') || 'ar';
        const errorMessage = lang === 'ar' ? 
            'يرجى إدخال عدد صحيح بين 1 و 20' : 
            'Please enter a valid number between 1 and 20';
        showToast(errorMessage, 'error');
        return;
    }

    const topicsContainer = document.getElementById('topicsContainer');
    const topicsSection = document.getElementById('topicsSection');
    
    // مسح المواضيع الموجودة
    topicsContainer.innerHTML = '';
    topicCounter = 0;
    
    // إنشاء المواضيع الجديدة
    for (let i = 0; i < topicsCount; i++) {
        addTopic();
    }
    
    // إظهار قسم المواضيع
    topicsSection.style.display = 'block';
    
    // رسالة مترجمة
    const lang = localStorage.getItem('language') || 'ar';
    const successMessage = lang === 'ar' ? 
        `تم إنشاء ${topicsCount} موضوع/مواضيع` : 
        `${topicsCount} topic(s) created successfully`;
    showToast(successMessage, 'success');
}

// إضافة موضوع جديد
function addTopic() {
    topicCounter++;
    const topicsContainer = document.getElementById('topicsContainer');
    const topicsSection = document.getElementById('topicsSection');
    
    const topicItem = document.createElement('div');
    topicItem.className = 'topic-item';
    topicItem.id = `topic-${topicCounter}`;
    
    topicItem.innerHTML = `
        <div class="topic-header">
            <span class="topic-number" data-translate="topic-number">الموضوع ${topicCounter}</span>
            ${topicCounter > 1 ? `<button type="button" class="remove-topic-btn" onclick="removeTopic(${topicCounter})" data-translate="remove-topic">
                <i class="fas fa-trash"></i>
                حذف
            </button>` : ''}
        </div>
        
        <div class="form-group full-width required">
            <label for="topicSubject-${topicCounter}" data-translate="topic-subject">موضوع للمحضر</label>
            <input type="text" id="topicSubject-${topicCounter}" name="topics[${topicCounter}][subject]" 
                   placeholder="أدخل موضوع المحضر هنا" data-translate-placeholder="placeholder-topic-subject" required />
        </div>
        
        <div class="form-group full-width required">
            <label for="topicDiscussion-${topicCounter}" data-translate="topic-discussion">المناقشة الرئيسية</label>
            <textarea id="topicDiscussion-${topicCounter}" name="topics[${topicCounter}][discussion]" 
                      rows="3" placeholder="أدخل المناقشة الرئيسية بالتفصيل" data-translate-placeholder="placeholder-topic-discussion" required></textarea>
        </div>
        
        <div class="row">
            <div class="form-group">
                <label for="topicDuration-${topicCounter}" data-translate="topic-duration">مدة</label>
                <input type="text" id="topicDuration-${topicCounter}" name="topics[${topicCounter}][duration]" 
                       placeholder="مثال: 30 يوم" data-translate-placeholder="placeholder-topic-duration" />
            </div>
            <div class="form-group">
                <label for="topicEndDate-${topicCounter}" data-translate="topic-end-date">تاريخ انتهاء</label>
                <input type="date" id="topicEndDate-${topicCounter}" name="topics[${topicCounter}][endDate]" 
                       placeholder="yyyy/mm/dd" data-translate-placeholder="placeholder-topic-end-date" />
            </div>
        </div>
        
        <div class="row">
            <div class="form-group">
                <label for="topicRecommendations-${topicCounter}" data-translate="topic-recommendations">التوصيات</label>
                <textarea id="topicRecommendations-${topicCounter}" name="topics[${topicCounter}][recommendations]" 
                          rows="2" placeholder="أدخل التوصيات هنا" data-translate-placeholder="placeholder-topic-recommendations"></textarea>
            </div>
            <div class="form-group">
                <label for="topicResponsibility-${topicCounter}" data-translate="topic-responsibility">المسؤولية</label>
                <input type="text" id="topicResponsibility-${topicCounter}" name="topics[${topicCounter}][responsibility]" 
                       placeholder="أدخل المسؤول هنا" data-translate-placeholder="placeholder-topic-responsibility" />
            </div>
        </div>
        
        <!-- قسم المناقشات الجانبية -->
        <div class="side-discussions-section">
            <div class="side-discussions-header">
                <h4 data-translate="side-discussions">المناقشات الجانبية</h4>
                <button type="button" class="add-side-discussion-btn" onclick="addSideDiscussion(${topicCounter})" data-translate="add-side-discussion">
                    <i class="fas fa-plus"></i>
                    إضافة مناقشة جانبية
                </button>
            </div>
            <div class="side-discussions-container" id="sideDiscussions-${topicCounter}">
                <!-- المناقشات الجانبية ستظهر هنا -->
            </div>
        </div>
    `;
    
    topicsContainer.appendChild(topicItem);
    
    // منع إرسال الفورم بـ Enter من الحقول الجديدة ولكن السماح بالانتقال
    const newFields = topicItem.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select');
    newFields.forEach(field => {
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                // للـ textarea، السماح بـ Enter إذا كان Shift مضغوط (للسطر الجديد)
                if (field.tagName.toLowerCase() === 'textarea' && e.shiftKey) {
                    const start = field.selectionStart;
                    const end = field.selectionEnd;
                    const value = field.value;
                    
                    field.value = value.substring(0, start) + '\n' + value.substring(end);
                    field.selectionStart = field.selectionEnd = start + 1;
                    return;
                }
                
                // استخدام نفس دالة الانتقال المبسطة
                moveToNextField(field);
            }
        });
    });
    
    // تطبيق الترجمات على العناصر الجديدة
    if (typeof applyTranslations === 'function') {
        applyTranslations();
    }
    
    // إظهار قسم المواضيع إذا كان مخفياً
    topicsSection.style.display = 'block';
    
    // تحديث عداد المواضيع
    updateTopicsCount();
}

// حذف موضوع
function removeTopic(topicId) {
    const topicElement = document.getElementById(`topic-${topicId}`);
    if (topicElement) {
        topicElement.remove();
        updateTopicsCount();
        // رسالة مترجمة
        const lang = localStorage.getItem('language') || 'ar';
        const deleteMessage = lang === 'ar' ? 'تم حذف الموضوع' : 'Topic deleted';
        showToast(deleteMessage, 'info');
    }
}

// تحديث عداد المواضيع
function updateTopicsCount() {
    const topics = document.querySelectorAll('.topic-item');
    const topicsCountInput = document.getElementById('topicsCount');
    if (topicsCountInput) {
        topicsCountInput.value = topics.length;
    }
}

// إضافة مناقشة جانبية
function addSideDiscussion(topicId) {
    const sideDiscussionsContainer = document.getElementById(`sideDiscussions-${topicId}`);
    if (!sideDiscussionsContainer) return;
    
    const existingSideDiscussions = sideDiscussionsContainer.querySelectorAll('.side-discussion-item');
    const sideDiscussionId = existingSideDiscussions.length + 1;
    const uniqueId = `${topicId}-${sideDiscussionId}`;
    
    const sideDiscussionItem = document.createElement('div');
    sideDiscussionItem.className = 'side-discussion-item';
    sideDiscussionItem.id = `sideDiscussion-${uniqueId}`;
    
    sideDiscussionItem.innerHTML = `
        <div class="side-discussion-header">
            <span class="side-discussion-number" data-translate="side-discussion-number">مناقشة جانبية ${sideDiscussionId}</span>
            <button type="button" class="remove-side-discussion-btn" onclick="removeSideDiscussion('${uniqueId}')" title="حذف المناقشة الجانبية" data-translate-title="remove-side-discussion">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        
        <div class="form-group full-width required">
            <label for="sideDiscussionContent-${uniqueId}" data-translate="side-discussion-content">محتوى المناقشة الجانبية</label>
            <textarea id="sideDiscussionContent-${uniqueId}" name="topics[${topicId}][sideDiscussions][${sideDiscussionId}][content]" 
                      rows="3" placeholder="أدخل محتوى المناقشة الجانبية" data-translate-placeholder="placeholder-side-discussion-content" required></textarea>
        </div>
        
        <div class="row">
            <div class="form-group">
                <label for="sideDiscussionDuration-${uniqueId}" data-translate="side-discussion-duration">مدة</label>
                <input type="text" id="sideDiscussionDuration-${uniqueId}" name="topics[${topicId}][sideDiscussions][${sideDiscussionId}][duration]" 
                       placeholder="مثال: 15 يوم" data-translate-placeholder="placeholder-side-discussion-duration" />
            </div>
            <div class="form-group">
                <label for="sideDiscussionEndDate-${uniqueId}" data-translate="side-discussion-end-date">تاريخ انتهاء</label>
                <input type="date" id="sideDiscussionEndDate-${uniqueId}" name="topics[${topicId}][sideDiscussions][${sideDiscussionId}][endDate]" />
            </div>
        </div>
        
        <div class="row">
            <div class="form-group">
                <label for="sideDiscussionRecommendations-${uniqueId}" data-translate="side-discussion-recommendations">التوصيات</label>
                <textarea id="sideDiscussionRecommendations-${uniqueId}" name="topics[${topicId}][sideDiscussions][${sideDiscussionId}][recommendations]" 
                          rows="2" placeholder="أدخل التوصيات هنا" data-translate-placeholder="placeholder-side-discussion-recommendations"></textarea>
            </div>
            <div class="form-group">
                <label for="sideDiscussionResponsibility-${uniqueId}" data-translate="side-discussion-responsibility">المسؤولية</label>
                <input type="text" id="sideDiscussionResponsibility-${uniqueId}" name="topics[${topicId}][sideDiscussions][${sideDiscussionId}][responsibility]" 
                       placeholder="أدخل المسؤول هنا" data-translate-placeholder="placeholder-side-discussion-responsibility" />
            </div>
        </div>
    `;
    
    sideDiscussionsContainer.appendChild(sideDiscussionItem);
    
    // منع إرسال الفورم بـ Enter من حقول المناقشة الجانبية الجديدة ولكن السماح بالانتقال
    const newFields = sideDiscussionItem.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select');
    newFields.forEach(field => {
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                // للـ textarea، السماح بـ Enter إذا كان Shift مضغوط (للسطر الجديد)
                if (field.tagName.toLowerCase() === 'textarea' && e.shiftKey) {
                    const start = field.selectionStart;
                    const end = field.selectionEnd;
                    const value = field.value;
                    
                    field.value = value.substring(0, start) + '\n' + value.substring(end);
                    field.selectionStart = field.selectionEnd = start + 1;
                    return;
                }
                
                // استخدام نفس دالة الانتقال المبسطة
                moveToNextField(field);
            }
        });
    });
    
    // تطبيق الترجمات على العناصر الجديدة
    if (typeof applyTranslations === 'function') {
        applyTranslations();
    }
    
    // رسالة مترجمة
    const lang = localStorage.getItem('language') || 'ar';
    const successMessage = lang === 'ar' ? 'تم إضافة مناقشة جانبية جديدة' : 'Side discussion added successfully';
    showToast(successMessage, 'success');
}

// حذف مناقشة جانبية
function removeSideDiscussion(uniqueId) {
    const sideDiscussionElement = document.getElementById(`sideDiscussion-${uniqueId}`);
    if (sideDiscussionElement) {
        sideDiscussionElement.remove();
        
        // رسالة مترجمة
        const lang = localStorage.getItem('language') || 'ar';
        const deleteMessage = lang === 'ar' ? 'تم حذف المناقشة الجانبية' : 'Side discussion deleted';
        showToast(deleteMessage, 'info');
        
        // إعادة ترقيم المناقشات الجانبية المتبقية
        const topicId = uniqueId.split('-')[0];
        renumberSideDiscussions(topicId);
    }
}

// إعادة ترقيم المناقشات الجانبية
function renumberSideDiscussions(topicId) {
    const sideDiscussionsContainer = document.getElementById(`sideDiscussions-${topicId}`);
    if (!sideDiscussionsContainer) return;
    
    const sideDiscussions = sideDiscussionsContainer.querySelectorAll('.side-discussion-item');
    sideDiscussions.forEach((item, index) => {
        const newNumber = index + 1;
        const numberSpan = item.querySelector('.side-discussion-number');
        if (numberSpan) {
            // استخدام النص المترجم بدلاً من النص الثابت
            const lang = localStorage.getItem('language') || 'ar';
            const sideDiscussionText = lang === 'ar' ? 'مناقشة جانبية' : 'Side Discussion';
            numberSpan.textContent = `${sideDiscussionText} ${newNumber}`;
        }
    });
}

// معالجة إرسال النموذج
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // التحقق من صحة النموذج
    if (!validateForm()) {
        return;
    }

    // جمع بيانات النموذج
    const protocolData = collectFormData();

    try {
        // إظهار رسالة التحميل
        showToast('جاري حفظ المحضر...', 'info');
        
        // إرسال البيانات إلى الخادم (إنشاء أو تحديث)
        const form = document.getElementById('protocolForm');
        const editId = form?.dataset?.editId;
        const response = await (editId ? updateProtocol(editId, protocolData) : saveProtocol(protocolData));
        
        if (response.success) {
            showToast(editId ? 'تم تحديث المحضر بنجاح' : 'تم حفظ المحضر بنجاح', 'success');
            // إعادة تعيين النموذج بعد ثانيتين
            setTimeout(() => {
                resetForm();
                // الرجوع لقائمة المحاضر بعد الحفظ
                window.location.href = '/frontend/html/protocol-list.html';
            }, 2000);
        } else {
            showToast(response.message || 'حدث خطأ أثناء حفظ المحضر', 'error');
        }
    } catch (error) {
        console.error('خطأ في حفظ المحضر:', error);
        showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

// جمع بيانات المواضيع
function collectTopicsData() {
    const topics = [];
    const topicElements = document.querySelectorAll('.topic-item');
    
    topicElements.forEach((topicElement, index) => {
        const topicId = topicElement.id.split('-')[1];
        
        // جمع بيانات المناقشات الجانبية
        const sideDiscussions = [];
        const sideDiscussionElements = topicElement.querySelectorAll('.side-discussion-item');
        
        sideDiscussionElements.forEach((sideElement) => {
            const sideId = sideElement.id.replace('sideDiscussion-', '');
            const contentElement = document.getElementById(`sideDiscussionContent-${sideId}`);
            const durationElement = document.getElementById(`sideDiscussionDuration-${sideId}`);
            const endDateElement = document.getElementById(`sideDiscussionEndDate-${sideId}`);
            const recommendationsElement = document.getElementById(`sideDiscussionRecommendations-${sideId}`);
            const responsibilityElement = document.getElementById(`sideDiscussionResponsibility-${sideId}`);
            
            if (contentElement && contentElement.value.trim()) {
                sideDiscussions.push({
                    content: contentElement.value.trim(),
                    duration: durationElement ? durationElement.value.trim() : '',
                    endDate: endDateElement ? endDateElement.value : '',
                    recommendations: recommendationsElement ? recommendationsElement.value.trim() : '',
                    responsibility: responsibilityElement ? responsibilityElement.value.trim() : ''
                });
            }
        });
        
        const topicData = {
            id: topicId,
            subject: document.getElementById(`topicSubject-${topicId}`).value,
            discussion: document.getElementById(`topicDiscussion-${topicId}`).value,
            duration: document.getElementById(`topicDuration-${topicId}`).value,
            endDate: document.getElementById(`topicEndDate-${topicId}`).value,
            recommendations: document.getElementById(`topicRecommendations-${topicId}`).value,
            responsibility: document.getElementById(`topicResponsibility-${topicId}`).value,
            sideDiscussions: sideDiscussions
        };
        topics.push(topicData);
    });
    
    return topics;
}

// جمع بيانات النموذج مع القسم والمجلد واللجنة
function collectFormData() {
    const formData = new FormData(document.getElementById('protocolForm'));
    const assignmentType = formData.get('assignmentType');
    
    let departmentId = null;
    let folderId = null;
    let committeeId = null;
    
    if (assignmentType === 'department') {
        departmentId = formData.get('protocolDepartment') || null;
        folderId = formData.get('protocolFolder') || null;
    } else if (assignmentType === 'committee') {
        committeeId = formData.get('protocolCommittee') || null;
        folderId = formData.get('committeeFolder') || null;
    } else if (assignmentType === 'both') {
        departmentId = formData.get('protocolDepartment') || null;
        folderId = formData.get('protocolFolder') || null;
        committeeId = formData.get('protocolCommittee') || null;
    }
    
    return {
        protocolTitle: formData.get('protocolTitle'),
        protocolDate: formData.get('protocolDate'),
        protocolTime: formData.get('protocolTime'),
        room: formData.get('protocolRoom'),
        assignmentType: assignmentType,
        departmentId: departmentId,
        folderId: folderId,
        committeeId: committeeId,
        topics: collectTopicsData()
    };
}

// حفظ المحضر
async function saveProtocol(protocolData) {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch('http://localhost:3006/api/protocols', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(protocolData)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'خطأ في الخادم');
        }

        return result;
    } catch (error) {
        console.error('Error saving protocol:', error);
        throw error;
    }
}

// تحديث محضر
async function updateProtocol(protocolId, protocolData) {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch(`http://localhost:3006/api/protocols/${encodeURIComponent(protocolId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(protocolData)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'خطأ في الخادم');
        }
        return result;
    } catch (error) {
        console.error('Error updating protocol:', error);
        throw error;
    }
}

// التحقق من صحة النموذج
function validateForm() {
    const requiredFields = [
        'protocolTitle',
        'protocolDate'
    ];

    let isValid = true;

    // التحقق من الحقول الأساسية
    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (field && !field.value.trim()) {
            showFieldError(field, 'هذا الحقل مطلوب');
            isValid = false;
        } else if (field) {
            clearFieldError(field);
        }
    });

    // التحقق من المواضيع
    const topicElements = document.querySelectorAll('.topic-item');
    if (topicElements.length === 0) {
        showToast('يجب إضافة موضوع واحد على الأقل', 'error');
        isValid = false;
        return isValid;
    }

    // التحقق من كل موضوع
    topicElements.forEach(topicElement => {
        const topicId = topicElement.id.split('-')[1];
        const requiredTopicFields = [
            `topicSubject-${topicId}`,
            `topicDiscussion-${topicId}`
        ];

        // التحقق من الحقول المطلوبة
        requiredTopicFields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field && !field.value.trim()) {
                showFieldError(field, 'هذا الحقل مطلوب');
                isValid = false;
            } else if (field) {
                clearFieldError(field);
            }
        });

        // التحقق من صحة تاريخ انتهاء الموضوع (إذا تم إدخاله)
        const endDateField = document.getElementById(`topicEndDate-${topicId}`);
        if (endDateField && endDateField.value) {
            if (!validateTopicEndDate(endDateField)) {
                isValid = false;
            }
        }

        // التحقق من المناقشات الجانبية
        const sideDiscussionElements = topicElement.querySelectorAll('.side-discussion-item');
        sideDiscussionElements.forEach(sideElement => {
            const sideId = sideElement.id.replace('sideDiscussion-', '');
            const contentField = document.getElementById(`sideDiscussionContent-${sideId}`);
            
            // التحقق من محتوى المناقشة الجانبية
            if (contentField && !contentField.value.trim()) {
                showFieldError(contentField, 'محتوى المناقشة الجانبية مطلوب');
                isValid = false;
            } else if (contentField) {
                clearFieldError(contentField);
            }

            // التحقق من تاريخ انتهاء المناقشة الجانبية
            const sideEndDateField = document.getElementById(`sideDiscussionEndDate-${sideId}`);
            if (sideEndDateField && sideEndDateField.value) {
                if (!validateSideDiscussionEndDate(sideEndDateField)) {
                    isValid = false;
                }
            }
        });
    });

    return isValid;
}

// دالة للانتقال للحقل التالي
function moveToNextField(currentField) {
    const form = document.getElementById('protocolForm');
    if (!form) return;
    
    // جمع جميع الحقول القابلة للتركيز
    const allFields = Array.from(form.querySelectorAll(
        'input:not([type="submit"]):not([type="button"]):not([type="hidden"]), textarea, select'
    ));
    
    // تصفية الحقول المرئية والمفعلة فقط
    const visibleFields = allFields.filter(field => {
        const style = window.getComputedStyle(field);
        const rect = field.getBoundingClientRect();
        
        return (
            !field.disabled &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            field.offsetParent !== null &&
            rect.width > 0 &&
            rect.height > 0
        );
    });
    
    const currentIndex = visibleFields.indexOf(currentField);
    if (currentIndex >= 0 && currentIndex < visibleFields.length - 1) {
        const nextField = visibleFields[currentIndex + 1];
        nextField.focus();
        
        // للـ input، تحديد النص إذا كان موجود
        if (nextField.tagName.toLowerCase() === 'input' && nextField.type === 'text') {
            nextField.select();
        }
    }
}

// التحقق من صحة عنوان المحضر
function validateProtocolTitle() {
    const protocolTitle = this.value.trim();
    
    if (protocolTitle && protocolTitle.length < 10) {
        showFieldError(this, 'عنوان المحضر يجب أن يكون 10 أحرف على الأقل');
        return false;
    } else {
        clearFieldError(this);
        return true;
    }
}

// التحقق من صحة تاريخ انتهاء الموضوع
function validateTopicEndDate(endDateField) {
    const endDate = new Date(endDateField.value);
    const protocolDate = new Date(document.getElementById('protocolDate').value);
    
    if (endDate <= protocolDate) {
        showFieldError(endDateField, 'تاريخ انتهاء الموضوع يجب أن يكون بعد تاريخ المحضر');
        return false;
    } else {
        clearFieldError(endDateField);
        return true;
    }
}

// التحقق من صحة تاريخ انتهاء المناقشة الجانبية
function validateSideDiscussionEndDate(endDateField) {
    const endDate = new Date(endDateField.value);
    const protocolDate = new Date(document.getElementById('protocolDate').value);
    
    if (endDate <= protocolDate) {
        showFieldError(endDateField, 'تاريخ انتهاء المناقشة الجانبية يجب أن يكون بعد تاريخ المحضر');
        return false;
    } else {
        clearFieldError(endDateField);
        return true;
    }
}

// إظهار خطأ في الحقل
function showFieldError(field, message) {
    // إزالة رسالة الخطأ السابقة
    clearFieldError(field);
    
    // إضافة رسالة الخطأ
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    errorDiv.style.color = '#dc2626';
    errorDiv.style.fontSize = '12px';
    errorDiv.style.marginTop = '5px';
    
    field.parentNode.appendChild(errorDiv);
    field.style.borderColor = '#dc2626';
}

// إزالة خطأ الحقل
function clearFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    field.style.borderColor = '#d1d5db';
}

// إعادة تعيين النموذج
function resetForm() {
    const form = document.getElementById('protocolForm');
    if (form) {
        form.reset();
        
        // إعادة تعيين التاريخ الحالي
        const today = new Date().toISOString().split('T')[0];
        const protocolDateInput = document.getElementById('protocolDate');
        if (protocolDateInput) {
            protocolDateInput.value = today;
        }
        
        // إعادة تعيين الوقت الحالي
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const protocolTimeInput = document.getElementById('protocolTime');
        if (protocolTimeInput) {
            protocolTimeInput.value = `${hours}:${minutes}`;
        }
        
        // إعادة تعيين القاعة
        const protocolRoomInput = document.getElementById('protocolRoom');
        if (protocolRoomInput) {
            protocolRoomInput.value = '';
        }
        
        // إعادة تعيين الحقول الجديدة
        const departmentSelect = document.getElementById('protocolDepartment');
        const folderSelect = document.getElementById('protocolFolder');
        const committeeSelect = document.getElementById('protocolCommittee');
        const committeeFolderSelect = document.getElementById('committeeFolder');
        
        if (departmentSelect) departmentSelect.value = '';
        if (folderSelect) {
            folderSelect.value = '';
            folderSelect.disabled = true;
            folderSelect.innerHTML = '<option value="">اختر القسم أولاً</option>';
        }
        if (committeeSelect) committeeSelect.value = '';
        if (committeeFolderSelect) {
            committeeFolderSelect.value = '';
            committeeFolderSelect.disabled = true;
            committeeFolderSelect.innerHTML = '<option value="">اختر اللجنة أولاً</option>';
        }
        
        // إعادة تعيين نوع التخصيص
        const departmentOption = document.getElementById('optionDepartment');
        if (departmentOption) departmentOption.checked = true;
        toggleAssignmentType();
        
        // إخفاء قسم اللجنة في البداية
        const committeeSection = document.getElementById('committeeAssignment');
        if (committeeSection) committeeSection.style.display = 'none';
        
        // مسح المواضيع
        const topicsContainer = document.getElementById('topicsContainer');
        const topicsSection = document.getElementById('topicsSection');
        if (topicsContainer) {
            topicsContainer.innerHTML = '';
        }
        if (topicsSection) {
            topicsSection.style.display = 'none';
        }
        
        // إعادة تعيين عداد المواضيع
        topicCounter = 0;
        
        // إزالة جميع رسائل الخطأ
        const errorMessages = document.querySelectorAll('.field-error');
        errorMessages.forEach(error => error.remove());
        
        // إعادة تعيين ألوان الحدود
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.style.borderColor = '#d1d5db';
        });
        
        const lang = localStorage.getItem('language') || 'ar';
        const resetMessage = lang === 'ar' ? 'تم إعادة تعيين النموذج' : 'Form has been reset';
        showToast(resetMessage, 'info');
    }
}

// إظهار رسالة Toast
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // إضافة أيقونة حسب نوع الرسالة
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // إزالة الرسالة بعد 5 ثوان
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// الحصول على رمز المصادقة
function getAuthToken() {
    return localStorage.getItem('token');
}

// =====================
// وظائف تحميل الأقسام والمجلدات واللجان
// =====================

// إنشاء dropdown قابل للبحث
function createSearchableDropdown(selectElement, placeholder = 'ابحث...') {
    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-dropdown-wrapper';
    
    // إنشاء الزر الذي يظهر كـ select
    const dropdownButton = document.createElement('div');
    dropdownButton.className = 'dropdown-button';
    dropdownButton.setAttribute('tabindex', '0');
    
    const buttonText = document.createElement('span');
    buttonText.className = 'dropdown-button-text';
    buttonText.textContent = selectElement.options[0]?.textContent || 'اختر من القائمة';
    
    const dropdownArrow = document.createElement('span');
    dropdownArrow.className = 'dropdown-arrow';
    dropdownArrow.innerHTML = '▼';
    
    dropdownButton.appendChild(buttonText);
    dropdownButton.appendChild(dropdownArrow);
    
    // إنشاء القائمة المنسدلة
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'dropdown-menu';
    
    // إنشاء مربع البحث داخل القائمة
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dropdown-search';
    searchInput.placeholder = placeholder;
    
    // إنشاء قائمة الخيارات
    const optionsList = document.createElement('div');
    optionsList.className = 'dropdown-options';
    
    dropdownMenu.appendChild(searchInput);
    dropdownMenu.appendChild(optionsList);
    
    // إخفاء الـ select الأصلي
    selectElement.style.display = 'none';
    
    // إدراج العناصر الجديدة
    selectElement.parentNode.insertBefore(wrapper, selectElement.nextSibling);
    wrapper.appendChild(dropdownButton);
    wrapper.appendChild(dropdownMenu);
    
    // تطبيق حالة disabled إذا كانت موجودة
    if (selectElement.disabled) {
        dropdownButton.classList.add('disabled');
    }
    
    let allOptions = [];
    let isOpen = false;
    
    // دالة لتحديث الخيارات
    function updateOptions() {
        allOptions = Array.from(selectElement.options).map(option => ({
            value: option.value,
            text: option.textContent,
            html: option.innerHTML,
            element: option
        }));
        filterOptions('');
        updateButtonText();
    }
    
    // دالة لتحديث نص الزر
    function updateButtonText() {
        const selectedOption = allOptions.find(option => option.value === selectElement.value);
        if (selectedOption && selectedOption.value !== '') {
            // التحقق من وجود HTML في النص (للـ badges)
            if (selectedOption.element && selectedOption.element.innerHTML && selectedOption.element.innerHTML.includes('folder-type-badge')) {
                buttonText.innerHTML = selectedOption.element.innerHTML;
            } else {
                buttonText.textContent = selectedOption.text;
            }
        } else {
            buttonText.textContent = allOptions[0]?.text || 'اختر من القائمة';
        }
    }
    
    // دالة لتصفية الخيارات
    function filterOptions(searchTerm) {
        const filtered = allOptions.filter(option => 
            option.text.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        optionsList.innerHTML = '';
        
        const validOptions = filtered.filter(option => option.value !== '');
        
        if (validOptions.length === 0 && searchTerm) {
            const noResultsItem = document.createElement('div');
            noResultsItem.className = 'dropdown-no-results';
            noResultsItem.textContent = 'لا توجد نتائج مطابقة';
            optionsList.appendChild(noResultsItem);
            return;
        }
        
        filtered.forEach(option => {
            const item = document.createElement('div');
            item.className = 'dropdown-option';
            
            // التحقق من وجود HTML في النص (للـ badges)
            if (option.element && option.element.innerHTML && option.element.innerHTML.includes('folder-type-badge')) {
                item.innerHTML = option.element.innerHTML;
            } else {
                item.textContent = option.text;
            }
            
            item.dataset.value = option.value;
            
            if (option.value === selectElement.value) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', () => {
                selectElement.value = option.value;
                updateButtonText();
                closeDropdown();
                
                // إطلاق حدث التغيير
                const event = new Event('change', { bubbles: true });
                selectElement.dispatchEvent(event);
            });
            
            optionsList.appendChild(item);
        });
    }
    
    // دالة لفتح القائمة
    function openDropdown() {
        if (isOpen) return;
        isOpen = true;
        dropdownMenu.style.display = 'block';
        dropdownButton.classList.add('open');
        searchInput.value = '';
        searchInput.focus();
        filterOptions('');
    }
    
    // دالة لإغلاق القائمة
    function closeDropdown() {
        if (!isOpen) return;
        isOpen = false;
        dropdownMenu.style.display = 'none';
        dropdownButton.classList.remove('open');
        searchInput.value = '';
    }
    
    // مستمعي الأحداث
    dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectElement.disabled || dropdownButton.classList.contains('disabled')) {
            return;
        }
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });
    
    dropdownButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDropdown();
        }
    });
    
    searchInput.addEventListener('input', (e) => {
        filterOptions(e.target.value);
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDropdown();
            dropdownButton.focus();
        }
    });
    
    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            closeDropdown();
        }
    });
    
    // منع إغلاق القائمة عند النقر داخلها
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // مراقب لتحديث القائمة عند تغيير الخيارات
    const observer = new MutationObserver(updateOptions);
    observer.observe(selectElement, { childList: true, subtree: true });
    
    // تحديث أولي
    updateOptions();
    
    return {
        updateOptions,
        updateButtonText,
        setDisabled: (disabled) => {
            if (disabled) {
                dropdownButton.classList.add('disabled');
            } else {
                dropdownButton.classList.remove('disabled');
            }
        },
        destroy: () => {
            observer.disconnect();
            wrapper.remove();
            selectElement.style.display = 'block';
        }
    };
}

// تحميل الأقسام
async function loadDepartments() {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch('http://localhost:3006/api/departments/all', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`فشل في جلب الأقسام (${response.status})`);
        }

        const result = await response.json();
        const departments = Array.isArray(result) ? result : (result.data || []);

        const departmentSelect = document.getElementById('protocolDepartment');
        if (!departmentSelect) return;

        const lang = localStorage.getItem('language') || 'ar';
        const selectText = lang === 'ar' ? 'اختر القسم' : 'Select Department';
        departmentSelect.innerHTML = `<option value="">${selectText}</option>`;

        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            let name = dept.name;
            try {
                if (typeof name === 'string' && name.trim().startsWith('{')) {
                    name = JSON.parse(name);
                }
                option.textContent = typeof name === 'object'
                    ? (name[lang] || name.ar || name.en || '')
                    : name;
            } catch {
                option.textContent = name || '';
            }
            departmentSelect.appendChild(option);
        });

        // إنشاء dropdown قابل للبحث للأقسام
        if (!departmentSelect.searchableDropdown) {
            departmentSelect.searchableDropdown = createSearchableDropdown(departmentSelect, 'ابحث عن القسم...');
        } else {
            departmentSelect.searchableDropdown.updateOptions();
        }

        console.log('✅ تم تحميل', departments.length, 'قسم');
    } catch (error) {
        console.error('❌ خطأ في تحميل الأقسام:', error);
        showToast('خطأ في جلب الأقسام: ' + error.message, 'error');
    }
    
    return Promise.resolve();
}

// تحميل مجلدات القسم المحدد
async function loadFoldersForDepartment() {
    const departmentSelect = document.getElementById('protocolDepartment');
    const folderSelect = document.getElementById('protocolFolder');
    
    if (!departmentSelect || !folderSelect) return Promise.resolve();
    
    const departmentId = departmentSelect.value;
    
    if (!departmentId) {
        folderSelect.innerHTML = '<option value="">اختر القسم أولاً</option>';
        folderSelect.disabled = true;
        if (folderSelect.searchableDropdown) {
            folderSelect.searchableDropdown.setDisabled(true);
        }
        return Promise.resolve();
    }
    
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch(`http://localhost:3006/api/departments/${departmentId}/folders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`فشل في جلب مجلدات القسم (${response.status})`);
        }

        const result = await response.json();
        const folders = result.data || [];

        const lang = localStorage.getItem('language') || 'ar';
        const selectText = lang === 'ar' ? 'اختر المجلد' : 'Select Folder';
        folderSelect.innerHTML = `<option value="">${selectText}</option>`;

        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            let name = folder.name;
            try {
                if (typeof name === 'string' && name.trim().startsWith('{')) {
                    name = JSON.parse(name);
                }
                const displayName = typeof name === 'object'
                    ? (name[lang] || name.ar || name.en || '')
                    : name;
                
                // إضافة نوع المجلد إذا كان متوفراً مع badge ملون (للأقسام فقط)
                if (folder.type) {
                    const typeTranslations = {
                        'private': {
                            ar: 'خاص',
                            en: 'Private',
                            color: '#ef4444' // أحمر
                        },
                        'shared': {
                            ar: 'مشترك',
                            en: 'Shared', 
                            color: '#f59e0b' // برتقالي
                        },
                        'public': {
                            ar: 'عام',
                            en: 'Public',
                            color: '#10b981' // أخضر
                        }
                    };
                    
                    const typeInfo = typeTranslations[folder.type] || {
                        ar: folder.type,
                        en: folder.type,
                        color: '#6b7280'
                    };
                    
                    const folderTypeText = lang === 'ar' ? typeInfo.ar : typeInfo.en;
                    
                    // إنشاء عنصر مع badge ملون
                    option.innerHTML = `
                        <span class="folder-name">${displayName}</span>
                        <span class="folder-type-badge" style="background-color: ${typeInfo.color}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px; margin-right: 8px; font-weight: 500;">
                            ${folderTypeText}
                        </span>
                    `;
                } else {
                    option.textContent = displayName;
                }
            } catch {
                option.textContent = name || '';
            }
            folderSelect.appendChild(option);
        });

        folderSelect.disabled = false;
        
        // إنشاء dropdown قابل للبحث للمجلدات
        if (!folderSelect.searchableDropdown) {
            folderSelect.searchableDropdown = createSearchableDropdown(folderSelect, 'ابحث عن المجلد...');
        } else {
            folderSelect.searchableDropdown.updateOptions();
            folderSelect.searchableDropdown.setDisabled(false);
        }
        
        console.log('✅ تم تحميل', folders.length, 'مجلد للقسم', departmentId);
    } catch (error) {
        console.error('❌ خطأ في تحميل مجلدات القسم:', error);
        showToast('خطأ في جلب مجلدات القسم: ' + error.message, 'error');
        folderSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
        folderSelect.disabled = true;
        if (folderSelect.searchableDropdown) {
            folderSelect.searchableDropdown.setDisabled(true);
        }
    }
    
    return Promise.resolve();
}

// تحميل اللجان
async function loadCommittees() {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch('http://localhost:3006/api/committees', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`فشل في جلب اللجان (${response.status})`);
        }

        const result = await response.json();
        const committees = Array.isArray(result) ? result : (result.data || []);

        const committeeSelect = document.getElementById('protocolCommittee');
        if (!committeeSelect) return;

        const lang = localStorage.getItem('language') || 'ar';
        const selectText = lang === 'ar' ? 'اختر اللجنة' : 'Select Committee';
        committeeSelect.innerHTML = `<option value="">${selectText}</option>`;

        committees.forEach(committee => {
            const option = document.createElement('option');
            option.value = committee.id;
            let name = committee.name;
            try {
                if (typeof name === 'string' && name.trim().startsWith('{')) {
                    name = JSON.parse(name);
                }
                option.textContent = typeof name === 'object'
                    ? (name[lang] || name.ar || name.en || '')
                    : name;
            } catch {
                option.textContent = name || '';
            }
            committeeSelect.appendChild(option);
        });

        // إنشاء dropdown قابل للبحث للجان
        if (!committeeSelect.searchableDropdown) {
            committeeSelect.searchableDropdown = createSearchableDropdown(committeeSelect, 'ابحث عن اللجنة...');
        } else {
            committeeSelect.searchableDropdown.updateOptions();
        }

        console.log('✅ تم تحميل', committees.length, 'لجنة');
    } catch (error) {
        console.error('❌ خطأ في تحميل اللجان:', error);
        showToast('خطأ في جلب اللجان: ' + error.message, 'error');
    }
    
    return Promise.resolve();
}

// تبديل نوع التخصيص
function toggleAssignmentType() {
    const assignmentType = document.querySelector('input[name="assignmentType"]:checked').value;
    const departmentSection = document.getElementById('departmentAssignment');
    const committeeSection = document.getElementById('committeeAssignment');
    
    if (assignmentType === 'department') {
        departmentSection.style.display = 'block';
        committeeSection.style.display = 'none';
        
        // إعادة تعيين حقول اللجنة
        const committeeSelect = document.getElementById('protocolCommittee');
        const committeeFolderSelect = document.getElementById('committeeFolder');
        if (committeeSelect) committeeSelect.value = '';
        if (committeeFolderSelect) {
            committeeFolderSelect.value = '';
            committeeFolderSelect.disabled = true;
            committeeFolderSelect.innerHTML = '<option value="">اختر اللجنة أولاً</option>';
        }
    } else if (assignmentType === 'committee') {
        departmentSection.style.display = 'none';
        committeeSection.style.display = 'block';
        
        // إعادة تعيين حقول القسم
        const departmentSelect = document.getElementById('protocolDepartment');
        const folderSelect = document.getElementById('protocolFolder');
        if (departmentSelect) departmentSelect.value = '';
        if (folderSelect) {
            folderSelect.value = '';
            folderSelect.disabled = true;
            folderSelect.innerHTML = '<option value="">اختر القسم أولاً</option>';
        }
    } else if (assignmentType === 'both') {
        // إظهار كلا القسمين
        departmentSection.style.display = 'block';
        committeeSection.style.display = 'block';
        
        // تفعيل جميع الحقول
        const folderSelect = document.getElementById('protocolFolder');
        const committeeFolderSelect = document.getElementById('committeeFolder');
        if (folderSelect) folderSelect.disabled = false;
        if (committeeFolderSelect) committeeFolderSelect.disabled = false;
    }
}

// تحميل مجلدات اللجنة المحددة
async function loadFoldersForCommittee() {
    const committeeSelect = document.getElementById('protocolCommittee');
    const committeeFolderSelect = document.getElementById('committeeFolder');
    
    if (!committeeSelect || !committeeFolderSelect) return Promise.resolve();
    
    const committeeId = committeeSelect.value;
    
    if (!committeeId) {
        committeeFolderSelect.innerHTML = '<option value="">اختر اللجنة أولاً</option>';
        committeeFolderSelect.disabled = true;
        if (committeeFolderSelect.searchableDropdown) {
            committeeFolderSelect.searchableDropdown.setDisabled(true);
        }
        return Promise.resolve();
    }
    
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('غير مصرح لك، يرجى تسجيل الدخول مرة أخرى');
        }

        const response = await fetch(`http://localhost:3006/api/committees/${committeeId}/folders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`فشل في جلب مجلدات اللجنة (${response.status})`);
        }

        const result = await response.json();
        const folders = result.data || [];

        const lang = localStorage.getItem('language') || 'ar';
        const selectText = lang === 'ar' ? 'اختر مجلد اللجنة' : 'Select Committee Folder';
        committeeFolderSelect.innerHTML = `<option value="">${selectText}</option>`;

        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            let name = folder.name;
            try {
                if (typeof name === 'string' && name.trim().startsWith('{')) {
                    name = JSON.parse(name);
                }
                const displayName = typeof name === 'object'
                    ? (name[lang] || name.ar || name.en || '')
                    : name;
                
                // اللجان لا تحتوي على أنواع مجلدات، فقط عرض الاسم
                option.textContent = displayName;
            } catch {
                option.textContent = name || '';
            }
            committeeFolderSelect.appendChild(option);
        });

        committeeFolderSelect.disabled = false;
        
        // إنشاء dropdown قابل للبحث لمجلدات اللجنة
        if (!committeeFolderSelect.searchableDropdown) {
            committeeFolderSelect.searchableDropdown = createSearchableDropdown(committeeFolderSelect, 'ابحث عن مجلد اللجنة...');
        } else {
            committeeFolderSelect.searchableDropdown.updateOptions();
            committeeFolderSelect.searchableDropdown.setDisabled(false);
        }
        
        console.log('✅ تم تحميل مجلدات اللجنة', folders.length, 'مجلد للجنة', committeeId);
    } catch (error) {
        console.error('❌ خطأ في تحميل مجلدات اللجنة:', error);
        showToast('خطأ في جلب مجلدات اللجنة: ' + error.message, 'error');
        committeeFolderSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
        committeeFolderSelect.disabled = true;
        if (committeeFolderSelect.searchableDropdown) {
            committeeFolderSelect.searchableDropdown.setDisabled(true);
        }
    }
    
    return Promise.resolve();
}

// إضافة CSS للقوائم القابلة للبحث
function addSearchableDropdownStyles() {
    if (document.getElementById('searchableDropdownStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'searchableDropdownStyles';
    style.textContent = `
        /* Wrapper للـ dropdown الجديد */
        .searchable-dropdown-wrapper {
            position: relative;
            width: 100%;
        }
        
        /* الزر الذي يظهر كـ select */
        .dropdown-button {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background-color: #fff;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            min-height: 20px;
        }
        
        .dropdown-button:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .dropdown-button:hover {
            border-color: #9ca3af;
        }
        
        .dropdown-button.open {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .dropdown-button-text {
            flex: 1;
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #374151;
        }
        
        .dropdown-arrow {
            color: #6b7280;
            font-size: 12px;
            transition: transform 0.2s ease;
            margin-left: 8px;
        }
        
        .dropdown-button.open .dropdown-arrow {
            transform: rotate(180deg);
        }
        
        /* القائمة المنسدلة */
        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #d1d5db;
            border-top: none;
            border-radius: 0 0 6px 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            z-index: 1000;
            display: none;
            max-height: 250px;
            overflow: hidden;
        }
        
        /* مربع البحث داخل القائمة */
        .dropdown-search {
            width: 100%;
            padding: 8px 12px;
            border: none;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
            background-color: #f9fafb;
            box-sizing: border-box;
        }
        
        .dropdown-search:focus {
            outline: none;
            background-color: #fff;
        }
        
        .dropdown-search::placeholder {
            color: #9ca3af;
        }
        
        /* قائمة الخيارات */
        .dropdown-options {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .dropdown-option {
            padding: 10px 12px;
            cursor: pointer;
            border-bottom: 1px solid #f3f4f6;
            transition: background-color 0.2s ease;
            font-size: 14px;
            line-height: 1.4;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .dropdown-option:last-child {
            border-bottom: none;
        }
        
        .dropdown-option:hover {
            background-color: #f3f4f6;
        }
        
        .dropdown-option.selected {
            background-color: #e5e7eb;
            font-weight: 500;
        }
        
        .dropdown-no-results {
            padding: 12px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            font-style: italic;
        }
        
        /* scrollbar مخصص */
        .dropdown-options::-webkit-scrollbar {
            width: 6px;
        }
        
        .dropdown-options::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        
        .dropdown-options::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        
        .dropdown-options::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
        
        /* تحسينات للموبايل */
        @media (max-width: 768px) {
            .dropdown-menu {
                max-height: 200px;
            }
            
            .dropdown-options {
                max-height: 150px;
            }
            
            .dropdown-option {
                padding: 12px;
                font-size: 16px;
            }
            
            .dropdown-search {
                padding: 10px 12px;
                font-size: 16px;
            }
        }
        
        /* حالة disabled */
        .dropdown-button.disabled {
            background-color: #f3f4f6;
            color: #9ca3af;
            cursor: not-allowed;
        }
        
        .dropdown-button.disabled:hover {
            border-color: #d1d5db;
        }
        
        .dropdown-button.disabled .dropdown-arrow {
            color: #d1d5db;
        }
        
        /* تنسيقات الـ badges الملونة للمجلدات */
        .folder-type-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
            color: white;
            margin-right: 8px;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .folder-name {
            display: inline-block;
        }
        
        .dropdown-option .folder-type-badge {
            float: left;
            margin-left: 8px;
            margin-right: 0;
        }
        
        .dropdown-button-text .folder-type-badge {
            float: left;
            margin-left: 8px;
            margin-right: 0;
        }
    `;
    
    document.head.appendChild(style);
}

// تصدير الدوال للاستخدام العام
window.resetForm = resetForm;
window.showToast = showToast;
window.generateTopics = generateTopics;
window.addTopic = addTopic;
window.removeTopic = removeTopic;
window.addSideDiscussion = addSideDiscussion;
window.removeSideDiscussion = removeSideDiscussion;
window.loadFoldersForDepartment = loadFoldersForDepartment;
window.loadFoldersForCommittee = loadFoldersForCommittee;
window.toggleAssignmentType = toggleAssignmentType;
window.moveToNextField = moveToNextField;

// إضافة CSS عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    addSearchableDropdownStyles();
});

// تأكد من إضافة الـ CSS حتى لو كانت الصفحة محملة بالفعل
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSearchableDropdownStyles);
} else {
    addSearchableDropdownStyles();
}

