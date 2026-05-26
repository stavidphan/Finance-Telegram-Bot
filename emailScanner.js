// ============================================================
// emailScanner.js - Quét email hàng ngày & trigger thủ công
// ============================================================
// processDailyEmails() quét 3 luồng email từ BANK_CONFIG:
//   1. Sao kê thẻ (xử lý + gửi Telegram TRƯỚC)
//   2. Giao dịch thẻ tín dụng + chuyển khoản (pending, gửi SAU)
// ============================================================

// ── Manual trigger qua Telegram /scanmail ───────────────────
function triggerEmailScan() {
    sendMessage("🔍 *Đang quét email giao dịch hôm nay...*", { parse_mode: "Markdown" });
    processDailyEmails();
}

// ============================================================
// HÀM CHÍNH: QUÉT EMAIL HÀNG NGÀY
// ============================================================
function processDailyEmails() {
    try {
        Logger.log("🔍 [EmailScanner] Bắt đầu quét email...");

        // Tính mốc đầu ngày GMT+7
        var gmt7Offset = 7 * 60 * 60 * 1000;
        var nowGmt7 = new Date(new Date().getTime() + gmt7Offset);
        var startOfDayGmt7 = new Date(Date.UTC(
            nowGmt7.getUTCFullYear(),
            nowGmt7.getUTCMonth(),
            nowGmt7.getUTCDate(),
            0, 0, 0, 0
        ) - gmt7Offset);

        Logger.log("📅 [EmailScanner] Tìm email từ: " + startOfDayGmt7.toISOString());

        // Load processed IDs 1 lần vào bộ nhớ → tránh đọc PropertiesService mỗi email
        var processedData = loadProcessedEmailSet();
        var newProcessedIds = []; // Gom tất cả IDs mới → ghi 1 lần cuối

        // Thu thập kết quả từ 4 luồng
        var statements = [];
        var transactions = [];
        var cashbacks = [];

        // ── Luồng 1: Giao dịch thẻ tín dụng ──
        scanEmailStream(
            "creditCardTx",
            getStreamFilters("creditCardTx"),
            parseCreditCardTxEmail,
            startOfDayGmt7,
            transactions,
            processedData.idSet,
            newProcessedIds
        );

        // ── Luồng 2: Giao dịch chuyển khoản ──
        scanEmailStream(
            "transferTx",
            getStreamFilters("transferTx"),
            parseTransferTxEmail,
            startOfDayGmt7,
            transactions,
            processedData.idSet,
            newProcessedIds
        );

        // ── Luồng 3: Sao kê thẻ tín dụng ──
        scanEmailStream(
            "statement",
            getStreamFilters("statement"),
            parseStatementEmail,
            startOfDayGmt7,
            statements,
            processedData.idSet,
            newProcessedIds
        );

        // ── Luồng 4: Sao kê hoàn tiền (Cashback) ──
        scanEmailStream(
            "cashback",
            getStreamFilters("cashback"),
            parseCashbackEmail,
            startOfDayGmt7,
            cashbacks,
            processedData.idSet,
            newProcessedIds
        );

        // Ghi tất cả IDs mới vào PropertiesService 1 lần (thay vì N lần)
        batchMarkEmailsProcessed(newProcessedIds, processedData.records);

        Logger.log("📊 [EmailScanner] Kết quả: " + statements.length + " sao kê, " + transactions.length + " giao dịch.");

        // ── XỬ LÝ SAO KÊ TRƯỚC ──
        if (statements.length > 0) {
            processStatements(statements);
        }

        // ── XỬ LÝ HOÀN TIỀN (CASHBACK) ──
        if (cashbacks.length > 0) {
            processCashbacks(cashbacks);
        }

        // ── XỬ LÝ GIAO DỊCH SAU ──
        if (transactions.length === 0) {
            if (statements.length === 0) {
                sendMessage("✅ *Quét email hoàn tất!*\n📭 Không tìm thấy email giao dịch mới hôm nay.", { parse_mode: "Markdown" });
            } else {
                // Đã gửi sao kê, không có giao dịch thêm
                sendMessage("✅ *Quét email hoàn tất!*\n📭 Không có giao dịch mới ngoài sao kê ở trên.", { parse_mode: "Markdown" });
            }
            return;
        }

        // Lưu pending list
        savePendingTransactions(transactions);

        // Tạo tin nhắn hỏi ghi chú
        var msg = "📧 *Tìm thấy " + transactions.length + " giao dịch từ email hôm nay:*\n\n";
        for (var k = 0; k < transactions.length; k++) {
            var tx = transactions[k];
            var txType = getTransactionTypeFromAmount(tx.amountRaw);
            var txAmount = parseAmountFromEmail(tx.amountRaw);
            var txFormattedAmount = txAmount.toLocaleString("vi-VN") + " VND";
            var txTypeIcon = txType === "Chi tiêu" ? "💸" : "💰";
            var txCardName = (tx.emailType === "transfer_tx" || tx.bankType === "VCB")
                ? "TK VCB " + tx.last4
                : getCardName(tx.last4);

            msg += "*" + (k + 1) + ".* " + txTypeIcon + " " + txType + "\n";
            msg += "   📅 " + tx.transactionTime + "\n";
            if (tx.emailType === "credit_card_tx" || tx.bankType === "MSB") {
                msg += "   🏪 " + escapeMarkdown(tx.content) + "\n";
            }
            if (tx.transferContent) {
                msg += "   📋 " + escapeMarkdown(tx.transferContent) + "\n";
            }
            msg += "   💵 " + txFormattedAmount + "\n";
            msg += "   💳 " + txCardName + "\n\n";
        }

        msg += "📝 *Vui lòng nhập thông tin cho " + transactions.length + " giao dịch trên.*\n";
        msg += "Mỗi giao dịch 1 dòng, đúng thứ tự:\n";
        msg += "• Thẻ tín dụng: Nhập `<Ghi chú>`\n";
        msg += "• Thẻ VCB: Nhập `<Mô tả> (<Ghi chú>)` (Vd: Ăn sáng (Phở))\n";
        msg += "_(Nhập dấu \\- nếu không có ghi chú cho giao dịch đó)_";

        sendMessage(msg, { parse_mode: "Markdown" });

    } catch (e) {
        Logger.log("❌ [EmailScanner] Lỗi processDailyEmails: " + e.message);
        sendMessage("❌ *Lỗi khi quét email:* " + e.message, { parse_mode: "Markdown" });
    }
}

// ============================================================
// QUÉT 1 LUỒNG EMAIL
// ============================================================

/**
 * Quét Gmail theo danh sách filters và parse kết quả
 * @param {string} streamName - Tên luồng (để log)
 * @param {Array} filters - [{sender, subjectKeyword}]
 * @param {Function} parserFn - Hàm parse body email
 * @param {Date} startOfDay - Mốc đầu ngày để lọc
 * @param {Array} resultArray - Mảng để push kết quả vào
 * @param {Object} [processedIdSet] - {emailId: true} đã load sẵn từ loadProcessedEmailSet()
 * @param {Array} [newIdsList] - Mảng để gom IDs mới → batchMarkEmailsProcessed() ghi 1 lần
 */
function scanEmailStream(streamName, filters, parserFn, startOfDay, resultArray, processedIdSet, newIdsList) {
    if (!filters || filters.length === 0) {
        Logger.log("⚠️ [EmailScanner] Luồng '" + streamName + "' không có filter.");
        return;
    }

    for (var i = 0; i < filters.length; i++) {
        var cfg = filters[i];
        Logger.log("🔍 [" + streamName + "] Đang tìm: sender=" + cfg.sender + " | subject=" + cfg.subjectKeyword);

        var query = "from:" + cfg.sender +
            " subject:\"" + cfg.subjectKeyword + "\"" +
            " newer_than:1d";

        var threads = GmailApp.search(query, 0, 50);
        Logger.log("📧 [" + streamName + "] Tìm thấy " + threads.length + " thread(s)");

        for (var t = 0; t < threads.length; t++) {
            var messages = threads[t].getMessages();

            for (var m = 0; m < messages.length; m++) {
                var msg = messages[m];
                var emailId = msg.getId();

                // Bỏ qua email trước mốc đầu ngày
                // if (msg.getDate() < startOfDay) {
                //     Logger.log("⏭️ [" + streamName + "] Bỏ qua email cũ: " + emailId);
                //     continue;
                // }

                try {
                    // Kiểm tra đã xử lý: dùng in-memory idSet nếu có, fallback sang PropertiesService
                    var alreadyProcessed = processedIdSet
                        ? (processedIdSet[emailId] === true)
                        : isEmailProcessed(emailId);

                    if (alreadyProcessed) {
                        Logger.log("⏭️ [" + streamName + "] Email đã xử lý: " + emailId);
                        continue;
                    }

                    var body = msg.getPlainBody();
                    var parsed = parserFn(body);

                    // Đánh dấu đã xử lý: gom vào newIdsList nếu có, fallback sang ghi ngay
                    if (processedIdSet && newIdsList) {
                        processedIdSet[emailId] = true; // Cập nhật cache in-memory để tránh trùng trong cùng lần scan
                        newIdsList.push(emailId);
                    } else {
                        markEmailProcessed(emailId);
                    }

                    if (!parsed) {
                        Logger.log("⚠️ [" + streamName + "] Không parse được email: " + emailId);
                        logErrorToSheet(
                            "Email Parse Error",
                            "Không parse được email " + streamName,
                            "scanEmailStream",
                            { emailId: emailId, subject: msg.getSubject() }
                        );

                        // Gửi thông báo lỗi cho người dùng qua Telegram
                        var streamNameVi = getStreamDisplayName(streamName);
                        var userErrorMsg = "⚠️ *Lỗi xử lý email giao dịch/sao kê*\n\n" +
                            "Hệ thống không thể phân tích nội dung email sau:\n" +
                            "• *Loại:* " + streamNameVi + "\n" +
                            "• *Người gửi:* `" + cfg.sender + "`\n" +
                            "• *Tiêu đề:* " + escapeMarkdown(msg.getSubject()) + "\n" +
                            "• *Thời gian:* `" + Utilities.formatDate(msg.getDate(), "GMT+7", "dd/MM/yyyy HH:mm") + "`\n\n" +
                            "Lỗi đã được ghi lại trong sheet *System Logs*. Bạn hãy kiểm tra lại hoặc nhập thủ công giao dịch này.";
                        sendMessage(userErrorMsg, { parse_mode: "Markdown" });
                        continue;
                    }

                    resultArray.push(parsed);
                    Logger.log("✅ [" + streamName + "] Đã parse email: " + emailId);
                } catch (err) {
                    Logger.log("❌ [" + streamName + "] Lỗi xử lý email " + emailId + ": " + err.message);
                    logErrorToSheet(
                        "Email Processing Error",
                        err.message,
                        "scanEmailStream",
                        { emailId: emailId, subject: msg.getSubject() }
                    );

                    // Đánh dấu đã xử lý để tránh quét lại nhiều lần gây spam
                    if (processedIdSet && newIdsList) {
                        processedIdSet[emailId] = true;
                        newIdsList.push(emailId);
                    } else {
                        markEmailProcessed(emailId);
                    }

                    var streamNameVi = getStreamDisplayName(streamName);
                    var userErrorMsg = "⚠️ *Lỗi xử lý email giao dịch/sao kê*\n\n" +
                        "Hệ thống gặp sự cố khi xử lý email sau:\n" +
                        "• *Loại:* " + streamNameVi + "\n" +
                        "• *Người gửi:* `" + cfg.sender + "`\n" +
                        "• *Tiêu đề:* " + escapeMarkdown(msg.getSubject()) + "\n" +
                        "• *Thời gian:* `" + Utilities.formatDate(msg.getDate(), "GMT+7", "dd/MM/yyyy HH:mm") + "`\n" +
                        "• *Lỗi:* " + escapeMarkdown(err.message) + "\n\n" +
                        "Chi tiết lỗi đã được ghi lại trong sheet *System Logs*. Bạn hãy kiểm tra lại hoặc nhập thủ công.";
                    sendMessage(userErrorMsg, { parse_mode: "Markdown" });
                }
            }
        }
    }
}

/**
 * Lấy tên hiển thị tiếng Việt của luồng email để thông báo cho người dùng
 */
function getStreamDisplayName(streamName) {
    switch (streamName) {
        case "creditCardTx": return "Giao dịch thẻ tín dụng";
        case "transferTx": return "Giao dịch chuyển khoản";
        case "statement": return "Sao kê thẻ tín dụng";
        case "cashback": return "Sao kê hoàn tiền (cashback)";
        default: return streamName;
    }
}

