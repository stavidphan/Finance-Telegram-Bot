// ============================================================
// emailSaver.js - Quản lý pending transactions & lưu giao dịch
// ============================================================

var PENDING_KEY = "pendingEmailTransactions";
var PROCESSED_IDS_KEY = "processedEmailIds";

// ============================================================
// QUẢN LÝ PENDING TRANSACTIONS
// ============================================================

// FOR TEST ONLY
function clearAllCache() {
  clearPendingTransactions();
  clearProcessedEmailsCache();
}

function savePendingTransactions(list) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(PENDING_KEY, JSON.stringify(list));
    Logger.log("✅ [EmailSaver] Đã lưu " + list.length + " giao dịch pending.");
}

function getPendingTransactions() {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(PENDING_KEY);
    if (!raw) return null;
    try {
        var list = JSON.parse(raw);
        return list && list.length > 0 ? list : null;
    } catch (e) {
        return null;
    }
}

function clearPendingTransactions() {
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty(PENDING_KEY);
    Logger.log("✅ [EmailSaver] Đã xóa pending transactions.");
}

// ============================================================
// CHỐNG TRÙNG LẶP EMAIL
// ============================================================

function markEmailProcessed(emailId) {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(PROCESSED_IDS_KEY);
    var records = [];
    if (raw) {
        try { records = JSON.parse(raw); } catch (e) { records = []; }
    }

    var now = new Date().getTime();
    var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Xóa records cũ hơn 7 ngày
    records = records.filter(function (r) { return (now - r.ts) < sevenDaysMs; });

    records.push({ id: emailId, ts: now });
    props.setProperty(PROCESSED_IDS_KEY, JSON.stringify(records));
}

function isEmailProcessed(emailId) {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(PROCESSED_IDS_KEY);
    if (!raw) return false;
    try {
        var records = JSON.parse(raw);
        return records.some(function (r) { return r.id === emailId; });
    } catch (e) {
        return false;
    }
}

/**
 * Load toàn bộ danh sách email đã xử lý vào bộ nhớ 1 lần
 * Tự động loại bỏ records cũ hơn 7 ngày
 * @returns {{ records: Array, idSet: Object }} - idSet là {emailId: true} để O(1) lookup
 */
function loadProcessedEmailSet() {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(PROCESSED_IDS_KEY);
    var records = [];
    if (raw) {
        try { records = JSON.parse(raw); } catch (e) { records = []; }
    }

    var now = new Date().getTime();
    var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    records = records.filter(function(r) { return (now - r.ts) < sevenDaysMs; });

    var idSet = {};
    for (var i = 0; i < records.length; i++) {
        idSet[records[i].id] = true;
    }
    return { records: records, idSet: idSet };
}

/**
 * Ghi nhiều email ID mới vào PropertiesService trong 1 lần (thay vì từng email 1)
 * @param {Array<string>} newIds - Danh sách email ID cần đánh dấu
 * @param {Array} existingRecords - Mảng records đã load sẵn (không parse lại)
 */
function batchMarkEmailsProcessed(newIds, existingRecords) {
    if (!newIds || newIds.length === 0) return;
    var now = new Date().getTime();
    var records = existingRecords || [];
    for (var i = 0; i < newIds.length; i++) {
        records.push({ id: newIds[i], ts: now });
    }
    var props = PropertiesService.getScriptProperties();
    props.setProperty(PROCESSED_IDS_KEY, JSON.stringify(records));
    Logger.log("✅ [EmailSaver] Batch mark " + newIds.length + " email(s) đã xử lý.");
}

function clearProcessedEmailsCache() {
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty(PROCESSED_IDS_KEY);
    Logger.log("✅ [EmailSaver] Đã xóa cache email đã xử lý.");
    sendMessage("✅ *Đã xóa danh sách email đã xử lý!* Bạn có thể chạy lại lệnh /scanmail.", { parse_mode: "Markdown" });
}

// ============================================================
// XỬ LÝ GHI CHÚ TỪ USER VÀ LƯU GIAO DỊCH VÀO SHEET
// ============================================================

function confirmAndSaveEmailTransactions(bulkNote) {
    try {
        var pendingList = getPendingTransactions();
        if (!pendingList || pendingList.length === 0) {
            sendMessage("⚠️ Không có giao dịch email nào đang chờ xử lý.", { parse_mode: "Markdown" });
            return false;
        }

        var notes = bulkNote.split("\n").map(function (n) { return n.trim(); });

        var successCount = 0;
        var errors = [];
        var rowsBySheet = {};
        // Lưu thông tin ghi vào bảng riêng thẻ (xử lý sau bulk insert)
        var creditCardEntries = [];

        // BƯỚC 1: Xây dựng mảng rowData cho từng sheet
        for (var i = 0; i < pendingList.length; i++) {
            var tx = pendingList[i];
            var noteLine = notes[i] || "";
            if (noteLine === "-") noteLine = "";

            try {
                var type = getTransactionTypeFromAmount(tx.amountRaw);
                var amount = parseAmountFromEmail(tx.amountRaw);

                var category = "Mua sắm"; // Credit card default
                var content = tx.content;
                var noteWithCard = "";
                var noteForCardLedger = ""; // Note cho bảng riêng (không có "- thẻ XXX")

                if (tx.emailType === "transfer_tx" || tx.bankType === "VCB") {
                    // Chuyển khoản: phân tách <mô tả> (<ghi chú>)
                    var matchNote = noteLine.match(/^(.+?)(?:\s*\(([^()]+)\))?$/);
                    if (matchNote && noteLine !== "") {
                        content = capitalizeFirstLetter(matchNote[1].trim());
                        var noteExtracted = matchNote[2] ? matchNote[2].trim() : "";
                        category = getCategoryDetail(content);
                        noteWithCard = noteExtracted ? capitalizeFirstLetter(noteExtracted) : "";
                    } else {
                        category = "Khác";
                        content = "Chuyển khoản VCB";
                        noteWithCard = "";
                    }
                } else {
                    // Thẻ tín dụng
                    var cardName = getCardName(tx.last4);
                    noteForCardLedger = noteLine ? capitalizeFirstLetter(noteLine) : "";
                    noteWithCard = noteLine
                        ? capitalizeFirstLetter(noteLine) + " - " + cardName
                        : cardName;
                }

                var month = getMonthFromTransactionTime(tx.transactionTime);
                var year = getYearFromTransactionTime(tx.transactionTime);
                var sheetKey = month + "_" + year;

                var rowData = [
                    tx.transactionTime,  // A: Ngày + giờ
                    type,                // B: Loại giao dịch
                    category,            // C: Danh mục
                    amount,              // D: Số tiền
                    content,             // E: Mô tả
                    noteWithCard         // F: Ghi chú
                ];

                if (!rowsBySheet[sheetKey]) {
                    rowsBySheet[sheetKey] = { month: month, year: year, rows: [] };
                }
                rowsBySheet[sheetKey].rows.push(rowData);

                // Ghi nhận entry cho bảng riêng thẻ tín dụng
                if (tx.emailType === "credit_card_tx" || (tx.bankType !== "VCB" && BANK_CONFIG.creditCardTx.cards[tx.last4])) {
                    creditCardEntries.push({
                        sheetKey: sheetKey,
                        cardLast4: tx.last4,
                        transactionTime: tx.transactionTime,
                        amount: amount,
                        note: noteForCardLedger
                    });
                }

                successCount++;
            } catch (rowErr) {
                errors.push("Giao dịch " + (i + 1) + ": " + rowErr.message);
                Logger.log("❌ [EmailSaver] Lỗi xử lý giao dịch " + (i + 1) + ": " + rowErr.message);
            }
        }

        // BƯỚC 2: Bulk insert vào bảng chính
        // dùng lightMode=true để bỏ qua setup nặng (chart, format, ledger) — chạy 1 lần ở cuối
        var sheetCache = {};
        for (var key in rowsBySheet) {
            var sData = rowsBySheet[key];
            var sheet = getSheetByMonth(sData.month, sData.year, true);
            if (!sheet) {
                errors.push("Lỗi: Không tạo được sheet tháng " + sData.month + "/" + sData.year);
                continue;
            }

            sheetCache[key] = sheet;

            var addCount = sData.rows.length;
            var startRow = getLastMainTableRow(sheet) + 1;

            sheet.getRange(startRow, 1, addCount, 6).setValues(sData.rows);
            sheet.getRange(startRow, 4, addCount, 1).setNumberFormat("#,##0");

            applyAmountColorFormatting(sheet, startRow, addCount);
            Logger.log("✅ [EmailSaver] Đã insert " + addCount + " row(s) vào sheet " + sData.month + "/" + sData.year);
        }

        // BƯỚC 3: Ghi vào bảng riêng thẻ tín dụng (batch per sheet)
        // Gom entries theo sheetKey rồi ghi 1 lần/sheet thay vì từng dòng
        var ledgerEntriesBySheet = {};
        for (var c = 0; c < creditCardEntries.length; c++) {
            var entry = creditCardEntries[c];
            if (!ledgerEntriesBySheet[entry.sheetKey]) {
                ledgerEntriesBySheet[entry.sheetKey] = [];
            }
            ledgerEntriesBySheet[entry.sheetKey].push(entry);
        }
        for (var lKey in ledgerEntriesBySheet) {
            var lSheet = sheetCache[lKey];
            if (lSheet) {
                saveCreditCardSubLedgerBatch(lSheet, ledgerEntriesBySheet[lKey]);
            }
        }

        // BƯỚC 4: Cập nhật chart 1 lần/sheet sau khi đã insert xong tất cả
        for (var cKey in sheetCache) {
            createOrUpdateChart(sheetCache[cKey]);
        }

        // Xóa pending
        clearPendingTransactions();

        // Thông báo kết quả
        var resultMsg = "✅ *Đã lưu " + successCount + "/" + pendingList.length + " giao dịch từ email!*\n\n";

        for (var j = 0; j < pendingList.length; j++) {
            var tx2 = pendingList[j];
            var noteLine2 = notes[j] || "";
            if (noteLine2 === "-") noteLine2 = "";
            var amount2 = parseAmountFromEmail(tx2.amountRaw);
            var type2 = getTransactionTypeFromAmount(tx2.amountRaw);
            var typeIcon2 = type2 === "Chi tiêu" ? "💸" : "💰";

            var contentDisplay = tx2.content;
            var noteDisplay = "";

            if (tx2.emailType === "transfer_tx" || tx2.bankType === "VCB") {
                if (noteLine2 !== "") {
                    var mNote = noteLine2.match(/^(.+?)(?:\s*\(([^()]+)\))?$/);
                    if (mNote) {
                        contentDisplay = capitalizeFirstLetter(mNote[1].trim());
                        var nExtracted = mNote[2] ? mNote[2].trim() : "";
                        noteDisplay = nExtracted ? capitalizeFirstLetter(nExtracted) : "";
                    }
                }
            } else {
                var cardName2 = getCardName(tx2.last4);
                noteDisplay = noteLine2 ? noteLine2 + " - " + cardName2 : cardName2;
            }

            var category2 = getCategoryDetail(contentDisplay);
            var categoryIcon2 = loadCategoryCache().get(category2) || "❗";
            var dateDisplay2 = getDateStringFromTransactionTime(tx2.transactionTime);

            resultMsg += "*" + (j + 1) + ". " + typeIcon2 + " " + type2 + "*\n";
            resultMsg += "   *💰 Số tiền:* " + amount2.toLocaleString("vi-VN") + " VND\n";
            resultMsg += "   *📝 Mô tả:* " + escapeMarkdown(contentDisplay) + "\n";
            resultMsg += "   *" + categoryIcon2 + " Danh mục:* " + escapeMarkdown(category2) + "\n";
            resultMsg += "   *📅 Ngày:* " + dateDisplay2 + "\n";
            if (noteDisplay) {
                resultMsg += "   *📌 Ghi chú:* " + escapeMarkdown(noteDisplay) + "\n\n";
            } else {
                resultMsg += "\n";
            }
        }

        if (errors.length > 0) {
            resultMsg += "⚠️ *Lỗi:*\n" + errors.join("\n");
        }

        sendMessage(resultMsg, { parse_mode: "Markdown" });
        return true;
    } catch (e) {
        Logger.log("❌ [EmailSaver] Lỗi confirmAndSaveEmailTransactions: " + e.message);
        sendMessage("❌ *Lỗi khi lưu giao dịch email:* " + e.message, { parse_mode: "Markdown" });
        return false;
    }
}
