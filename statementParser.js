// ============================================================
// statementParser.js - Parse email sao kê thẻ tín dụng
// ============================================================
// Router pattern: detect card number → lookup parser → call
// Mỗi thẻ có thể có body format khác nhau
// Output chung: { emailType, cardNumber, cardName, outstandingBalance,
//                 dueDate, statementPeriod }
// ============================================================

var STATEMENT_PARSERS = {
    "parseMSBStatement": parseMSBStatement,
    "parseVPBankStatement": parseVPBankStatement,
    "parseUOBStatement": parseUOBStatement,
    "parseHSBCStatement": parseHSBCStatement
};

/**
 * Router: parse email sao kê
 * Bước 1: Extract last4 từ body (cho các bank ghi số thẻ trong email, ví dụ: MSB)
 * Bước 2: Nếu không có last4 (hoặc không tìm thấy trong config), scan cardTypeKeyword
 *         trong tất cả entries — dùng cho các bank chỉ ghi tên loại thẻ (ví dụ: VPBank)
 */
function parseStatementEmail(body) {
    try {
        var rawBody = body.replace(/\r/g, "").trim();

        var cardConfig = null;
        var cardKey = null;

        // Bước 1: Thử extract last4 từ body
        var last4 = extractStatementCardLast4(rawBody);
        if (last4) {
            cardConfig = BANK_CONFIG.statement.cards[last4];
            cardKey = last4;
        }

        // Bước 2: Nếu không có last4 hoặc last4 không khớp config,
        //         scan tất cả entries theo cardTypeKeyword
        if (!cardConfig) {
            var cards = BANK_CONFIG.statement.cards;
            for (var key in cards) {
                var entry = cards[key];
                if (entry.cardTypeKeyword && rawBody.indexOf(entry.cardTypeKeyword) !== -1) {
                    cardConfig = entry;
                    cardKey = key;
                    break;
                }
            }
        }

        if (!cardConfig) {
            Logger.log("⚠️ [StatementParser] Không nhận diện được thẻ trong email sao kê.");
            return null;
        }

        var parserFn = STATEMENT_PARSERS[cardConfig.parser];
        if (!parserFn) {
            Logger.log("❌ [StatementParser] Parser '" + cardConfig.parser + "' chưa được đăng ký.");
            return null;
        }

        var result = parserFn(rawBody, cardKey);
        if (result) {
            result.emailType = "statement";
            result.cardName = cardConfig.name || ("Thẻ " + cardKey);
            // cardNumber: lưu key để dùng trong saveStatementToSheet (tìm/cập nhật đúng dòng)
            if (!result.cardNumber) result.cardNumber = cardKey;
        }
        return result;
    } catch (e) {
        Logger.log("❌ [StatementParser] Lỗi: " + e.message);
        return null;
    }
}

// ── Extract last4 từ body sao kê (chỉ dùng khi body có số thẻ) ────────
function extractStatementCardLast4(rawBody) {
    // Pattern — MSB: "Số thẻ/Card number:\n4022-****-****-0204"
    var cardMatch = rawBody.match(/(?:Số thẻ|Card number)[:\s]*\n?\s*[\d\*]{4}-[\d\*]{4}-[\d\*]{4}-(\d{4})/i);
    if (cardMatch) return cardMatch[1];

    // Fallback MSB: any xxxx-****-****-NNNN pattern
    var msbFallback = rawBody.match(/\d{4}-\*{4}-\*{4}-(\d{4})/);
    if (msbFallback) return msbFallback[1];

    // Pattern — HSBC: "43784100xxxx1348" hoặc "xxxx1348"
    var hsbcMatch = rawBody.match(/xxxx(\d{4})/i);
    if (hsbcMatch) return hsbcMatch[1];

    // Pattern — UOB: "so duoi ket thuc 1403" (email không dấu)
    var uobMatch = rawBody.match(/ket thuc\s+(\d{4})/i);
    if (uobMatch) return uobMatch[1];

    // Trả về null nếu không tìm thấy — router sẽ tiếp tục bằng cardTypeKeyword
    return null;
}

// ============================================================
// MSB Statement Parser
// ============================================================
// Body format mẫu:
//   Thẻ tín dụng (loại thẻ)/Credit card type:
//   Visa Online
//   Số thẻ/Card number:
//   4022-****-****-0204
//   Kì sao kê/Statement Period:
//   30/03/2026 - 25/04/2026
//   Dư nợ hiện tại/Outstanding balance:
//   3,417,058
//   Số tiền thanh toán tối thiểu/Minimum amount due:
//   100,000
//   Hạn thanh toán/Due date:
//   10/05/2026
// ============================================================
function parseMSBStatement(rawBody, cardKey) {
    // Kỳ sao kê
    var periodMatch = rawBody.match(/(?:Kì sao kê|Statement Period)[:\s]*\n?\s*([\d\/]+\s*-\s*[\d\/]+)/i);
    var statementPeriod = periodMatch ? periodMatch[1].trim() : null;

    // Dư nợ
    var balanceMatch = rawBody.match(/(?:Dư nợ hiện tại|Outstanding balance)[:\s]*\n?\s*([\d,]+)/i);
    var outstandingBalance = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, "")) : null;

    // Thanh toán tối thiểu
    var minDueMatch = rawBody.match(/(?:Số tiền thanh toán tối thiểu|Minimum amount due)[:\s]*\n?\s*([\d,]+)/i);
    var minimumDue = minDueMatch ? parseFloat(minDueMatch[1].replace(/,/g, "")) : null;

    // Hạn thanh toán
    var dueDateMatch = rawBody.match(/(?:Hạn thanh toán|Due date)[:\s]*\n?\s*(\d{2}\/\d{2}\/\d{4})/i);
    var dueDate = dueDateMatch ? dueDateMatch[1].trim() : null;

    Logger.log("✅ [StatementParser] MSB → card: *" + cardKey +
        ", period: " + statementPeriod +
        ", balance: " + outstandingBalance +
        ", minDue: " + minimumDue +
        ", dueDate: " + dueDate);

    if (!outstandingBalance || !dueDate) {
        Logger.log("⚠️ [StatementParser] Thiếu dữ liệu sao kê MSB.");
        return null;
    }

    return {
        cardNumber: cardKey,
        statementPeriod: statementPeriod || "",
        outstandingBalance: outstandingBalance,
        minimumDue: minimumDue || 0,
        dueDate: dueDate
    };
}

// ============================================================
// VPBank Statement Parser
// ============================================================
// Body format đặc điểm:
//   - Ký sao kê: "Từ DD/MM/YYYY  đến DD/MM/YYYY"
//   - Thanh toán tối thiểu: value (định dạng "VND -X") xuất hiện SAU label
//   - Hạn thanh toán: "17H DD/MM/YYYY" xuất hiện SAU label
//   - Số dư cuối kỳ: value ("VND -X") xuất hiện TRƯỚC label “Số dư cuối kỳ”
//   - Không có số thẻ trong body; nhận diện thẻ qua cardTypeKeyword
// ============================================================
function parseVPBankStatement(rawBody, cardKey) {
    // Xóa dấu * markdown để parse dễ hơn
    var cleanBody = rawBody.replace(/\*/g, "");

    // Kỳ sao kê: "Từ DD/MM/YYYY  đến DD/MM/YYYY"
    var periodMatch = cleanBody.match(/Từ\s+(\d{2}\/\d{2}\/\d{4})\s+đến\s+(\d{2}\/\d{2}\/\d{4})/i);
    var statementPeriod = periodMatch ? periodMatch[1] + " - " + periodMatch[2] : null;

    // Thanh toán tối thiểu: "VND -X" xuất hiện SAU "Minimum Amount Due"
    var minDueMatch = cleanBody.match(/Minimum Amount Due[\s\S]{0,80}?VND\s+[-]?([\d,]+(?:\.\d+)?)/i);
    var minimumDue = minDueMatch ? parseFloat(minDueMatch[1].replace(/,/g, "")) : 0;

    // Hạn thanh toán: xuất hiện SAU "Payment Due Date", format "17H DD/MM/YYYY"
    // Yêu cầu xuống dòng ngay sau "Payment Due Date" để tránh match nhầm
    // cụm "payment due date" trong câu intro ("...payment due date with details below:")
    var dueDateMatch = cleanBody.match(/Payment Due Date\s*[\r\n]+[\s\S]{0,80}?(?:\d+H\s+)?(\d{2}\/\d{2}\/\d{4})/i);
    var dueDate = dueDateMatch ? dueDateMatch[1] : null;

    // Số dư cuối kỳ: "VND -X" xuất hiện TRƯỚC "Số dư cuối kỳ / Outstanding Balance"
    // Match lần xuất hiện đầu tiên (trước phần trả góp nếu có)
    var balanceMatch = cleanBody.match(/VND\s+[-]?([\d,]+(?:\.\d+)?)\s*\n[^\n]*(?:Số dư cuối kỳ|Outstanding Balance)/i);
    var outstandingBalance = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, "")) : null;

    Logger.log("✅ [StatementParser] VPBank → key: " + cardKey +
        ", period: " + statementPeriod +
        ", balance: " + outstandingBalance +
        ", minDue: " + minimumDue +
        ", dueDate: " + dueDate);

    if (!outstandingBalance || !dueDate) {
        Logger.log("⚠️ [StatementParser] Thiếu dữ liệu sao kê VPBank.");
        return null;
    }

    return {
        cardNumber: cardKey,
        statementPeriod: statementPeriod || "",
        outstandingBalance: outstandingBalance,
        minimumDue: minimumDue,
        dueDate: dueDate
    };
}

// ============================================================
// UOB Statement Parser
// ============================================================
// Body format (không dấu):
//   "so duoi ket thuc 1403 den han thanh toan vao ngay 29/04/26"
//   "Khoan thanh toan toi thieu la VND 50,000."
//   "Tong thanh toan den han la VND 90,038."
// Lưu ý: ngày có thể dùng năm 2 chữ số ("29/04/26") → cần chuẩn hóa.
// ============================================================
function parseUOBStatement(rawBody, cardKey) {
    // Hàm chuẩn hóa năm 2 chữ số → 4 chữ số
    function normalizeYear(dateStr) {
        return dateStr.replace(/(\d{2}\/\d{2}\/)(\/?)(\'?)(\d{2})$/, function (m, prefix, s1, s2, yy) {
            return prefix + "20" + yy;
        });
    }

    // Hạn thanh toán: "vao ngay DD/MM/YY" hoặc "DD/MM/YYYY"
    // \s+ thay dấu cách đơn để xử lý line wrap ("vao\nngay DD/MM/YY")
    var dueDateMatch = rawBody.match(/vao\s+ngay\s+(\d{2}\/\d{2}\/\d{2,4})/i);
    var dueDate = null;
    if (dueDateMatch) {
        var raw = dueDateMatch[1];
        // Nếu năm 2 chữ số, thêm "20" phía trước
        dueDate = raw.match(/\d{4}$/) ? raw : raw.replace(/(\d{2})$/, "20$1");
    }

    // Thanh toán tối thiểu: "VND 50,000"
    var minDueMatch = rawBody.match(/toi thieu la VND\s+([\d,]+)/i);
    var minimumDue = minDueMatch ? parseFloat(minDueMatch[1].replace(/,/g, "")) : 0;

    // Tổng dư nợ: "Tong thanh toan den han la VND 90,038"
    var balanceMatch = rawBody.match(/Tong thanh toan den han la VND\s+([\d,]+)/i);
    var outstandingBalance = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, "")) : null;

    Logger.log("✅ [StatementParser] UOB → key: " + cardKey +
        ", balance: " + outstandingBalance +
        ", minDue: " + minimumDue +
        ", dueDate: " + dueDate);

    if (!outstandingBalance || !dueDate) {
        Logger.log("⚠️ [StatementParser] Thiếu dữ liệu sao kê UOB.");
        return null;
    }

    return {
        cardNumber: cardKey,
        statementPeriod: "",
        outstandingBalance: outstandingBalance,
        minimumDue: minimumDue,
        dueDate: dueDate
    };
}

// ============================================================
// HSBC Statement Parser
// ============================================================
// Body format:
//   "Thẻ Tín Dụng: 43784100xxxx1348."
//   "Dư nợ cuối kỳ: 1.150.671 VNĐ."   (dấu chấm là phân cách nghìn)
//   "Thanh toán tối thiểu: 50.000 VNĐ."
//   "Ngày đến hạn thanh toán: 02/05/26."
// Lưu ý: số tiền dùng dấu chấm làm phân cách nghìn (không phải thập phân).
// ============================================================
function parseHSBCStatement(rawBody, cardKey) {
    // Hàm parse số tiền HSBC: "1.150.671" → 1150671 (xóa dấu chấm phân cách nghìn)
    function parseHSBCAmount(str) {
        return parseFloat(str.replace(/\./g, "")) || 0;
    }

    // Kỳ sao kê: "tháng 04/2026" từ tiêu đề email
    var periodMatch = rawBody.match(/Sao Kê\s+tháng\s+([\d\/]+)/i);
    var statementPeriod = periodMatch ? "Tháng " + periodMatch[1] : "";

    // Dư nợ cuối kỳ
    var balanceMatch = rawBody.match(/Dư nợ cuối kỳ:\s+([\d.]+)\s*VN/i);
    var outstandingBalance = balanceMatch ? parseHSBCAmount(balanceMatch[1]) : null;

    // Thanh toán tối thiểu
    var minDueMatch = rawBody.match(/Thanh toán tối thiểu:\s+([\d.]+)\s*VN/i);
    var minimumDue = minDueMatch ? parseHSBCAmount(minDueMatch[1]) : 0;

    // Hạn thanh toán: "02/05/26" → "02/05/2026"
    var dueDateMatch = rawBody.match(/Ngày đến hạn thanh toán:\s+(\d{2}\/\d{2}\/(\d{2,4}))/i);
    var dueDate = null;
    if (dueDateMatch) {
        var raw = dueDateMatch[1];
        dueDate = raw.match(/\d{4}$/) ? raw : raw.replace(/(\d{2})$/, "20$1");
    }

    Logger.log("✅ [StatementParser] HSBC → key: " + cardKey +
        ", period: " + statementPeriod +
        ", balance: " + outstandingBalance +
        ", minDue: " + minimumDue +
        ", dueDate: " + dueDate);

    if (!outstandingBalance || !dueDate) {
        Logger.log("⚠️ [StatementParser] Thiếu dữ liệu sao kê HSBC.");
        return null;
    }

    return {
        cardNumber: cardKey,
        statementPeriod: statementPeriod,
        outstandingBalance: outstandingBalance,
        minimumDue: minimumDue,
        dueDate: dueDate
    };
}
