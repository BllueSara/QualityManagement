// approvals-recived.js
let filteredItems = [];

const apiBase = 'http://localhost:3006/api';
const token = localStorage.getItem('token');
let permissionsKeys = [];
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
    filesList = '<p class="files-summary">تفويض شامل لجميع الملفات المعلقة</p>';
  } else {
    filesList = '<div class="files-list">';
    files.forEach(file => {
      filesList += `<div class="file-item">
        <span class="file-name">${file.title || file.name}</span>
        <span class="file-type">${file.type === 'department' ? 'قسم' : 'لجنة'}</span>
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
    <h3>اقرار التفويض</h3>
    <button class="close-btn" onclick="closeDelegationConfirmationPopup()">&times;</button>
  `;
  
  // Body
  const body = document.createElement('div');
  body.className = 'delegation-body';
  
  // Delegator info
  const delegatorInfoDiv = document.createElement('div');
  delegatorInfoDiv.className = 'delegator-info';
  delegatorInfoDiv.innerHTML = `
    <h4>معلومات الموظف المفوض</h4>
    <div class="info-row">
      <span class="label">الاسم الكامل:</span>
      <span class="value">${delegatorInfo.fullName}</span>
    </div>
    <div class="info-row">
      <span class="label">رقم الهوية:</span>
      <span class="value">${delegatorInfo.idNumber}</span>
    </div>
  `;
  
  // Delegate info
  const delegateInfoDiv = document.createElement('div');
  delegateInfoDiv.className = 'delegate-info';
  delegateInfoDiv.innerHTML = `
    <h4>معلومات الموظف المفوض له</h4>
    <div class="info-row">
      <span class="label">الاسم الكامل:</span>
      <span class="value">${delegateInfo.fullName}</span>
    </div>
    <div class="info-row">
      <span class="label">رقم الهوية:</span>
      <span class="value">${delegateInfo.idNumber}</span>
    </div>
  `;
  
  // Delegation details
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'delegation-details';
  detailsDiv.innerHTML = `
    <h4>تفاصيل التفويض</h4>
    <div class="delegation-type">
      <span class="label">نوع التفويض:</span>
      <span class="value">${isBulk ? 'تفويض شامل' : 'تفويض فردي'}</span>
    </div>
    ${filesList}
  `;
  
  // Delegation statement
  const statementDiv = document.createElement('div');
  statementDiv.className = 'delegation-statement';
  statementDiv.innerHTML = `
    <p class="statement-text">
      أقر بأنني أفوض الموظف <strong>${delegateInfo.fullName}</strong> 
      ذو رقم الهوية <strong>${delegateInfo.idNumber}</strong> 
      بالتوقيع بالنيابة عني على ${isBulk ? 'جميع الملفات المعلقة' : 'الملفات المحددة'}.
    </p>
  `;
  
  // Signature section - إضافة كانفاس للتوقيع
  const signatureSection = document.createElement('div');
  signatureSection.className = 'delegation-signature-section';
  signatureSection.innerHTML = `
    <h4>توقيع المرسل</h4>
    <div class="signature-canvas-container">
      <div class="signature-controls" style="margin-top: 10px;">
        <button type="button" onclick="clearSignatureCanvas()" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-right: 5px; cursor: pointer;">
          مسح التوقيع
        </button>
      </div>
    </div>
  `;
  
  // Footer
  const footer = document.createElement('div');
  footer.className = 'delegation-footer';
  footer.innerHTML = `
    <button class="btn btn-danger" onclick="rejectDelegation()">رفض التفويض</button>
    <button class="btn btn-secondary" onclick="closeDelegationConfirmationPopup()">إلغاء</button>
    <button class="btn btn-primary" onclick="confirmDelegation()">قبول التفويض</button>
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
  const popup = document.getElementById('delegationConfirmationPopup');
  if (popup) {
    popup.remove();
  }
  
  // إعادة تعيين متغيرات الكانفاس النشط
  activeCanvas = null;
  activeCtx = null;
  console.log('🔍 Delegation confirmation popup closed, activeCanvas reset');
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
  
  if (!pendingDelegationData) {
    showToast('خطأ: لا توجد بيانات تفويض', 'error');
    return;
  }
  
  // الحصول على توقيع المرسل من الكانفاس
  const senderSignature = getSignatureFromCanvas();
  console.log('🔍 senderSignature obtained:', senderSignature ? 'YES' : 'NO');
  
  if (!senderSignature) {
    showToast('يرجى التوقيع أولاً كمرسل للتفويض', 'error');
    return;
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
}

function rejectDelegation() {
  if (!pendingDelegationData) {
    showToast('خطأ: لا توجد بيانات تفويض', 'error');
    return;
  }
  
  // إغلاق البوب أب
  closeDelegationConfirmationPopup();
  
  // مسح البيانات المؤقتة
  pendingDelegationData = null;
  
  showToast('تم رفض التفويض', 'info');
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
      showToast('تم قبول التفويض بنجاح', 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(result.message || 'فشل في قبول التفويض', 'error');
    }
  } catch (error) {
    console.error('Error accepting single department delegation:', error);
    showToast('خطأ في قبول التفويض', 'error');
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
      showToast('تم قبول التفويض بنجاح', 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || 'فشل في قبول التفويض', 'error');
    }
  } catch (error) {
    console.error('Error accepting single committee delegation:', error);
    showToast('خطأ في قبول التفويض', 'error');
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
      showToast('تم قبول التفويض الشامل بنجاح', 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || 'فشل في قبول التفويض الشامل', 'error');
    }
  } catch (error) {
    console.error('Error accepting bulk delegation:', error);
    showToast('خطأ في قبول التفويض الشامل', 'error');
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
      showToast('تم رفض التفويض بنجاح', 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || 'فشل في رفض التفويض', 'error');
    }
  } catch (error) {
    console.error('Error rejecting single department delegation:', error);
    showToast('خطأ في رفض التفويض', 'error');
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
      showToast('تم رفض التفويض بنجاح', 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || 'فشل في رفض التفويض', 'error');
    }
  } catch (error) {
    console.error('Error rejecting single committee delegation:', error);
    showToast('خطأ في رفض التفويض', 'error');
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
      showToast('تم رفض التفويض الشامل بنجاح', 'success');
      closeDelegationConfirmationPopup();
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      showToast(result.message || 'فشل في رفض التفويض الشامل', 'error');
    }
  } catch (error) {
    console.error('Error rejecting bulk delegation:', error);
    showToast('خطأ في رفض التفويض الشامل', 'error');
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
    console.error('خطأ في معالجة التفويض المباشر الموحد:', err);
    throw err;
  }
}

// دوال عرض بوب أب اقرار التفويض
async function showSingleDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {
  try {
    // التحقق من صحة البيانات قبل الإرسال
    if (!delegateTo) {
      showToast('خطأ: المستخدم المفوض له غير محدد', 'error');
      return;
    }
    
    if (!contentId) {
      showToast('خطأ: معرف الملف غير محدد', 'error');
      return;
    }
    
    if (!contentType) {
      showToast('خطأ: نوع المحتوى غير محدد', 'error');
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
      showToast(result.message || 'فشل في جلب بيانات التفويض', 'error');
    }
  } catch (error) {
    console.error('Error showing single delegation confirmation:', error);
    showToast('خطأ في عرض اقرار التفويض', 'error');
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
      showToast(result.message || 'فشل في جلب بيانات التفويض الشامل', 'error');
    }
  } catch (error) {
    console.error('Error showing bulk delegation confirmation:', error);
    showToast('خطأ في عرض اقرار التفويض الشامل', 'error');
  }
}

async function showSingleCommitteeDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {
  try {
    // التحقق من صحة البيانات قبل الإرسال
    if (!delegateTo) {
      showToast('خطأ: المستخدم المفوض له غير محدد', 'error');
      return;
    }
    
    if (!contentId) {
      showToast('خطأ: معرف الملف غير محدد', 'error');
      return;
    }
    
    if (!contentType) {
      showToast('خطأ: نوع المحتوى غير محدد', 'error');
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
      showToast(result.message || 'فشل في جلب بيانات التفويض', 'error');
    }
  } catch (error) {
    console.error('Error showing single committee delegation confirmation:', error);
    showToast('خطأ في عرض اقرار التفويض', 'error');
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
      showToast(result.message || 'فشل في جلب بيانات التفويض الشامل للجان', 'error');
    }
  } catch (error) {
    console.error('Error showing bulk committee delegation confirmation:', error);
    showToast('خطأ في عرض اقرار التفويض الشامل للجان', 'error');
  }
}
// دالة إظهار التوست - خارج DOMContentLoaded لتكون متاحة في كل مكان
function showToast(message, type = 'info', duration = 3000) {
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
}

// جلب صلاحيات المستخدم
async function fetchPermissions() {
  if (!token) return;
  const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
  const userId = payload.id, role = payload.role;
  if (role === 'admin') {
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
  const modal = getCachedElement(modalId);
  if (modal) {
    // إغلاق فوري بدون تأخير
    modal.style.display = 'none';
    modal.style.opacity = '1';
    modal.style.transition = '';
    
    // تنظيف الذاكرة المؤقتة
    modalCache.delete(modalId);
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
    btnAll.innerHTML = `<i class="fas fa-user-friends"></i> ${getTranslation('delegate-all') || 'تفويض جميع الملفات بالنيابة'}`;
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
      document.getElementById('delegateUser').innerHTML = '<option value="" disabled selected>' + (getTranslation('select-user') || 'اختر المستخدم') + '</option>';
      document.getElementById('delegateNotes').value = '';
      openModal('delegateModal');
      loadDepartments();
      document.getElementById('delegateNotes').placeholder = getTranslation('notes-bulk') || 'ملاحظات (تنطبق على جميع الملفات)';
    };
  }

  try {
    const deptResp      = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    const commResp      = await fetchJSON(`${apiBase}/committee-approvals/assigned-to-me`);
    const combined      = [...(deptResp.data||[]), ...(commResp.data||[])];
    const uniqueMap     = new Map();
    combined.forEach(item => uniqueMap.set(item.id, item));
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
      const type     = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
      const endpoint = type === 'committee' ? 'committee-approvals' : 'approvals';
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
        showToast(getTranslation('error-sending'), 'error');
      }
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
    const localizedTitle = getLocalizedName(i.title).toLowerCase();
    const localizedSource = getLocalizedName(i.source_name).toLowerCase();
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
    tr.dataset.status = item.approval_status;
    tr.dataset.source = item.source_name;
    tr.dataset.type   = item.type;

    let actions = "";
    if (item.approval_status === 'pending') {
      actions += `<button class="btn-sign"><i class="fas fa-user-check"></i> ${getTranslation('sign')}</button>`;
      actions += `<button class="btn-delegate"><i class="fas fa-user-friends"></i> ${getTranslation('delegate')}</button>`;
      actions += `<button class="btn-qr"><i class="fas fa-qrcode"></i> ${getTranslation('electronic')}</button>`;
      actions += `<button class="btn-reject"><i class="fas fa-times"></i> ${getTranslation('reject')}</button>`;
      actions += `<button class="btn-preview"><i class="fas fa-eye"></i> ${getTranslation('preview')}</button>`;
    }
    // إضافة زر تتبع الطلب لجميع الحالات
    actions += `<button class="btn-track" data-id="${item.id}" data-type="${item.type}">${getTranslation('track')}</button>`;

    const contentType = item.type === 'committee'
      ? getTranslation('committee-file')
      : getTranslation('department-report');

    // Debug: طباعة البيانات للتحقق
    console.log('Item data:', item);
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
    
    // عرض تواريخ الملف ونوع القسم فقط لملفات الأقسام
    let dateRange = '-';
    let departmentDisplay = '-';
    
    if (item.type !== 'committee') {
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
        const id = target.closest('tr').dataset.id;
        console.log('🔍 Opening signature modal for id:', id);
        openSignatureModal(id);
        return;
      }
      
      // زر التفويض
      if (target.closest('.btn-delegate')) {
        console.log('🔍 Delegation button clicked!');
        isBulkDelegation = false;
        selectedContentId = target.closest('tr').dataset.id;
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
        selectedContentId = target.closest('tr').dataset.id;
        openModal('qrModal');
        return;
      }
      
      // زر الرفض
      if (target.closest('.btn-reject')) {
        selectedContentId = target.closest('tr').dataset.id;
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
  const item = allItems.find(i => i.id == itemId);

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
    await fetchJSON(`${apiBase}/contents/log-view`, {
      method: 'POST',
      body: JSON.stringify({
        contentId: numericItemId,
        contentType: item.type || 'department',
        contentTitle: item.title,
        sourceName: item.source_name,
        folderName: item.folder_name || item.folderName || ''
      })
    });
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
    // لجلب سجل اعتماد اللجنة
    const res = await fetch(`${apiBase}/committee-approvals/${cleanId}/approvals`, {
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
    const contentType = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
    const endpoint = contentType === 'committee' ? 'committee-approvals' : 'approvals';
    let approvalLog = await fetchApprovalLog(selectedContentId, contentType);
    const payload = {
      approved: true,
      signature: null,
      electronic_signature: true,
      notes: ''
    };
    const tokenPayload = JSON.parse(atob(token.split('.')[1] || '{}'));
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
      showToast(getTranslation('error-sending'), 'error');
    }
  });
}

// 3. تعديل زر التوقيع اليدوي (التوقيع بالرسم)
function setupSignatureModal() {
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
  
  let drawing = false;
  
  window.addEventListener('resize', resizeCanvas);
  
  // إعداد التبويبات
  setupSignatureTabs();
  
  // إعداد رفع الصور
  setupImageUpload();
  
  function getPos(e) {
    const rect = activeCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
  
  activeCanvas.addEventListener('mousedown', e => {
    drawing = true;
    const pos = getPos(e);
    activeCtx.beginPath();
    activeCtx.moveTo(pos.x, pos.y);
  });
  activeCanvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const pos = getPos(e);
    activeCtx.lineTo(pos.x, pos.y);
    activeCtx.stroke();
  });
  activeCanvas.addEventListener('mouseup', () => {
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = activeCanvas.toDataURL('image/png');
  });
  activeCanvas.addEventListener('mouseleave', () => drawing = false);
  activeCanvas.addEventListener('touchstart', e => {
    drawing = true;
    const pos = getPos(e);
    activeCtx.beginPath();
    activeCtx.moveTo(pos.x, pos.y);
  });
  activeCanvas.addEventListener('touchmove', e => {
    if (!drawing) return;
    const pos = getPos(e);
    activeCtx.lineTo(pos.x, pos.y);
    activeCtx.stroke();
  });
  activeCanvas.addEventListener('touchend', () => {
    drawing = false;
    // تحديث التوقيع الحالي عند الانتهاء من الرسم
    currentSignature = activeCanvas.toDataURL('image/png');
  });
  
  document.getElementById('btnClear').addEventListener('click', () => {
    clearCanvas();
    currentSignature = null;
  });
  
  document.getElementById('btnCancelSignature').addEventListener('click', () => {
    closeSignatureModal();
  });
  
  document.getElementById('btnConfirmSignature').addEventListener('click', async () => {
    // التحقق من وجود توقيع
    if (!currentSignature) {
      showToast(getTranslation('no-signature') || 'يرجى إضافة توقيع أولاً', 'error');
      return;
    }
    
    const contentType = document.querySelector(`tr[data-id="${selectedContentId}"]`).dataset.type;
    const endpoint = contentType === 'committee' ? 'committee-approvals' : 'approvals';
    let approvalLog = await fetchApprovalLog(selectedContentId, contentType);
    const payload = {
      approved: true,
      signature: currentSignature,
      notes: ''
    };
    const tokenPayload = JSON.parse(atob(token.split('.')[1] || '{}'));
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
      showToast(getTranslation('error-sending'), 'error');
    }
  });
}

// إعداد التبويبات
function setupSignatureTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // إزالة الفئة النشطة من جميع التبويبات
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // إضافة الفئة النشطة للتبويب المحدد
      btn.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
      
      // إعادة تعيين التوقيع الحالي
      currentSignature = null;
    });
  });
}

// إعداد رفع الصور
function setupImageUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('signatureFile');
  const uploadPreview = document.getElementById('uploadPreview');
  const previewImage = document.getElementById('previewImage');
  const btnRemoveImage = document.getElementById('btnRemoveImage');
  
  // النقر على منطقة الرفع
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  // سحب وإفلات الملفات
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
  
  // اختيار الملف من input
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });
  
  // إزالة الصورة
  btnRemoveImage.addEventListener('click', () => {
    uploadPreview.style.display = 'none';
    uploadArea.style.display = 'block';
    fileInput.value = '';
    currentSignature = null;
  });
  
  function handleFileSelect(file) {
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
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // رسم الصورة على الكانفاس
        ctx.drawImage(img, 0, 0, width, height);
        
        // تحويل إلى base64
        currentSignature = canvas.toDataURL('image/png');
        
        // عرض المعاينة
        previewImage.src = currentSignature;
        uploadArea.style.display = 'none';
        uploadPreview.style.display = 'block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
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
      const userId = document.getElementById('delegateUser').value;
      const notes = document.getElementById('delegateNotes').value;
      if (!userId) return showToast(getTranslation('please-select-user'), 'warning');
      
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
          showToast(getTranslation('error-sending') || 'حدث خطأ أثناء عرض اقرار التفويض الشامل', 'error');
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
          showToast('خطأ: لم يتم العثور على الملف المحدد', 'error');
          return;
        }
        
        const contentType = row.dataset.type;
        console.log('🔍 contentType from dataset:', contentType);
        console.log('🔍 selectedContentId:', selectedContentId);
        
        // التحقق من صحة البيانات
        if (!contentType) {
          console.error('🔍 contentType is missing or undefined');
          showToast('خطأ: نوع المحتوى غير محدد', 'error');
          return;
        }
        
        if (!selectedContentId) {
          console.error('🔍 selectedContentId is missing or undefined');
          showToast('خطأ: معرف الملف غير محدد', 'error');
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
          } else {
            // تفويض قسم فردي
            console.log('🔍 Showing single department delegation confirmation');
            await showSingleDelegationConfirmation(userId, selectedContentId, contentType, notes);
          }
        } catch (err) {
          console.error('Failed to show delegation confirmation:', err);
          showToast(getTranslation('error-sending') || 'حدث خطأ أثناء عرض اقرار التفويض', 'error');
        }
      }
      isBulkDelegation = false;
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
            showToast(result.message || getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
          }
          refreshApprovalsData();
        } catch (err) {
          console.error('Accept all delegations error:', err);
          showToast(getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
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
          showToast(result.message || getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
        }
        refreshApprovalsData();
      }).catch((err) => {
        console.error('Accept all delegations error:', err);
        showToast(getTranslation('accept-all-proxy-error') || 'حدث خطأ أثناء قبول جميع التفويضات', 'error');
      });
    }
  }
}

// دالة مسح التوقيع
function clearCanvas() {
  if (activeCtx && activeCanvas) {
    activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
  }
}

// دالة تغيير حجم الكانفس
function resizeCanvas() {
  if (!activeCanvas) return;
  const wrapper = activeCanvas.parentElement;
  if (!wrapper) return; // إضافة فحص إضافي لتجنب الخطأ
  const rect = wrapper.getBoundingClientRect();
  activeCanvas.width = rect.width;
  activeCanvas.height = rect.height;
  activeCtx.lineWidth = 2;
  activeCtx.lineCap = 'round';
  activeCtx.strokeStyle = '#000';
}

// دالة فتح مودال التوقيع
function openSignatureModal(contentId) {
  selectedContentId = contentId;
  const modal = document.getElementById('signatureModal');
  modal.style.display = 'flex';
  
  // إعادة تعيين التوقيع الحالي
  currentSignature = null;
  
  // إعادة تعيين التبويبات
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  
  // تفعيل تبويب التوقيع المباشر افتراضياً
  document.querySelector('[data-tab="draw"]').classList.add('active');
  document.getElementById('draw-tab').classList.add('active');
  
  // إعادة تعيين منطقة رفع الصور
  const uploadArea = document.getElementById('uploadArea');
  const uploadPreview = document.getElementById('uploadPreview');
  if (uploadArea && uploadPreview) {
    uploadArea.style.display = 'block';
    uploadPreview.style.display = 'none';
  }
  
  // تعيين الكانفاس النشط للمودال الرئيسي
  setTimeout(() => {
    // التأكد من أن الكانفاس الرئيسي هو النشط
    const mainCanvas = document.getElementById('mainSignatureCanvas');
    if (mainCanvas) {
      activeCanvas = mainCanvas;
      activeCtx = activeCanvas.getContext('2d');
      console.log('🔍 Main signature modal opened, activeCanvas set to:', activeCanvas.id);
    }
    resizeCanvas();
    clearCanvas();
  }, 50);
}

// دالة إغلاق مودال التوقيع
function closeSignatureModal() {
  const modal = document.getElementById('signatureModal');
  if (modal) {
    // إغلاق فوري بدون تأخير
    modal.style.display = 'none';
    modal.style.opacity = '1';
    modal.style.transition = '';
    clearCanvas();
    
    // إعادة تعيين متغيرات الكانفاس النشط
    activeCanvas = null;
    activeCtx = null;
    console.log('🔍 Main signature modal closed, activeCanvas reset');
  }
}

// دالة لتحديث البيانات بدلاً من إعادة تحميل الصفحة
async function refreshApprovalsData() {
  try {
    
    const deptResp = await fetchJSON(`${apiBase}/approvals/assigned-to-me`);
    const commResp = await fetchJSON(`${apiBase}/committee-approvals/assigned-to-me`);
    const combined = [...(deptResp.data||[]), ...(commResp.data||[])];
    const uniqueMap = new Map();
    combined.forEach(item => uniqueMap.set(item.id, item));
    allItems = Array.from(uniqueMap.values());
    filteredItems = allItems;

    await setupFilters(allItems);
    renderApprovals(filteredItems);
    
  } catch (err) {
    console.error("Error refreshing approvals:", err);
    showToast(getTranslation('error-refreshing') || 'حدث خطأ أثناء تحديث البيانات', 'error');
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
  if (!elementCache.has(id)) {
    elementCache.set(id, document.getElementById(id));
  }
  return elementCache.get(id);
}

// دالة محسنة لإغلاق المودال
function closeModal(modalId) {
  const modal = getCachedElement(modalId);
  if (modal) {
    // إغلاق فوري بدون تأخير
    modal.style.display = 'none';
    modal.style.opacity = '1';
    modal.style.transition = '';
    
    // تنظيف الذاكرة المؤقتة
    modalCache.delete(modalId);
  }
}

// دالة محسنة لفتح المودال
function openModal(modalId) {
  console.log('🔍 openModal called with modalId:', modalId);
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
    const endpoint = data.isCommittee ? 'http://localhost:3006/api/committee-approvals/committee-delegations/single' : 'http://localhost:3006/api/approvals/delegate-single';
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
      showToast('تم إرسال طلب التفويض بنجاح', 'success');
      // تحديث الصفحة أو إعادة تحميل البيانات
      setTimeout(() => {
        if (typeof refreshApprovalsData === 'function') {
          refreshApprovalsData();
        } else {
          window.location.reload();
        }
      }, 1500);
    } else {
      showToast(result.message || 'فشل إرسال طلب التفويض', 'error');
    }
  } catch (error) {
    console.error('🔍 Error processing single delegation:', error);
    showToast('خطأ في إرسال طلب التفويض', 'error');
  }
}

// دالة معالجة التفويض الشامل
async function processBulkDelegation(data) {
  console.log('🔍 processBulkDelegation called with data:', data);
  console.log('🔍 senderSignature in data:', data.senderSignature ? 'PRESENT' : 'MISSING');
  
  try {
    const endpoint = data.isCommittee ? 'http://localhost:3006/api/committee-approvals/committee-delegations/bulk' : 'http://localhost:3006/api/approvals/delegate-all-unified';
    console.log('🔍 Using endpoint:', endpoint);
    
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
      const message = data.isCommittee ? 'تم إرسال طلب التفويض الشامل للجان بنجاح' : 'تم إرسال طلب التفويض الشامل بنجاح';
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
      showToast(result.message || 'فشل إرسال طلب التفويض الشامل', 'error');
    }
  } catch (error) {
    console.error('🔍 Error processing bulk delegation:', error);
    showToast('خطأ في إرسال طلب التفويض الشامل', 'error');
  }
}