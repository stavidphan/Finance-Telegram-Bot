// ============================================================
// cashbackManager.js - Lưu sao kê hoàn tiền vào sheet
// ============================================================
// Sao kê hoàn tiền lưu tại N26+ trên sheet tháng
// ============================================================

var CASHBACK_TITLE_ROW = 25;       // Row chứa tiêu đề "💸 Sao kê hoàn tiền"
var CASHBACK_HEADER_ROW = 26;      // Row chứa header cột
var CASHBACK_DATA_START_ROW = 27;  // Row bắt đầu data
var CASHBACK_START_COL = 14;       // Cột N (theo user yêu cầu N, O, P)

// ============================================================
// LƯU SAO KÊ HOÀN TIỀN VÀO SHEET
// ============================================================

/**
 * Tạo header cho khu vực sao kê hoàn tiền (row 25-26, cột N-P)
 */
function ensureCashbackHeaders(sheet) {
    try {
        var titleCell = sheet.getRange(CASHBACK_TITLE_ROW, CASHBACK_START_COL).getValue();
        var headerCell = sheet.getRange(CASHBACK_HEADER_ROW, CASHBACK_START_COL).getValue();
        if (titleCell || headerCell) return; // Đã có header, skip

        // Section title: merge trước khi set value
        var titleRange = sheet.getRange(CASHBACK_TITLE_ROW, CASHBACK_START_COL, 1, 3);
        titleRange.merge();
        titleRange.getCell(1, 1)
            .setValue("💸 Sao kê hoàn tiền")
            .setFontWeight("bold")
            .setFontSize(11)
            .setBackground("#e8f5e9"); // Xanh lá nhạt cho hoàn tiền

        // Header cột
        sheet.getRange(CASHBACK_HEADER_ROW, CASHBACK_START_COL, 1, 3)
            .setValues([["Tên thẻ", "Số tiền hoàn", "Kỳ sao kê"]])
            .setFontWeight("bold")
            .setBackground("#c8e6c9");

        // Định dạng cột Số tiền hoàn
        sheet.getRange(CASHBACK_DATA_START_ROW, CASHBACK_START_COL + 1, 10, 1)
            .setNumberFormat("#,##0");
    } catch (e) {
        Logger.log("⚠️ [CashbackManager] ensureCashbackHeaders lỗi (bỏ qua): " + e.message);
    }
}

/**
 * Lưu thông tin hoàn tiền vào sheet (tìm hoặc update dòng cùng thẻ)
 * @param {object} cashbackData - { cardNumber, cardName, cashbackAmount, statementPeriod }
 */
function saveCashbackToSheet(cashbackData) {
    try {
        var now = new Date();
        var currentMonth = parseInt(Utilities.formatDate(now, "GMT+7", "MM"), 10);
        var currentYear = parseInt(Utilities.formatDate(now, "GMT+7", "yyyy"), 10);

        var sheet = getSheetByMonth(currentMonth, currentYear);
        if (!sheet) {
            Logger.log("❌ [CashbackManager] Không tạo được sheet tháng " + currentMonth + "/" + currentYear);
            return false;
        }

        ensureCashbackHeaders(sheet);

        // Tìm dòng có cùng thẻ (update nếu đã tồn tại)
        var maxCheck = 20;
        var existingRow = -1;
        for (var r = CASHBACK_DATA_START_ROW; r < CASHBACK_DATA_START_ROW + maxCheck; r++) {
            var cellValue = sheet.getRange(r, CASHBACK_START_COL).getValue();
            if (!cellValue || cellValue === "") break;
            if (String(cellValue).indexOf(cashbackData.cardNumber) !== -1 ||
                String(cellValue) === cashbackData.cardName) {
                existingRow = r;
                break;
            }
        }

        var targetRow = existingRow !== -1 ? existingRow : getNextCashbackRow(sheet);

        var rowData = [
            cashbackData.cardName,
            cashbackData.cashbackAmount,
            cashbackData.statementPeriod
        ];

        sheet.getRange(targetRow, CASHBACK_START_COL, 1, 3).setValues([rowData]);
        sheet.getRange(targetRow, CASHBACK_START_COL + 1).setNumberFormat("#,##0");

        Logger.log("✅ [CashbackManager] Đã lưu hoàn tiền thẻ " + cashbackData.cardName + " tại row " + targetRow);
        return true;
    } catch (e) {
        Logger.log("❌ [CashbackManager] Lỗi saveCashbackToSheet: " + e.message);
        return false;
    }
}

/**
 * Tìm dòng trống tiếp theo trong khu vực hoàn tiền
 */
function getNextCashbackRow(sheet) {
    for (var r = CASHBACK_DATA_START_ROW; r < CASHBACK_DATA_START_ROW + 20; r++) {
        var val = sheet.getRange(r, CASHBACK_START_COL).getValue();
        if (!val || val === "") return r;
    }
    return CASHBACK_DATA_START_ROW + 20;
}

/**
 * Xử lý toàn bộ flow cashback: lưu sheet và gửi thông báo Telegram
 */
function processCashbacks(cashbacks) {
    if (cashbacks.length === 0) return;

    var msg = "💸 *SAO KÊ HOÀN TIỀN*\n";

    for (var i = 0; i < cashbacks.length; i++) {
        var cb = cashbacks[i];
        saveCashbackToSheet(cb);
        
        var formattedAmount = cb.cashbackAmount.toLocaleString("vi-VN");
        msg += "\n*" + (i + 1) + ".* 💳 *" + cb.cardName + "*\n";
        msg += "📅 Kỳ sao kê: " + cb.statementPeriod + "\n";
        msg += "💰 Số tiền hoàn: *" + formattedAmount + " VND*\n";
    }

    sendMessage(msg, { parse_mode: "Markdown" });
}
