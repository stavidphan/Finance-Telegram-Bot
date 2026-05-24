// ============================================================
// creditCardLedger.js - Bảng giao dịch thẻ tín dụng (gộp chung)
// ============================================================
// Layout mới: 4 cột tại Q (17) — TẤT CẢ thẻ ghi chung 1 bảng
//   Row 1 : Tiêu đề "💳 Bảng giao dịch thẻ tín dụng" (merged 4 cột)
//   Row 2 : Header: Tên thẻ | Ngày giờ | Số tiền | Ghi chú  (có filter)
//   Row 3+: Data (mỗi giao dịch 1 dòng, cột Tên thẻ để filter)
// ============================================================
// Lý do đổi: layout cũ mở rộng cột ngang per-thẻ → giới hạn cột Google Sheets
// ============================================================

var LEDGER_START_COL     = 17; // Cột Q
var LEDGER_TITLE_ROW     = 1;
var LEDGER_HEADER_ROW    = 2;
var LEDGER_DATA_START    = 3;
var LEDGER_COL_COUNT     = 4;  // Tên thẻ | Ngày giờ | Số tiền | Ghi chú

/**
 * Tạo header bảng gộp (gọi tự động khi chưa tồn tại)
 */
function ensureCreditCardLedgerHeaders(sheet) {
    var existing = sheet.getRange(LEDGER_HEADER_ROW, LEDGER_START_COL).getValue();
    if (existing === "Tên thẻ") return; // Đã có header

    // Row 1: Tiêu đề (merge 4 cột)
    var titleRange = sheet.getRange(LEDGER_TITLE_ROW, LEDGER_START_COL, 1, LEDGER_COL_COUNT);
    titleRange.merge();
    sheet.getRange(LEDGER_TITLE_ROW, LEDGER_START_COL)
        .setValue("💳 Bảng giao dịch thẻ tín dụng")
        .setFontWeight("bold")
        .setFontSize(11)
        .setBackground("#4285f4")
        .setFontColor("#ffffff")
        .setHorizontalAlignment("center");

    // Row 2: Column headers
    sheet.getRange(LEDGER_HEADER_ROW, LEDGER_START_COL, 1, LEDGER_COL_COUNT)
        .setValues([["Tên thẻ", "Ngày giờ", "Số tiền", "Ghi chú"]])
        .setFontWeight("bold")
        .setBackground("#e8eaf6");

    // Độ rộng cột
    sheet.setColumnWidth(LEDGER_START_COL,     160); // Tên thẻ
    sheet.setColumnWidth(LEDGER_START_COL + 1, 130); // Ngày giờ
    sheet.setColumnWidth(LEDGER_START_COL + 2, 100); // Số tiền
    sheet.setColumnWidth(LEDGER_START_COL + 3, 200); // Ghi chú

    // Format số tiền cho vùng data
    sheet.getRange(LEDGER_DATA_START, LEDGER_START_COL + 2, 200, 1)
        .setNumberFormat("#,##0");

    // Tạo filter trên vùng đủ lớn để filter theo tên thẻ
    try {
        if (!sheet.getFilter()) {
            sheet.getRange(LEDGER_HEADER_ROW, LEDGER_START_COL, 200, LEDGER_COL_COUNT)
                .createFilter();
        }
    } catch (filterErr) {
        Logger.log("⚠️ [CreditCardLedger] Không tạo được filter: " + filterErr.message);
    }

    Logger.log("✅ [CreditCardLedger] Đã tạo header bảng gộp.");
}

/**
 * Tìm dòng trống tiếp theo trong bảng gộp
 */
function getNextRowInCreditCardLedger(sheet) {
    var maxRows = sheet.getMaxRows();
    var checkCount = Math.min(maxRows - LEDGER_DATA_START + 1, 500);
    if (checkCount <= 0) return LEDGER_DATA_START;

    var values = sheet.getRange(LEDGER_DATA_START, LEDGER_START_COL, checkCount, 1).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
        if (values[i][0] !== "" && values[i][0] !== null) {
            return LEDGER_DATA_START + i + 1;
        }
    }
    return LEDGER_DATA_START;
}

/**
 * Ghi 1 giao dịch vào bảng gộp
 * @param {Sheet} sheet          - Sheet tháng
 * @param {string} cardLast4     - 4 số cuối thẻ (dùng để lấy tên từ config)
 * @param {string} transactionTime - Ngày giờ giao dịch
 * @param {number} amount        - Số tiền
 * @param {string} note          - Ghi chú (không có "- thẻ XXX")
 */
function saveCreditCardSubLedger(sheet, cardLast4, transactionTime, amount, note, type) {
    try {
        ensureCreditCardLedgerHeaders(sheet);

        var cardName = getCardName(cardLast4);
        var nextRow  = getNextRowInCreditCardLedger(sheet);

        sheet.getRange(nextRow, LEDGER_START_COL, 1, LEDGER_COL_COUNT)
            .setValues([[cardName, transactionTime, amount, note]]);
        
        var amountCell = sheet.getRange(nextRow, LEDGER_START_COL + 2);
        amountCell.setNumberFormat("#,##0");
        if (type === "Thu nhập") {
            amountCell.setFontColor("#37d462").setFontWeight("bold");
        } else {
            amountCell.setFontColor("#000000").setFontWeight("normal");
        }

        Logger.log("✅ [CreditCardLedger] Đã ghi: " + cardName + " tại row " + nextRow);
    } catch (e) {
        Logger.log("❌ [CreditCardLedger] Lỗi: " + e.message);
    }
}

/**
 * Ghi nhiều giao dịch thẻ tín dụng vào bảng gộp trong 1 lần gọi API (batch mode)
 * @param {Sheet} sheet
 * @param {Array} entries - [{ cardLast4, transactionTime, amount, note, type }]
 */
function saveCreditCardSubLedgerBatch(sheet, entries) {
    if (!entries || entries.length === 0) return;
    try {
        ensureCreditCardLedgerHeaders(sheet);

        var nextRow = getNextRowInCreditCardLedger(sheet);
        var rowData = entries.map(function(e) {
            return [getCardName(e.cardLast4), e.transactionTime, e.amount, e.note];
        });

        sheet.getRange(nextRow, LEDGER_START_COL, rowData.length, LEDGER_COL_COUNT)
            .setValues(rowData);
        
        var amountRange = sheet.getRange(nextRow, LEDGER_START_COL + 2, rowData.length, 1);
        amountRange.setNumberFormat("#,##0");

        var fontColors = [];
        var fontWeights = [];
        for (var i = 0; i < entries.length; i++) {
            var type = entries[i].type;
            if (type === "Thu nhập") {
                fontColors.push(["#37d462"]); // Xanh lá
                fontWeights.push(["bold"]);
            } else {
                fontColors.push(["#000000"]); // Đen
                fontWeights.push(["normal"]);
            }
        }
        amountRange.setFontColors(fontColors);
        amountRange.setFontWeights(fontWeights);

        Logger.log("✅ [CreditCardLedger] Đã batch ghi " + rowData.length + " dòng từ row " + nextRow);
    } catch (e) {
        Logger.log("❌ [CreditCardLedger] Lỗi batch: " + e.message);
    }
}
