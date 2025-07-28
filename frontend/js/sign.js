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

// دالة الترجمة
function getTranslation(key) {
  const translations = {
    'error-loading': 'خطأ في تحميل البيانات',
    'no-documents': 'لا توجد مستندات',
    'accept': 'قبول',
    'reject': 'رفض',
    'accept-message': 'هل أنت متأكد من قبول هذا التفويض؟',
    'reject-message': 'يرجى إدخال سبب الرفض:',
    'reason-required': 'يرجى إدخال سبب الرفض',
    'reject-success': 'تم رفض التفويض بنجاح',
    'error-rejecting': 'خطأ في رفض التفويض'
  };
  
  return translations[key] || key;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Test backend connectivity first
  try {
    const healthRes = await fetch('http://localhost:3006/health');
    if (healthRes.ok) {
      console.log('✅ Backend server is running');
    } else {
      console.error('❌ Backend server returned error:', healthRes.status);
    }
  } catch (err) {
    console.error('❌ Backend server is not reachable:', err);
    showToast('الخادم غير متاح', 'error');
    return;
  }
  
  await checkDelegationStatus();
  loadDelegations();
});

const apiBaseDept = 'http://localhost:3006/api/approvals/proxy';
const apiBaseComm = 'http://localhost:3006/api/committee-approvals/proxy';
const token = localStorage.getItem('token');
let currentUserId = null;
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUserId = payload.id;
    console.log('JWT payload:', payload);
  } catch (e) {
    console.error('فشل استخراج userId من التوكن', e);
  }
}
const currentLang = localStorage.getItem('language') || 'ar';


function getLocalizedName(jsonString) {
  try {
    const obj = JSON.parse(jsonString);
    return obj[currentLang] || obj.ar || obj.en || '';
  } catch (e) {
    // لو مش JSON، رجع النص كما هو
    return jsonString;
  }
}
let selectedContentId = null;
let selectedContentType = null;
let hasShownDelegationPopup = false;

// دالة جديدة لفحص حالة التفويض مباشرة من قاعدة البيانات
async function checkDelegationStatus() {
  const token = localStorage.getItem('token');
  if (!token || !currentUserId) {
    console.log('Token or currentUserId missing:', { token: !!token, currentUserId });
    return;
  }
  
  console.log('Checking delegation status for userId:', currentUserId);
  
  try {
    // 1. فحص التفويض المباشر من جدول active_delegations
    const delegationUrl = `http://localhost:3006/api/users/${currentUserId}/delegation-status`;
    console.log('Calling delegation status URL:', delegationUrl);
    const delegationRes = await fetch(delegationUrl, { 
      headers: authHeaders() 
    });
    
    if (!delegationRes.ok) {
      console.error('❌ Delegation status request failed:', delegationRes.status, delegationRes.statusText);
      const errorText = await delegationRes.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const delegationJson = await delegationRes.json();
    console.log('Delegation status response:', delegationJson);
    
    if (delegationJson.status === 'success' && delegationJson.data && delegationJson.data.delegated_by) {
      console.log('✅ Found direct delegation from user:', delegationJson.data.delegated_by);
      
      // تحقق من سجلات الموافقة قبل عرض البوب أب
      const hasProcessedDelegation = await checkDelegationApprovalLogs(delegationJson.data.delegated_by, 'direct');
      if (!hasProcessedDelegation) {
        // المستخدم مفوض له - عرض بوب أب التفويض المباشر
        await showDirectDelegationPopup(delegationJson.data.delegated_by);
      } else {
        console.log('✅ Direct delegation already processed, skipping popup');
      }
      return;
    } else {
      console.log('❌ No direct delegation found');
    }
    
    // 2. فحص التفويضات المعلقة الموحدة (أقسام ولجان)
    const pendingDelegationsUrl = `http://localhost:3006/api/approvals/pending-delegations-unified/${currentUserId}`;
    console.log('Calling pending delegations unified URL:', pendingDelegationsUrl);
    const pendingDelegationsRes = await fetch(pendingDelegationsUrl, { 
      headers: authHeaders() 
    });
    
    if (!pendingDelegationsRes.ok) {
      console.error('❌ Pending delegations unified request failed:', pendingDelegationsRes.status, pendingDelegationsRes.statusText);
      const errorText = await pendingDelegationsRes.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const pendingDelegationsJson = await pendingDelegationsRes.json();
    console.log('Pending delegations unified response:', pendingDelegationsJson);
    
    if (pendingDelegationsJson.status === 'success' && pendingDelegationsJson.data && pendingDelegationsJson.data.length > 0) {
      console.log('✅ Found pending unified delegations:', pendingDelegationsJson.data.length);
      
      // تحقق من سجلات الموافقة قبل عرض البوب أب
      const latestDelegation = pendingDelegationsJson.data[0]; // أحدث تفويض
      const hasProcessedDelegation = await checkDelegationApprovalLogs(latestDelegation.delegated_by, 'bulk', latestDelegation.id);
      if (!hasProcessedDelegation) {
        // هناك تفويضات معلقة - عرض بوب أب التفويض الجماعي الموحد
        await showBulkDelegationPopup(latestDelegation.id, latestDelegation.delegated_by_name);
      } else {
        console.log('✅ Bulk delegation already processed, skipping popup');
      }
      return;
    } else {
      console.log('❌ No pending unified delegations found');
    }
    
    console.log('🔍 No delegations found for user:', currentUserId);
    
  } catch (err) {
    console.error('خطأ في فحص حالة التفويض:', err);
    if (err.response) {
      console.error('Error response:', await err.response.text());
    }
  }
}

// دالة موحدة للتحقق من سجلات الموافقة للتفويض
async function checkDelegationApprovalLogs(delegatorId, delegationType, delegationId = null) {
  try {
    console.log('🔍 Checking delegation approval logs:', { delegatorId, delegationType, delegationId });
    
    // التحقق من سجلات الموافقة للأقسام
    const deptLogsUrl = `http://localhost:3006/api/approvals/delegation-logs/${currentUserId}/${delegatorId}`;
    const deptLogsRes = await fetch(deptLogsUrl, { headers: authHeaders() });
    
    if (deptLogsRes.ok) {
      const deptLogsJson = await deptLogsRes.json();
      console.log('Department delegation logs:', deptLogsJson);
      
      if (deptLogsJson.status === 'success' && deptLogsJson.data && deptLogsJson.data.length > 0) {
        // تحقق من وجود سجلات مقبولة أو مرفوضة
        const hasProcessedLogs = deptLogsJson.data.some(log => 
          log.status === 'accepted' || log.status === 'rejected' || log.status === 'approved'
        );
        if (hasProcessedLogs) {
          console.log('✅ Found processed department delegation logs');
          return true;
        }
      }
    } else {
      console.log('❌ Department delegation logs request failed:', deptLogsRes.status);
    }
    
    // التحقق من سجلات الموافقة للجان
    const commLogsUrl = `http://localhost:3006/api/committee-approvals/delegation-logs/${currentUserId}/${delegatorId}`;
    const commLogsRes = await fetch(commLogsUrl, { headers: authHeaders() });
    
    if (commLogsRes.ok) {
      const commLogsJson = await commLogsRes.json();
      console.log('Committee delegation logs:', commLogsJson);
      
      if (commLogsJson.status === 'success' && commLogsJson.data && commLogsJson.data.length > 0) {
        // تحقق من وجود سجلات مقبولة أو مرفوضة
        const hasProcessedLogs = commLogsJson.data.some(log => 
          log.status === 'accepted' || log.status === 'rejected' || log.status === 'approved'
        );
        if (hasProcessedLogs) {
          console.log('✅ Found processed committee delegation logs');
          return true;
        }
      }
    } else {
      console.log('❌ Committee delegation logs request failed:', commLogsRes.status);
    }
    
    // التحقق من سجلات الموافقة العامة (approval_logs و committee_approval_logs)
    try {
      const generalLogsUrl = `http://localhost:3006/api/approvals/user-approval-status/${currentUserId}/${delegatorId}`;
      const generalLogsRes = await fetch(generalLogsUrl, { headers: authHeaders() });
      
      if (generalLogsRes.ok) {
        const generalLogsJson = await generalLogsRes.json();
        console.log('General approval logs:', generalLogsJson);
        
        if (generalLogsJson.status === 'success' && generalLogsJson.data && generalLogsJson.data.hasProcessed) {
          console.log('✅ Found processed general approval logs');
          return true;
        }
      }
    } catch (err) {
      console.log('❌ General approval logs request failed:', err);
    }
    
    // التحقق من سجلات active_delegations (إذا كان التفويض لا يزال نشطاً)
    if (delegationType === 'direct') {
      try {
        const activeDelegationUrl = `http://localhost:3006/api/users/${currentUserId}/delegation-status`;
        const activeDelegationRes = await fetch(activeDelegationUrl, { headers: authHeaders() });
        
        if (activeDelegationRes.ok) {
          const activeDelegationJson = await activeDelegationRes.json();
          if (activeDelegationJson.status === 'success' && activeDelegationJson.data && activeDelegationJson.data.delegated_by === delegatorId) {
            console.log('✅ Active delegation still exists, checking for any processed logs...');
            // إذا كان التفويض لا يزال نشطاً، تحقق من وجود أي سجلات معالجة
            return false; // لا تزال بحاجة للمعالجة
          }
        }
      } catch (err) {
        console.log('❌ Error checking active delegation:', err);
      }
    }
    
    console.log('❌ No processed delegation logs found');
    return false;
    
  } catch (err) {
    console.error('خطأ في التحقق من سجلات موافقة التفويض:', err);
    return false;
  }
}

// دالة عرض بوب أب التفويض المباشر
async function showDirectDelegationPopup(delegatorId) {
  if (hasShownDelegationPopup) return;
  hasShownDelegationPopup = true;
  
  try {
    // جلب اسم المفوض
    const userRes = await fetch(`http://localhost:3006/api/users/${delegatorId}`, { headers: authHeaders() });
    const userJson = await userRes.json();
    const delegatorName = userJson.data?.name || userJson.data?.username || 'المفوض';
    
    showDelegationPopup(
      `${delegatorName} قام بتفويضك بالنيابة عنه في جميع ملفاته (أقسام ولجان).`,
      async () => {
        await processDirectDelegationUnified(delegatorId, 'accept');
      },
      async () => {
        await processDirectDelegationUnified(delegatorId, 'reject');
      }
    );
  } catch (err) {
    console.error('خطأ في جلب بيانات المفوض:', err);
  }
}

// دالة عرض بوب أب التفويض الجماعي الموحد
async function showBulkDelegationPopup(delegationId, delegatorName) {
  if (hasShownDelegationPopup) return;
  hasShownDelegationPopup = true;
  
  showDelegationPopup(
    `${delegatorName} قام بتفويضك بالنيابة عنه في جميع ملفاته (أقسام ولجان).`,
    async () => {
      await processBulkDelegationUnified(delegationId, 'accept');
    },
    async () => {
      await processBulkDelegationUnified(delegationId, 'reject');
    }
  );
}

// دالة موحدة لعرض بوب أب التفويض
function showDelegationPopup(message, onAccept, onReject) {
  const overlay = document.createElement('div');
  overlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';
  
  const box = document.createElement('div');
  box.style = 'background:#fff;padding:32px 24px;border-radius:12px;max-width:400px;text-align:center;box-shadow:0 2px 16px #0002;';
  box.innerHTML = `<div style='font-size:1.2rem;margin-bottom:18px;'>${message}<br>هل توافق على التفويض؟</div>`;
  
  const btnAccept = document.createElement('button');
  btnAccept.textContent = 'موافقة';
  btnAccept.style = 'background:#1eaa7c;color:#fff;padding:8px 24px;border:none;border-radius:6px;font-size:1rem;margin:0 8px;cursor:pointer;';
  
  const btnReject = document.createElement('button');
  btnReject.textContent = 'رفض';
  btnReject.style = 'background:#e53e3e;color:#fff;padding:8px 24px;border:none;border-radius:6px;font-size:1rem;margin:0 8px;cursor:pointer;';
  
  btnAccept.onclick = async () => {
    try {
      await onAccept();
      showToast('تم قبول التفويض بنجاح', 'success');
    } catch (err) {
      showToast('خطأ في قبول التفويض', 'error');
    }
    document.body.removeChild(overlay);
  };
  
  btnReject.onclick = async () => {
    try {
      await onReject();
      showToast('تم رفض التفويض', 'success');
    } catch (err) {
      showToast('خطأ في رفض التفويض', 'error');
    }
    document.body.removeChild(overlay);
  };
  
  box.appendChild(btnAccept);
  box.appendChild(btnReject);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// دالة معالجة التفويض المباشر الموحد
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
    console.log('✅ Direct delegation unified result:', json);
  } catch (err) {
    console.error('خطأ في معالجة التفويض المباشر الموحد:', err);
    throw err;
  }
}

// دالة معالجة التفويض الجماعي الموحد
async function processBulkDelegationUnified(delegationId, action) {
  try {
    const res = await fetch('http://localhost:3006/api/approvals/bulk-delegation-unified/process', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ delegationId, action })
    });
    const json = await res.json();
    if (json.status !== 'success') {
      throw new Error(json.message);
    }
    console.log('✅ Bulk delegation unified result:', json);
  } catch (err) {
    console.error('خطأ في معالجة التفويض الجماعي الموحد:', err);
    throw err;
  }
}

async function loadDelegations() {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('يجب تسجيل الدخول أولاً', 'error');
    return;
  }
  const tbody = document.querySelector('.proxy-table tbody');
  tbody.innerHTML = '';

  try {
    const [deptRes, commRes] = await Promise.all([
      fetch(apiBaseDept, { headers: authHeaders() }),
      fetch(apiBaseComm, { headers: authHeaders() })
    ]);
    const deptJson = await deptRes.json();
    const commJson = await commRes.json();

    if (deptJson.status !== 'success' || commJson.status !== 'success') {
      throw new Error(getTranslation('error-loading'));
    }

    const deptData = deptJson.data.map(d => ({ ...d, type: 'dept' }));
    const commData = commJson.data.map(d => ({ ...d, type: 'committee' }));
    const allData = [...deptData, ...commData];

    // طباعة بيانات التفويضات في الكونسول للتشخيص
    console.log('allData:', allData);

    if (allData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">${getTranslation('no-documents')}</td></tr>`;
      return;
    }

    allData.forEach(d => {
      // استخدم proxy_status إذا وجدت، وإلا status
      const status = d.proxy_status || d.status;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(getLocalizedName(d.title))}</td>
        <td class="col-signer">
          ${escapeHtml(d.delegated_by_name || d.delegated_by || '—')}
        </td>
        <td class="col-action">
          <button class="btn-accept" data-id="${d.id}" data-type="${d.type}" data-delegatedby="${d.delegated_by}">${getTranslation('accept')}</button>
          <button class="btn-reject" data-id="${d.id}" data-type="${d.type}">${getTranslation('reject')}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // زر القبول
    document.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        const contentId = btn.dataset.id;
        const contentType = btn.dataset.type;
        const page = 'approvals-recived.html';

        showPopup(getTranslation('accept-message'), async () => {
          try {
            const endpointRoot = (contentType === 'committee') ? 'committee-approvals' : 'approvals';
            const res = await fetch(`http://localhost:3006/api/${endpointRoot}/proxy/accept/${contentId}`, {
              method: 'POST',
              headers: authHeaders()
            });
            const json = await res.json();
            if (json.status === 'success') {
              window.location.href = `/frontend/html/${page}?id=${contentId}`;
            } else {
              showToast(json.message || 'خطأ أثناء قبول التفويض', 'error');
            }
          } catch (err) {
            showToast('خطأ أثناء قبول التفويض', 'error');
          }
        });
      });
    });

    // زر الرفض
    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedContentId = btn.dataset.id;
        selectedContentType = btn.dataset.type;

        showPopup(
          getTranslation('reject-message'),
          submitReject,
          true
        );
      });
    });

  } catch (err) {
    console.error(err);
    showToast(getTranslation('error-loading'), 'error');
  }
}

function authHeaders() {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('يجب تسجيل الدخول أولاً', 'error');
    // يمكنك هنا إعادة التوجيه: window.location.href = '/frontend/html/login.html';
    return {};
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function closeRejectModal() {
  const overlay = document.getElementById('popupOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function submitReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) return showToast(getTranslation('reason-required'), 'error');

  const endpointRoot = (selectedContentType === 'dept')
    ? 'approvals'
    : 'committee-approvals';

  try {
    const res = await fetch(`http://localhost:3006/api/${endpointRoot}/${selectedContentId}/approve`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        approved: false,
        signature: null,
        electronic_signature: false,
        notes: reason
      })
    });
    const json = await res.json();
    if (json.status === 'success') {
      showToast(getTranslation('reject-success'), 'success');
      loadDelegations();
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    console.error(err);
    showToast(getTranslation('error-rejecting'), 'error');
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showPopup(message, onConfirm, showReason = false) {
  const overlay = document.getElementById('popupOverlay');
  const msgEl = document.getElementById('popupMessage');
  const reasonEl = document.getElementById('rejectReason');
  const btnConfirm = document.getElementById('popupConfirm');
  const btnCancel = document.getElementById('popupCancel');

  msgEl.textContent = message;
  reasonEl.style.display = showReason ? 'block' : 'none';

  btnConfirm.replaceWith(btnConfirm.cloneNode(true));
  btnCancel.replaceWith(btnCancel.cloneNode(true));

  document.getElementById('popupConfirm').addEventListener('click', () => {
    overlay.style.display = 'none';
    onConfirm();
  });
  document.getElementById('popupCancel').addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  overlay.style.display = 'flex';
}

function setupSignatureCanvas() {
  canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  document.getElementById('btnClear').addEventListener('click', () => {
    clearCanvas();
  });

  document.getElementById('btnConfirm').addEventListener('click', async () => {
    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      // ... existing code ...
    } catch (err) {
      // console.error(err);
      showToast('خطأ أثناء إرسال التوقيع.', 'error');
    }
  });
}
