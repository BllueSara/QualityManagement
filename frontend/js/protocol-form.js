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
        if (titleInput) titleInput.value = data.title || '';
        if (dateInput) dateInput.value = (data.protocolDate || '').split('T')[0] || '';

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
    }

    // التحقق من صحة عنوان المحضر
    const protocolTitleInput = document.getElementById('protocolTitle');
    if (protocolTitleInput) {
        protocolTitleInput.addEventListener('input', validateProtocolTitle);
    }
}

// إنشاء المواضيع حسب العدد المحدد
function generateTopics() {
    const topicsCount = parseInt(document.getElementById('topicsCount').value);
    
    if (topicsCount < 1 || topicsCount > 20) {
        showToast('يرجى إدخال عدد صحيح بين 1 و 20', 'error');
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
    
    showToast(`تم إنشاء ${topicsCount} موضوع/مواضيع`, 'success');
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
            <label for="topicDiscussion-${topicCounter}" data-translate="topic-discussion">موضوع المناقشة</label>
            <textarea id="topicDiscussion-${topicCounter}" name="topics[${topicCounter}][discussion]" 
                      rows="3" placeholder="أدخل موضوع المناقشة بالتفصيل" data-translate-placeholder="placeholder-topic-discussion" required></textarea>
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
    `;
    
    topicsContainer.appendChild(topicItem);
    
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
        showToast('تم حذف الموضوع', 'info');
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

// معالجة إرسال النموذج
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // التحقق من صحة النموذج
    if (!validateForm()) {
        return;
    }

    // جمع بيانات النموذج
    const formData = new FormData(event.target);
    const protocolData = {
        protocolTitle: formData.get('protocolTitle'),
        protocolDate: formData.get('protocolDate'),
        topics: collectTopicsData()
    };

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
        const topicData = {
            id: topicId,
            subject: document.getElementById(`topicSubject-${topicId}`).value,
            discussion: document.getElementById(`topicDiscussion-${topicId}`).value,
            duration: document.getElementById(`topicDuration-${topicId}`).value,
            endDate: document.getElementById(`topicEndDate-${topicId}`).value
        };
        topics.push(topicData);
    });
    
    return topics;
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
    });

    return isValid;
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
        
        showToast('تم إعادة تعيين النموذج', 'info');
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

// تصدير الدوال للاستخدام العام
window.resetForm = resetForm;
window.showToast = showToast;
window.generateTopics = generateTopics;
window.addTopic = addTopic;
window.removeTopic = removeTopic;

