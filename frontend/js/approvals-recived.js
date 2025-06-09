document.addEventListener("DOMContentLoaded", () => {
  const modal    = document.getElementById("signatureModal");
  const canvas   = document.getElementById("signaturePad");
  const ctx      = canvas.getContext("2d");
  const btnClear = document.getElementById("btnClear");
  const btnConfirm = document.getElementById("btnConfirmSignature");
  const btnClose = modal.querySelector(".modal-close");

  // إعادة ضبط حجم الكانفاس ومقياسه
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width  = rect.width  * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;

    // إعادة التحويلات إلى الوضع الافتراضي
    if (ctx.resetTransform) ctx.resetTransform();
    else ctx.setTransform(1,0,0,1,0,0);

    // مقياس DPI
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.lineWidth = 2;
    ctx.lineCap   = "round";
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // أحداث الرسم
  let drawing = false;
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return {x,y};
  }
  canvas.addEventListener("mousedown", e => { drawing=true; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); });
  canvas.addEventListener("mousemove", e => { if(drawing){ const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); } });
  canvas.addEventListener("mouseup",   () => drawing=false);
  canvas.addEventListener("mouseleave",() => drawing=false);
  canvas.addEventListener("touchstart",e => { drawing=true; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); });
  canvas.addEventListener("touchmove", e => { if(drawing){ const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); } });
  canvas.addEventListener("touchend",  () => drawing=false);

  // مسح الكانفاس
  btnClear.addEventListener("click", () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
  });

  // إغلاق المودال
  btnClose.addEventListener("click", () => modal.style.display = "none");

  // فتح المودال عند الضغط على أي زر توقيع
document.querySelectorAll(".btn-sign").forEach(btn => {
  btn.addEventListener("click", () => {
    // أولاً نظّف الكانفاس
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // اعرض المودال
    modal.style.display = "flex";
    // ثم أعد احتساب أبعاد الـ canvas بحسب wrapper الآن الظاهر
    resizeCanvas();
  });
});

  // تأكيد التوقيع (هنا يمكنك إرسال dataURL للـ API أو إدراجها في الجدول)
  btnConfirm.addEventListener("click", () => {
    const dataURL = canvas.toDataURL("image/png");
    console.log("توقيع:", dataURL);
    modal.style.display = "none";
  });
    const rejectModal = document.getElementById("rejectModal");
  const btnRejects  = document.querySelectorAll(".btn-reject");
  const btnCancel   = rejectModal.querySelector(".btn-cancel");
  const btnSend     = document.getElementById("btnSendReason");
  const textarea    = document.getElementById("rejectReason");

  // فتح المودال عند الضغط على أي زر رفض
  btnRejects.forEach(btn => {
    btn.addEventListener("click", () => {
      textarea.value = "";                // مسح السابق
      rejectModal.style.display = "flex";
    });
  });
  // إغلاق المودال
  [btnClose, btnCancel].forEach(el => {
    el.addEventListener("click", () => {
      rejectModal.style.display = "none";
    });
  });

  // إرسال السبب
  btnSend.addEventListener("click", () => {
    const reason = textarea.value.trim();
    if (!reason) {
      alert("يرجى كتابة سبب الرفض."); return;
    }
    // مثال: طباعة السبب أو إرساله للـ API
    console.log("سبب الرفض:", reason);
    rejectModal.style.display = "none";
  });
  const qrModal    = document.getElementById("qrModal");
  const btnQR      = document.querySelectorAll(".btn-qr");
  const btnClosee   = qrModal.querySelectorAll("[data-modal='qrModal']");
  const qrCanvas   = document.getElementById("qrCanvas");
  const btnDownload= document.getElementById("btnDownloadQR");
  const btnApprove = document.getElementById("btnElectronicApprove");
  const successMsg = document.getElementById("qrSuccessMsg");

  // تهيئة QRious
  const qr = new QRious({ element: qrCanvas, size: 200, value: "" });

  // فتح البوب-آب
  btnQR.forEach(btn => btn.addEventListener("click", () => {
    qr.value = window.location.origin + "/frontend/html/electronic-approval.html";
    console.log("رابط الاعتماد الإلكتروني:", qr.value);

    // أخفِ الرسالة في كل مرة يُفتح فيها
    successMsg.style.display = "none";
    // أظهر الأزرار
    btnApprove.style.display = btnDownload.style.display = btnCancel.style.display = "inline-flex";
    qrModal.style.display = "flex";
  }));

  // إغلاق
  btnClosee.forEach(el => el.addEventListener("click", () => {
    qrModal.style.display = "none";
  }));

  // تنزيل الكود
  btnDownload.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = qrCanvas.toDataURL("image/png");
    link.download = "qr-code.png";
    link.click();
  });

  // اعتماد إلكتروني داخل المودال
  btnApprove.addEventListener("click", () => {
    // أعرض رسالة النجاح
    successMsg.style.display = "block";
    // أخفِ الأزرار حتى لا يكرر المستخدم
    btnApprove.style.display = btnDownload.style.display = btnCancel.style.display = "none";
  });
  const delegateModal = document.getElementById("delegateModal");
  const btnDelegates  = document.querySelectorAll(".btn-delegate");
  const btnCloseee      = delegateModal.querySelectorAll("[data-modal='delegateModal']");
  const btnConfirmm    = document.getElementById("btnDelegateConfirm");
  const form          = document.getElementById("delegateForm");

  // فتح المودال عند الضغط على أي زر توقيع نيابي
  btnDelegates.forEach(btn => {
    btn.addEventListener("click", () => {
      form.reset();                      // إعادة تعيين الحقول
      delegateModal.style.display = "flex";
    });
  });

  // إغلاق المودال عبر (×) أو زر إلغاء
  btnCloseee.forEach(el => {
    el.addEventListener("click", () => {
      delegateModal.style.display = "none";
    });
  });

  // عند تأكيد التوقيع نيابي
  btnConfirmm.addEventListener("click", () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    // اجمع البيانات حسب الحاجة
    const data = {
      user: document.getElementById("delegateUser").value.trim(),
      dept: document.getElementById("delegateDept").value,
      notes: document.getElementById("delegateNotes").value.trim()
    };
    console.log("توقيع نيابي عن:", data);
    // هنا يمكنك إرسال البيانات إلى الـ API أو تحديث الجدول

    delegateModal.style.display = "none";
  });
});
