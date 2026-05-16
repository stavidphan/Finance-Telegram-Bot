// ============================================================
// creditCardTxParser.js - Parse giao dịch thẻ tín dụng
// ============================================================
// Router pattern: detect card number → lookup parser → call
// Thêm parser mới: tạo function parsXXXCreditCardTx(body, last4)
// và thêm vào BANK_CONFIG.creditCardTx.cards
// ============================================================

// ── Registry: map parser name → function ─────────────────────
var CREDIT_CARD_TX_PARSERS = {
    "parseMSBCreditCardTx": parseMSBCreditCardTx,
    "parseVPBankCreditCardTx": parseVPBankCreditCardTx,
    "parseUOBCreditCardTx": parseUOBCreditCardTx,
    "parseHSBCCreditCardTx": parseHSBCCreditCardTx,
    "parseCakeCreditCardTx": parseCakeCreditCardTx
};

/**
 * Router: parse email giao dịch thẻ tín dụng
 * 1. Extract last4 từ body
 * 2. Lookup parser trong BANK_CONFIG
 * 3. Gọi parser cụ thể
 */
function parseCreditCardTxEmail(body) {
    try {
        var rawBody = body.replace(/\r/g, "").trim();
        var cleanBody = rawBody.replace(/[ \t]+/g, " ");

        // Extract last4 từ body (thử nhiều pattern)
        var last4 = extractCreditCardLast4(rawBody, cleanBody);
        if (!last4) {
            Logger.log("⚠️ [CreditCardTxParser] Không tìm thấy số thẻ trong email.");
            return null;
        }

        // Lookup parser
        var cardConfig = BANK_CONFIG.creditCardTx.cards[last4];
        if (!cardConfig) {
            Logger.log("⚠️ [CreditCardTxParser] Thẻ *" + last4 + " không có trong BANK_CONFIG.");
            return null;
        }

        var parserFn = CREDIT_CARD_TX_PARSERS[cardConfig.parser];
        if (!parserFn) {
            Logger.log("❌ [CreditCardTxParser] Parser '" + cardConfig.parser + "' chưa được đăng ký.");
            return null;
        }

        var result = parserFn(rawBody, cleanBody, last4);
        if (result) {
            result.emailType = "credit_card_tx";
        }
        return result;
    } catch (e) {
        Logger.log("❌ [CreditCardTxParser] Lỗi: " + e.message);
        return null;
    }
}

// ── Extract last4 từ body (common patterns) ──────────────────
function extractCreditCardLast4(rawBody, cleanBody) {
    // Pattern 1: extractField "Main Card Number" / "Số thẻ tín dụng"
    var cardStr = extractEmailField(rawBody, "Main Card Number") || extractEmailField(rawBody, "Số thẻ tín dụng");
    if (cardStr) {
        var m = cardStr.match(/(\d{4})$/);
        if (m) return m[1];
    }

    // Pattern 2: MSB format — xxxx-xxxx-xxxx-NNNN
    var cardMatch = cleanBody.match(/\b[xX\*\d]{4}-[xX\*\d]{4}-[xX\*\d]{4}-(\d{4})\b/);
    if (cardMatch) return cardMatch[1];

    // Pattern 3: VPBank format — "MasterCard *NNNN"
    var vpbMatch = rawBody.match(/MasterCard\s+\*(\d{4})/i);
    if (vpbMatch) return vpbMatch[1];

    // Pattern 4: UOB format — "so cuoi NNNN" (email không dấu)
    var uobMatch = rawBody.match(/so cuoi\s+(\d{4})/i);
    if (uobMatch) return uobMatch[1];

    // Pattern 5: HSBC format — "XNNNN" (ví dụ: X1348)
    var hsbcMatch = rawBody.match(/[Xx](\d{4})(?:\b|\s|của)/);
    if (hsbcMatch) return hsbcMatch[1];

    // Pattern 6: CAKE format — "Số thẻ ••NNNN" hoặc ký tự ẩn khác trước 4 chữ số
    var cakeMatch = rawBody.match(/Số thẻ[^\d\n]{1,6}(\d{4})/);
    if (cakeMatch) return cakeMatch[1];

    return null;
}

// ============================================================
// MSB Credit Card Transaction Parser
// ============================================================
function parseMSBCreditCardTx(rawBody, cleanBody, last4) {
    // Số tiền
    var amountStr = extractEmailField(rawBody, "Changed Amount") || extractEmailField(rawBody, "Số tiền thay đổi");
    var amountRaw = null;
    if (amountStr) {
        var mAmount = amountStr.match(/([+-]?[\d,]+(?:\.\d+)?)/);
        if (mAmount) amountRaw = mAmount[1];
    }
    if (!amountRaw) {
        var amountMatch = cleanBody.match(/Changed Amount[\s\S]*?\n\s*([+-]?[\d,]+(?:\.\d+)?)\s*VND/i) || cleanBody.match(/([+-][\d,]+(?:\.\d+)?)\s*VND/i);
        amountRaw = amountMatch ? amountMatch[1].trim() : null;
    }

    // Nội dung
    var content = extractEmailField(rawBody, "Content") || extractEmailField(rawBody, "Nội dung giao dịch");
    if (!content) {
        var contentMatch = cleanBody.match(/Content[\s\S]*?\n\s*(.+?)\s*\n/i) || cleanBody.match(/Nội dung giao dịch[\s\S]*?\n\s*(.+?)\s*\n/i);
        content = contentMatch ? contentMatch[1].trim() : null;
    }

    // Thời gian
    var timeStr = extractEmailField(rawBody, "Transaction time") || extractEmailField(rawBody, "Thời gian giao dịch");
    var transactionTime = null;
    if (timeStr && timeStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
        var mTime = timeStr.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
        if (mTime) transactionTime = mTime[1];
    }
    if (!transactionTime) {
        var fallbackTimeMatch = cleanBody.match(/Transaction time[\s\S]*?\n\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i) || cleanBody.match(/Thời gian giao dịch[\s\S]*?\n\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i);
        transactionTime = fallbackTimeMatch ? fallbackTimeMatch[1].trim() : null;
    }

    Logger.log("✅ [CreditCardTxParser] MSB → last4: " + last4 + ", amount: " + amountRaw + ", content: " + content + ", time: " + transactionTime);

    if (!amountRaw || !content || !transactionTime) {
        Logger.log("⚠️ [CreditCardTxParser] Thiếu dữ liệu MSB.");
        return null;
    }

    return {
        bankType: "MSB",
        last4: last4,
        amountRaw: amountRaw,
        content: content,
        transactionTime: transactionTime
    };
}

// ============================================================
// VPBank Credit Card Transaction Parser
// ============================================================
// Body format đặc biệt: VALUE xuất hiện TRƯỚC label của nó.
// Ví dụ: "- 83,144 VND" rồi mới đến "Số tiền thay đổi / Changed Amount"
// Chiến lược: với mỗi label, tìm dòng không rỗng liền trước nó.
// ============================================================
function parseVPBankCreditCardTx(rawBody, cleanBody, last4) {
    var lines = rawBody.split("\n").map(function (l) { return l.trim(); });

    // Hàm tiện ích: tìm dòng không rỗng liền trước dòng chứa label
    function getPrevValue(labelPattern) {
        for (var i = 1; i < lines.length; i++) {
            if (labelPattern.test(lines[i])) {
                for (var j = i - 1; j >= 0; j--) {
                    if (lines[j] !== "") return lines[j];
                }
            }
        }
        return null;
    }

    // Số tiền: dòng trước "Số tiền thay đổi / Changed Amount"
    var amountLine = getPrevValue(/Số tiền thay đổi|Changed Amount/i);
    var amountRaw = null;
    if (amountLine) {
        var cleanAmt = amountLine.replace(/\*/g, "").trim();
        var mAmt = cleanAmt.match(/([-+]?)\s*([\d,]+(?:\.\d+)?)\s*VND/i);
        if (mAmt) amountRaw = (mAmt[1] || "-") + mAmt[2]; // mặc định âm (chi tiêu)
    }

    // Nội dung: dòng trước "Nội dung / Transaction Content"
    var contentLine = getPrevValue(/Nội dung|Transaction Content/i);
    var content = contentLine ? contentLine.replace(/\*/g, "").trim() : null;

    // Thời gian: dòng trước "Thời gian / Time"
    // Pattern mở rộng: bao gồm cả "Th.i gian" (dề phòng encode khác nhau)
    var timeLine = getPrevValue(/Th.i\s+gian|\bTime\b/i);
    var transactionTime = null;
    if (timeLine) {
        var cleanTime = timeLine.replace(/\*/g, "").trim();
        // Format: "06/05/2026 17:52:33" → lấy "06/05/2026 17:52"
        var mTime = cleanTime.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
        if (mTime) transactionTime = mTime[1] + " " + mTime[2];
    }
    // Fallback: tìm bất kỳ dòng nào chứa DD/MM/YYYY HH:MM trong toàn body
    if (!transactionTime) {
        for (var fi = 0; fi < lines.length; fi++) {
            var fClean = lines[fi].replace(/\*/g, "").trim();
            var fMatch = fClean.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
            if (fMatch) {
                transactionTime = fMatch[1] + " " + fMatch[2];
                break;
            }
        }
    }

    Logger.log("✅ [CreditCardTxParser] VPBank → last4: " + last4 + ", amount: " + amountRaw + ", content: " + content + ", time: " + transactionTime);

    if (!amountRaw || !content || !transactionTime) {
        Logger.log("⚠️ [CreditCardTxParser] Thiếu dữ liệu VPBank.");
        return null;
    }

    return {
        bankType: "VPBANK",
        last4: last4,
        amountRaw: amountRaw,
        content: content,
        transactionTime: transactionTime
    };
}

// ============================================================
// UOB Credit Card Transaction Parser
// ============================================================
// Body format (không dấu):
//   "voi so cuoi 1403 da thuc hien giao dich 90,038 VND vao ngay 14/03/2026"
// ============================================================
function parseUOBCreditCardTx(rawBody, cleanBody, last4) {
    // Số tiền: quét giá trị trước chữ VND (không phụ thuộc vào chuỗi "giao dich")
    var amtMatch = rawBody.match(/([\d,]+)\s*VND/i);
    var amountRaw = amtMatch ? "-" + amtMatch[1] : null;      // Chi tiêu → âm

    // Ngày giao dịch: lấy cụm định dạng DD/MM/YYYY đầu tiên
    var dateMatch = rawBody.match(/(\d{2}\/\d{2}\/\d{4})/);
    var dateStr = dateMatch ? dateMatch[1] : null;

    // Nội dung: không có tên merchant trong body → dùng mô tả chung
    var content = "Giao dịch UOB";

    var transactionTime = dateStr ? dateStr + " 00:00" : null;

    Logger.log("✅ [CreditCardTxParser] UOB → last4: " + last4 + ", amount: " + amountRaw + ", time: " + transactionTime);

    if (!amountRaw || !transactionTime) {
        Logger.log("⚠️ [CreditCardTxParser] Thiếu dữ liệu UOB.");
        return null;
    }

    return {
        bankType: "UOB",
        last4: last4,
        amountRaw: amountRaw,
        content: content,
        transactionTime: transactionTime
    };
}

// ============================================================
// HSBC Credit Card Transaction Parser
// ============================================================
// Body format:
//   "th\u1ebb t\u00edn d\u1ee5ng X1348 ... s\u1ed1 ti\u1ec1n 166,000 VND t\u1ea1i Shopee v\u00e0o ng\u00e0y 07/03/2026"
// L\u01b0u \u00fd: kh\u00f4ng c\u00f3 gi\u1edd \u2192 d\u00f9ng 00:00.
// ============================================================
function parseHSBCCreditCardTx(rawBody, cleanBody, last4) {
    // S\u1ed1 ti\u1ec1n
    var amtMatch = rawBody.match(/s\u1ed1 ti\u1ec1n\s+([\d,]+)\s*VND/i);
    var amountRaw = amtMatch ? "-" + amtMatch[1] : null;    // Chi ti\u00eau \u2192 \u00e2m

    // N\u1ed9i dung: "t\u1ea1i <Merchant> v\u00e0o ng\u00e0y"
    var contentMatch = rawBody.match(/t\u1ea1i\s+(.+?)\s+v\u00e0o\s+ng\u00e0y/i);
    var content = contentMatch ? contentMatch[1].trim() : "Giao d\u1ecbch HSBC";

    // Ng\u00e0y giao d\u1ecbch
    var dateMatch = rawBody.match(/v\u00e0o\s+ng\u00e0y\s+(\d{2}\/\d{2}\/\d{4})/i);
    var transactionTime = dateMatch ? dateMatch[1] + " 00:00" : null;

    Logger.log("\u2705 [CreditCardTxParser] HSBC \u2192 last4: " + last4 + ", amount: " + amountRaw + ", content: " + content + ", time: " + transactionTime);

    if (!amountRaw || !transactionTime) {
        Logger.log("\u26a0\ufe0f [CreditCardTxParser] Thi\u1ebfu d\u1eef li\u1ec7u HSBC.");
        return null;
    }

    return {
        bankType: "HSBC",
        last4: last4,
        amountRaw: amountRaw,
        content: content,
        transactionTime: transactionTime
    };
}

// ============================================================
// CAKE Credit Card Transaction Parser
// ============================================================
// Body format:
//   "Giao dịch Thanh toán thẻ qua ECOM"  (label + value trên cùng dòng)
//   "Giá trị 29.000 đ"   (→ dấu chấm là phân cách nghìn)
//   "Vào lúc 08:45 06/05/2026"
// Lưu ý: body có "giao dịch như sau:" ở trước — cần tránh match sai.
// ============================================================
function parseCakeCreditCardTx(rawBody, cleanBody, last4) {
    var lines = rawBody.split("\n").map(function (l) { return l.trim(); });
    var content = "Giao dịch CAKE";

    // Nội dung: tìm dòng bắt đầu bằng "Giao d" và tiếp theo là giá trị thực
    // Bỏ qua dòng chứa "như sau" (là câu giới thiệu, không phải field)
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // Tránh match câu giới thiệu "giao dịch như sau"
        if (/nhu\s+sau|như\s+sau/i.test(line)) continue;
        // Match dòng "Giao dịch <value>" hoặc "Giao dich <value>" (có dấu hoặc không)
        var m = line.match(/^Giao\s+d.ch\s+(.+)/i);
        if (m && m[1].trim()) {
            content = m[1].trim();
            break;
        }
    }

    // Số tiền: "Giá trị 29.000 đ" → dấu chấm là phân cách nghìn
    var amtMatch = rawBody.match(/Gi.\s+tr.\s+([\d.]+)\s*\u0111/i);
    var amountRaw = null;
    if (amtMatch) {
        var normalized = amtMatch[1].replace(/\./g, ""); // "29.000" → "29000"
        amountRaw = "-" + normalized;
    }

    // Thời gian: "Vào lúc HH:mm DD/MM/YYYY"
    var timeMatch = rawBody.match(/V.o\s+l.c\s+(\d{2}:\d{2})\s+(\d{2}\/\d{2}\/\d{4})/i);
    var transactionTime = timeMatch ? timeMatch[2] + " " + timeMatch[1] : null;

    Logger.log("✅ [CreditCardTxParser] CAKE → last4: " + last4 + ", amount: " + amountRaw + ", content: " + content + ", time: " + transactionTime);

    if (!amountRaw || !transactionTime) {
        Logger.log("⚠️ [CreditCardTxParser] Thiếu dữ liệu CAKE.");
        return null;
    }

    return {
        bankType: "CAKE",
        last4: last4,
        amountRaw: amountRaw,
        content: content,
        transactionTime: transactionTime
    };
}
