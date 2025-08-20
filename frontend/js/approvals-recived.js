// approvals-recived.js
let filteredItems = [];

const apiBase = 'http://localhost:3006/api';
const token = localStorage.getItem('token');
let permissionsKeys = [];

// دالة إظهار التوست - تعريفها في البداية لتكون متاحة في كل مكان
function showToast(message, type = 'info', duration = 3000) {
    try {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Force reflow to ensure animation plays from start
        toast.offsetWidth; 

        // تفعيل التوست
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Set a timeout to remove the toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 500);
        }, duration);
        
        console.log('✅ Toast shown successfully:', message);
    } catch (error) {
        console.error('❌ Error showing toast:', error);
    }
}
// تم إزالة التصريحات المكررة للمتغيرات العامة لأنها موجودة في sign.js
const currentLang = localStorage.getItem('language') || 'ar'; // تم إزالة التصريح المكرر
let currentPage   = 1;
const itemsPerPage = 5;
let allItems = [];
// بعد تعريف itemsPerPage …
const statusList = ['pending', 'approved', 'rejected'];
let currentGroupIndex = 0;

// متغيرات إضافية مطلوبة
let selectedContentId = null;
let selectedContentType = null;
let currentSignature = null;
// إزالة المتغيرات القديمة للكانفاس واستبدالها بمتغيرات موحدة
// let canvas = null;
// let ctx = null;
let activeCanvas = null;
let activeCtx = null;
let modalCache = new Map();
let elementCache = new Map();
let isBulkDelegation = false;

// متغيرات عامة لتخزين بيانات التفويض
let currentDelegationData = null;
let pendingDelegationData = null;

// متغيرات التوقيع
// إزالة المتغيرات المكررة واستخدام المتغيرات الموحدة أعلاه
// let signatureCanvas = null;
// let signatureContext = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// متغيرات جديدة لحماية من النقر المتكرر
let isProcessingApproval = false;
let isProcessingSignature = false;
let isProcessingDelegation = false;
let processingTimeout = null;

// دالة عرض بوب أب اقرار التفويض
function showDelegationConfirmationPopup(delegatorInfo, delegateInfo, files, isBulk = false, delegationData = null) {
  // تخزين بيانات التفويض الحالي
  currentDelegationData = delegationData;
  
  // إزالة أي بوب أب موجود مسبقاً
  const existingPopup = document.getElementById('delegationConfirmationPopup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // إزالة أي كانفاس توقيع موجود مسبقاً
  const existingCanvas = document.getElementById('delegationSignatureCanvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }

  // إعادة تعيين متغيرات التوقيع
  activeCanvas = null;
  activeCtx = null;
  isDrawing = false;
  lastX = 0;
  lastY = 0;

  // إنشاء البوب أب
  const popup = document.createElement('div');
  popup.id = 'delegationConfirmationPopup';
  popup.className = 'delegation-confirmation-popup';
  
  // إضافة inline styles للتأكد من الظهور
  popup.style.position = 'fixed';
  popup.style.top = '0';
  popup.style.left = '0';
  popup.style.width = '100%';
  popup.style.height = '100%';
  popup.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  popup.style.display = 'flex';
  popup.style.justifyContent = 'center';
  popup.style.alignItems = 'center';
  popup.style.zIndex = '10000';
  popup.style.direction = 'rtl';
  
  // تحضير قائمة الملفات
  let filesList = '';
  if (isBulk) {
    filesList = `<p class="files-summary">${getTranslation('comprehensive-delegation')}</p>`;
  } else {
    filesList = '<div class="files-list">';
    files.forEach(file => {
      filesList += `<div class="file-item">
        <span class="file-name">${file.title || file.name}</span>
        <span class="file-type">${file.type === 'department' ? getTranslation('department-report') : file.type === 'committee' ? getTranslation('committee-file') : file.type === 'protocol' ? getTranslation('protocol-file') : getTranslation('file')}</span>
      </div>`;
    });
    filesList += '</div>';
  }

  // إنشاء المحتوى باستخدام DOM بدلاً من innerHTML لتجنب مشاكل الكانفاس
  const content = document.createElement('div');
  content.className = 'delegation-confirmation-content';
  content.style.cssText = 'background: white; border-radius: 8px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);';
  
  // Header
  const header = document.createElement('div');
  header.className = 'delegation-header';
  header.innerHTML = `
    <h3>${getTranslation('delegation-confirmation')}</h3>
    <button class="close-btn" onclick="closeDelegationConfirmationPopup()">&times;</button>
  `;
  
  // Body
  const body = document.createElement('div');
  body.className = 'delegation-body';
  
  // Delegator info
  const delegatorInfoDiv = document.createElement('div');
  delegatorInfoDiv.className = 'delegator-info';
  delegatorInfoDiv.innerHTML = `
    <h4>${getTranslation('delegator-info')}</h4>
    <div class="info-row">
      <span class="label">${getTranslation('full-name')}:</span>
      <span class="value">${delegatorInfo.fullName}</span>
    </div>
    <div class="info-row">
      <span class="label">${getTranslation('id-number')}:</span>
      <span class="value">${delegatorInfo.idNumber}</span>
    </div>
  `;
  
  // Delegate info
  const delegateInfoDiv = document.createElement('div');
  delegateInfoDiv.className = 'delegate-info';
  delegateInfoDiv.innerHTML = `
    <h4>${getTranslation('delegate-info')}</h4>
    <div class="info-row">
      <span class="label">${getTranslation('full-name')}:</span>
      <span class="value">${delegateInfo.fullName}</span>
    </div>
    <div class="info-row">
      <span class="label">${getTranslation('id-number')}:</span>
      <span class="value">${delegateInfo.idNumber}</span>
    </div>
  `;
  
  // Delegation details
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'delegation-details';
  detailsDiv.innerHTML = `
    <h4>${getTranslation('delegation-details')}</h4>
    <div class="delegation-type">
      <span class="label">${getTranslation('delegation-type')}:</span>
      <span class="value">${isBulk ? getTranslation('comprehensive-delegation') : getTranslation('single-delegation')}</span>
    </div>
    ${filesList}
  `;
  
  // Delegation statement
  const statementDiv = document.createElement('div');
  statementDiv.className = 'delegation-statement';
  statementDiv.innerHTML = `
    <p class="statement-text">
      ${getTranslation('delegation-confirmation-message')} <strong>${delegateInfo.fullName}</strong> 
      ${getTranslation('delegation-confirmation-message-2')} <strong>${delegateInfo.idNumber}</strong> 
      ${getTranslation('delegation-confirmation-message-3')} ${isBulk ? getTranslation('delegation-confirmation-message-5') : getTranslation('delegation-confirmation-message-4')}.
    </p>
  `;
  
  // Signature section - إضافة كانفاس للتوقيع
  const signatureSection = document.createElement('div');
  signatureSection.className = 'delegation-signature-section';
  signatureSection.innerHTML = `
    <h4>${getTranslation('delegation-signature-section')}</h4>
    <div class="signature-canvas-container">
      <div class="signature-controls" style="margin-top: 10px;">
        <button type="button" onclick="clearSignatureCanvas()" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-right: 5px; cursor: pointer;">
          ${getTranslation('clear')}
        </button>
      </div>
    </div>
  `;
  
  // Footer
  const footer = document.createElement('div');
  footer.className = 'delegation-footer';
  footer.innerHTML = `
    <button class="btn btn-danger" onclick="rejectDelegation()">${getTranslation('reject-delegation')}</button>
    <button class="btn btn-secondary" onclick="closeDelegationConfirmationPopup()">${getTranslation('cancel-delegation')}</button>
    <button class="btn btn-primary" onclick="confirmDelegation()">${getTranslation('confirm-delegation')}</button>
  `;
  
  // Assembly
  body.appendChild(delegatorInfoDiv);
  body.appendChild(delegateInfoDiv);
  body.appendChild(detailsDiv);
  body.appendChild(statementDiv);
  body.appendChild(signatureSection);
  
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  
  popup.appendChild(content);
  
  // إنشاء الكانفاس برمجياً بعد إضافة المحتوى
  const canvasContainer = popup.querySelector('.signature-canvas-container');
  const delegationCanvasElement = document.createElement('canvas');
  delegationCanvasElement.id = 'delegationSignatureCanvas';
  delegationCanvasElement.width = 400;
  delegationCanvasElement.height = 200;
  delegationCanvasElement.style.border = '1px solid #ccc';
  delegationCanvasElement.style.borderRadius = '4px';
  delegationCanvasElement.style.cursor = 'crosshair';
  canvasContainer.insertBefore(delegationCanvasElement, canvasContainer.firstChild);
  
  // تعيين الكانفاس النشط
  activeCanvas = delegationCanvasElement;
  activeCtx = activeCanvas.getContext('2d');

  // إضافة ملف CSS للبوب أب
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/frontend/css/delegation-confirmation.css';
  link.id = 'delegation-confirmation-css';
  
  // إزالة أي ملف CSS سابق
  const existingCSS = document.getElementById('delegation-confirmation-css');
  if (existingCSS) {
    existingCSS.remove();
  }
  
  document.head.appendChild(link);
  document.body.appendChild(popup);
  
  // تهيئة التوقيع بعد إضافة البوب أب والكانفاس
  setTimeout(() => {
    initializeSignatureDrawing();
  }, 200);
}

function closeDelegationConfirmationPopup() {
  try {
    const popup = document.getElementById('delegationConfirmationPopup');
    if (popup) {
      popup.remove();
      console.log('🔍 Delegation confirmation popup removed');
    }
    
    // إعادة تعيين متغيرات الكانفاس النشط
    activeCanvas = null;
    activeCtx = null;
    console.log('🔍 Delegation confirmation popup closed, activeCanvas reset');
    
    // إعادة تفعيل أزرار الصف إذا كان هناك contentId محدد
    if (selectedContentId) {
      const row = document.querySelector(`tr[data-id="${selectedContentId}"]`);
      if (row && row.dataset.status === 'pending') {
        enableRowActions(selectedContentId);
      }
    }
    
    // إعادة تفعيل أزرار الصف إذا كان هناك contentId في بيانات التفويض
    if (pendingDelegationData && pendingDelegationData.contentId) {
      enableRowActions(pendingDelegationData.contentId);
    }
    
    // إعادة تفعيل زر التأكيد إذا كان معطلاً
    const confirmButton = document.querySelector('#delegationConfirmationPopup .btn-primary');
    if (confirmButton && confirmButton.disabled) {
      setButtonProcessingState(confirmButton, false);
    }
    
    console.log('🔍 Delegation confirmation popup cleanup completed');
  } catch (error) {
    console.error('🔍 Error closing delegation confirmation popup:', error);
  }
}

// دالة تهيئة التوقيع
function initializeSignatureDrawing() {
  console.log('🔍 initializeSignatureDrawing called');
  
  // التحقق من وجود الكانفاس النشط
  if (!activeCanvas || !activeCtx) {
    console.log('🔍 No active canvas found, skipping initialization');
    return;
  }
  
  console.log('🔍 Found activeCanvas:', activeCanvas);

  // تعيين أبعاد الكانفاس حسب حجم الشاشة
  const isMobile = window.innerWidth <= 768;
  const canvasWidth = isMobile ? 350 : 400;
  const canvasHeight = isMobile ? 150 : 200;
  
  console.log('🔍 Setting canvas dimensions:', { canvasWidth, canvasHeight });
  
  // تعيين الأبعاد مباشرة على العنصر
  activeCanvas.width = canvasWidth;
  activeCanvas.height = canvasHeight;
  
  // تعيين الأبعاد في CSS أيضاً للتأكد
  activeCanvas.style.width = canvasWidth + 'px';
  activeCanvas.style.height = canvasHeight + 'px';

  // إعادة الحصول على السياق بعد تغيير الأبعاد
  activeCtx = activeCanvas.getContext('2d');
  console.log('🔍 Got canvas context:', activeCtx);

  if (activeCtx) {
    activeCtx.strokeStyle = '#000';
    activeCtx.lineWidth = 2;
    activeCtx.lineCap = 'round';

    // إزالة event listeners السابقة لتجنب التكرار
    activeCanvas.removeEventListener('mousedown', startDrawing);
    activeCanvas.removeEventListener('mousemove', draw);
    activeCanvas.removeEventListener('mouseup', stopDrawing);
    activeCanvas.removeEventListener('mouseout', stopDrawing);
    activeCanvas.removeEventListener('touchstart', handleTouchStart);
    activeCanvas.removeEventListener('touchmove', handleTouchMove);
    activeCanvas.removeEventListener('touchend', stopDrawing);

    // إضافة event listeners للتوقيع
    activeCanvas.addEventListener('mousedown', startDrawing);
    activeCanvas.addEventListener('mousemove', draw);
    activeCanvas.addEventListener('mouseup', stopDrawing);
    activeCanvas.addEventListener('mouseout', stopDrawing);

    // دعم اللمس للأجهزة المحمولة
    activeCanvas.addEventListener('touchstart', handleTouchStart);
    activeCanvas.addEventListener('touchmove', handleTouchMove);
    activeCanvas.addEventListener('touchend', stopDrawing);

    console.log('🔍 Signature canvas initialized successfully');

  } else {
    console.error('🔍 Failed to get canvas context!');
  }
}

// دوال التوقيع
function startDrawing(e) {
  if (!activeCanvas || !activeCtx) {
    return;
  }
  
  isDrawing = true;
  const rect = activeCanvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
}

function draw(e) {
  if (!isDrawing) {
    return;
  }
  
  if (!activeCanvas || !activeCtx) {
    return;
  }
  
  e.preventDefault();
  
  const rect = activeCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;
  
  activeCtx.beginPath();
  activeCtx.moveTo(lastX, lastY);
  activeCtx.lineTo(currentX, currentY);
  activeCtx.stroke();
  
  lastX = currentX;
  lastY = currentY;
}

function stopDrawing() {
  isDrawing = false;
}

// معالجة اللمس للأجهزة المحمولة
function handleTouchStart(e) {
  e.preventDefault();
  
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    activeCanvas.dispatchEvent(mouseEvent);
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    activeCanvas.dispatchEvent(mouseEvent);
  }
}

// دالة تبديل تبويبات التوقيع
function switchSignatureTab(tabName) {
  // إزالة الفئة النشطة من جميع التبويبات
  const tabs = document.querySelectorAll('.signature-tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // إخفاء جميع المحتويات
  const contents = document.querySelectorAll('.signature-tab-content');
  contents.forEach(content => content.classList.remove('active'));
  
  // تفعيل التبويب المحدد
  const activeTab = document.querySelector(`[onclick="switchSignatureTab('${tabName}')"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  // إظهار المحتوى المحدد
  const activeContent = document.getElementById(`${tabName}-signature-tab`);
  if (activeContent) {
    activeContent.classList.add('active');
  }
  

}

// دالة مسح التوقيع
function clearSignatureCanvas() {
  if (activeCtx && activeCanvas) {
    // التأكد من أن الكانفاس له أبعاد صحيحة
    if (activeCanvas.width === 0 || activeCanvas.height === 0) {
      const isMobile = window.innerWidth <= 768;
      activeCanvas.width = isMobile ? 350 : 400;
      activeCanvas.height = isMobile ? 150 : 200;
      activeCanvas.style.width = activeCanvas.width + 'px';
      activeCanvas.style.height = activeCanvas.height + 'px';
    }
    
    activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
  }
}

// دالة الحصول على التوقيع من الكانفاس
function getSignatureFromCanvas() {
  if (!activeCanvas) {
    console.error('🔍 Active canvas not found');
    return null;
  }
  
  if (!activeCtx) {
    console.error('🔍 Active canvas context not found');
    return null;
  }
  
  // التحقق من وجود توقيع على الكانفاس
  const imageData = activeCtx.getImageData(0, 0, activeCanvas.width, activeCanvas.height);
  const data = imageData.data;
  let hasSignature = false;
  
  // التحقق من وجود خطوط سوداء (التوقيع)
  for (let i = 0; i < data.length; i += 4) {
    // البحث عن بكسل أسود (RGB قيم منخفضة)
    if (data[i] < 50 && data[i + 1] < 50 && data[i + 2] < 50 && data[i + 3] > 200) {
      hasSignature = true;
      break;
    }
  }
  
  if (!hasSignature) {
    console.log('🔍 No signature detected on canvas');
    return null;
  }
  
  const signatureData = activeCanvas.toDataURL('image/png');
  console.log('🔍 Signature captured successfully:', signatureData.substring(0, 50) + '...');
  return signatureData;
}

// دالة الحصول على التوقيع (للتوافق مع الكود القديم)
function getSignature() {
  const activeTab = document.querySelector('.signature-tab.active');
  if (!activeTab) return null;
  
  const tabName = activeTab.getAttribute('onclick').match(/'([^']+)'/)[1];
  
  if (tabName === 'manual') {
    // التحقق من وجود توقيع على الكانفاس
    const imageData = activeCtx.getImageData(0, 0, activeCanvas.width, activeCanvas.height);
    const data = imageData.data;
    let hasSignature = false;
    
    // التحقق من وجود خطوط سوداء (التوقيع)
    for (let i = 0; i < data.length; i += 4) {
      // البحث عن بكسل أسود (RGB قيم منخفضة)
      if (data[i] < 50 && data[i + 1] < 50 && data[i + 2] < 50 && data[i + 3] > 200) {
        hasSignature = true;
        break;
      }
    }
    
    if (!hasSignature) {
      showToast('يرجى التوقيع أولاً', 'error');
      return null;
    }
    
    return activeCanvas.toDataURL('image/png');
  } else if (tabName === 'electronic') {
    const electronicSignature = document.getElementById('electronicSignature').value.trim();
    if (!electronicSignature) {
      showToast('يرجى كتابة التوقيع الإلكتروني', 'error');
      return null;
    }
    
    // إنشاء توقيع إلكتروني كصورة
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 100;
    
    // خلفية بيضاء
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // النص
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(electronicSignature, canvas.width / 2, canvas.height / 2);
    
    return canvas.toDataURL('image/png');
  }
  
  return null;
}

function confirmDelegation() {
  console.log('🔍 confirmDelegation called');
  console.log('🔍 pendingDelegationData:', pendingDelegationData);
  
  try {
    if (!pendingDelegationData) {
       showToast(getTranslation('error-no-delegation-data'), 'error');

      return;
    }
    
    // الحصول على توقيع المرسل من الكانفاس
    const senderSignature = getSignatureFromCanvas();
    console.log('🔍 senderSignature obtained:', senderSignature ? 'YES' : 'NO');
    
    if (!senderSignature) {
    showToast(getTranslation('delegation-error-no-signature'), 'error');

      return;
    }
    
    // حماية من النقر المتكرر
    const confirmButton = document.querySelector('#delegationConfirmationPopup .btn-primary');
      if (!protectFromDoubleClick(confirmButton, getTranslation('processing-delegation'))) {
      return;
    }
    
    // تعطيل جميع أزرار الصف إذا كان هناك contentId
    if (pendingDelegationData.contentId) {
      disableRowActions(pendingDelegationData.contentId);
    }
    
    // إضافة توقيع المرسل إلى بيانات التفويض
    pendingDelegationData.senderSignature = senderSignature;
    console.log('🔍 Updated pendingDelegationData with signature');
    
    // معالجة قبول التفويض حسب النوع
    if (pendingDelegationData.isBulk) {
      // قبول تفويض شامل
      console.log('🔍 Processing bulk delegation');
      processBulkDelegation(pendingDelegationData);
    } else {
      // قبول تفويض فردي
      console.log('🔍 Processing single delegation');
      processSingleDelegation(pendingDelegationData);
    }
    
    // إغلاق البوب أب
    closeDelegationConfirmationPopup();
    
    // مسح البيانات المؤقتة
    pendingDelegationData = null;
  } catch (error) {
    console.error('🔍 Error in confirmDelegation:', error);
    showToast('حدث خطأ أثناء معالجة التفويض', 'error');
    
    // إعادة تفعيل الأزرار في حالة الخطأ
    if (pendingDelegationData && pendingDelegationData.contentId) {
      enableRowActions(pendingDelegationData.contentId);
    }
    
    const confirmButton = document.querySelector('#delegationConfirmationPopup .btn-primary');
    if (confirmButton) {
      setButtonProcessingState(confirmButton, false);
    }
  }
}

function rejectDelegation() {
  if (!pendingDelegationData) {
    showToast(getTranslation('error-no-delegation-data'), 'error');
    return;
  }
  
  // إعادة تفعيل أزرار الصف عند رفض التفويض
  if (pendingDelegationData.contentId) {
    enableRowActions(pendingDelegationData.contentId);
  }
  
  // إعادة تفعيل زر التأكيد إذا كان معطلاً
  const confirmButton = document.querySelector('#delegationConfirmationPopup .btn-primary');
  if (confirmButton && confirmButton.disabled) {
    setButtonProcessingState(confirmButton, false);
  }
  
  // إغلاق البوب أب
  closeDelegationConfirmationPopup();
  
  // مسح البيانات المؤقتة
  pendingDelegationData = null;
  
        showToast(getTranslation('delegation-rejected'), 'info');
}

// دوال معالجة التفويضات المختلفة
async function processSingleDepartmentDelegationAcceptance(delegationId) {
  try {
    const response = await fetch('http://localhost:3006/api/approvals/single-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegationId: delegationId,
        action: 'accept'
      })
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      showToast(getTranslation('delegation-sent-success'), 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(result.message || getTranslation('delegation-failed'), 'error');
    }
  } catch (error) {
    console.error('Error accepting single department delegation:', error);
    showToast(getTranslation('delegation-error-processing'), 'error');
  }
}

async function processSingleCommitteeDelegationAcceptance(delegationId) {
  try {
    const response = await fetch('http://localhost:3006/api/committee-approvals/single-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegationId: delegationId,
        action: 'accept'
      })
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      showToast(getTranslation('delegation-sent-success'), 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || getTranslation('delegation-failed'), 'error');
    }
  } catch (error) {
    console.error('Error accepting single committee delegation:', error);
    showToast(getTranslation('delegation-error-processing'), 'error');
  }
}

async function processBulkDelegationAcceptance(delegationId) {
  try {
    const response = await fetch('http://localhost:3006/api/approvals/bulk-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegationId: delegationId,
        action: 'accept'
      })
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      showToast(getTranslation('delegation-bulk-sent'), 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || getTranslation('delegation-failed'), 'error');
    }
  } catch (error) {
    console.error('Error accepting bulk delegation:', error);
    showToast(getTranslation('delegation-error-processing'), 'error');
  }
}

async function processSingleDepartmentDelegationRejection(delegationId) {
  try {
    const response = await fetch('http://localhost:3006/api/approvals/single-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegationId: delegationId,
        action: 'reject'
      })
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      showToast(getTranslation('delegation-rejected'), 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || getTranslation('delegation-failed'), 'error');
    }
  } catch (error) {
    console.error('Error rejecting single department delegation:', error);
    showToast(getTranslation('delegation-error-processing'), 'error');
  }
}

async function processSingleCommitteeDelegationRejection(delegationId) {
  try {
    const response = await fetch('http://localhost:3006/api/committee-approvals/single-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegationId: delegationId,
        action: 'reject'
      })
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      showToast(getTranslation('delegation-rejected-success'), 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || getTranslation('delegation-rejection-failed'), 'error');
    }
  } catch (error) {
    console.error('Error rejecting single committee delegation:', error);
    showToast(getTranslation('delegation-rejection-error'), 'error');
  }
}

async function processBulkDelegationRejection(delegationId) {
  try {
    const response = await fetch('http://localhost:3006/api/approvals/bulk-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegationId: delegationId,
        action: 'reject'
      })
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      showToast(getTranslation('bulk-delegation-rejected-success'), 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || getTranslation('bulk-delegation-rejection-failed'), 'error');
    }
  } catch (error) {
    console.error('Error rejecting bulk delegation:', error);
    showToast(getTranslation('bulk-delegation-rejection-error'), 'error');
  }
}

async function processDirectDelegationUnified(delegatorId, action) {
  try {
    const res = await fetch('http://localhost:3006/api/approvals/direct-delegation-unified/process', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ delegatorId, action })
    });
    const json = await res.json();
    if (json.status !== 'success') {
      throw new Error(json.message);
    }
    
    closeDelegationConfirmationPopup();
    setTimeout(() => {
      window.location.reload();
    }, 200);
  } catch (err) {
    console.error(getTranslation('direct-delegation-processing-error'), err);
    throw err;
  }
}

// دوال عرض بوب أب اقرار التفويض
async function showSingleDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {
  try {
    // التحقق من صحة البيانات قبل الإرسال
    if (!delegateTo) {
      showToast(getTranslation('error-delegate-not-specified'), 'error');
      return;
    }
    
    if (!contentId) {
      showToast(getTranslation('error-content-id-not-specified'), 'error');
      return;
    }
    
    if (!contentType) {
      showToast(getTranslation('error-content-type-not-specified'), 'error');
      return;
    }
    
    const requestBody = {
      delegateTo,
      notes,
      contentId,
      contentType,
      isBulk: false
    };
    
    const response = await fetch('http://localhost:3006/api/approvals/new-delegation-confirmation-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, files, isBulk } = result.confirmationData;
      
      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        contentId,
        contentType,
        isBulk: false
      };
      
      // عرض البوب أب
      showDelegationConfirmationPopup(delegator, delegate, files, false);
    } else {
      showToast(result.message || getTranslation('failed-to-fetch-delegation-data'), 'error');
    }
  } catch (error) {
    console.error('Error showing single delegation confirmation:', error);
    showToast(getTranslation('error-showing-delegation-confirmation'), 'error');
  }
}

async function showBulkDelegationConfirmation(delegateTo, notes = '') {
  try {
    const response = await fetch('http://localhost:3006/api/approvals/new-delegation-confirmation-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        isBulk: true
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, files, isBulk } = result.confirmationData;
      
      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        isBulk: true
      };
      
      // عرض البوب أب
      showDelegationConfirmationPopup(delegator, delegate, files, true);
    } else {
      showToast(result.message || getTranslation('failed-to-fetch-bulk-delegation-data'), 'error');
    }
  } catch (error) {
    console.error('Error showing bulk delegation confirmation:', error);
    showToast(getTranslation('error-showing-bulk-delegation-confirmation'), 'error');
  }
}

async function showSingleCommitteeDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {
  try {
    // التحقق من صحة البيانات قبل الإرسال
    if (!delegateTo) {
      showToast(getTranslation('error-delegate-not-specified'), 'error');
      return;
    }
    
    if (!contentId) {
      showToast(getTranslation('error-content-id-not-specified'), 'error');
      return;
    }
    
    if (!contentType) {
      showToast(getTranslation('error-content-type-not-specified'), 'error');
      return;
    }
    
    const requestBody = {
      delegateTo,
      notes,
      contentId,
      contentType,
      isBulk: false
    };
    
    const response = await fetch('http://localhost:3006/api/approvals/new-delegation-confirmation-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, files, isBulk } = result.confirmationData;
      
      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        contentId,
        contentType,
        isBulk: false,
        isCommittee: true
      };
    
      showDelegationConfirmationPopup(delegator, delegate, files, false);
    } else {
      showToast(result.message || getTranslation('failed-to-fetch-delegation-data'), 'error');
    }
  } catch (error) {
    console.error('Error showing single committee delegation confirmation:', error);
    showToast(getTranslation('error-showing-delegation-confirmation'), 'error');
  }
}

async function showBulkProtocolDelegationConfirmation(delegateTo, notes = '') {
  try {
    const response = await fetch('http://localhost:3006/api/protocols/new-delegation-confirmation-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        isBulk: true
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, files, isBulk } = result.confirmationData;
      
      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        isBulk: true,
        isProtocol: true
      };
      
      // عرض البوب أب
      showDelegationConfirmationPopup(delegator, delegate, files, true);
    } else {
      showToast(result.message || getTranslation('failed-to-fetch-bulk-protocol-delegation-data'), 'error');
    }
  } catch (error) {
    console.error('Error showing bulk protocol delegation confirmation:', error);
    showToast(getTranslation('error-showing-bulk-protocol-delegation-confirmation'), 'error');
  }
}

async function showSingleProtocolDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {
  try {
    // التحقق من صحة البيانات قبل الإرسال
    if (!delegateTo) {
      showToast(getTranslation('error-delegate-not-specified'), 'error');
      return;
    }
    
    if (!contentId) {
      showToast(getTranslation('error-protocol-id-not-specified'), 'error');
      return;
    }
    
    if (!contentType) {
      showToast(getTranslation('error-content-type-not-specified'), 'error');
      return;
    }
    
    const requestBody = {
      delegateTo,
      notes,
      contentId,
      contentType,
      isBulk: false
    };
    
    const response = await fetch('http://localhost:3006/api/protocols/new-delegation-confirmation-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, files, isBulk } = result.confirmationData;
      
      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        contentId,
        contentType,
        isBulk: false,
        isProtocol: true
      };
    
      showDelegationConfirmationPopup(delegator, delegate, files, false);
    } else {
      showToast(result.message || getTranslation('failed-to-fetch-delegation-data'), 'error');
    }
  } catch (error) {
    console.error('Error showing single protocol delegation confirmation:', error);
    showToast(getTranslation('error-showing-delegation-confirmation'), 'error');
  }
}

async function showBulkCommitteeDelegationConfirmation(delegateTo, notes = '') {
  try {
    const response = await fetch('http://localhost:3006/api/approvals/new-delegation-confirmation-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        isBulk: true
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, files, isBulk } = result.confirmationData;
      
      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        isBulk: true,
        isCommittee: true
      };
      
      // عرض البوب أب
      showDelegationConfirmationPopup(delegator, delegate, files, true);
    } else {
      showToast(result.message || getTranslation('failed-to-fetch-bulk-committee-delegation-data'), 'error');
    }
  } catch (error) {
    console.error('Error showing bulk committee delegation confirmation:', error);
    showToast(getTranslation('error-showing-bulk-committee-delegation-confirmation'), 'error');
  }
}

// جلب صلاحيات المستخدم
async function fetchPermissions() {
  if (!token) return;
  const payload = await safeGetUserInfo(token);
  if (!payload) return;
  const userId = payload.id, role = payload.role;
  if (role === 'admin' || role === 'super_admin') {
    permissionsKeys = ['*'];
    return;
  }
  try {
    const res = await fetch(`${apiBase}/users/${userId}/permissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { data: perms } = await res.json();
    permissionsKeys = perms.map(p => typeof p === 'string' ? p : (p.permission || p.permission_key));
  } catch (e) {
    console.error('Failed to fetch permissions', e);
  }
}

async function fetchJSON(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getLocalizedName(name) {
  const lang = localStorage.getItem('language') || 'ar';
  try {
    const parsed = typeof name === 'string' ? JSON.parse(name) : name;
    return parsed?.[lang] || parsed?.ar || parsed?.en || name;
  } catch {
    return name;
  }
}
function closeModal(modalId) {
  console.log('🔍 closeModal called with modalId:', modalId);
  try {
    const modal = getCachedElement(modalId);
    if (modal) {
      // إغلاق فوري بدون تأخير
      modal.style.display = 'none';
      modal.style.opacity = '1';
      modal.style.transition = '';
      
      // تنظيف الذاكرة المؤقتة
      modalCache.delete(modalId);
      
      // إعادة تفعيل أزرار الصف إذا كان المودال هو مودال الرفض أو التوقيع الإلكتروني أو التفويض
      if ((modalId === 'rejectModal' || modalId === 'qrModal' || modalId === 'delegateModal') && selectedContentId) {
        const row = document.querySelector(`tr[data-id="${selectedContentId}"]`);
        if (row && row.dataset.status === 'pending') {
          enableRowActions(selectedContentId);
        }
      }
      
      console.log('🔍 Modal closed successfully');
    } else {
      console.error('🔍 Modal not found:', modalId);
    }
  } catch (error) {
    console.error('🔍 Error closing modal:', error);
  }
}

function setupCloseButtons() {
  // إزالة event listeners السابقة لتجنب التكرار
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.removeEventListener('click', handleCloseClick);
    btn.addEventListener('click', handleCloseClick);
  });
  
  // إزالة event listeners السابقة للنقر خارج المودال
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.removeEventListener('click', handleOutsideClick);
    modal.addEventListener('click', handleOutsideClick);
  });
}

// دالة منفصلة لمعالجة النقر على زر الإغلاق
function handleCloseClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const modalId = e.target.dataset.modal || e.target.closest('.modal-overlay')?.id;
  if (modalId) {
    closeModal(modalId);
  }
}

// دالة منفصلة لمعالجة النقر خارج المودال
function handleOutsideClick(e) {
  if (e.target === e.currentTarget) {
    closeModal(e.currentTarget.id);
  }
}
// تعريف deptFilter مرة واحدة في الأعلى
const deptFilter = document.getElementById('deptFilter');

document.addEventListener('DOMContentLoaded', async () => {
  if (!token) return showToast(getTranslation('please-login'), 'error');

  await fetchPermissions();

  // تعريف وإضافة زر تفويض جميع الملفات بالنيابة بعد فلتر الأقسام
  let btnAll = document.getElementById('delegateAllBtn');
  if (btnAll) btnAll.remove();
  // تحقق من الصلاحية قبل إنشاء الزر
  const canBulkDelegate = permissionsKeys.includes('*') || permissionsKeys.includes('grant_permissions') || permissionsKeys.includes('delegate_all');
  if (canBulkDelegate) {
    btnAll = document.createElement('button');
    btnAll.id = 'delegateAllBtn';
    btnAll.className = 'btn-delegate-all';
    btnAll.type = 'button';
            btnAll.innerHTML = `<i class="fas fa-user-friends"></i> ${getTranslation('delegate-all')}`;
    btnAll.style = 'background: #2563eb; color: #fff; padding: 8px 18px; border-radius: 6px; border: none; font-size: 1rem; margin-right: 8px; cursor: pointer; vertical-align: middle;';
    const deptFilter = document.getElementById('deptFilter');
    if (deptFilter && deptFilter.parentNode) {
      deptFilter.parentNode.insertBefore(btnAll, deptFilter.nextSibling);
    }
    // ربط حدث فتح مودال التفويض الجماعي (نفس مودال التفويض العادي)
    btnAll.onclick = function() {
      isBulkDelegation = true;
      selectedContentId = null;
      document.getElementById('delegateDept').value = '';
      document.getElementById('delegateUser').innerHTML = '<option value="" disabled selected>' + getTranslation('select-user') + '</option>';
      document.getElementById('delegateNotes').value = '';
      openModal('delegateModal');
      loadDepartments();
      document.getElementById('delegateNotes').placeholder = getTranslation('notes-bulk');
    };
  }

  try {
    const deptResp      = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    const commResp      = await fetchJSON(`${apiBase}/committee-approvals/assigned-to-me`);
    const protocolResp  = await fetchJSON(`${apiBase}/protocols/pending/approvals`);
    
    // Combine all types of approvals
    const deptItems = (deptResp.data || []).map(item => ({
      ...item,
      type: 'department',
      // normalize keys just in case
      approval_status: item.approval_status || item.approvalStatus || item.status || 'pending',
      file_path: item.file_path || item.filePath || ''
    }));
    const commItems = (commResp.data || []).map(item => ({
      ...item,
      type: 'committee',
      approval_status: item.approval_status || item.approvalStatus || item.status || 'pending',
      file_path: item.file_path || item.filePath || ''
    }));
    const protocolItems = (protocolResp.data || []).map(item => ({
      ...item,
      type: 'protocol',
      // normalize naming differences from protocols API
      approval_status: item.approval_status || item.approvalStatus || item.status || 'pending',
      file_path: item.file_path || item.filePath || '',
      protocol_date: item.protocol_date || item.protocolDate || item.createdAt || '',
      topics_count: item.topics_count || item.topicsCount || 0,
      created_at: item.created_at || item.createdAt || '',
      updated_at: item.updated_at || item.updatedAt || ''
    }));

    const combined = [...deptItems, ...commItems, ...protocolItems];
    const uniqueMap = new Map();
    // Deduplicate by id with priority: protocol > committee > department
    const typePriority = { protocol: 3, committee: 2, department: 1 };
    combined.forEach(item => {
      const key = item.id;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      } else {
        const existing = uniqueMap.get(key);
        const existingPriority = typePriority[existing.type] || 0;
        const incomingPriority = typePriority[item.type] || 0;
        if (incomingPriority > existingPriority) uniqueMap.set(key, item);
      }
    });
    allItems = Array.from(uniqueMap.values());
    filteredItems = allItems;

    await setupFilters(allItems);
    renderApprovals(filteredItems);
  } catch (err) {
    console.error("Error loading approvals:", err);
    showToast(getTranslation('error-loading'), 'error');
  }
document.getElementById("prevPage").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderApprovals(filteredItems);
  }
});

document.getElementById("nextPage").addEventListener("click", () => {
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderApprovals(filteredItems);
  }
});
  setupSignatureModal();
  setupCloseButtons();

  // ربط زر إرسال سبب الرفض
  const btnSendReason = document.getElementById('btnSendReason');
  if (btnSendReason) {
    btnSendReason.addEventListener('click', async () => {
      const reason = document.getElementById('rejectReason').value.trim();
      if (!reason) return showToast(getTranslation('please-enter-reason'), 'warning');
      
      // حماية من النقر المتكرر
      if (!protectFromDoubleClick(btnSendReason, getTranslation('sending-rejection'))) {
        return;
      }
      
      // تعطيل جميع أزرار الصف
      disableRowActions(selectedContentId);
      
      const type     = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
      let endpoint;
      switch (type) {
        case 'committee':
          endpoint = 'committee-approvals';
          break;
        case 'protocol':
          endpoint = 'protocols';
          break;
        default:
          endpoint = 'approvals';
          break;
      }
      try {
        await fetchJSON(`${apiBase}/${endpoint}/${selectedContentId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ approved: false, signature: null, notes: reason })
        });
        showToast(getTranslation('success-rejected'), 'success');
        closeModal('rejectModal');
        updateApprovalStatusInUI(selectedContentId, 'rejected');
      } catch (e) {
        console.error('Failed to send rejection:', e);
        // إعادة تفعيل الزر في حالة الخطأ
        setButtonProcessingState(btnSendReason, false);
        enableRowActions(selectedContentId);
      }
    });
  }

  // إضافة معالجة للإلغاء في مودال الرفض
  const btnCancelReject = document.getElementById('btnCancelReject');
  if (btnCancelReject) {
    btnCancelReject.addEventListener('click', () => {
      // إعادة تفعيل أزرار الصف عند الإلغاء
      if (selectedContentId) {
        enableRowActions(selectedContentId);
      }
      
      // إعادة تفعيل زر الإرسال إذا كان معطلاً
      const btnSendReason = document.getElementById('btnSendReason');
      if (btnSendReason && btnSendReason.disabled) {
        setButtonProcessingState(btnSendReason, false);
      }
      
      closeModal('rejectModal');
    });
  }

  // **رابط أزرار الباجينشن خارج أي شرط**


// وفي رقم الصفحة:


});

async function setupFilters(items) {
  const deptFilter = document.getElementById('deptFilter');
  const deptSet    = new Set(items.map(i => i.source_name).filter(Boolean));
  deptFilter.innerHTML = `<option value="all">${getTranslation('all-departments')}</option>`;
  deptSet.forEach(name => {
    const opt = document.createElement('option');
    opt.value       = name;
    opt.textContent = getLocalizedName(name);
    deptFilter.appendChild(opt);
  });
  deptFilter.addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);
}

// تحسين دالة applyFilters
function applyFilters() {
  currentPage = 1;  // ترجع للصفحة الأولى عند كل فلتر
  const dept       = document.getElementById('deptFilter').value;
  const status     = document.getElementById('statusFilter').value;
  const searchText = document.getElementById('searchInput').value.trim().toLowerCase();

  // خزّن النتيجة في filteredItems
  filteredItems = allItems.filter(i => {
    const localizedTitle = (getLocalizedName(i.title) || '').toLowerCase();
    const localizedSource = (getLocalizedName(i.source_name) || '').toLowerCase();
    const okDept   = dept === 'all' || i.source_name === dept;
    const okStatus = status === 'all' || i.approval_status === status;
    const okSearch = localizedTitle.includes(searchText) || localizedSource.includes(searchText);
    return okDept && okStatus && okSearch;
  });

  // استخدام throttled render لتحسين الأداء
  throttledRenderApprovals(filteredItems);
}
// تم إزالة التعريف المكرر - الدالة معرفة أدناه

// تم إزالة التعريف المكرر - الدوال معرفة أعلاه

function renderApprovals(items) {
  const tbody = document.getElementById("approvalsBody");
  tbody.innerHTML = "";

  // 1) إجمالي العناصر والفهارس
  const totalItems = items.length;
  const startIdx   = (currentPage - 1) * itemsPerPage;
  const endIdx     = Math.min(startIdx + itemsPerPage, totalItems);

  // 2) فرز وحساب القطع
  const sorted    = items.slice().sort((a, b) => {
    const order = { pending: 0, rejected: 1, approved: 2 };
    return order[a.approval_status] - order[b.approval_status];
  });
  const pageItems = sorted.slice(startIdx, endIdx);

  // 3) إنشاء الصفوف
  const canSign = permissionsKeys.includes('*') || permissionsKeys.includes('sign');
  const canDel  = permissionsKeys.includes('*') || permissionsKeys.includes('sign_on_behalf');

  pageItems.forEach(item => {
    const tr = document.createElement("tr");
    tr.dataset.id     = item.id;
    tr.dataset.key    = `${item.type}:${item.id}`;
    tr.dataset.status = item.approval_status;
    tr.dataset.source = item.source_name;
    tr.dataset.type   = item.type;

    let actions = "";
    if (item.approval_status === 'pending' || item.approval_status === 'rejected') {
      actions += `<button class="btn-sign"><i class="fas fa-user-check"></i> ${getTranslation('sign')}</button>`;
      actions += `<button class="btn-delegate"><i class="fas fa-user-friends"></i> ${getTranslation('delegate')}</button>`;
      actions += `<button class="btn-qr"><i class="fas fa-qrcode"></i> ${getTranslation('electronic')}</button>`;
      actions += `<button class="btn-reject"><i class="fas fa-times"></i> ${getTranslation('reject')}</button>`;
      actions += `<button class="btn-preview"><i class="fas fa-eye"></i> ${getTranslation('preview')}</button>`;
    }

    // إضافة زر تتبع الطلب لجميع الحالات
    actions += `<button class="btn-track" data-id="${item.id}" data-type="${item.type}">${getTranslation('track')}</button>`;

    let contentType;
    switch (item.type) {
      case 'committee':
        contentType = getTranslation('committee-file');
        break;
      case 'protocol':
        contentType = getTranslation('protocol-file') || 'محضر';
        break;
      default:
        contentType = getTranslation('department-report');
        break;
    }

    // Debug: طباعة البيانات للتحقق
    console.log('Item data:', item);
    console.log('Item type:', item.type);
    console.log('Content type:', contentType);
    console.log('Start date:', item.start_date);
    console.log('End date:', item.end_date);
    console.log('Created at:', item.created_at);
    console.log('Updated at:', item.updated_at);
    
    // تنسيق التواريخ
    const formatDate = (dateString) => {
      if (!dateString) return '-';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString(localStorage.getItem('language') === 'ar' ? 'ar-EG' : 'en-US');
      } catch (e) {
        console.error('Error formatting date:', dateString, e);
        return '-';
      }
    };
    
    const startDate = formatDate(item.start_date);
    const endDate = formatDate(item.end_date);
    const createdDate = formatDate(item.created_at);
    const updatedDate = formatDate(item.updated_at);
    
    // عرض تواريخ الملف ونوع القسم حسب نوع المحتوى
    let dateRange = '-';
    let departmentDisplay = '-';
    let sequenceDisplay = '';
    
    if (item.type === 'protocol') {
      // للمحاضر - عرض تاريخ المحضر وعدد المواضيع
      if (item.protocol_date) {
        dateRange = `${getTranslation('protocol-date') || 'تاريخ المحضر'}: ${formatDate(item.protocol_date)}`;
      } else if (item.created_at) {
        dateRange = `${getTranslation('created')}: ${createdDate}`;
      }
      
      // عرض عدد المواضيع للمحاضر
      if (item.topics_count) {
        departmentDisplay = `${item.topics_count} ${getTranslation('topics') || 'موضوع'}`;
      } else {
        departmentDisplay = getTranslation('no-topics') || 'لا توجد مواضيع';
      }


    } else if (item.type !== 'committee') {
      // تواريخ الملف - فقط لملفات الأقسام
      if (item.start_date && item.end_date && item.start_date !== item.end_date) {
        dateRange = `${startDate} - ${endDate}`;
      } else if (item.start_date) {
        dateRange = `${getTranslation('from')}: ${startDate}`;
      } else if (item.end_date) {
        dateRange = `${getTranslation('to')}: ${endDate}`;
      } else if (item.created_at) {
        // إذا لم تكن هناك تواريخ محددة، استخدم تاريخ الإنشاء
        dateRange = `${getTranslation('created')}: ${createdDate}`;
      }
      
      // تنسيق اسم القسم مع نوعه - فقط لملفات الأقسام
      if (item.source_name) {
        const departmentType = item.department_type || 'department';
        const departmentTypeTranslation = getTranslation(`department-type-${departmentType}`) || departmentType;
        departmentDisplay = `${departmentTypeTranslation}: ${getLocalizedName(item.source_name)}`;
      }
    } else {
      // لملفات اللجان - عرض اسم القسم بدون نوع
      departmentDisplay = item.source_name ? getLocalizedName(item.source_name) : '-';
    }
    
    // Debug: طباعة النتيجة النهائية
    console.log('Final dateRange:', dateRange);
    console.log('Final departmentDisplay:', departmentDisplay);

    tr.innerHTML = `
      <td class="col-id">${item.id}</td>
      <td>
        ${getLocalizedName(item.title)}
        <div class="content-meta">(${contentType} - ${getLocalizedName(item.folder_name || item.folderName || '')})</div>
      </td>
      <td>${departmentDisplay}</td>
      <td class="col-dates">${dateRange}</td>
      <td class="col-response">${statusLabel(item.approval_status)}</td>
      <td class="col-actions">${actions}</td>
    `;
    tbody.appendChild(tr);

    if (!canDel) tr.querySelector('.btn-delegate')?.remove();
    if (!canSign) tr.querySelector('.btn-qr')?.remove();
  });

  // 4) حدّث الباجينج
  renderPagination(totalItems);

  // 5) حدّث نص العدّادة
  updateRecordsInfo(totalItems, startIdx, endIdx);

  // 6) أربط الأزرار
  initActions();
}

function updateApprovalStatusInUI(id, newStatus) {
  const item = allItems.find(i => i.id == id);
  if (!item) return;
  item.approval_status = newStatus;
  applyFilters();
}

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === totalPages;

  const container = document.getElementById("pageNumbers");
  container.innerHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const span = document.createElement("span");
    span.textContent = i;
    span.className   = "page-number" + (i === currentPage ? " active" : "");
    span.addEventListener("click", () => {
      currentPage = i;
      renderApprovals(filteredItems);
    });
    container.appendChild(span);
  }
}

function statusLabel(status) {
  switch (status) {
    case 'approved':  return getTranslation('approved');
    case 'rejected':  return getTranslation('rejected');
    default:          return getTranslation('pending');
  }
}

// (بقية دوال initActions و signature modal و delegate تبقى كما كانت)


function initActions() {
  // استخدام event delegation محسن لتحسين الأداء
  if (!window.globalClickHandler) {
    window.globalClickHandler = (e) => {
      const target = e.target;
      
      // زر التوقيع
      if (target.closest('.btn-sign')) {
        console.log('🔍 Sign button clicked!');
        const row = target.closest('tr');
        const id = row.dataset.id;
        selectedContentType = row.dataset.type;
        console.log('🔍 Opening signature modal for id:', id);
        
        // تعطيل جميع أزرار الصف فوراً
        disableRowActions(id);
        
        openSignatureModal(id);
        return;
      }
      
      // زر التفويض
      if (target.closest('.btn-delegate')) {
        console.log('🔍 Delegation button clicked!');
        const row = target.closest('tr');
        const id = row.dataset.id;
        
        // تعطيل جميع أزرار الصف فوراً
        disableRowActions(id);
        
        isBulkDelegation = false;
        selectedContentId = id;
        console.log('🔍 selectedContentId set to:', selectedContentId);
        openModal('delegateModal');
        loadDepartments();
        document.getElementById('delegateNotes').placeholder = getTranslation('notes') || 'ملاحظات (اختياري)';
        
        // إعداد event listener للتفويض بعد فتح المودال
        setTimeout(() => {
          setupDelegationEventListener();
        }, 100);
        
        return;
      }
      
      // زر التوقيع الإلكتروني
      if (target.closest('.btn-qr')) {
        const row = target.closest('tr');
        const id = row.dataset.id;
        
        // تعطيل جميع أزرار الصف فوراً
        disableRowActions(id);
        
        selectedContentId = id;
        selectedContentType = row.dataset.type;
        openModal('qrModal');
        return;
      }
      
      // زر الرفض
      if (target.closest('.btn-reject')) {
        const row = target.closest('tr');
        const id = row.dataset.id;
        
        // تعطيل جميع أزرار الصف فوراً
        disableRowActions(id);
        
        selectedContentId = id;
        selectedContentType = row.dataset.type;
        openModal('rejectModal');
        return;
      }
      
      // زر المعاينة
      if (target.closest('.btn-preview')) {
        handlePreviewClick(target);
        return;
      }
      
      // زر تتبع الطلب
      if (target.closest('.btn-track')) {
        const btn = target.closest('.btn-track');
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        window.location.href = `/frontend/html/track-request.html?id=${id}&type=${type}`;
        return;
      }
    };
    
    document.addEventListener('click', window.globalClickHandler, { passive: true });
  }
}

// دالة منفصلة لمعالجة النقر على زر المعاينة
async function handlePreviewClick(target) {
  const tr = target.closest('tr');
  const itemId = tr.dataset.id;
  const itemType = tr.dataset.type;
  const item = allItems.find(i => `${i.type}:${i.id}` === `${itemType}:${itemId}` || i.id == itemId);



  if (!item || !item.file_path) {
    showToast(getTranslation('no-content'), 'error');
    return;
  }

  // تسجيل عرض المحتوى
  try {
    let numericItemId = itemId;
    if (typeof itemId === 'string') {
      if (itemId.includes('-')) {
        const match = itemId.match(/\d+$/);
        numericItemId = match ? match[0] : itemId;
      } else {
        numericItemId = parseInt(itemId) || itemId;
      }
    } else {
      numericItemId = parseInt(itemId) || itemId;
    }
    if (!numericItemId || numericItemId <= 0) {
      console.warn('Invalid content ID:', itemId);
      return;
    }
    
    // استخدام API مختلف حسب نوع المحتوى
    let logViewEndpoint;
    if (item.type === 'committee') {
      // لا يوجد API لتسجيل عرض اللجان حالياً - تخطي تسجيل اللوق
      console.log('Skipping log view for committee content:', numericItemId);
    } else if (item.type === 'protocol') {
      // لا يوجد API لتسجيل عرض المحاضر حالياً - تخطي تسجيل اللوق
      console.log('Skipping log view for protocol content:', numericItemId);
    } else {
      // تسجيل عرض محتوى الأقسام
      logViewEndpoint = `${apiBase}/contents/log-view`;
      await fetchJSON(logViewEndpoint, {
        method: 'POST',
        body: JSON.stringify({
          contentId: numericItemId,
          contentType: item.type || 'department',
          contentTitle: item.title,
          sourceName: item.source_name,
          folderName: item.folder_name || item.folderName || ''
        })
      });
    }
  } catch (err) {
    console.error('Failed to log content view:', err);
    // لا نوقف العملية إذا فشل تسجيل اللوق
  }

  const baseApiUrl = apiBase.replace('/api', '');

  let filePath = item.file_path;
  let fileBaseUrl;

  // حالة ملفات اللجان (مسار يبدأ بـ backend/uploads/)
  if (filePath.startsWith('backend/uploads/')) {
    fileBaseUrl = `${baseApiUrl}/backend/uploads`;
    // شيل البادئة بالكامل
    filePath = filePath.replace(/^backend\/uploads\//, '');
  }
  // حالة ملفات الأقسام (مسار يبدأ بـ uploads/)
  else if (filePath.startsWith('uploads/')) {
    fileBaseUrl = `${baseApiUrl}/uploads`;
    // شيل البادئة
    filePath = filePath.replace(/^uploads\//, '');
  }
  // حالة ملفات المحاضر
  else if (item.type === 'protocol') {
    // بروتوكولاتنا تُحفظ كمسار نسبي مثل "protocols/filename.pdf"
    // أو قد تأتي كاملة ببادئة uploads/
    if (filePath.startsWith('backend/uploads/protocols/')) {
      fileBaseUrl = `${baseApiUrl}/backend/uploads/protocols`;
      filePath = filePath.replace(/^backend\/uploads\/protocols\//, '');
    } else if (filePath.startsWith('uploads/protocols/')) {
      fileBaseUrl = `${baseApiUrl}/uploads/protocols`;
      filePath = filePath.replace(/^uploads\/protocols\//, '');
    } else if (filePath.startsWith('protocols/')) {
      fileBaseUrl = `${baseApiUrl}/uploads`;
      // نبقي "protocols/.." كما هي تحت /uploads
    } else {
      // fallback العام
      fileBaseUrl = `${baseApiUrl}/uploads`;
    }
  }
  // أي حالة ثانية نفترض نفس مجلد uploads
  else {
    fileBaseUrl = `${baseApiUrl}/uploads`;
  }

  const url = `${fileBaseUrl}/${filePath}`;
  window.open(url, '_blank');
}

// 1. دالة لجلب سجل الاعتمادات للملف
async function fetchApprovalLog(contentId, type) {
  // إزالة البادئة إن وجدت
  let cleanId = contentId;
  if (typeof cleanId === 'string' && (cleanId.startsWith('dept-') || cleanId.startsWith('comm-'))) {
    cleanId = cleanId.split('-')[1];
  }
  
  if (type === 'committee') {
    // لجلب سجل اعتماد اللجنة - استخدام ID الأصلي مع البادئة
    const res = await fetch(`${apiBase}/committee-approvals/${contentId}/approvals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } else if (type === 'protocol') {
    // لجلب سجل اعتماد المحضر
    const res = await fetch(`${apiBase}/protocols/${cleanId}/approvals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } else {
    // لجلب تفاصيل القسم من /api/contents/:id واستخراج approvals_log
    const res = await fetch(`${apiBase}/contents/${cleanId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    // approvals_log غالبًا يكون JSON string
    let log = [];
    try {
      log = JSON.parse(json.data?.approvals_log || json.approvals_log || '[]');
    } catch { log = []; }
    return log;
  }
}

// 2. تعديل زر التوقيع الإلكتروني
const btnElectronicApprove = document.getElementById('btnElectronicApprove');
if (btnElectronicApprove) {
  btnElectronicApprove.addEventListener('click', async () => {
    if (!selectedContentId) return showToast(getTranslation('please-select-user'), 'warning');
    
    // حماية من النقر المتكرر
    if (!protectFromDoubleClick(btnElectronicApprove, getTranslation('signing'))) {
      return;
    }
    
    // تعطيل جميع أزرار الصف
    disableRowActions(selectedContentId);
    
    const contentType = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
    let endpoint;
    switch (contentType) {
      case 'committee':
        endpoint = 'committee-approvals';
        break;
      case 'protocol':
        endpoint = 'protocols';
        break;
      default:
        endpoint = 'approvals';
        break;
    }
    let approvalLog = await fetchApprovalLog(selectedContentId, contentType);
    const payload = {
      approved: true,
      signature: null,
      electronic_signature: true,
      notes: ''
    };
    const tokenPayload = await safeGetUserInfo(token);
    if (!tokenPayload) {
      setButtonProcessingState(btnElectronicApprove, false);
      enableRowActions(selectedContentId);
      return;
    }
    const myLog = Array.isArray(approvalLog) ? approvalLog.find(l => l.approver_id == tokenPayload.id) : null;
    console.log('[SIGN] approvalLog:', approvalLog);
    console.log('[SIGN] myLog:', myLog);
    if (myLog && (myLog.signed_as_proxy == 1 || myLog.delegated_by)) {
      payload.on_behalf_of = myLog.delegated_by;
      console.log('[SIGN] Sending on_behalf_of:', myLog.delegated_by);
    }
    console.log('[SIGN] payload being sent:', payload);
    try {
      const response = await fetchJSON(`${apiBase}/${endpoint}/${selectedContentId}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      console.log('[SIGN] response:', response);
      showToast(getTranslation('success-approved'), 'success');
      closeModal('qrModal');
      updateApprovalStatusInUI(selectedContentId, 'approved');
      disableActionsFor(selectedContentId);
    } catch (err) {
      console.error('Failed to electronically approve:', err);
      // إعادة تفعيل الزر في حالة الخطأ
      setButtonProcessingState(btnElectronicApprove, false);
      enableRowActions(selectedContentId);
    }
  });
}

// إضافة معالجة للإلغاء في مودال التوقيع الإلكتروني
const btnCancelQr = document.getElementById('btnCancelQr');
if (btnCancelQr) {
  btnCancelQr.addEventListener('click', () => {
    // إعادة تفعيل أزرار الصف عند الإلغاء
    if (selectedContentId) {
      enableRowActions(selectedContentId);
    }
    
    // إعادة تفعيل زر التوقيع إذا كان معطلاً
    const btnElectronicApprove = document.getElementById('btnElectronicApprove');
    if (btnElectronicApprove && btnElectronicApprove.disabled) {
      setButtonProcessingState(btnElectronicApprove, false);
    }
    
    closeModal('qrModal');
  });
}

// 3. تعديل زر التوقيع اليدوي (التوقيع بالرسم)
function setupSignatureModal() {
  console.log('🔍 setupSignatureModal called');
  
  // تعيين الكانفاس النشط للمودال الرئيسي
  activeCanvas = document.getElementById('mainSignatureCanvas');
  if (!activeCanvas) {
    console.error('🔍 Main signature canvas not found');
    return;
  }
  
  activeCtx = activeCanvas.getContext('2d');
  if (!activeCtx) {
    console.error('🔍 Failed to get main canvas context');
    return;
  }
  
  // تهيئة الكانفاس بشكل صحيح
  initializeCanvas();
  
  let drawing = false;
  
  // إزالة event listener السابق لتغيير الحجم لتجنب التكرار
  window.removeEventListener('resize', resizeCanvas);
  window.addEventListener('resize', resizeCanvas);
  
  // إعداد التبويبات
  setupSignatureTabs();
  
  // إعداد رفع الصور
  setupImageUpload();
  
  function getPos(e) {
    const rect = activeCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // حساب النسبة المئوية للكانفاس
    const scaleX = activeCanvas.width / rect.width;
    const scaleY = activeCanvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }
  
  // إزالة event listeners السابقة لتجنب التكرار
  activeCanvas.removeEventListener('mousedown', handleMouseDown);
  activeCanvas.removeEventListener('mousemove', handleMouseMove);
  activeCanvas.removeEventListener('mouseup', handleMouseUp);
  activeCanvas.removeEventListener('mouseleave', handleMouseLeave);
  activeCanvas.removeEventListener('touchstart', handleTouchStart);
  activeCanvas.removeEventListener('touchmove', handleTouchMove);
  activeCanvas.removeEventListener('touchend', handleTouchEnd);
  
  function handleMouseDown(e) {
    drawing = true;
    const pos = getPos(e);
    activeCtx.beginPath();
    activeCtx.moveTo(pos.x, pos.y);
  }
  
  function handleMouseMove(e) {
    if (!drawing) return;
    const pos = getPos(e);
    activeCtx.lineTo(pos.x, pos.y);
    activeCtx.stroke();
  }
  
  function handleMouseUp() {
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = activeCanvas.toDataURL('image/png');
  }
  
  function handleMouseLeave() {
    drawing = false;
  }
  
  function handleTouchStart(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    activeCtx.beginPath();
    activeCtx.moveTo(pos.x, pos.y);
  }
  
  function handleTouchMove(e) {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    activeCtx.lineTo(pos.x, pos.y);
    activeCtx.stroke();
  }
  
  function handleTouchEnd(e) {
    e.preventDefault();
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = activeCanvas.toDataURL('image/png');
  }
  
  // إضافة event listeners للتوقيع
  activeCanvas.addEventListener('mousedown', handleMouseDown);
  activeCanvas.addEventListener('mousemove', handleMouseMove);
  activeCanvas.addEventListener('mouseup', handleMouseUp);
  activeCanvas.addEventListener('mouseleave', handleMouseLeave);
  activeCanvas.addEventListener('touchstart', handleTouchStart);
  activeCanvas.addEventListener('touchmove', handleTouchMove);
  activeCanvas.addEventListener('touchend', handleTouchEnd);
  
  // إزالة event listeners السابقة للأزرار
  const btnClear = document.getElementById('btnClear');
  const btnCancelSignature = document.getElementById('btnCancelSignature');
  const btnConfirmSignature = document.getElementById('btnConfirmSignature');
  
  if (btnClear) {
    btnClear.removeEventListener('click', handleClearClick);
    btnClear.addEventListener('click', handleClearClick);
  }
  
  if (btnCancelSignature) {
    btnCancelSignature.removeEventListener('click', handleCancelClick);
    btnCancelSignature.addEventListener('click', handleCancelClick);
  }
  
  if (btnConfirmSignature) {
    btnConfirmSignature.removeEventListener('click', handleConfirmClick);
    btnConfirmSignature.addEventListener('click', handleConfirmClick);
  }
  
  function handleClearClick() {
    clearCanvas();
    currentSignature = null;
  }
  
  function handleCancelClick() {
    // إعادة تفعيل أزرار الصف عند الإلغاء
    if (selectedContentId) {
      enableRowActions(selectedContentId);
    }
    
    closeSignatureModal();
  }
  
  async function handleConfirmClick() {
    // التحقق من وجود توقيع
    if (!currentSignature) {
      showToast(getTranslation('no-signature') || 'يرجى إضافة توقيع أولاً', 'error');
      return;
    }
    
    // حماية من النقر المتكرر
    const confirmButton = document.getElementById('btnConfirmSignature');
    if (!protectFromDoubleClick(confirmButton, getTranslation('sending-signature'))) {
      return;
    }
    
    // تعطيل جميع أزرار الصف
    disableRowActions(selectedContentId);
    
    const contentType = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
    let endpoint;
    switch (contentType) {
      case 'committee':
        endpoint = 'committee-approvals';
        break;
      case 'protocol':
        endpoint = 'protocols';
        break;
      default:
        endpoint = 'approvals';
        break;
    }
    let approvalLog = await fetchApprovalLog(selectedContentId, contentType);
    const payload = {
      approved: true,
      signature: currentSignature,
      notes: ''
    };
    const tokenPayload = await safeGetUserInfo(token);
    if (!tokenPayload) {
      setButtonProcessingState(confirmButton, false);
      enableRowActions(selectedContentId);
      return;
    }
    const myLog = Array.isArray(approvalLog) ? approvalLog.find(l => l.approver_id == tokenPayload.id) : null;
    console.log('[SIGN] approvalLog:', approvalLog);
    console.log('[SIGN] myLog:', myLog);
    if (myLog && (myLog.signed_as_proxy == 1 || myLog.delegated_by)) {
      payload.on_behalf_of = myLog.delegated_by;
      console.log('[SIGN] Sending on_behalf_of:', myLog.delegated_by);
    }
    console.log('[SIGN] payload being sent:', payload);
    try {
      const response = await fetchJSON(`${apiBase}/${endpoint}/${selectedContentId}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      console.log('[SIGN] response:', response);
      showToast(getTranslation('success-sent'), 'success');
      closeSignatureModal();
      updateApprovalStatusInUI(selectedContentId, 'approved');
      disableActionsFor(selectedContentId);
    } catch (err) {
      console.error('Failed to send signature:', err);
      // إعادة تفعيل الزر في حالة الخطأ
      setButtonProcessingState(confirmButton, false);
      enableRowActions(selectedContentId);
    }
  }
  
  console.log('🔍 Signature modal setup completed successfully');
}

// دالة تهيئة الكانفاس
function initializeCanvas() {
  if (!activeCanvas || !activeCtx) {
    console.error('🔍 Canvas or context not available for initialization');
    return;
  }
  
  // الحصول على أبعاد الحاوية
  const wrapper = activeCanvas.parentElement;
  if (!wrapper) {
    console.error('🔍 Canvas wrapper not found');
    return;
  }
  
  const rect = wrapper.getBoundingClientRect();
  const canvasWidth = rect.width || 400;
  const canvasHeight = rect.height || 200;
  
  console.log('🔍 Setting canvas dimensions:', { canvasWidth, canvasHeight });
  
  // تعيين الأبعاد مباشرة على العنصر
  activeCanvas.width = canvasWidth;
  activeCanvas.height = canvasHeight;
  
  // تعيين الأبعاد في CSS أيضاً للتأكد
  activeCanvas.style.width = '100%';
  activeCanvas.style.height = '100%';
  
  // إعادة الحصول على السياق بعد تغيير الأبعاد
  activeCtx = activeCanvas.getContext('2d');
  
  if (activeCtx) {
    // تعيين خصائص الرسم
    activeCtx.strokeStyle = '#000';
    activeCtx.lineWidth = 2;
    activeCtx.lineCap = 'round';
    activeCtx.lineJoin = 'round';
    
    // مسح الكانفاس
    activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
    
    // تعيين خلفية بيضاء للكانفاس
    activeCtx.fillStyle = '#ffffff';
    activeCtx.fillRect(0, 0, activeCanvas.width, activeCanvas.height);
    
    // إعادة تعيين لون الرسم
    activeCtx.strokeStyle = '#000';
    
    console.log('🔍 Canvas initialized successfully with dimensions:', {
      width: activeCanvas.width,
      height: activeCanvas.height,
      styleWidth: activeCanvas.style.width,
      styleHeight: activeCanvas.style.height
    });
  } else {
    console.error('🔍 Failed to get canvas context after initialization!');
  }
}

// إعداد التبويبات
function setupSignatureTabs() {
  console.log('🔍 setupSignatureTabs called');
  
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  if (tabBtns.length === 0 || tabContents.length === 0) {
    console.warn('🔍 No tab buttons or contents found');
    return;
  }
  
  // إزالة event listeners السابقة
  tabBtns.forEach(btn => {
    btn.removeEventListener('click', handleTabClick);
    btn.addEventListener('click', handleTabClick);
  });
  
  function handleTabClick(e) {
    const targetTab = e.target.dataset.tab;
    console.log('🔍 Tab clicked:', targetTab);
    
    if (!targetTab) {
      console.warn('🔍 No tab data found');
      return;
    }
    
    // إزالة الفئة النشطة من جميع التبويبات
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // إضافة الفئة النشطة للتبويب المحدد
    e.target.classList.add('active');
    const targetContent = document.getElementById(`${targetTab}-tab`);
    
    if (targetContent) {
      targetContent.classList.add('active');
      
      // إذا كان التبويب المحدد هو التوقيع المباشر، أعد تهيئة الكانفاس
      if (targetTab === 'draw') {
        setTimeout(() => {
          if (activeCanvas) {
            initializeCanvas();
            setupSignatureDrawing();
          }
        }, 50);
      }
    } else {
      console.warn('🔍 Tab content not found:', `${targetTab}-tab`);
    }
    
    // إعادة تعيين التوقيع الحالي
    currentSignature = null;
  }
  
  console.log('🔍 Signature tabs setup completed');
}

// إعداد رفع الصور
function setupImageUpload() {
  console.log('🔍 setupImageUpload called');
  
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('signatureFile');
  const uploadPreview = document.getElementById('uploadPreview');
  const previewImage = document.getElementById('previewImage');
  const btnRemoveImage = document.getElementById('btnRemoveImage');
  
  if (!uploadArea || !fileInput || !uploadPreview || !previewImage || !btnRemoveImage) {
    console.warn('🔍 Some image upload elements not found');
    return;
  }
  
  // إزالة event listeners السابقة
  uploadArea.removeEventListener('click', handleUploadAreaClick);
  uploadArea.removeEventListener('dragover', handleDragOver);
  uploadArea.removeEventListener('dragleave', handleDragLeave);
  uploadArea.removeEventListener('drop', handleDrop);
  fileInput.removeEventListener('change', handleFileChange);
  btnRemoveImage.removeEventListener('click', handleRemoveImage);
  
  // النقر على منطقة الرفع
  uploadArea.addEventListener('click', handleUploadAreaClick);
  
  // سحب وإفلات الملفات
  uploadArea.addEventListener('dragover', handleDragOver);
  uploadArea.addEventListener('dragleave', handleDragLeave);
  uploadArea.addEventListener('drop', handleDrop);
  
  // اختيار الملف من input
  fileInput.addEventListener('change', handleFileChange);
  
  // إزالة الصورة
  btnRemoveImage.addEventListener('click', handleRemoveImage);
  
  function handleUploadAreaClick() {
    fileInput.click();
  }
  
  function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  }
  
  function handleDragLeave() {
    uploadArea.classList.remove('dragover');
  }
  
  function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }
  
  function handleFileChange(e) {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  }
  
  function handleRemoveImage() {
    uploadPreview.style.display = 'none';
    uploadArea.style.display = 'block';
    fileInput.value = '';
    currentSignature = null;
    console.log('🔍 Image removed');
  }
  
  function handleFileSelect(file) {
    console.log('🔍 File selected:', file.name, file.type);
    
    if (!file.type.startsWith('image/')) {
      showToast(getTranslation('invalid-image') || 'يرجى اختيار ملف صورة صالح', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // تحويل الصورة إلى base64
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // تحديد أبعاد الصورة
        const maxWidth = 400;
        const maxHeight = 200;
        let { width, height } = img;
        
        // حساب النسب المئوية للحفاظ على النسبة
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // رسم الصورة على الكانفاس
        ctx.drawImage(img, 0, 0, width, height);
        
        // تحويل إلى base64
        const signatureData = canvas.toDataURL('image/png');
        
        // عرض المعاينة
        previewImage.src = signatureData;
        uploadArea.style.display = 'none';
        uploadPreview.style.display = 'block';
        
        // حفظ التوقيع
        currentSignature = signatureData;
        
        console.log('🔍 Image processed and signature saved');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  console.log('🔍 Image upload setup completed');
}

async function loadDepartments() {
  const deptSelect = document.getElementById('delegateDept');
  if (!deptSelect) return;

  try {
    const res = await fetchJSON(`${apiBase}/departments/all`);
    const departments = Array.isArray(res) ? res : (res.data || []);
    const lang = localStorage.getItem('language') || 'ar';

    deptSelect.innerHTML = `<option value="" disabled selected>${getTranslation('select-department')}</option>`;

    departments.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;

      let deptName;
      try {
        const parsed = JSON.parse(d.name);
        deptName = parsed[lang] || parsed.ar || d.name;
      } catch {
        deptName = d.name;
      }

      opt.textContent = deptName;
      deptSelect.appendChild(opt);
    });

  } catch (err) {
    console.error('Failed to load departments:', err);
    showToast(getTranslation('error-loading'), 'error');
  }
}


document.getElementById('delegateDept').addEventListener('change', async (e) => {
  const deptId = e.target.value;
  try {
    const res = await fetch(`${apiBase}/users?departmentId=${deptId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const json = await res.json();
    const users = json.data || [];
    const userSelect = document.getElementById('delegateUser');
    userSelect.innerHTML = `<option value="" disabled selected>${getTranslation('select-user')}</option>`;

    users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.name;
      userSelect.appendChild(opt);
    });

  } catch (err) {
    console.error('Failed to load users:', err);
    showToast(getTranslation('error-loading'), 'error');
  }
});

// دالة لإعداد event listener للتفويض
function setupDelegationEventListener() {
  const btnDelegateConfirm = document.getElementById('btnDelegateConfirm');
  console.log('🔍 btnDelegateConfirm element found:', btnDelegateConfirm);
  if (btnDelegateConfirm) {
    console.log('🔍 Adding click event listener to btnDelegateConfirm');
    btnDelegateConfirm.addEventListener('click', async () => {
      console.log('🔍 btnDelegateConfirm clicked!');
      
      // حماية من النقر المتكرر
      if (!protectFromDoubleClick(btnDelegateConfirm, getTranslation('processing-delegation'))) {
        return;
      }
      
      const userId = document.getElementById('delegateUser').value;
      const notes = document.getElementById('delegateNotes').value;
      if (!userId) {
        setButtonProcessingState(btnDelegateConfirm, false);
        return showToast(getTranslation('please-select-user'), 'warning');
      }
      
      // تعطيل جميع أزرار الصف إذا كان هناك contentId محدد
      if (selectedContentId) {
        disableRowActions(selectedContentId);
      }
      
      if (isBulkDelegation) {
        // تفويض شامل - عرض بوب أب الإقرار أولاً
        console.log('🔍 Starting bulk delegation confirmation process...');
        try {
          // إغلاق مودال التفويض الحالي
          closeModal('delegateModal');
          
          // عرض بوب أب الإقرار للتفويض الشامل
          await showBulkDelegationConfirmation(userId, notes);
        } catch (err) {
          console.error('Failed to show bulk delegation confirmation:', err);
          showToast(getTranslation('error-showing-bulk-delegation-confirmation'), 'error');
          // إعادة تفعيل الزر في حالة الخطأ
          setButtonProcessingState(btnDelegateConfirm, false);
          // إعادة تفعيل أزرار الصف في حالة الخطأ
          if (selectedContentId) {
            enableRowActions(selectedContentId);
          }
        }
      } else {
        // تفويض فردي - عرض بوب أب الإقرار أولاً
        console.log('🔍 Starting single delegation confirmation process...');
        console.log('🔍 selectedContentId:', selectedContentId);
        console.log('🔍 userId:', userId);
        console.log('🔍 notes:', notes);
        
        const row = document.querySelector(`tr[data-id="${selectedContentId}"]`);
        console.log('🔍 Found row:', row);
        
        if (!row) {
          console.error('🔍 Row not found for selectedContentId:', selectedContentId);
          showToast(getTranslation('error-file-not-found'), 'error');
          setButtonProcessingState(btnDelegateConfirm, false);
          // إعادة تفعيل أزرار الصف في حالة الخطأ
          if (selectedContentId) {
            enableRowActions(selectedContentId);
          }
          return;
        }
        
        const contentType = row.dataset.type;
        console.log('🔍 contentType from dataset:', contentType);
        console.log('🔍 selectedContentId:', selectedContentId);
        
        // التحقق من صحة البيانات
        if (!contentType) {
          console.error('🔍 contentType is missing or undefined');
          showToast(getTranslation('error-content-type-not-specified'), 'error');
          setButtonProcessingState(btnDelegateConfirm, false);
          // إعادة تفعيل أزرار الصف في حالة الخطأ
          if (selectedContentId) {
            enableRowActions(selectedContentId);
          }
          return;
        }
        
        if (!selectedContentId) {
          console.error('🔍 selectedContentId is missing or undefined');
          showToast(getTranslation('error-content-id-not-specified'), 'error');
          setButtonProcessingState(btnDelegateConfirm, false);
          // إعادة تفعيل أزرار الصف في حالة الخطأ
          if (selectedContentId) {
            enableRowActions(selectedContentId);
          }
          return;
        }
        
        try {
          // إغلاق مودال التفويض الحالي
          console.log('🔍 Closing delegate modal...');
          closeModal('delegateModal');
          
          // عرض بوب أب الإقرار حسب نوع المحتوى
          if (contentType === 'committee') {
            // تفويض لجنة فردي
            console.log('🔍 Showing single committee delegation confirmation');
            await showSingleCommitteeDelegationConfirmation(userId, selectedContentId, contentType, notes);
          } else if (contentType === 'protocol') {
            // تفويض محضر فردي
            console.log('🔍 Showing single protocol delegation confirmation');
            await showSingleProtocolDelegationConfirmation(userId, selectedContentId, contentType, notes);
          } else {
            // تفويض قسم فردي
            console.log('🔍 Showing single department delegation confirmation');
            await showSingleDelegationConfirmation(userId, selectedContentId, contentType, notes);
          }
        } catch (err) {
          console.error('Failed to show delegation confirmation:', err);
          showToast(getTranslation('error-showing-delegation-confirmation'), 'error');
          // إعادة تفعيل الزر في حالة الخطأ
          setButtonProcessingState(btnDelegateConfirm, false);
          // إعادة تفعيل أزرار الصف في حالة الخطأ
          if (selectedContentId) {
            enableRowActions(selectedContentId);
          }
        }
      }
      isBulkDelegation = false;
    });
  }
  
  // إضافة معالجة للإلغاء في مودال التفويض
  const btnCancelDelegate = document.getElementById('btnCancelDelegate');
  if (btnCancelDelegate) {
    btnCancelDelegate.addEventListener('click', () => {
      // إعادة تفعيل أزرار الصف عند الإلغاء
      if (selectedContentId) {
        enableRowActions(selectedContentId);
      }
      
      // إعادة تفعيل زر التأكيد إذا كان معطلاً
      const btnDelegateConfirm = document.getElementById('btnDelegateConfirm');
      if (btnDelegateConfirm && btnDelegateConfirm.disabled) {
        setButtonProcessingState(btnDelegateConfirm, false);
      }
      
      closeModal('delegateModal');
    });
  }
}

function disableActionsFor(contentId) {
  const row = document.querySelector(`tr[data-id="${contentId}"]`);
  if (!row) return;
  const actionsCell = row.querySelector('.col-actions');
  if (actionsCell) actionsCell.innerHTML = '';
}

function updateRecordsInfo(totalItems, startIdx, endIdx) {
  document.getElementById('startRecord').textContent = totalItems === 0 ? 0 : startIdx + 1;
  document.getElementById('endRecord').textContent   = endIdx;
  document.getElementById('totalCount').textContent  = totalItems;
}

// Popup تأكيد قبول جميع التفويضات
function showApprovalsProxyPopup() {
  // إذا لديك modal مخصص استخدمه، وإلا استخدم window.confirm
  if (window.showPopup) {
    showPopup(
      getTranslation('accept-all-proxy-confirm') || 'هل توافق على أن تصبح مفوضًا بالنيابة عن جميع الملفات المحولة لك؟',
      async () => {
        try {
          const response = await fetch(`${apiBase}/approvals/proxy/accept-all-unified`, { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` } 
          });
          const result = await response.json();
          
          if (result.status === 'success') {
            const stats = result.stats || {};
            const message = `${result.message}\nملفات الأقسام: ${stats.departmentFiles || 0}\nملفات اللجان: ${stats.committeeFiles || 0}`;
            showToast(message, 'success');
          } else {
            showToast(result.message || getTranslation('accept-all-proxy-error'), 'error');
          }
          refreshApprovalsData();
        } catch (err) {
          console.error('Accept all delegations error:', err);
          showToast(getTranslation('accept-all-proxy-error'), 'error');
        }
      }
    );
  } else {
    if (window.confirm(getTranslation('accept-all-proxy-confirm') || 'هل توافق على أن تصبح مفوضًا بالنيابة عن جميع الملفات المحولة لك؟')) {
      fetch(`${apiBase}/approvals/proxy/accept-all-unified`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` } 
      }).then(async (response) => {
        const result = await response.json();
        if (result.status === 'success') {
          const stats = result.stats || {};
          const message = `${result.message}\nملفات الأقسام: ${stats.departmentFiles || 0}\nملفات اللجان: ${stats.committeeFiles || 0}`;
          showToast(message, 'success');
        } else {
          showToast(result.message || getTranslation('accept-all-proxy-error'), 'error');
        }
        refreshApprovalsData();
      }).catch((err) => {
        console.error('Accept all delegations error:', err);
        showToast(getTranslation('accept-all-proxy-error'), 'error');
      });
    }
  }
}

// دالة مسح التوقيع
function clearCanvas() {
  if (activeCtx && activeCanvas) {
    // مسح الكانفاس
    activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
    
    // إعادة تعيين خصائص الرسم
    activeCtx.strokeStyle = '#000';
    activeCtx.lineWidth = 2;
    activeCtx.lineCap = 'round';
    activeCtx.lineJoin = 'round';
    
    // تعيين خلفية بيضاء للكانفاس
    activeCtx.fillStyle = '#ffffff';
    activeCtx.fillRect(0, 0, activeCanvas.width, activeCanvas.height);
    
    // إعادة تعيين لون الرسم
    activeCtx.strokeStyle = '#000';
    
    // إعادة تعيين التوقيع الحالي
    currentSignature = null;
    
    console.log('🔍 Canvas cleared successfully');
  } else {
    console.warn('🔍 Canvas or context not available for clearing');
  }
}

// دالة تغيير حجم الكانفس
function resizeCanvas() {
  if (!activeCanvas) {
    console.warn('🔍 No active canvas for resizing');
    return;
  }
  
  const wrapper = activeCanvas.parentElement;
  if (!wrapper) {
    console.warn('🔍 No wrapper found for canvas resizing');
    return;
  }
  
  const rect = wrapper.getBoundingClientRect();
  const newWidth = rect.width || 400;
  const newHeight = rect.height || 200;
  
  // حفظ البيانات الحالية إذا كان هناك توقيع
  let imageData = null;
  if (activeCtx) {
    try {
      imageData = activeCtx.getImageData(0, 0, activeCanvas.width, activeCanvas.height);
    } catch (e) {
      console.warn('🔍 Could not preserve canvas data during resize');
    }
  }
  
  // تعيين الأبعاد الجديدة
  activeCanvas.width = newWidth;
  activeCanvas.height = newHeight;
  
  // إعادة الحصول على السياق بعد تغيير الأبعاد
  activeCtx = activeCanvas.getContext('2d');
  
  if (activeCtx) {
    // إعادة تعيين خصائص الرسم
    activeCtx.lineWidth = 2;
    activeCtx.lineCap = 'round';
    activeCtx.lineJoin = 'round';
    activeCtx.strokeStyle = '#000';
    
    // تعيين خلفية بيضاء للكانفاس
    activeCtx.fillStyle = '#ffffff';
    activeCtx.fillRect(0, 0, activeCanvas.width, activeCanvas.height);
    
    // استعادة البيانات المحفوظة إذا كانت موجودة
    if (imageData) {
      try {
        activeCtx.putImageData(imageData, 0, 0);
      } catch (e) {
        console.warn('🔍 Could not restore canvas data after resize');
      }
    }
    
    console.log('🔍 Canvas resized to:', { width: newWidth, height: newHeight });
  } else {
    console.error('🔍 Failed to get canvas context after resize');
  }
}

// دالة فتح مودال التوقيع
function openSignatureModal(contentId) {
  console.log('🔍 openSignatureModal called for contentId:', contentId);
  selectedContentId = contentId;
  const modal = document.getElementById('signatureModal');
  
  if (!modal) {
    console.error('🔍 Signature modal not found');
    return;
  }
  
  modal.style.display = 'flex';
  
  // إعادة تعيين التوقيع الحالي
  currentSignature = null;
  
  // إعادة تعيين التبويبات
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  
  // تفعيل تبويب التوقيع المباشر افتراضياً
  const drawTabBtn = document.querySelector('[data-tab="draw"]');
  const drawTabContent = document.getElementById('draw-tab');
  
  if (drawTabBtn && drawTabContent) {
    drawTabBtn.classList.add('active');
    drawTabContent.classList.add('active');
  }
  
  // إعادة تعيين منطقة رفع الصور
  const uploadArea = document.getElementById('uploadArea');
  const uploadPreview = document.getElementById('uploadPreview');
  if (uploadArea && uploadPreview) {
    uploadArea.style.display = 'block';
    uploadPreview.style.display = 'none';
  }
  
  // تعيين الكانفاس النشط للمودال الرئيسي مع تأخير لضمان تحميل DOM
  setTimeout(() => {
    const mainCanvas = document.getElementById('mainSignatureCanvas');
    if (mainCanvas) {
      activeCanvas = mainCanvas;
      activeCtx = activeCanvas.getContext('2d');
      console.log('🔍 Main signature modal opened, activeCanvas set to:', activeCanvas.id);
      
      // تهيئة الكانفاس
      initializeCanvas();
      
      // إعادة إعداد event listeners للتوقيع
      setupSignatureDrawing();
      
      // إعادة إعداد التبويبات
      setupSignatureTabs();
      
      // إعادة إعداد رفع الصور
      setupImageUpload();
      
      console.log('🔍 Signature modal fully initialized');
    } else {
      console.error('🔍 Main signature canvas not found in modal');
    }
  }, 100);
}

// دالة إعداد التوقيع على الكانفاس
function setupSignatureDrawing() {
  if (!activeCanvas || !activeCtx) {
    console.error('🔍 Canvas or context not available for drawing setup');
    return;
  }
  
  let drawing = false;
  
  function getPos(e) {
    const rect = activeCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // حساب النسبة المئوية للكانفاس
    const scaleX = activeCanvas.width / rect.width;
    const scaleY = activeCanvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }
  
  // إزالة event listeners السابقة
  activeCanvas.removeEventListener('mousedown', handleMouseDown);
  activeCanvas.removeEventListener('mousemove', handleMouseMove);
  activeCanvas.removeEventListener('mouseup', handleMouseUp);
  activeCanvas.removeEventListener('mouseleave', handleMouseLeave);
  activeCanvas.removeEventListener('touchstart', handleTouchStart);
  activeCanvas.removeEventListener('touchmove', handleTouchMove);
  activeCanvas.removeEventListener('touchend', handleTouchEnd);
  
  function handleMouseDown(e) {
    drawing = true;
    const pos = getPos(e);
    activeCtx.beginPath();
    activeCtx.moveTo(pos.x, pos.y);
  }
  
  function handleMouseMove(e) {
    if (!drawing) return;
    const pos = getPos(e);
    activeCtx.lineTo(pos.x, pos.y);
    activeCtx.stroke();
  }
  
  function handleMouseUp() {
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = activeCanvas.toDataURL('image/png');
  }
  
  function handleMouseLeave() {
    drawing = false;
  }
  
  function handleTouchStart(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    activeCtx.beginPath();
    activeCtx.moveTo(pos.x, pos.y);
  }
  
  function handleTouchMove(e) {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    activeCtx.lineTo(pos.x, pos.y);
    activeCtx.stroke();
  }
  
  function handleTouchEnd(e) {
    e.preventDefault();
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = activeCanvas.toDataURL('image/png');
  }
  
  // إضافة event listeners للتوقيع
  activeCanvas.addEventListener('mousedown', handleMouseDown);
  activeCanvas.addEventListener('mousemove', handleMouseMove);
  activeCanvas.addEventListener('mouseup', handleMouseUp);
  activeCanvas.addEventListener('mouseleave', handleMouseLeave);
  activeCanvas.addEventListener('touchstart', handleTouchStart);
  activeCanvas.addEventListener('touchmove', handleTouchMove);
  activeCanvas.addEventListener('touchend', handleTouchEnd);
  
  console.log('🔍 Signature drawing setup completed');
}

// دالة إغلاق مودال التوقيع
function closeSignatureModal() {
  console.log('🔍 closeSignatureModal called');
  
  const modal = document.getElementById('signatureModal');
  if (modal) {
    // إغلاق فوري بدون تأخير
    modal.style.display = 'none';
    modal.style.opacity = '1';
    modal.style.transition = '';
    
    // مسح الكانفاس
    clearCanvas();
    
    // إزالة event listeners من الكانفاس
    if (activeCanvas) {
      activeCanvas.removeEventListener('mousedown', handleMouseDown);
      activeCanvas.removeEventListener('mousemove', handleMouseMove);
      activeCanvas.removeEventListener('mouseup', handleMouseUp);
      activeCanvas.removeEventListener('mouseleave', handleMouseLeave);
      activeCanvas.removeEventListener('touchstart', handleTouchStart);
      activeCanvas.removeEventListener('touchmove', handleTouchMove);
      activeCanvas.removeEventListener('touchend', handleTouchEnd);
    }
    
    // إزالة event listener لتغيير الحجم
    window.removeEventListener('resize', resizeCanvas);
    
    // إزالة event listeners من الأزرار
    const btnClear = document.getElementById('btnClear');
    const btnCancelSignature = document.getElementById('btnCancelSignature');
    const btnConfirmSignature = document.getElementById('btnConfirmSignature');
    
    if (btnClear) {
      btnClear.removeEventListener('click', handleClearClick);
    }
    
    if (btnCancelSignature) {
      btnCancelSignature.removeEventListener('click', handleCancelClick);
    }
    
    if (btnConfirmSignature) {
      btnConfirmSignature.removeEventListener('click', handleConfirmClick);
    }
    
    // إعادة تفعيل أزرار الصف إذا لم يتم الاعتماد
    if (selectedContentId) {
      const row = document.querySelector(`tr[data-id="${selectedContentId}"]`);
      if (row && row.dataset.status === 'pending') {
        enableRowActions(selectedContentId);
      }
    }
    
    // إعادة تعيين متغيرات الكانفاس النشط
    activeCanvas = null;
    activeCtx = null;
    currentSignature = null;
    
    console.log('🔍 Main signature modal closed, activeCanvas reset');
  } else {
    console.warn('🔍 Signature modal not found for closing');
  }
}

// دالة لتحديث البيانات بدلاً من إعادة تحميل الصفحة
async function refreshApprovalsData() {
  try {
    
    // جلب ملفات اللجان من endpoint واحد فقط لتجنب التكرار
    const commResp = await fetchJSON(`${apiBase}/committee-approvals/assigned-to-me`);
    const deptResp = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    const protocolResp = await fetchJSON(`${apiBase}/protocols/pending/approvals`);
    
    // دالة مساعدة لتحديد نوع الملف بدقة
    const determineFileType = (item, sourceType) => {
      console.log(`🔍 Determining file type for item ${item.id}:`, {
        content_type: item.content_type,
        type: item.type,
        id: item.id,
        sourceType: sourceType,
        title: item.title
      });
      
      // إذا كان الملف يحتوي على content_type، استخدمه
      if (item.content_type) {
        console.log(`🔍 Using content_type: ${item.content_type}`);
        return item.content_type;
      }
      
      // إذا كان الملف يحتوي على type، استخدمه
      if (item.type && item.type !== sourceType) {
        console.log(`🔍 Using item.type: ${item.type}`);
        return item.type;
      }
      
      // إذا كان معرف الملف يبدأ بـ 'comm-'، فهو ملف لجنة
      if (item.id && item.id.toString().startsWith('comm-')) {
        console.log(`🔍 Using ID prefix 'comm-': committee`);
        return 'committee';
      }
      
      // إذا كان معرف الملف يبدأ بـ 'prot-'، فهو محضر
      if (item.id && item.id.toString().startsWith('prot-')) {
        console.log(`🔍 Using ID prefix 'prot-': protocol`);
        return 'protocol';
      }
      
      // إذا كان الملف يحتوي على source_name يبدأ بـ 'لجنة' أو 'committee'، فهو ملف لجنة
      if (item.source_name && (
        item.source_name.toLowerCase().includes('committee') || 
        item.source_name.includes('لجنة') ||
        item.source_name.includes('لجنة')
      )) {
        console.log(`🔍 Using source_name pattern: committee`);
        return 'committee';
      }
      
      // استخدم النوع المحدد من المصدر
      console.log(`🔍 Using source type: ${sourceType}`);
      return sourceType;
    };
    
    // Combine all types of approvals with improved type detection
    const deptItems = (deptResp.data || []).map(item => ({ 
      ...item, 
      type: determineFileType(item, 'department') 
    }));
    const commItems = (commResp.data || []).map(item => ({ 
      ...item, 
      type: determineFileType(item, 'committee') 
    }));
    const protocolItems = (protocolResp.data || []).map(item => ({ 
      ...item, 
      type: determineFileType(item, 'protocol') 
    }));
    
    // Log للتحقق من البيانات
    console.log('🔍 Committee items count:', commItems.length);
    console.log('🔍 Department items count:', deptItems.length);
    console.log('🔍 Protocol items count:', protocolItems.length);
    
    // تحسين منطق إزالة التكرار - إعطاء الأولوية للنوع الصحيح
    const uniqueMap = new Map();
    const processedIds = new Set();
    
    // أولاً: معالجة ملفات اللجان (أعلى أولوية)
    commItems.forEach(item => {
      const key = `${item.type}:${item.id}`;
      uniqueMap.set(key, item);
      processedIds.add(item.id);
      console.log(`🔍 Added committee item: ${item.id} (${item.type})`);
    });
    
    // ثانياً: معالجة المحاضر
    protocolItems.forEach(item => {
      const key = `${item.type}:${item.id}`;
      uniqueMap.set(key, item);
      processedIds.add(item.id);
      console.log(`🔍 Added protocol item: ${item.id} (${item.type})`);
    });
    
    // ثالثاً: معالجة ملفات الأقسام (أقل أولوية)
    deptItems.forEach(item => {
      // تحقق من نوع الملف أولاً
      const actualType = determineFileType(item, 'department');
      console.log(`🔍 Processing dept item ${item.id}: original type=${item.type}, actual type=${actualType}`);
      
      // إذا كان الملف لم يتم معالجته من قبل (ليس ملف لجنة أو محضر)
      if (!processedIds.has(item.id)) {
        const key = `${actualType}:${item.id}`;
        uniqueMap.set(key, { ...item, type: actualType });
        console.log(`🔍 Added department item: ${item.id} (${actualType})`);
      } else {
        // تحقق من نوع الملف الحالي في uniqueMap
        const existingItem = uniqueMap.get(`committee:${item.id}`) || uniqueMap.get(`protocol:${item.id}`);
        if (existingItem) {
          console.log(`🔍 Skipped department item: ${item.id} - already processed as ${existingItem.type}`);
        } else {
          // إذا لم يكن موجود، أضفه كملف قسم
          const key = `${actualType}:${item.id}`;
          uniqueMap.set(key, { ...item, type: actualType });
          console.log(`🔍 Added department item: ${item.id} (${actualType}) - no conflict found`);
        }
      }
    });
    
    allItems = Array.from(uniqueMap.values());
    filteredItems = allItems;
    
    console.log('🔍 Final items count:', allItems.length);
    console.log('🔍 Final items by type:', {
      committee: allItems.filter(item => item.type === 'committee').length,
      department: allItems.filter(item => item.type === 'department').length,
      protocol: allItems.filter(item => item.type === 'protocol').length
    });

    await setupFilters(allItems);
    renderApprovals(filteredItems);
    
  } catch (err) {
    console.error("Error refreshing approvals:", err);
            showToast(getTranslation('error-refreshing'), 'error');
  }
}

// تحسين الأداء باستخدام debounce للبحث
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  }
}

// تحسين دالة البحث
const debouncedApplyFilters = debounce(applyFilters, 300);

// تحديث event listener للبحث
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debouncedApplyFilters);
  }
  
  // إعداد event listener للتفويض
  setupDelegationEventListener();
});

// تحسين الأداء - تخزين مؤقت للعناصر المستخدمة بكثرة

// دالة محسنة للحصول على العناصر مع التخزين المؤقت
function getCachedElement(id) {
  try {
    if (!id) {
      console.warn('🔍 Element ID is null or undefined');
      return null;
    }
    
    if (!elementCache.has(id)) {
      const element = document.getElementById(id);
      elementCache.set(id, element);
      if (!element) {
        console.warn('🔍 Element not found:', id);
      }
    }
    return elementCache.get(id);
  } catch (error) {
    console.error('🔍 Error getting cached element:', error);
    return null;
  }
}



// دالة محسنة لفتح المودال
function openModal(modalId) {
  console.log('🔍 openModal called with modalId:', modalId);
  try {
    const modal = getCachedElement(modalId);
    console.log('🔍 Modal element found:', modal);
    if (modal) {
      // فتح فوري بدون تأخير
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.transition = '';
      
      // تخزين في الذاكرة المؤقتة
      modalCache.set(modalId, modal);
      console.log('🔍 Modal opened successfully');
    } else {
      console.error('🔍 Modal not found:', modalId);
    }
  } catch (error) {
    console.error('🔍 Error opening modal:', error);
  }
}

// تحسين الأداء - إضافة throttling للعمليات الثقيلة
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// تحسين دالة renderApprovals مع throttling
const throttledRenderApprovals = throttle(renderApprovals, 100);

function authHeaders() {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}


// دالة معالجة التفويض الفردي
async function processSingleDelegation(data) {
  console.log('🔍 processSingleDelegation called with data:', data);
  console.log('🔍 senderSignature in data:', data.senderSignature ? 'PRESENT' : 'MISSING');
  
  try {
    let endpoint;
    if (data.isCommittee) {
      endpoint = 'http://localhost:3006/api/committee-approvals/committee-delegations/single';
    } else if (data.isProtocol) {
      endpoint = 'http://localhost:3006/api/approvals/delegate-single';
    } else {
      endpoint = 'http://localhost:3006/api/approvals/delegate-single';
    }
    console.log('🔍 Using endpoint:', endpoint);
    
    const requestBody = {
      delegateTo: data.delegateTo,
      notes: data.notes,
      contentId: data.contentId,
      contentType: data.contentType,
      signature: data.senderSignature // توقيع المرسل
    };
    
    console.log('🔍 Request body:', requestBody);
    console.log('🔍 Signature in request:', requestBody.signature ? 'PRESENT' : 'MISSING');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    console.log('🔍 Response from server:', result);
    
    if (result.status === 'success') {
      let message;
      if (data.isProtocol) {
        message = getTranslation('protocol-delegation-request-sent-success');
      } else {
        message = getTranslation('delegation-request-sent-success');
      }
      showToast(message, 'success');
      // تحديث الصفحة أو إعادة تحميل البيانات
      setTimeout(() => {
        if (typeof refreshApprovalsData === 'function') {
          refreshApprovalsData();
        } else {
          window.location.reload();
        }
      }, 1500);
    } else {
      showToast(result.message || getTranslation('delegation-request-failed'), 'error');
      // إعادة تفعيل أزرار الصف في حالة الفشل
      if (data.contentId) {
        enableRowActions(data.contentId);
      }
    }
  } catch (error) {
    console.error('🔍 Error processing single delegation:', error);
    showToast(getTranslation('delegation-request-error'), 'error');
    // إعادة تفعيل أزرار الصف في حالة الخطأ
    if (data.contentId) {
      enableRowActions(data.contentId);
    }
  } finally {
    // إعادة تفعيل جميع الأزرار في حالة النجاح أو الفشل
    const confirmButton = document.querySelector('#delegationConfirmationPopup .btn-primary');
    if (confirmButton) {
      setButtonProcessingState(confirmButton, false);
    }
  }
}

// دالة معالجة التفويض الشامل
async function processBulkDelegation(data) {
  console.log('🔍 processBulkDelegation called with data:', data);
  console.log('🔍 senderSignature in data:', data.senderSignature ? 'PRESENT' : 'MISSING');
  
  try {
    // استخدام endpoint واحد شامل للكل (الموافقات، اللجان، المحاضر)
    const endpoint = 'http://localhost:3006/api/approvals/delegate-all-unified';
    console.log('🔍 Using unified endpoint:', endpoint);
    
    const requestBody = {
      delegateTo: data.delegateTo,
      notes: data.notes,
      signature: data.senderSignature // توقيع المرسل
    };
    
    console.log('🔍 Request body:', requestBody);
    console.log('🔍 Signature in request:', requestBody.signature ? 'PRESENT' : 'MISSING');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    console.log('🔍 Response from server:', result);
    
    if (result.status === 'success') {
      // رسالة موحدة للنجاح
      const message = getTranslation('bulk-delegation-request-sent-success');
      showToast(message, 'success');
      // تحديث الصفحة أو إعادة تحميل البيانات
      setTimeout(() => {
        if (typeof refreshApprovalsData === 'function') {
          refreshApprovalsData();
        } else {
          window.location.reload();
        }
      }, 1500);
    } else {
      showToast(result.message || getTranslation('bulk-delegation-request-failed'), 'error');
      // إعادة تفعيل أزرار الصف في حالة الفشل
      if (data.contentId) {
        enableRowActions(data.contentId);
      }
    }
  } catch (error) {
    console.error('🔍 Error processing bulk delegation:', error);
    showToast(getTranslation('bulk-delegation-request-error'), 'error');
    // إعادة تفعيل أزرار الصف في حالة الخطأ
    if (data.contentId) {
      enableRowActions(data.contentId);
    }
  } finally {
    // إعادة تفعيل جميع الأزرار في حالة النجاح أو الفشل
    const confirmButton = document.querySelector('#delegationConfirmationPopup .btn-primary');
    if (confirmButton) {
      setButtonProcessingState(confirmButton, false);
    }
  }
}

// دالة جديدة لحماية الأزرار من النقر المتكرر
function setButtonProcessingState(button, isProcessing, processingText = null, originalText = null) {
  try {
    if (!button) {
      console.warn('🔍 Button is null in setButtonProcessingState');
      return;
    }
    
    if (isProcessing) {
      // حفظ النص الأصلي إذا لم يتم حفظه من قبل
      if (!originalText && !button.dataset.originalText) {
        button.dataset.originalText = button.innerHTML;
      }
      
      // تعطيل الزر وإظهار حالة المعالجة
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
      button.style.pointerEvents = 'none';
      button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${processingText || 'جاري المعالجة...'}`;
      
      // إضافة مؤشر بصري
      button.classList.add('processing');
      
      // إضافة CSS إضافي لتحسين المظهر
      button.style.transition = 'all 0.3s ease';
      button.style.transform = 'scale(0.98)';
      button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      
      console.log('🔍 Button set to processing state');
    } else {
      // إعادة تفعيل الزر وإعادة النص الأصلي
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.style.pointerEvents = 'auto';
      button.innerHTML = button.dataset.originalText || originalText || button.innerHTML.replace(/<i[^>]*><\/i>\s*/, '');
      
      // إزالة المؤشر البصري
      button.classList.remove('processing');
      
      // إعادة تعيين CSS
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '';
      
      console.log('🔍 Button returned to normal state');
    }
  } catch (error) {
    console.error('🔍 Error in setButtonProcessingState:', error);
  }
}

// دالة لحماية من النقر المتكرر مع timeout
function protectFromDoubleClick(button, processingText = null) {
  try {
    if (!button || button.disabled) {
      console.warn('🔍 Button is null or already disabled');
      return false;
    }
    
    // تعطيل الزر فوراً
    setButtonProcessingState(button, true, processingText);
    
    // إعادة تفعيل الزر بعد 10 ثواني كحد أقصى (زيادة الوقت للسيرفر البطيء)
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }
    
    processingTimeout = setTimeout(() => {
      if (button) {
        setButtonProcessingState(button, false);
        console.log('🔍 Button re-enabled after timeout');
      }
    }, 10000);
    
    console.log('🔍 Button protected from double click');
    return true;
  } catch (error) {
    console.error('🔍 Error in protectFromDoubleClick:', error);
    return false;
  }
}

// دالة لتعطيل جميع أزرار الصف
function disableRowActions(contentId) {
  try {
    const row = document.querySelector(`tr[data-id="${contentId}"]`);
    if (!row) {
      console.warn('🔍 Row not found for contentId:', contentId);
      return;
    }
    
    const actionButtons = row.querySelectorAll('button');
    if (actionButtons.length === 0) {
      console.warn('🔍 No action buttons found in row');
      return;
    }
    
    actionButtons.forEach(button => {
      try {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        button.style.pointerEvents = 'none';
        
        // إضافة مؤشر بصري
        button.classList.add('processing');
        
        // حفظ النص الأصلي
        if (!button.dataset.originalText) {
          button.dataset.originalText = button.innerHTML;
        }
        
        // إضافة نص المعالجة
         button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${getTranslation('processing')}`;

        
        // إضافة CSS إضافي لتحسين المظهر
        button.style.transition = 'all 0.3s ease';
        button.style.transform = 'scale(0.95)';
        button.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        button.style.filter = 'grayscale(30%)';
      } catch (buttonError) {
        console.error('🔍 Error disabling button:', buttonError);
      }
    });
    
    console.log('🔍 Row actions disabled for contentId:', contentId);
  } catch (error) {
    console.error('🔍 Error in disableRowActions:', error);
  }
}

// دالة لإعادة تفعيل جميع أزرار الصف
function enableRowActions(contentId) {
  try {
    const row = document.querySelector(`tr[data-id="${contentId}"]`);
    if (!row) {
      console.warn('🔍 Row not found for contentId:', contentId);
      return;
    }
    
    const actionButtons = row.querySelectorAll('button');
    if (actionButtons.length === 0) {
      console.warn('🔍 No action buttons found in row');
      return;
    }
    
    actionButtons.forEach(button => {
      try {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.style.pointerEvents = 'auto';
        
        // إزالة المؤشر البصري
        button.classList.remove('processing');
        
        // إعادة النص الأصلي
        if (button.dataset.originalText) {
          button.innerHTML = button.dataset.originalText;
        }
        
        // إعادة تعيين CSS
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '';
        button.style.filter = '';
      } catch (buttonError) {
        console.error('🔍 Error enabling button:', buttonError);
      }
    });
    
    console.log('🔍 Row actions enabled for contentId:', contentId);
  } catch (error) {
    console.error('🔍 Error in enableRowActions:', error);
  }
}