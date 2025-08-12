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

// تم إزالة دالة الترجمة المكررة - تستخدم دالة الترجمة من language.js

document.addEventListener('DOMContentLoaded', async () => {
  // إعادة تعيين المتغير عند تحميل الصفحة
  hasShownDelegationPopup = false;

  // ترك قائمة التفويضات المعالجة كما هي حتى لا تتكرر البوب أب بعد القبول/الرفض
  localStorage.removeItem('lastDelegationCheck');

  // التأكد من أن currentUserId تم تعيينه
  if (!currentUserId) {
    console.error('❌ currentUserId is not set');
    showToast('خطأ في تحديد هوية المستخدم', 'error');
    return;
  }

  // Test backend connectivity first
  try {
    const healthRes = await fetch('http://10.99.28.23:3006/health');
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

  // طباعة currentUserId للتشخيص
  console.log('🔍 Current user ID:', currentUserId);

  // فحص تشخيصي للتفويضات
  try {
    const debugRes = await fetch(`http://10.99.28.23:3006/api/approvals/debug-delegations/${currentUserId}`, {
      headers: authHeaders()
    });
    if (debugRes.ok) {
      const debugData = await debugRes.json();
      console.log('🔍 DEBUG: All delegations for user:', debugData);
    }
  } catch (err) {
    console.error('❌ Debug request failed:', err);
  }

  await checkDelegationStatus();
  await checkPendingDelegationConfirmations(); // فحص التفويضات المعلقة لعرض النوافذ المنبثقة
  loadDelegations();
});

const apiBaseDept = 'http://10.99.28.23:3006/api/approvals/proxy';
const apiBaseComm = 'http://10.99.28.23:3006/api/committee-approvals/proxy';
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
// const currentLang = localStorage.getItem('language') || 'ar'; // تم إزالة التصريح المكرر - موجود في language.js

// متغير عام لتخزين بيانات التفويض الحالي للمفوض له
let currentDelegationData = null;


function getLocalizedName(jsonString) {
  try {
    const obj = JSON.parse(jsonString);
    const lang = localStorage.getItem('language') || 'ar';
    return obj[lang] || obj.ar || obj.en || '';
  } catch (e) {
    // لو مش JSON، رجع النص كما هو
    return jsonString;
  }
}
let selectedContentId = null;
let selectedContentType = null;
let selectedDelegationType = null;
let hasShownDelegationPopup = false;

// دالة للتحقق من التفويضات الفردية المعلقة (ملف واحد فقط) - بدون عرض بوب أب
async function checkSingleDelegations() {
  try {
    console.log('🔍 Checking single delegations for userId:', currentUserId);

    // فحص التفويضات الفردية للأقسام
    const deptSingleDelegationsUrl = `http://10.99.28.23:3006/api/approvals/single-delegations/${currentUserId}`;
    const deptSingleRes = await fetch(deptSingleDelegationsUrl, { headers: authHeaders() });

    if (deptSingleRes.ok) {
      const deptSingleJson = await deptSingleRes.json();
      console.log('Department single delegations:', deptSingleJson);

      if (deptSingleJson.status === 'success' && deptSingleJson.data && deptSingleJson.data.length > 0) {
        console.log('✅ Found single department delegations:', deptSingleJson.data.length);
        return true;
      }
    }

    // فحص التفويضات الفردية للجان
    const commSingleDelegationsUrl = `http://10.99.28.23:3006/api/committee-approvals/single-delegations/${currentUserId}`;
    const commSingleRes = await fetch(commSingleDelegationsUrl, { headers: authHeaders() });

    if (commSingleRes.ok) {
      const commSingleJson = await commSingleRes.json();
      console.log('Committee single delegations:', commSingleJson);

      if (commSingleJson.status === 'success' && commSingleJson.data && commSingleJson.data.length > 0) {
        console.log('✅ Found single committee delegations:', commSingleJson.data.length);
        return true;
      }
    }

    // فحص التفويضات الفردية للمحاضر
    const protSingleDelegationsUrl = `http://10.99.28.23:3006/api/protocols/single-delegations/${currentUserId}`;
    const protSingleRes = await fetch(protSingleDelegationsUrl, { headers: authHeaders() });
    if (protSingleRes.ok) {
      const protSingleJson = await protSingleRes.json();
      console.log('Protocol single delegations:', protSingleJson);
      if (protSingleJson.status === 'success' && protSingleJson.data && protSingleJson.data.length > 0) {
        console.log('✅ Found single protocol delegations:', protSingleJson.data.length);
        return true;
      }
    }

    console.log('❌ No single delegations found');
    return false;

  } catch (err) {
    console.error('خطأ في فحص التفويضات الفردية:', err);
    return false;
  }
}

async function checkDelegationStatus() {
  const token = localStorage.getItem('token');
  if (!token || !currentUserId) {
    console.log('Token or currentUserId missing:', { token: !!token, currentUserId });
    return;
  }

  console.log('Checking delegation status for userId:', currentUserId);

  // فحص سريع إذا كان المستخدم قد عالج أي تفويضات مؤخراً
  const lastDelegationCheck = localStorage.getItem('lastDelegationCheck');
  const now = Date.now();
  if (lastDelegationCheck && (now - parseInt(lastDelegationCheck)) < 30000) { // 30 ثانية
    console.log('🔍 Skipping delegation check - checked recently');
    return;
  }
  localStorage.setItem('lastDelegationCheck', now.toString());

  // فحص سريع إذا كان المستخدم قد عالج أي تفويضات في الجلسة الحالية
  const processedDelegations = JSON.parse(localStorage.getItem('processedDelegations') || '[]');
  if (processedDelegations.length > 0) {
    console.log('🔍 Found processed delegations in current session:', processedDelegations);
    // لا نحتاج للفحص إذا كان المستخدم قد عالج تفويضات في الجلسة الحالية
    return;
  }

  try {
    // 0. فحص التفويضات المعلقة التي تحتاج تأكيد (بوب أب)
    await checkPendingDelegationConfirmations();

    // 1. فحص التفويضات الفردية أولاً (ملف واحد فقط) - ستظهر في الجدول للقبول أو الرفض
    const hasSingleDelegations = await checkSingleDelegations();
    if (hasSingleDelegations) {
      console.log('✅ Found single delegations, they will appear in the table for accept/reject');
      // التفويضات الفردية لا تظهر بوب أب، فقط في الجدول
    }

    // 2. فحص التفويض المباشر من جدول active_delegations (جميع الملفات)
    const delegationUrl = `http://10.99.28.23:3006/api/users/${currentUserId}/delegation-status`;
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
    console.log('🔍 Delegation data:', delegationJson.data);

    if (delegationJson.status === 'success' && delegationJson.data && delegationJson.data.delegated_by) {
      console.log('✅ Found direct delegation from user:', delegationJson.data.delegated_by);

      // تحقق من سجلات الموافقة قبل عرض البوب أب
      const hasProcessedDelegation = await checkDelegationApprovalLogs(delegationJson.data.delegated_by, 'direct');
      if (!hasProcessedDelegation) {
        // المستخدم مفوض له - عرض بوب أب التفويض المباشر (جميع الملفات)
        await showDirectDelegationPopup(delegationJson.data.delegated_by);
      } else {
        console.log('✅ Direct delegation already processed, skipping popup');
      }
      return;
    } else {
      console.log('❌ No direct delegation found');
    }

    // 3. فحص التفويضات المعلقة الموحدة (أقسام ولجان) - جميع الملفات
    // ملاحظة: التفويضات الفردية لا تظهر هنا لأنها تظهر في الجدول فقط
    const pendingDelegationsUrl = `http://10.99.28.23:3006/api/approvals/pending-delegations-unified/${currentUserId}`;
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
    console.log('🔍 Pending delegations data length:', pendingDelegationsJson.data?.length || 0);

    if (pendingDelegationsJson.status === 'success' && pendingDelegationsJson.data && pendingDelegationsJson.data.length > 0) {
      console.log('✅ Found pending unified delegations:', pendingDelegationsJson.data.length);

      // تحقق من سجلات الموافقة قبل عرض البوب أب
      const latestDelegation = pendingDelegationsJson.data[0]; // أحدث تفويض
      const hasProcessedDelegation = await checkDelegationApprovalLogs(latestDelegation.delegated_by, 'bulk', latestDelegation.id);
      if (!hasProcessedDelegation) {
        // هناك تفويضات معلقة - عرض بوب أب التفويض الجماعي الموحد (جميع الملفات)
        await showBulkDelegationPopup(latestDelegation.id, latestDelegation.delegated_by_name);
      } else {
        console.log('✅ Bulk delegation already processed, skipping popup');
      }
      return;
    } else {
      console.log('❌ No pending unified delegations found');
    }

    console.log('🔍 No delegations found for user:', currentUserId);

    // تشخيص إضافي للتفويضات الجماعية
    console.log('🔍 Checking for bulk delegations specifically...');
    try {
      const bulkCheckUrl = `http://10.99.28.23:3006/api/approvals/pending-delegations-unified/${currentUserId}`;
      const bulkCheckRes = await fetch(bulkCheckUrl, { headers: authHeaders() });
      if (bulkCheckRes.ok) {
        const bulkCheckJson = await bulkCheckRes.json();
        console.log('🔍 Bulk delegations check:', bulkCheckJson);
        if (bulkCheckJson.status === 'success' && bulkCheckJson.data && bulkCheckJson.data.length > 0) {
          console.log('🔍 Found bulk delegations but they were not processed:', bulkCheckJson.data);
        } else {
          console.log('🔍 No bulk delegations found in database');
        }
      }
    } catch (err) {
      console.error('❌ Error checking bulk delegations:', err);
    }

    // تشخيص إضافي لـ active_delegations
    console.log('🔍 Checking active_delegations specifically...');
    try {
      const activeCheckUrl = `http://10.99.28.23:3006/api/users/${currentUserId}/delegation-status`;
      const activeCheckRes = await fetch(activeCheckUrl, { headers: authHeaders() });
      if (activeCheckRes.ok) {
        const activeCheckJson = await activeCheckRes.json();
        console.log('🔍 Active delegations check:', activeCheckJson);
      }
    } catch (err) {
      console.error('❌ Error checking active delegations:', err);
    }

    // تشخيص إضافي للتفويضات الجماعية في approval_logs
    console.log('🔍 Checking approval_logs for bulk delegations...');
    try {
      const approvalLogsUrl = `http://10.99.28.23:3006/api/approvals/delegation-logs/${currentUserId}/6`;
      const approvalLogsRes = await fetch(approvalLogsUrl, { headers: authHeaders() });
      if (approvalLogsRes.ok) {
        const approvalLogsJson = await approvalLogsRes.json();
        console.log('🔍 Approval logs check:', approvalLogsJson);
        if (approvalLogsJson.status === 'success' && approvalLogsJson.data && approvalLogsJson.data.length > 0) {
          const bulkLogs = approvalLogsJson.data.filter(log => log.content_id === null);
          console.log('🔍 Bulk delegation logs found:', bulkLogs);
        }
      }
    } catch (err) {
      console.error('❌ Error checking approval logs:', err);
    }

  } catch (err) {
    console.error('خطأ في فحص حالة التفويض:', err);
    if (err.response) {
      console.error('Error response:', await err.response.text());
    }
  }
}

async function checkPendingDelegationConfirmations() {
  try {
    console.log('🔍 Checking for pending delegation confirmations...');
    console.log('🔍 Current user ID for confirmations:', currentUserId);

    // فحص سريع إذا كان المستخدم قد عالج أي تفويضات في الجلسة الحالية
    const processedDelegations = JSON.parse(localStorage.getItem('processedDelegations') || '[]');
    console.log('🔍 Processed delegations in current session:', processedDelegations);

    // لا نتخطى الفحص - قد يكون لديه تفويضات جديدة معلقة
    // if (processedDelegations.length > 0) {
    //   console.log('🔍 Found processed delegations in current session, skipping popup check');
    //   return;
    // }

    // فحص التفويضات الفردية المعلقة للأقسام
    console.log('🔍 Checking department single delegations...');
    const singleDeptResponse = await fetch(`http://10.99.28.23:3006/api/approvals/single-delegations/${currentUserId}`, {
      headers: authHeaders()
    });

    if (singleDeptResponse.ok) {
      const singleDeptData = await singleDeptResponse.json();
      if (singleDeptData.status === 'success' && singleDeptData.data && singleDeptData.data.length > 0) {
        console.log('🔍 Found pending single department delegations:', singleDeptData.data.length);

        for (const delegation of singleDeptData.data) {
          // جلب بيانات التأكيد للمفوض له
          const confirmationResponse = await fetch('http://10.99.28.23:3006/api/approvals/delegation-confirmation-data', {
            method: 'POST',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              delegationId: delegation.id,
              delegationType: 'single',
              contentType: 'department'
            })
          });

          if (confirmationResponse.ok) {
            const confirmationData = await confirmationResponse.json();
            if (confirmationData.status === 'success' && confirmationData.confirmationData) {
              console.log('🔍 Showing single department delegation confirmation popup');
              showDelegationConfirmationPopup(
                confirmationData.confirmationData.delegator,
                confirmationData.confirmationData.delegate,
                confirmationData.confirmationData.file ? [confirmationData.confirmationData.file] : [],
                false,
                {
                  delegationId: delegation.id,
                  delegationType: 'single',
                  contentType: 'department'
                }
              );
              return; // عرض بوب أب واحد فقط
            }
          }
        }
      }
    }

    // فحص التفويضات الفردية المعلقة للجان
    console.log('🔍 Checking committee single delegations...');
    const singleCommResponse = await fetch(`http://10.99.28.23:3006/api/committee-approvals/single-delegations/${currentUserId}`, {
      headers: authHeaders()
    });

    if (singleCommResponse.ok) {
      const singleCommData = await singleCommResponse.json();
      if (singleCommData.status === 'success' && singleCommData.data && singleCommData.data.length > 0) {
        console.log('🔍 Found pending single committee delegations:', singleCommData.data.length);

        for (const delegation of singleCommData.data) {
          // جلب بيانات التأكيد للمفوض له
          const confirmationResponse = await fetch('http://10.99.28.23:3006/api/approvals/delegation-confirmation-data', {
            method: 'POST',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              delegationId: delegation.id,
              delegationType: 'single',
              contentType: 'committee'
            })
          });

          if (confirmationResponse.ok) {
            const confirmationData = await confirmationResponse.json();
            if (confirmationData.status === 'success' && confirmationData.confirmationData) {
              console.log('🔍 Showing single committee delegation confirmation popup');
              showDelegationConfirmationPopup(
                confirmationData.confirmationData.delegator,
                confirmationData.confirmationData.delegate,
                confirmationData.confirmationData.file ? [confirmationData.confirmationData.file] : [],
                false,
                {
                  delegationId: delegation.id,
                  delegationType: 'single',
                  contentType: 'committee'
                }
              );
              return; // عرض بوب أب واحد فقط
            }
          }
        }
      }
    }

    // فحص التفويضات الفردية المعلقة للمحاضر
    const singleProtResponse = await fetch(`http://10.99.28.23:3006/api/protocols/single-delegations/${currentUserId}`, {
      headers: authHeaders()
    });

    console.log('🔍 Protocol single delegations response status:', singleProtResponse.status);

    if (singleProtResponse.ok) {
      const singleProtData = await singleProtResponse.json();
      console.log('🔍 Protocol single delegations raw data:', singleProtData);

      if (singleProtData.status === 'success' && singleProtData.data && singleProtData.data.length > 0) {
        console.log('🔍 Found pending single protocol delegations:', singleProtData.data.length);

        for (const delegation of singleProtData.data) {
          console.log('🔍 Processing protocol delegation:', delegation);
          console.log('🔍 delegation object keys:', Object.keys(delegation));
          console.log('🔍 delegation.delegation_id:', delegation.delegation_id);
          console.log('🔍 delegation.delegated_by:', delegation.delegated_by);
          console.log('🔍 delegation.content_id:', delegation.content_id);

          // جلب بيانات التأكيد للمفوض له
          const confirmationResponse = await fetch('http://10.99.28.23:3006/api/protocols/delegation-confirmation-data', {
            method: 'POST',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              delegateTo: delegation.delegated_by,
              contentId: delegation.content_id,
              contentType: 'protocol',
              isBulk: false
            })
          });

          console.log('🔍 Protocol confirmation response status:', confirmationResponse.status);

          if (confirmationResponse.ok) {
            const confirmationData = await confirmationResponse.json();
            console.log('🔍 Protocol confirmation data:', confirmationData);

            if (confirmationData.status === 'success' && confirmationData.confirmationData) {
              console.log('🔍 Showing single protocol delegation confirmation popup');
              const delegationData = {
                delegationId: delegation.delegation_id,
                delegationType: 'single',
                contentType: 'protocol'
              };
              console.log('🔍 delegationData being passed:', delegationData);
              // التأكد من وجود الملفات - إما file أو files
              const fileArray = confirmationData.confirmationData.files ||
                (confirmationData.confirmationData.file ? [confirmationData.confirmationData.file] : []);

              showDelegationConfirmationPopup(
                confirmationData.confirmationData.delegator,
                confirmationData.confirmationData.delegate,
                fileArray,
                false,
                delegationData
              );
              return; // عرض بوب أب واحد فقط
            }
          } else {
            console.error('🔍 Protocol confirmation request failed:', confirmationResponse.status, confirmationResponse.statusText);
          }
        }
      } else {
        console.log('🔍 No protocol single delegations found or invalid response');
      }
    } else {
      console.error('🔍 Protocol single delegations request failed:', singleProtResponse.status, singleProtResponse.statusText);
    }

    // فحص التفويضات الشاملة المعلقة
    const bulkResponse = await fetch(`http://10.99.28.23:3006/api/approvals/pending-delegations-unified/${currentUserId}`, {
      headers: authHeaders()
    });

    if (bulkResponse.ok) {
      const bulkData = await bulkResponse.json();
      if (bulkData.status === 'success' && bulkData.data && bulkData.data.length > 0) {
        console.log('🔍 Found pending bulk delegations:', bulkData.data.length);

        for (const delegation of bulkData.data) {
          // جلب بيانات التأكيد للمفوض له
          const confirmationResponse = await fetch('http://10.99.28.23:3006/api/approvals/delegation-confirmation-data', {
            method: 'POST',
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              delegationId: delegation.id,
              delegationType: 'bulk'
            })
          });

          if (confirmationResponse.ok) {
            const confirmationData = await confirmationResponse.json();
            if (confirmationData.status === 'success' && confirmationData.confirmationData) {
              console.log('🔍 Showing bulk delegation confirmation popup');
              showDelegationConfirmationPopup(
                confirmationData.confirmationData.delegator,
                confirmationData.confirmationData.delegate,
                [],
                true,
                {
                  delegationId: delegation.id,
                  delegationType: 'bulk'
                }
              );
              return; // عرض بوب أب واحد فقط
            }
          }
        }
      }
    }

    console.log('🔍 No pending delegation confirmations found');
    console.log('🔍 Finished checking pending delegation confirmations');
  } catch (error) {
    console.error('Error checking pending delegation confirmations:', error);
  }
}

// دالة موحدة للتحقق من سجلات الموافقة للتفويض
async function checkDelegationApprovalLogs(delegatorId, delegationType, delegationId = null) {
  try {
    console.log('🔍 Checking delegation approval logs:', { delegatorId, delegationType, delegationId });

    // فحص سريع من localStorage إذا كان هذا التفويض قد تم معالجته في الجلسة الحالية
    const processedDelegations = JSON.parse(localStorage.getItem('processedDelegations') || '[]');
    const delegationKey = `${delegatorId}-${delegationType}`;
    if (processedDelegations.includes(delegationKey)) {
      console.log('✅ Delegation already processed in current session:', delegationKey);
      return true;
    }

    // التحقق من سجلات الموافقة للأقسام
    const deptLogsUrl = `http://10.99.28.23:3006/api/approvals/delegation-logs/${currentUserId}/${delegatorId}`;
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
          // إضافة إلى قائمة التفويضات المعالجة في الجلسة الحالية
          processedDelegations.push(delegationKey);
          localStorage.setItem('processedDelegations', JSON.stringify(processedDelegations));
          return true;
        }
      }
    } else {
      console.log('❌ Department delegation logs request failed:', deptLogsRes.status);
    }

    // التحقق من سجلات الموافقة للجان
    const commLogsUrl = `http://10.99.28.23:3006/api/committee-approvals/delegation-logs/${currentUserId}/${delegatorId}`;
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
          // إضافة إلى قائمة التفويضات المعالجة في الجلسة الحالية
          processedDelegations.push(delegationKey);
          localStorage.setItem('processedDelegations', JSON.stringify(processedDelegations));
          return true;
        }
      }
    } else {
      console.log('❌ Committee delegation logs request failed:', commLogsRes.status);
    }

    // التحقق من سجلات الموافقة العامة (approval_logs و committee_approval_logs)
    try {
      const generalLogsUrl = `http://10.99.28.23:3006/api/approvals/user-approval-status/${currentUserId}/${delegatorId}`;
      const generalLogsRes = await fetch(generalLogsUrl, { headers: authHeaders() });

      if (generalLogsRes.ok) {
        const generalLogsJson = await generalLogsRes.json();
        console.log('General approval logs:', generalLogsJson);

        if (generalLogsJson.status === 'success' && generalLogsJson.data && generalLogsJson.data.hasProcessed) {
          console.log('✅ Found processed general approval logs');
          // إضافة إلى قائمة التفويضات المعالجة في الجلسة الحالية
          processedDelegations.push(delegationKey);
          localStorage.setItem('processedDelegations', JSON.stringify(processedDelegations));
          return true;
        }
      }
    } catch (err) {
      console.log('❌ General approval logs request failed:', err);
    }

    // التحقق من سجلات active_delegations (إذا كان التفويض لا يزال نشطاً)
    if (delegationType === 'direct') {
      try {
        const activeDelegationUrl = `http://10.99.28.23:3006/api/users/${currentUserId}/delegation-status`;
        const activeDelegationRes = await fetch(activeDelegationUrl, { headers: authHeaders() });

        if (activeDelegationRes.ok) {
          const activeDelegationJson = await activeDelegationRes.json();
          if (activeDelegationJson.status === 'success' && activeDelegationJson.data && activeDelegationJson.data.delegated_by === delegatorId) {
            console.log('✅ Active delegation still exists, checking for any processed logs...');
            // إذا كان التفويض لا يزال نشطاً، تحقق من وجود أي سجلات معالجة
            // إذا لم توجد سجلات معالجة، فهذا يعني أن التفويض لم يتم معالجته بعد
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
  if (hasShownDelegationPopup) {
    console.log('⚠️ Delegation popup already shown, skipping...');
    return;
  }

  console.log('🔍 Showing direct delegation popup for delegator:', delegatorId);
  hasShownDelegationPopup = true;

  try {
    // جلب بيانات المفوض
    const userRes = await fetch(`http://10.99.28.23:3006/api/users/${delegatorId}`, { headers: authHeaders() });
    const userJson = await userRes.json();
    const delegatorName = userJson.data?.name || userJson.data?.username || 'المفوض';
    const delegatorIdNumber = userJson.data?.national_id || userJson.data?.id_number || 'غير محدد';

    // جلب بيانات المفوض له
    const currentUserRes = await fetch(`http://10.99.28.23:3006/api/users/${currentUserId}`, { headers: authHeaders() });
    const currentUserJson = await currentUserRes.json();
    const delegateName = currentUserJson.data?.name || currentUserJson.data?.username || 'المفوض له';
    const delegateIdNumber = currentUserJson.data?.national_id || currentUserJson.data?.id_number || 'غير محدد';

    console.log('🔍 Delegator name:', delegatorName);

    // إنشاء بيانات التفويض
    const delegatorInfo = {
      fullName: delegatorName,
      idNumber: delegatorIdNumber
    };

    const delegateInfo = {
      fullName: delegateName,
      idNumber: delegateIdNumber
    };

    // عرض البوب أب المفصل للتفويض الشامل
    showDelegationConfirmationPopup(
      delegatorInfo,
      delegateInfo,
      [], // لا توجد ملفات محددة للتفويض الشامل
      true, // isBulk = true للتفويض الشامل
      {
        delegatorId: delegatorId,
        delegationType: 'direct'
      }
    );
  } catch (err) {
    console.error('خطأ في جلب بيانات المفوض:', err);
    // إعادة تعيين المتغير في حالة الخطأ
    hasShownDelegationPopup = false;
  }
}

// دالة عرض بوب أب التفويض الجماعي الموحد
async function showBulkDelegationPopup(delegationId, delegatorName) {
  if (hasShownDelegationPopup) {
    console.log('⚠️ Delegation popup already shown, skipping...');
    return;
  }

  console.log('🔍 Showing bulk delegation popup for delegation:', delegationId, 'delegator:', delegatorName);
  hasShownDelegationPopup = true;

  try {
    // جلب بيانات التفويض الجماعي للحصول على معرف المفوض
    const delegationRes = await fetch(`http://10.99.28.23:3006/api/approvals/pending-delegations-unified/${currentUserId}`, {
      headers: authHeaders()
    });

    if (delegationRes.ok) {
      const delegationJson = await delegationRes.json();
      const delegation = delegationJson.data?.find(d => d.id == delegationId);

      if (delegation) {
        // جلب بيانات المفوض
        const delegatorRes = await fetch(`http://10.99.28.23:3006/api/users/${delegation.delegated_by}`, { headers: authHeaders() });
        const delegatorJson = await delegatorRes.json();
        const delegatorIdNumber = delegatorJson.data?.national_id || delegatorJson.data?.id_number || 'غير محدد';

        // جلب بيانات المفوض له
        const currentUserRes = await fetch(`http://10.99.28.23:3006/api/users/${currentUserId}`, { headers: authHeaders() });
        const currentUserJson = await currentUserRes.json();
        const delegateName = currentUserJson.data?.name || currentUserJson.data?.username || 'المفوض له';
        const delegateIdNumber = currentUserJson.data?.national_id || currentUserJson.data?.id_number || 'غير محدد';

        // إنشاء بيانات التفويض
        const delegatorInfo = {
          fullName: delegatorName,
          idNumber: delegatorIdNumber
        };

        const delegateInfo = {
          fullName: delegateName,
          idNumber: delegateIdNumber
        };

        // عرض البوب أب المفصل للتفويض الشامل
        showDelegationConfirmationPopup(
          delegatorInfo,
          delegateInfo,
          [], // لا توجد ملفات محددة للتفويض الشامل
          true, // isBulk = true للتفويض الشامل
          {
            delegationId: delegationId,
            delegationType: 'bulk',
            delegatorId: delegation.delegated_by
          }
        );
      } else {
        throw new Error('Delegation not found');
      }
    } else {
      throw new Error('Failed to fetch delegation data');
    }
  } catch (err) {
    console.error('خطأ في جلب بيانات التفويض:', err);
    // إعادة تعيين المتغير في حالة الخطأ
    hasShownDelegationPopup = false;
  }
}



// تم إزالة دالة showDelegationPopup البسيطة - نستخدم showDelegationConfirmationPopup المفصلة لجميع أنواع التفويض

// دالة معالجة التفويض المباشر الموحد
async function processDirectDelegationUnified(delegatorId, action) {
  try {
    console.log('🔍 Processing direct delegation unified:', { delegatorId, action });
    const res = await fetch('http://10.99.28.23:3006/api/approvals/direct-delegation-unified/process', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ delegatorId, action })
    });
    const json = await res.json();
    if (json.status !== 'success') {
      throw new Error(json.message);
    }
    console.log('✅ Direct delegation unified result:', json);

    // تسجيل التفويض كمعالج في الجلسة الحالية
    const processedDelegations = JSON.parse(localStorage.getItem('processedDelegations') || '[]');
    const delegationKey = `${delegatorId}-direct`;
    if (!processedDelegations.includes(delegationKey)) {
      processedDelegations.push(delegationKey);
      localStorage.setItem('processedDelegations', JSON.stringify(processedDelegations));
    }

    // إعادة تعيين المتغير بعد المعالجة الناجحة
    hasShownDelegationPopup = false;

    // إغلاق البوب أب
    closeDelegationConfirmationPopup();

    // تحديث الصفحة
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (err) {
    console.error('خطأ في معالجة التفويض المباشر الموحد:', err);
    // إعادة تعيين المتغير في حالة الخطأ
    hasShownDelegationPopup = false;
    throw err;
  }
}

// دالة معالجة التفويض الجماعي الموحد
async function processBulkDelegationUnified(delegationId, action) {
  try {
    console.log('🔍 Processing bulk delegation unified:', { delegationId, action });
    const res = await fetch('http://10.99.28.23:3006/api/approvals/bulk-delegation-unified/process', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ delegationId, action })
    });
    const json = await res.json();
    if (json.status !== 'success') {
      throw new Error(json.message);
    }
    console.log('✅ Bulk delegation unified result:', json);

    // تسجيل التفويض كمعالج في الجلسة الحالية (نحتاج delegatorId)
    // سنحصل عليه من الاستجابة أو من البيانات المحفوظة
    if (json.data && json.data.delegatorId) {
      const processedDelegations = JSON.parse(localStorage.getItem('processedDelegations') || '[]');
      const delegationKey = `${json.data.delegatorId}-bulk`;
      if (!processedDelegations.includes(delegationKey)) {
        processedDelegations.push(delegationKey);
        localStorage.setItem('processedDelegations', JSON.stringify(processedDelegations));
      }
    }

    // إعادة تعيين المتغير بعد المعالجة الناجحة
    hasShownDelegationPopup = false;

    // إغلاق البوب أب
    closeDelegationConfirmationPopup();

    // تحديث الصفحة
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (err) {
    console.error('خطأ في معالجة التفويض الجماعي الموحد:', err);
    // إعادة تعيين المتغير في حالة الخطأ
    hasShownDelegationPopup = false;
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
  if (!tbody) {
    console.log('proxy-table tbody not found, skipping loadDelegations');
    return;
  }
  tbody.innerHTML = '';

  try {
    // جلب التفويضات الجماعية (proxy)
    const [deptRes, commRes] = await Promise.all([
      fetch(apiBaseDept, { headers: authHeaders() }),
      fetch(apiBaseComm, { headers: authHeaders() })
    ]);
    const deptJson = await deptRes.json();
    const commJson = await commRes.json();

    if (deptJson.status !== 'success' || commJson.status !== 'success') {
      throw new Error(getTranslation('error-loading'));
    }

    const deptData = deptJson.data.map(d => ({ ...d, type: 'dept', delegationType: 'bulk' }));
    const commData = commJson.data.map(d => ({ ...d, type: 'committee', delegationType: 'bulk' }));
    let allData = [...deptData, ...commData];

    // إضافة تعليق توضيحي
    console.log('🔍 Bulk delegations loaded:', { dept: deptData.length, committee: commData.length });

    // جلب التفويضات الفردية أيضاً
    try {
      const [deptSingleRes, commSingleRes, protSingleRes] = await Promise.all([
        fetch(`http://10.99.28.23:3006/api/approvals/single-delegations/${currentUserId}`, { headers: authHeaders() }),
        fetch(`http://10.99.28.23:3006/api/committee-approvals/single-delegations/${currentUserId}`, { headers: authHeaders() }),
        fetch(`http://10.99.28.23:3006/api/protocols/single-delegations/${currentUserId}`, { headers: authHeaders() })
      ]);

      console.log('🔍 Department single delegations response:', deptSingleRes.status);
      if (deptSingleRes.ok) {
        const deptSingleJson = await deptSingleRes.json();
        console.log('🔍 Department single delegations data:', deptSingleJson);
        if (deptSingleJson.status === 'success' && deptSingleJson.data && deptSingleJson.data.length > 0) {
          const deptSingleData = deptSingleJson.data.map(d => ({
            ...d,
            type: 'dept',
            delegationType: 'single',
            id: d.content_id, // استخدام content_id كـ id
            title: d.content_title // استخدام content_title كـ title
          }));
          allData = [...allData, ...deptSingleData];
          console.log('✅ Added department single delegations:', deptSingleData.length);
        }
      }

      console.log('🔍 Committee single delegations response:', commSingleRes.status);
      if (commSingleRes.ok) {
        const commSingleJson = await commSingleRes.json();
        console.log('🔍 Committee single delegations data:', commSingleJson);
        if (commSingleJson.status === 'success' && commSingleJson.data && commSingleJson.data.length > 0) {
          const commSingleData = commSingleJson.data.map(d => ({
            ...d,
            type: 'committee',
            delegationType: 'single',
            id: d.content_id, // استخدام content_id كـ id
            title: d.content_title // استخدام content_title كـ title
          }));
          allData = [...allData, ...commSingleData];
          console.log('✅ Added committee single delegations:', commSingleData.length);
        }
      }

      console.log('🔍 Protocol single delegations response:', protSingleRes.status);
      if (protSingleRes.ok) {
        const protSingleJson = await protSingleRes.json();
        console.log('🔍 Protocol single delegations data:', protSingleJson);
        if (protSingleJson.status === 'success' && protSingleJson.data && protSingleJson.data.length > 0) {
          const protSingleData = protSingleJson.data.map(d => ({
            ...d,
            type: 'protocol',
            delegationType: 'single',
            id: d.delegation_id || d.id, // استخدام delegation_id إذا وجد، وإلا id
            title: d.content_title // استخدام content_title كـ title
          }));
          allData = [...allData, ...protSingleData];
          console.log('✅ Added protocol single delegations:', protSingleData.length);
        }
      }
    } catch (err) {
      console.error('خطأ في جلب التفويضات الفردية:', err);
    }

    // طباعة بيانات التفويضات في الكونسول للتشخيص
    console.log('🔍 Total delegations loaded:', allData.length);
    console.log('🔍 Breakdown by type:', {
      bulk: allData.filter(d => d.delegationType === 'bulk').length,
      single: allData.filter(d => d.delegationType === 'single').length
    });

    // إزالة التكرار بناءً على content_id و type
    const uniqueData = allData.filter((item, index, self) =>
      index === self.findIndex(t =>
        t.id === item.id && t.type === item.type && t.delegationType === item.delegationType
      )
    );

    console.log('🔍 After removing duplicates:', uniqueData.length);

    // إضافة تشخيص مفصل للبيانات
    console.log('🔍 Sample data structure:', uniqueData[0]);
    console.log('🔍 All unique data:', uniqueData);

    if (uniqueData.length === 0) {
      console.log('🔍 No unique data found, showing no-documents message');
      const noDocumentsMessage = getTranslation('no-documents') || 'لا توجد مستندات';
      console.log('🔍 No documents message:', noDocumentsMessage);
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">${noDocumentsMessage}</td></tr>`;
      return;
    }

    uniqueData.forEach((d, index) => {
      console.log(`🔍 Processing item ${index}:`, d);

      // استخدم proxy_status إذا وجدت، وإلا status
      const status = d.proxy_status || d.status;
      const delegationTypeText = d.delegationType === 'single' ? ' (تفويض فردي)' : ' (تفويض شامل)';

      // التأكد من وجود العنوان
      const title = d.title || d.content_title || d.name || 'بدون عنوان';
      console.log(`🔍 Title for item ${index}:`, title);

      const tr = document.createElement('tr');
      // الحصول على ترجمات الأزرار
      const acceptText = getTranslation('accept') || 'قبول';
      const rejectText = getTranslation('reject') || 'رفض';
      console.log(`🔍 Button texts for item ${index}:`, { accept: acceptText, reject: rejectText });

      tr.innerHTML = `
      <td>${escapeHtml(getLocalizedName(title))}${delegationTypeText}</td>
      <td class="col-signer">
        ${escapeHtml(d.delegated_by_name || d.delegated_by || '—')}
      </td>
      <td class="col-action">
        <button class="btn-accept" data-id="${d.id}" data-type="${d.type}" data-delegation-type="${d.delegationType}" data-delegatedby="${d.delegated_by}">${acceptText}</button>
        <button class="btn-reject" data-id="${d.id}" data-type="${d.type}" data-delegation-type="${d.delegationType}">${rejectText}</button>
      </td>
    `;
      tbody.appendChild(tr);
      console.log(`🔍 Added row for item ${index}`);
    });

    // زر القبول
    document.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        const contentId = btn.dataset.id;
        const contentType = btn.dataset.type;
        const delegationType = btn.dataset.delegationType;
        const page = 'approvals-recived.html';

        showPopup(getTranslation('accept-message'), async () => {
          try {
            if (delegationType === 'single') {
              // معالجة التفويض الفردي
              let endpointRoot;
              if (contentType === 'committee') endpointRoot = 'committee-approvals';
              else if (contentType === 'protocol') endpointRoot = 'protocols';
              else endpointRoot = 'approvals';
              const res = await fetch(`http://10.99.28.23:3006/api/${endpointRoot}/single-delegation-unified/process`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                  contentId,
                  action: 'accept',
                  contentType
                })
              });
              const json = await res.json();
              if (json.status === 'success') {
                showToast('تم قبول التفويض الفردي بنجاح', 'success');
                loadDelegations(); // إعادة تحميل الجدول
              } else {
                showToast(json.message || 'خطأ أثناء قبول التفويض الفردي', 'error');
              }
            } else {
              // معالجة التفويض الجماعي (كالمعتاد)
              let endpointRoot;
              if (contentType === 'committee') endpointRoot = 'committee-approvals';
              else if (contentType === 'protocol') endpointRoot = 'protocols';
              else endpointRoot = 'approvals';
              const res = await fetch(`http://10.99.28.23:3006/api/${endpointRoot}/proxy/accept/${contentId}`, {
                method: 'POST',
                headers: authHeaders()
              });
              const json = await res.json();
              if (json.status === 'success') {
                window.location.href = `/frontend/html/${page}?id=${contentId}`;
              } else {
                showToast(json.message || 'خطأ أثناء قبول التفويض', 'error');
              }
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
        selectedDelegationType = btn.dataset.delegationType;

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

  try {
    if (selectedDelegationType === 'single') {
      // معالجة رفض التفويض الفردي
      let endpointRoot;
      if (selectedContentType === 'committee') endpointRoot = 'committee-approvals';
      else if (selectedContentType === 'protocol') endpointRoot = 'protocols';
      else endpointRoot = 'approvals';
      const res = await fetch(`http://10.99.28.23:3006/api/${endpointRoot}/single-delegation-unified/process`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          contentId: selectedContentId,
          action: 'reject',
          contentType: selectedContentType,
          reason
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast('تم رفض التفويض الفردي بنجاح', 'success');
        loadDelegations();
      } else {
        throw new Error(json.message);
      }
    } else {
      // معالجة رفض التفويض الجماعي (كالمعتاد)
      let endpointRoot;
      if (selectedContentType === 'dept' || selectedContentType === 'department') endpointRoot = 'approvals';
      else if (selectedContentType === 'committee') endpointRoot = 'committee-approvals';
      else if (selectedContentType === 'protocol') endpointRoot = 'protocols';
      else endpointRoot = 'approvals';

      const res = await fetch(`http://10.99.28.23:3006/api/${endpointRoot}/${selectedContentId}/approve`, {
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

function showDelegationConfirmationPopup(delegatorInfo, delegateInfo, files, isBulk = false, delegationData = null) {
  console.log('🔍 showDelegationConfirmationPopup called with:', { delegatorInfo, delegateInfo, files, isBulk, delegationData });
  console.log('🔍 delegatorInfo details:', delegatorInfo);
  console.log('🔍 delegateInfo details:', delegateInfo);
  console.log('🔍 files details:', files);

  // تخزين بيانات التفويض الحالي
  currentDelegationData = delegationData;

  // إزالة أي بوب أب موجود مسبقاً
  const existingPopup = document.getElementById('delegationConfirmationPopup');
  if (existingPopup) {
    existingPopup.remove();
  }

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
  } else if (files && files.length > 0) {
    filesList = '<div class="files-list">';
    files.forEach(file => {
      const fileTypeText = file.type === 'department' ? 'قسم' :
        file.type === 'committee' ? 'لجنة' :
          file.type === 'protocol' ? 'محضر' : 'ملف';
      filesList += `<div class="file-item">
      <span class="file-name">${file.title || file.name}</span>
      <span class="file-type">${fileTypeText}</span>
    </div>`;
    });
    filesList += '</div>';
  } else {
    // إذا لم تكن هناك ملفات، اعرض رسالة مناسبة
    filesList = '<p class="files-summary">تفويض فردي - لا توجد ملفات محددة</p>';
  }

  popup.innerHTML = `
  <div class="delegation-confirmation-content" style="background: white; border-radius: 8px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);">
    <div class="delegation-header">
      <h3>اقرار التفويض</h3>
      <button class="close-btn" onclick="closeDelegationConfirmationPopup()">&times;</button>
    </div>
    
    <div class="delegation-body">
      <div class="delegator-info">
        <h4>معلومات الموظف المفوض</h4>
        <div class="info-row">
          <span class="label">الاسم الكامل:</span>
          <span class="value">${delegatorInfo.fullName}</span>
        </div>
        <div class="info-row">
          <span class="label">رقم الهوية:</span>
          <span class="value">${delegatorInfo.idNumber}</span>
        </div>
      </div>
      
      <div class="delegate-info">
        <h4>معلومات الموظف المفوض له</h4>
        <div class="info-row">
          <span class="label">الاسم الكامل:</span>
          <span class="value">${delegateInfo.fullName}</span>
        </div>
        <div class="info-row">
          <span class="label">رقم الهوية:</span>
          <span class="value">${delegateInfo.idNumber}</span>
        </div>
      </div>
      
      <div class="delegation-details">
        <h4>تفاصيل التفويض</h4>
        <div class="delegation-type">
          <span class="label">نوع التفويض:</span>
          <span class="value">${isBulk ? 'تفويض شامل' : 'تفويض فردي'}</span>
        </div>
        ${filesList}
      </div>
      
    <div class="delegation-statement">
  <p class="statement-text">
    أقر بأنني أقبل التفويض للموظف <strong>${delegateInfo.fullName}</strong> 
    ذو رقم الهوية <strong>${delegateInfo.idNumber}</strong> 
    بالتوقيع بالنيابة عنه ${isBulk ? 'لجميع الملفات المعلقة' : (files && files.length > 0 ? 'للملفات المحددة' : 'للملف المحدد')}.
  </p>
</div>
    
    <div class="delegation-footer">
      <button class="btn btn-danger" onclick="rejectDelegation()">رفض التفويض</button>
      <button class="btn btn-secondary" onclick="closeDelegationConfirmationPopup()">إلغاء</button>
      <button class="btn btn-primary" onclick="confirmDelegation()">قبول التفويض</button>
    </div>
  </div>
`;

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

  // إضافة event listener للتحقق من تحميل CSS
  link.onload = () => {
  };

  link.onerror = () => {
    console.error('🔍 Failed to load CSS file');
  };

  document.head.appendChild(link);
  document.body.appendChild(popup);

}

function closeDelegationConfirmationPopup() {
  const popup = document.getElementById('delegationConfirmationPopup');
  if (popup) {
    popup.remove();
  }
  // إعادة تعيين المتغير عند إغلاق البوب أب
  hasShownDelegationPopup = false;
}

// متغيرات عامة لتخزين بيانات التفويض
let pendingDelegationData = null;

function confirmDelegation() {
  if (!currentDelegationData) {
    showToast('خطأ: لا توجد بيانات تفويض', 'error');
    return;
  }

  console.log('🔍 Processing delegation acceptance with data:', currentDelegationData);
  console.log('🔍 currentDelegationData.delegationId:', currentDelegationData.delegationId);
  console.log('🔍 currentDelegationData.delegationType:', currentDelegationData.delegationType);
  console.log('🔍 currentDelegationData.contentType:', currentDelegationData.contentType);

  // معالجة قبول التفويض حسب النوع
  if (currentDelegationData.delegationType === 'single') {
    if (currentDelegationData.contentType === 'committee') {
      // قبول تفويض لجنة فردي
      processSingleCommitteeDelegationAcceptance(currentDelegationData.delegationId);
    } else if (currentDelegationData.contentType === 'protocol') {
      // قبول تفويض محضر فردي
      processSingleProtocolDelegationAcceptance(currentDelegationData.delegationId);
    } else {
      // قبول تفويض قسم فردي
      processSingleDepartmentDelegationAcceptance(currentDelegationData.delegationId);
    }
  } else if (currentDelegationData.delegationType === 'bulk') {
    // قبول تفويض شامل
    processBulkDelegationAcceptance(currentDelegationData.delegationId);
  } else if (currentDelegationData.delegationType === 'direct') {
    // قبول تفويض مباشر
    processDirectDelegationUnified(currentDelegationData.delegatorId, 'accept');
  }

  // لا نحتاج لإغلاق البوب أب هنا - سيتم إغلاقه من دوال المعالجة
}

function rejectDelegation() {
  if (!currentDelegationData) {
    showToast('خطأ: لا توجد بيانات تفويض', 'error');
    return;
  }

  console.log('🔍 Processing delegation rejection with data:', currentDelegationData);
  console.log('🔍 currentDelegationData.delegationId:', currentDelegationData.delegationId);
  console.log('🔍 currentDelegationData.delegationType:', currentDelegationData.delegationType);
  console.log('🔍 currentDelegationData.contentType:', currentDelegationData.contentType);

  // معالجة رفض التفويض حسب النوع
  if (currentDelegationData.delegationType === 'single') {
    if (currentDelegationData.contentType === 'committee') {
      // رفض تفويض لجنة فردي
      processSingleCommitteeDelegationRejection(currentDelegationData.delegationId);
    } else if (currentDelegationData.contentType === 'protocol') {
      // رفض تفويض محضر فردي
      processSingleProtocolDelegationRejection(currentDelegationData.delegationId);
    } else {
      // رفض تفويض قسم فردي
      processSingleDepartmentDelegationRejection(currentDelegationData.delegationId);
    }
  } else if (currentDelegationData.delegationType === 'bulk') {
    // رفض تفويض شامل
    processBulkDelegationRejection(currentDelegationData.delegationId);
  } else if (currentDelegationData.delegationType === 'direct') {
    // رفض تفويض مباشر
    processDirectDelegationUnified(currentDelegationData.delegatorId, 'reject');
  }

  // لا نحتاج لإغلاق البوب أب هنا - سيتم إغلاقه من دوال المعالجة
}

async function processSingleDepartmentDelegationAcceptance(delegationId) {
  try {
    const response = await fetch('http://10.99.28.23:3006/api/approvals/single-delegation-unified/process', {
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
      // إعادة تعيين المتغير بعد المعالجة الناجحة
      hasShownDelegationPopup = false;
      // إغلاق البوب أب
      closeDelegationConfirmationPopup();
      // تحديث الصفحة
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
    const response = await fetch('http://10.99.28.23:3006/api/committee-approvals/single-delegation-unified/process', {
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
      // إعادة تعيين المتغير بعد المعالجة الناجحة
      hasShownDelegationPopup = false;
      // إغلاق البوب أب
      closeDelegationConfirmationPopup();
      // تحديث الصفحة
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
    const response = await fetch('http://10.99.28.23:3006/api/approvals/bulk-delegation-unified/process', {
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
      // إعادة تعيين المتغير بعد المعالجة الناجحة
      hasShownDelegationPopup = false;
      // إغلاق البوب أب
      closeDelegationConfirmationPopup();
      // تحديث الصفحة
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
    const response = await fetch('http://10.99.28.23:3006/api/approvals/single-delegation-unified/process', {
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
      // إعادة تعيين المتغير بعد المعالجة الناجحة
      hasShownDelegationPopup = false;
      // إغلاق البوب أب
      closeDelegationConfirmationPopup();
      // تحديث الصفحة
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
    const response = await fetch('http://10.99.28.23:3006/api/committee-approvals/single-delegation-unified/process', {
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
      // إعادة تعيين المتغير بعد المعالجة الناجحة
      hasShownDelegationPopup = false;
      // إغلاق البوب أب
      closeDelegationConfirmationPopup();
      // تحديث الصفحة
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
    const response = await fetch('http://10.99.28.23:3006/api/approvals/bulk-delegation-unified/process', {
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

      // تأشير هذه التفويضات كمعالجة حتى لا يظهر البوب أب مرة أخرى
      try {
        const processedDelegations = JSON.parse(localStorage.getItem('processedDelegations') || '[]');
        const delegatorIdForMarker = (currentDelegationData && currentDelegationData.delegatorId) || result.data?.delegatorId;
        if (delegatorIdForMarker) {
          const delegationKey = `${delegatorIdForMarker}-bulk`;
          if (!processedDelegations.includes(delegationKey)) {
            processedDelegations.push(delegationKey);
            localStorage.setItem('processedDelegations', JSON.stringify(processedDelegations));
          }
        }
      } catch (_) { }
      // إعادة تعيين المتغير بعد المعالجة الناجحة
      hasShownDelegationPopup = false;
      // إغلاق البوب أب
      closeDelegationConfirmationPopup();
      // تحديث الصفحة
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(result.message || 'فشل في رفض التفويض الشامل', 'error');
    }
  } catch (error) {
    console.error('Error rejecting bulk delegation:', error);
    showToast('خطأ في رفض التفويض الشامل', 'error');
  }
}

// دالة لعرض بوب أب اقرار التفويض الفردي
async function showSingleDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {
  try {
    const response = await fetch('http://10.99.28.23:3006/api/delegations/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        contentId,
        contentType,
        showConfirmation: true
      })
    });

    const result = await response.json();

    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, file, isBulk } = result.confirmationData;

      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        contentId,
        contentType,
        isBulk: false
      };

      // عرض البوب أب
      showDelegationConfirmationPopup(delegator, delegate, [file], false);
    } else {
      showToast(result.message || 'فشل في جلب بيانات التفويض', 'error');
    }
  } catch (error) {
    console.error('Error showing single delegation confirmation:', error);
    showToast('خطأ في عرض اقرار التفويض', 'error');
  }
}

// دالة لعرض بوب أب اقرار التفويض الشامل
async function showBulkDelegationConfirmation(delegateTo, notes = '') {
  try {
    const response = await fetch('http://10.99.28.23:3006/api/delegations/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        showConfirmation: true
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

// دالة لعرض بوب أب اقرار التفويض الفردي للجان
async function showSingleCommitteeDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {

  try {
    const requestBody = {
      delegateTo,
      notes,
      contentId,
      contentType,
      showConfirmation: true
    };

    const response = await fetch('http://10.99.28.23:3006/api/committee-approvals/committee-delegations/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        contentId,
        contentType,
        showConfirmation: true
      })
    });

    console.log('🔍 API Response status:', response.status);
    console.log('🔍 API Response headers:', response.headers);

    const result = await response.json();
    console.log('🔍 API Response result:', result);

    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, file, isBulk } = result.confirmationData;
      console.log('🔍 Confirmation data extracted:', { delegator, delegate, file, isBulk });

      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        contentId,
        contentType,
        isBulk: false,
        isCommittee: true
      };

      showDelegationConfirmationPopup(delegator, delegate, [file], false);

      // إضافة alert كاختبار بسيط
      setTimeout(() => {
        const popup = document.getElementById('delegationConfirmationPopup');
        if (popup) {
          console.log('🔍 Popup found in DOM after creation');
        } else {
          console.error('🔍 Popup NOT found in DOM after creation');
          alert('Popup creation test: Popup should be visible now');
        }

        // Note: avoid await usage inside setTimeout callback
      }, 100);
    } else {
      console.log('🔍 API call failed or no confirmation data:', result);
      showToast(result.message || 'فشل في جلب بيانات التفويض', 'error');
    }
  } catch (error) {
    console.error('Error showing single committee delegation confirmation:', error);
    showToast('خطأ في عرض اقرار التفويض', 'error');
  }
}

// دالة لعرض بوب أب اقرار التفويض الشامل للجان
async function showBulkCommitteeDelegationConfirmation(delegateTo, notes = '') {
  try {
    const response = await fetch('http://10.99.28.23:3006/api/committee-approvals/committee-delegations/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        showConfirmation: true
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

// تحديث دالة processSingleDelegation لدعم اللجان
async function processSingleDelegation(data) {
  try {
    const endpoint = data.isCommittee ? 'http://10.99.28.23:3006/api/committee-approvals/committee-delegations/single' : 'http://10.99.28.23:3006/api/approvals/delegate-single';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo: data.delegateTo,
        notes: data.notes,
        contentId: data.contentId,
        contentType: data.contentType
      })
    });

    const result = await response.json();

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
    console.error('Error processing single delegation:', error);
    showToast('خطأ في إرسال طلب التفويض', 'error');
  }
}

// تحديث دالة processBulkDelegation لدعم اللجان
async function processBulkDelegation(data) {
  try {
    const endpoint = data.isCommittee ? 'http://10.99.28.23:3006/api/committee-approvals/committee-delegations/bulk' : 'http://10.99.28.23:3006/api/approvals/delegate-all-unified';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo: data.delegateTo,
        notes: data.notes
      })
    });

    const result = await response.json();

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
    console.error('Error processing bulk delegation:', error);
    showToast('خطأ في إرسال طلب التفويض الشامل', 'error');
  }
}

// دالة معالجة قبول تفويض محضر فردي
async function processSingleProtocolDelegationAcceptance(delegationId) {
  try {
    console.log('🔍 processSingleProtocolDelegationAcceptance called with delegationId:', delegationId);
    console.log('🔍 typeof delegationId:', typeof delegationId);
    console.log('🔍 delegationId value:', delegationId);

    const requestBody = {
      delegationId: delegationId,
      action: 'accept'
    };

    console.log('🔍 Request body being sent:', requestBody);

    const response = await fetch('http://10.99.28.23:3006/api/protocols/single-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(requestBody)
    });

    console.log('🔍 Response status:', response.status);
    console.log('🔍 Response ok:', response.ok);

    const result = await response.json();
    console.log('🔍 Response result:', result);

    if (result.status === 'success') {
      showToast('تم قبول تفويض المحضر بنجاح', 'success');
      setTimeout(() => {
        if (typeof refreshApprovalsData === 'function') {
          refreshApprovalsData();
        } else {
          window.location.reload();
        }
      }, 1500);
    } else {
      showToast(result.message || 'فشل في قبول تفويض المحضر', 'error');
    }
  } catch (error) {
    console.error('Error accepting single protocol delegation:', error);
    showToast('خطأ في قبول تفويض المحضر', 'error');
  }
}

// دالة معالجة رفض تفويض محضر فردي
async function processSingleProtocolDelegationRejection(delegationId) {
  try {
    console.log('🔍 processSingleProtocolDelegationRejection called with delegationId:', delegationId);
    console.log('🔍 typeof delegationId:', typeof delegationId);
    console.log('🔍 delegationId value:', delegationId);

    const requestBody = {
      delegationId: delegationId,
      action: 'reject'
    };

    console.log('🔍 Request body being sent:', requestBody);

    const response = await fetch('http://10.99.28.23:3006/api/protocols/single-delegation-unified/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(requestBody)
    });

    console.log('🔍 Response status:', response.status);
    console.log('🔍 Response ok:', response.ok);

    const result = await response.json();
    console.log('🔍 Response result:', result);

    if (result.status === 'success') {
      showToast('تم رفض تفويض المحضر بنجاح', 'success');
      // إعادة تعيين المتغير بعد المعالجة الناجحة
      hasShownDelegationPopup = false;
      // إغلاق البوب أب
      closeDelegationConfirmationPopup();
      // تحديث الصفحة
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(result.message || 'فشل في رفض تفويض المحضر', 'error');
    }
  } catch (error) {
    console.error('Error rejecting single protocol delegation:', error);
    showToast('خطأ في رفض تفويض المحضر', 'error');
  }
}

// دالة لعرض بوب أب اقرار التفويض الفردي للمحاضر
async function showSingleProtocolDelegationConfirmation(delegateTo, contentId, contentType, notes = '') {
  try {
    // استخدام API المحاضر المخصص
    const response = await fetch('http://10.99.28.23:3006/api/protocols/delegation-confirmation-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({
        delegateTo,
        notes,
        contentId,
        contentType,
        isBulk: false
      })
    });

    const result = await response.json();

    if (result.status === 'success' && result.confirmationData) {
      const { delegator, delegate, file, files, isBulk } = result.confirmationData;

      // التأكد من وجود الملفات - إما file أو files
      const fileArray = files || (file ? [file] : []);

      console.log('🔍 Protocol delegation confirmation data received:', { delegator, delegate, file, files, fileArray, isBulk });

      // تخزين بيانات التفويض
      pendingDelegationData = {
        delegateTo,
        notes,
        contentId,
        contentType,
        isBulk: false,
        isProtocol: true
      };

      // عرض البوب أب
      showDelegationConfirmationPopup(delegator, delegate, fileArray, false);
    } else {
      showToast(result.message || 'فشل في جلب بيانات تفويض المحضر', 'error');
    }
  } catch (error) {
    console.error('Error showing single protocol delegation confirmation:', error);
    showToast('خطأ في عرض اقرار تفويض المحضر', 'error');
  }
}


