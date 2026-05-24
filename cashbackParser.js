// ============================================================
// cashbackParser.js - Parse email sao kê hoàn tiền
// ============================================================

var CASHBACK_PARSERS = {
    "parseMSBCashback": parseMSBCashback,
    "parseVPBankCashback": parseVPBankCashback
};

function parseCashbackEmail(body) {
    try {
        var rawBody = body.replace(/\r/g, "").trim();
        var cardConfig = null;
        var cardKey = null;

        // Tìm kiếm config phù hợp dựa trên nội dung email (last4 hoặc cardTypeKeyword)
        var cards = BANK_CONFIG.cashback.cards;
        for (var key in cards) {
            var entry = cards[key];
            if (rawBody.indexOf(key) !== -1) { // Match last4
                cardConfig = entry;
                cardKey = key;
                break;
            } else if (entry.cardTypeKeyword && rawBody.toLowerCase().indexOf(entry.cardTypeKeyword.toLowerCase()) !== -1) {
                cardConfig = entry;
                cardKey = key;
                break;
            }
        }

        if (!cardConfig) {
            Logger.log("⚠️ [CashbackParser] Không nhận diện được thẻ trong email hoàn tiền.");
            return null;
        }

        var parserFn = CASHBACK_PARSERS[cardConfig.parser];
        if (!parserFn) {
            Logger.log("❌ [CashbackParser] Parser '" + cardConfig.parser + "' chưa được đăng ký.");
            return null;
        }

        var result = parserFn(rawBody, cardKey);
        if (result) {
            result.emailType = "cashback";
            result.cardName = cardConfig.name || ("Thẻ " + cardKey);
            if (!result.cardNumber) result.cardNumber = cardKey;
        }
        return result;
    } catch (e) {
        Logger.log("❌ [CashbackParser] Lỗi: " + e.message);
        return null;
    }
}

// ============================================================
// MSB Cashback Parser
// ============================================================
function parseMSBCashback(rawBody, cardKey) {
    // Xóa xuống dòng để match các cụm từ bị ngắt dòng
    var cleanBody = rawBody.replace(/[\r\n]+/g, " ");

    // Số tiền hoàn
    var amountMatch = cleanBody.match(/được\s+([\d.,]+)\s+VNĐ/i);
    var cashbackAmount = amountMatch ? parseFloat(amountMatch[1].replace(/[.,]/g, "")) : null;

    // Kỳ sao kê
    var periodMatch = cleanBody.match(/từ ngày\s+(\d{2}\/\d{2}\/\d{4})\s+đến\s+(\d{2}\/\d{2}\/\d{4})/i);
    var statementPeriod = periodMatch ? periodMatch[1] + " - " + periodMatch[2] : null;

    Logger.log("✅ [CashbackParser] MSB → card: " + cardKey +
        ", period: " + statementPeriod +
        ", amount: " + cashbackAmount);

    if (cashbackAmount === null || !statementPeriod) {
        Logger.log("⚠️ [CashbackParser] Thiếu dữ liệu hoàn tiền MSB.");
        return null;
    }

    return {
        cardNumber: cardKey,
        statementPeriod: statementPeriod,
        cashbackAmount: cashbackAmount
    };
}

// ============================================================
// VPBank Cashback Parser
// ============================================================
function parseVPBankCashback(rawBody, cardKey) {
    var cleanBody = rawBody.replace(/\*/g, ""); // Xóa ký tự *

    // Số tiền hoàn
    var amountMatch = cleanBody.match(/([\d.,]+)\s+VND\s*[\r\n]+Tổng số tiền hoàn/i);
    var cashbackAmount = amountMatch ? parseFloat(amountMatch[1].replace(/[.,]/g, "")) : null;

    // Kỳ sao kê
    var periodMatch = cleanBody.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\s*[\r\n]+Kỳ sao kê hoàn tiền/i);
    var statementPeriod = periodMatch ? periodMatch[1] + " - " + periodMatch[2] : null;

    // Fallback: Thử tìm trong đoạn văn bản
    if (!cashbackAmount || !statementPeriod) {
        var inlineCleanBody = cleanBody.replace(/[\r\n]+/g, " ");
        var inlineAmountMatch = inlineCleanBody.match(/hoàn thêm\s+([\d.,]+)\s+VND/i);
        if (!cashbackAmount && inlineAmountMatch) {
            cashbackAmount = parseFloat(inlineAmountMatch[1].replace(/[.,]/g, ""));
        }
        var inlinePeriodMatch = inlineCleanBody.match(/từ ngày\s+(\d{2}\/\d{2}\/\d{4})\s+đến\s+(\d{2}\/\d{2}\/\d{4})/i);
        if (!statementPeriod && inlinePeriodMatch) {
            statementPeriod = inlinePeriodMatch[1] + " - " + inlinePeriodMatch[2];
        }
    }

    Logger.log("✅ [CashbackParser] VPBank → card: " + cardKey +
        ", period: " + statementPeriod +
        ", amount: " + cashbackAmount);

    if (cashbackAmount === null || !statementPeriod) {
        Logger.log("⚠️ [CashbackParser] Thiếu dữ liệu hoàn tiền VPBank.");
        return null;
    }

    return {
        cardNumber: cardKey,
        statementPeriod: statementPeriod,
        cashbackAmount: cashbackAmount
    };
}
