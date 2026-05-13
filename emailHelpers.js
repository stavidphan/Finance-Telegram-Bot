// ============================================================
// emailHelpers.js - Utility functions dùng chung cho email processor
// ============================================================

// ── Parse số tiền từ amountRaw ("-143,100" → 143100) ────────
function parseAmountFromEmail(amountRaw) {
    var clean = amountRaw.replace(/[+,]/g, "").replace(/-/g, "").trim();
    return parseFloat(clean) || 0;
}

// ── Xác định loại giao dịch từ amountRaw ────────────────────
function getTransactionTypeFromAmount(amountRaw) {
    return amountRaw.trim().startsWith("-") ? "Chi tiêu" : "Thu nhập";
}

// ── Convert "dd/MM/yyyy HH:mm" → giữ nguyên cho cột A ──────
function formatDateForSheet(transactionTime) {
    return transactionTime;
}

// ── Lấy tháng từ transactionTime "dd/MM/yyyy HH:mm" ────────
function getMonthFromTransactionTime(transactionTime) {
    var parts = transactionTime.split(/[\/ :]/);
    return parseInt(parts[1], 10);
}

// ── Lấy năm từ transactionTime ──────────────────────────────
function getYearFromTransactionTime(transactionTime) {
    var parts = transactionTime.split(/[\/ :]/);
    return parseInt(parts[2], 10);
}

// ── Lấy ngày dạng dd/MM từ transactionTime ──────────────────
function getDateStringFromTransactionTime(transactionTime) {
    var parts = transactionTime.split(" ")[0].split("/");
    return parts[0] + "/" + parts[1];
}

// ── Extract field chung cho email dạng "Label\nValue\n\n" ───
function extractEmailField(rawBody, label) {
    var regex = new RegExp(label + "\\s*\\n+\\s*([\\s\\S]*?)(?:\\n\\n|$)", "i");
    var match = rawBody.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Lấy dòng cuối cùng của bảng chính (cột A, rows 1-6)
 * Chỉ quét cột A để tránh bị ảnh hưởng bởi data ở khu vực khác (sao kê J25+, chart J1+)
 * @param {Sheet} sheet
 * @returns {number} số dòng cuối có data trong cột A
 */
function getLastMainTableRow(sheet) {
    var maxRow = sheet.getLastRow();
    if (maxRow <= 1) return 1; // Chỉ có header hoặc trống

    // Đọc cột A từ row 2 đến maxRow
    var values = sheet.getRange(2, 1, maxRow - 1, 1).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
        if (values[i][0] !== "" && values[i][0] !== null) {
            return i + 2; // +2 vì bắt đầu từ row 2
        }
    }
    return 1; // Không có data, chỉ có header
}

