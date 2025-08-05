const deadlineModel = require('../models/deadlineModel');
const { insertNotification } = require('../models/notfications-utils');

// تعيين مواعيد نهائية للمعتمدين
async function setDeadlines(req, res) {
  try {
    const { contentId, contentType, deadlines } = req.body;

    if (!contentId || !contentType || !deadlines || !Array.isArray(deadlines)) {
      return res.status(400).json({
        status: 'error',
        message: 'بيانات غير صحيحة'
      });
    }

    // حذف المواعيد النهائية القديمة لهذا المحتوى
    await deadlineModel.deleteDeadlinesByContent(contentId, contentType);

    const results = [];
    
    for (const deadline of deadlines) {
      const { approverId, days, hours, minutes } = deadline;
      
      if (!approverId || (days === undefined && hours === undefined && minutes === undefined)) {
        continue;
      }

      // تحويل approverId إلى رقم
      const approverIdNum = parseInt(approverId);
      if (isNaN(approverIdNum)) {
        continue;
      }

      // حساب التاريخ النهائي بتوقيت السعودية (UTC+3)
      const deadlineDate = new Date();
      
      // تحويل إلى توقيت السعودية (إضافة 3 ساعات)
      const saudiTime = new Date(deadlineDate.getTime() + (3 * 60 * 60 * 1000));
      
      if (days) saudiTime.setDate(saudiTime.getDate() + parseInt(days));
      if (hours) saudiTime.setHours(saudiTime.getHours() + parseInt(hours));
      if (minutes) saudiTime.setMinutes(saudiTime.getMinutes() + parseInt(minutes));
      
      // تحويل مرة أخرى إلى UTC للحفظ في قاعدة البيانات
      const utcDate = new Date(saudiTime.getTime() - (3 * 60 * 60 * 1000));



      // إضافة الموعد النهائي
      const deadlineId = await deadlineModel.addDeadline(
        contentId,
        contentType,
        approverIdNum,
        utcDate
      );

      results.push({
        approverId,
        deadlineId,
        deadlineDate: saudiTime.toISOString() // إرجاع الوقت بتوقيت السعودية
      });
    }


    res.json({
      status: 'success',
      message: 'تم تعيين المواعيد النهائية بنجاح',
      data: results
    });

  } catch (error) {
    console.error('Error setting deadlines:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء تعيين المواعيد النهائية',
      details: error.message
    });
  }
}

// جلب المواعيد النهائية لمحتوى معين
async function getDeadlines(req, res) {
  try {
    const { contentId, contentType } = req.params;

    if (!contentId || !contentType) {
      return res.status(400).json({
        status: 'error',
        message: 'معرف المحتوى ونوعه مطلوبان'
      });
    }

    const deadlines = await deadlineModel.getDeadlinesByContent(contentId, contentType);

    res.json({
      status: 'success',
      data: deadlines
    });

  } catch (error) {
    console.error('Error getting deadlines:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء جلب المواعيد النهائية'
    });
  }
}

// جلب المواعيد النهائية النشطة لمستخدم معين
async function getUserDeadlines(req, res) {
  try {
    const userId = req.user.id;

    const deadlines = await deadlineModel.getActiveDeadlinesByUser(userId);

    res.json({
      status: 'success',
      data: deadlines
    });

  } catch (error) {
    console.error('Error getting user deadlines:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء جلب المواعيد النهائية'
    });
  }
}

// فحص المواعيد النهائية المنتهية الصلاحية وإرسال الإشعارات
async function checkExpiredDeadlines(req, res) {
  try {
    const expiredDeadlines = await deadlineModel.getExpiredDeadlines();
    
    const notifications = [];

    for (const deadline of expiredDeadlines) {
      // تحديث حالة الموعد النهائي إلى منتهي الصلاحية
      await deadlineModel.updateDeadlineStatus(deadline.id, 'expired');

      // إرسال إشعار للمعتمد
      const notificationId = await insertNotification(
        deadline.approver_id,
        'انتهت مهلة الاعتماد',
        `انتهت مهلة الاعتماد للمحتوى "${deadline.content_title}" من ${deadline.source_name}. يرجى مراجعة المحتوى والاعتماد عليه في أقرب وقت ممكن.`,
        'alert'
      );

      notifications.push({
        deadlineId: deadline.id,
        approverId: deadline.approver_id,
        contentTitle: deadline.content_title,
        notificationId
      });
    }

    res.json({
      status: 'success',
      message: `تم فحص ${expiredDeadlines.length} موعد نهائي منتهي الصلاحية`,
      data: {
        expiredCount: expiredDeadlines.length,
        notifications
      }
    });

  } catch (error) {
    console.error('Error checking expired deadlines:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء فحص المواعيد النهائية'
    });
  }
}

// حذف المواعيد النهائية لمحتوى معين
async function deleteDeadlines(req, res) {
  try {
    const { contentId, contentType } = req.params;

    if (!contentId || !contentType) {
      return res.status(400).json({
        status: 'error',
        message: 'معرف المحتوى ونوعه مطلوبان'
      });
    }

    await deadlineModel.deleteDeadlinesByContent(contentId, contentType);

    res.json({
      status: 'success',
      message: 'تم حذف المواعيد النهائية بنجاح'
    });

  } catch (error) {
    console.error('Error deleting deadlines:', error);
    res.status(500).json({
      status: 'error',
      message: 'حدث خطأ أثناء حذف المواعيد النهائية'
    });
  }
}

module.exports = {
  setDeadlines,
  getDeadlines,
  getUserDeadlines,
  checkExpiredDeadlines,
  deleteDeadlines
}; 