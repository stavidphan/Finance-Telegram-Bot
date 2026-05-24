// ============================================================
// statementManager.js - Lưu sao kê vào sheet & nhắc thanh toán
// ============================================================
// Sao kê lưu tại J26+ trên sheet tháng (theo due date month)
// Nhắc thanh toán: ScriptApp trigger + Google Calendar
// ============================================================

var STATEMENT_TITLE_ROW = 25;       // Row chứa tiêu đề "📋 Sao kê thẻ tín dụng"
var STATEMENT_HEADER_ROW = 26;      // Row chứa header cột
var STATEMENT_DATA_START_ROW = 27;   // Row bắt đầu data
var STATEMENT_START_COL = 10;        // Cột J
var STATEMENT_DUES_KEY = "statementDueDates";

// ============================================================
// LƯU SAO KÊ VÀO SHEET
// ============================================================

/**
 * Tạo header cho khu vực sao kê (row 36, cột J-M)
 */
function ensureStatementHeaders(sheet) {
    try {
        // Guard: check cả title row 25 (tránh gọi merge() lần 2 → exception)
        var titleCell = sheet.getRange(STATEMENT_TITLE_ROW, STATEMENT_START_COL).getValue();
        var headerCell = sheet.getRange(STATEMENT_HEADER_ROW, STATEMENT_START_COL).getValue();
        if (titleCell || headerCell) return; // Đã có header, skip

        // Section title: merge trước khi set value
        var titleRange = sheet.getRange(STATEMENT_TITLE_ROW, STATEMENT_START_COL, 1, 4);
        titleRange.merge();
        titleRange.getCell(1, 1)
            .setValue("📋 Sao kê thẻ tín dụng")
            .setFontWeight("bold")
            .setFontSize(11)
            .setBackground("#fff3e0");

        // Header cột
        sheet.getRange(STATEMENT_HEADER_ROW, STATEMENT_START_COL, 1, 4)
            .setValues([["Tên thẻ", "Dư nợ", "Hạn thanh toán", "Kỳ sao kê"]])
            .setFontWeight("bold")
            .setBackground("#e8eaf6");

        // Định dạng cột dư nợ
        sheet.getRange(STATEMENT_DATA_START_ROW, STATEMENT_START_COL + 1, 10, 1)
            .setNumberFormat("#,##0");
    } catch (e) {
        Logger.log("⚠️ [StatementManager] ensureStatementHeaders lỗi (bỏ qua): " + e.message);
    }
}

/**
 * Lưu thông tin sao kê vào sheet (tìm hoặc update dòng cùng thẻ)
 * @param {object} statementData - { cardNumber, cardName, outstandingBalance, dueDate, statementPeriod }
 */
function saveStatementToSheet(statementData) {
    try {
        // Xác định sheet theo tháng hiện tại quét email (GMT+7)
        var now = new Date();
        var dueMonth = parseInt(Utilities.formatDate(now, "GMT+7", "MM"), 10);
        var dueYear = parseInt(Utilities.formatDate(now, "GMT+7", "yyyy"), 10);

        var sheet = getSheetByMonth(dueMonth, dueYear);
        if (!sheet) {
            Logger.log("❌ [StatementManager] Không tạo được sheet tháng " + dueMonth + "/" + dueYear);
            return false;
        }

        ensureStatementHeaders(sheet);

        // Tìm dòng có cùng thẻ (update nếu đã tồn tại)
        var maxCheck = 20;
        var existingRow = -1;
        for (var r = STATEMENT_DATA_START_ROW; r < STATEMENT_DATA_START_ROW + maxCheck; r++) {
            var cellValue = sheet.getRange(r, STATEMENT_START_COL).getValue();
            if (!cellValue || cellValue === "") break;
            // Match theo cardNumber (MSB: last4 nằm trong cardName) HOẶC theo cardName exact (VPBank: key nội bộ)
            if (String(cellValue).indexOf(statementData.cardNumber) !== -1 ||
                String(cellValue) === statementData.cardName) {
                existingRow = r;
                break;
            }
        }

        var targetRow = existingRow !== -1 ? existingRow : getNextStatementRow(sheet);

        var rowData = [
            statementData.cardName,
            statementData.outstandingBalance,
            statementData.dueDate,
            statementData.statementPeriod
        ];

        sheet.getRange(targetRow, STATEMENT_START_COL, 1, 4).setValues([rowData]);
        sheet.getRange(targetRow, STATEMENT_START_COL + 1).setNumberFormat("#,##0");

        Logger.log("✅ [StatementManager] Đã lưu sao kê thẻ " + statementData.cardName + " tại row " + targetRow);
        return true;
    } catch (e) {
        Logger.log("❌ [StatementManager] Lỗi saveStatementToSheet: " + e.message);
        return false;
    }
}

/**
 * Tìm dòng trống tiếp theo trong khu vực sao kê
 */
function getNextStatementRow(sheet) {
    for (var r = STATEMENT_DATA_START_ROW; r < STATEMENT_DATA_START_ROW + 20; r++) {
        var val = sheet.getRange(r, STATEMENT_START_COL).getValue();
        if (!val || val === "") return r;
    }
    return STATEMENT_DATA_START_ROW + 20;
}

// ============================================================
// NHẮC THANH TOÁN - ScriptApp Trigger
// ============================================================

/**
 * Lưu due date vào PropertiesService
 */
function saveStatementDueDate(statementData) {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(STATEMENT_DUES_KEY);
    var dues = {};
    if (raw) {
        try { dues = JSON.parse(raw); } catch (e) { dues = {}; }
    }

    dues[statementData.cardNumber] = {
        cardName: statementData.cardName,
        dueDate: statementData.dueDate,
        outstandingBalance: statementData.outstandingBalance,
        savedAt: new Date().toISOString()
    };

    props.setProperty(STATEMENT_DUES_KEY, JSON.stringify(dues));
    Logger.log("✅ [StatementManager] Đã lưu due date thẻ " + statementData.cardName + ": " + statementData.dueDate);
}

/**
 * Kiểm tra và nhắc thanh toán — chạy bởi daily trigger
 */
function checkAndRemindDueDates() {
    try {
        var props = PropertiesService.getScriptProperties();
        var raw = props.getProperty(STATEMENT_DUES_KEY);
        if (!raw) return;

        var dues = JSON.parse(raw);
        var today = new Date();
        var gmt7Offset = 7 * 60 * 60 * 1000;
        var todayGmt7 = new Date(today.getTime() + gmt7Offset);
        var todayStr = Utilities.formatDate(todayGmt7, "GMT+7", "dd/MM/yyyy");
        var todayParts = todayStr.split("/");
        var todayDate = new Date(parseInt(todayParts[2]), parseInt(todayParts[1]) - 1, parseInt(todayParts[0]));

        var updated = false;

        for (var cardNum in dues) {
            var info = dues[cardNum];
            var dueParts = info.dueDate.split("/");
            var dueDate = new Date(parseInt(dueParts[2]), parseInt(dueParts[1]) - 1, parseInt(dueParts[0]));
            var diffDays = Math.round((dueDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));

            var formattedBalance = info.outstandingBalance.toLocaleString("vi-VN") + " VND";

            if (diffDays === 3) {
                sendMessage(
                    "⚠️ *Nhắc thanh toán thẻ tín dụng*\n\n" +
                    "💳 *" + info.cardName + "*\n" +
                    "💰 Dư nợ: " + formattedBalance + "\n" +
                    "⏰ Hạn thanh toán: *" + info.dueDate + "* (còn 3 ngày)\n\n" +
                    "Vui lòng thanh toán để tránh phí trễ hạn!",
                    { parse_mode: "Markdown" }
                );
            } else if (diffDays === 1) {
                sendMessage(
                    "🚨 *KHẨN: Thanh toán thẻ tín dụng*\n\n" +
                    "💳 *" + info.cardName + "*\n" +
                    "💰 Dư nợ: " + formattedBalance + "\n" +
                    "⏰ Hạn thanh toán: *" + info.dueDate + "* (NGÀY MAI!)\n\n" +
                    "⚠️ Thanh toán ngay để tránh phí trễ hạn!",
                    { parse_mode: "Markdown" }
                );
            } else if (diffDays < 0) {
                // Đã qua due date → xóa
                delete dues[cardNum];
                updated = true;
                Logger.log("🗑️ [StatementManager] Đã xóa due date hết hạn: " + info.cardName);
            }
        }

        if (updated) {
            props.setProperty(STATEMENT_DUES_KEY, JSON.stringify(dues));
        }
    } catch (e) {
        Logger.log("❌ [StatementManager] Lỗi checkAndRemindDueDates: " + e.message);
    }
}

/**
 * Tạo daily trigger để check due dates (chạy 1 lần để setup)
 * Gọi: setupDueDateCheckTrigger()
 */
function setupDueDateCheckTrigger() {
    var triggers = ScriptApp.getProjectTriggers();

    // Nếu trigger đã tồn tại → bỏ qua, không cần xóa/tạo lại
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === "checkAndRemindDueDates") {
            Logger.log("✅ [StatementManager] Trigger nhắc thanh toán đã tồn tại, bỏ qua.");
            sendMessage("✅ *Đã bật nhắc thanh toán thẻ tín dụng!*\nHệ thống sẽ nhắc trước 3 ngày và 1 ngày.", { parse_mode: "Markdown" });
            return;
        }
    }

    // Chưa có → tạo mới
    ScriptApp.newTrigger("checkAndRemindDueDates")
        .timeBased()
        .atHour(22) // chạy hàng ngày trong khoảng 22h-23h
        .everyDays(1)
        .create();

    Logger.log("✅ [StatementManager] Đã tạo trigger nhắc thanh toán hàng ngày lúc 22:00.");
    sendMessage("✅ *Đã bật nhắc thanh toán thẻ tín dụng!*\nHệ thống sẽ nhắc trước 3 ngày và 1 ngày.", { parse_mode: "Markdown" });
}

// ============================================================
// NHẮC THANH TOÁN - Google Calendar
// ============================================================

/**
 * Tạo event trên Google Calendar với reminder
 */
function createCalendarReminder(statementData) {
    try {
        // ── Giờ thông báo trên Calendar (thay đổi nếu cần) ──
        var CALENDAR_REMINDER_HOUR = 21;   // 21:00
        var CALENDAR_REMINDER_MINUTE = 0;  // :00

        var calendar = CalendarApp.getDefaultCalendar();
        var dueParts = statementData.dueDate.split("/");
        var dueDate = new Date(parseInt(dueParts[2]), parseInt(dueParts[1]) - 1, parseInt(dueParts[0]));

        var formattedBalance = statementData.outstandingBalance.toLocaleString("vi-VN");

        var title = "💳 Thanh toán thẻ " + statementData.cardName;
        var description = "Dư nợ: " + formattedBalance + " VND\n" +
            "Kỳ sao kê: " + statementData.statementPeriod + "\n" +
            "Thanh toán tối thiểu: " + (statementData.minimumDue || 0).toLocaleString("vi-VN") + " VND";

        // Xóa event cũ cùng title (tránh trùng)
        var existingEvents = calendar.getEventsForDay(dueDate);
        for (var i = 0; i < existingEvents.length; i++) {
            if (existingEvents[i].getTitle() === title) {
                existingEvents[i].deleteEvent();
            }
        }

        var event = calendar.createAllDayEvent(title, dueDate, { description: description })

        // Thêm reminder: 3 ngày trước và 1 ngày trước
        event.removeAllReminders();
        // 3 ngày trước lúc 21h
        event.addPopupReminder((3 * 24 + (24 - CALENDAR_REMINDER_HOUR)) * 60); // 4500 phút
        // 1 ngày trước lúc 21h
        event.addPopupReminder((1 * 24 + (24 - CALENDAR_REMINDER_HOUR)) * 60); // 1620 phút
        // Email reminder
        event.addEmailReminder((3 * 24 + (24 - CALENDAR_REMINDER_HOUR)) * 60);
        event.addEmailReminder((1 * 24 + (24 - CALENDAR_REMINDER_HOUR)) * 60);

        Logger.log("✅ [StatementManager] Đã tạo Calendar event: " + title + " vào " + statementData.dueDate);
        return true;
    } catch (e) {
        Logger.log("❌ [StatementManager] Lỗi createCalendarReminder: " + e.message);
        return false;
    }
}

/**
 * Xử lý toàn bộ flow sao kê: lưu sheet + đặt reminder cả 2 hướng
 */
function processStatements(statements) {
    if (statements.length === 0) return;

    for (var i = 0; i < statements.length; i++) {
        var st = statements[i];
        saveStatementToSheet(st);
        saveStatementDueDate(st);
        createCalendarReminder(st);
    }

    // Gửi tin nhắn Telegram tổng hợp sao kê
    var msg = "💳 *Sao kê thẻ tín dụng*\n";

    for (var j = 0; j < statements.length; j++) {
        var s = statements[j];
        var formattedBalance = s.outstandingBalance.toLocaleString("vi-VN");
        var formattedMinDue = (s.minimumDue || 0).toLocaleString("vi-VN");

        msg += "\n*" + (j + 1) + ".* 💳 *" + s.cardName + "*\n";
        msg += "📅 Kỳ sao kê: " + s.statementPeriod + "\n";
        msg += "💰 Dư nợ: " + formattedBalance + " VND\n";
        msg += "⚠️ Thanh toán tối thiểu: " + formattedMinDue + " VND\n";
        msg += "⏰ Hạn thanh toán: *" + s.dueDate + "*\n";
    }

    msg += "\n📅 Bạn sẽ được nhắc thanh toán trước 3 ngày và 1 ngày.";

    sendMessage(msg, { parse_mode: "Markdown" });

    // Setup ScriptApp trigger (chỉ cần 1 lần, idempotent)
    setupDueDateCheckTrigger();
}
