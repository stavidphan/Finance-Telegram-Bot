// ============================================================
// emailConfig.js - Cấu hình tập trung cho hệ thống quét email
// ============================================================
// Thêm thẻ/ngân hàng mới: chỉ cần thêm entry vào BANK_CONFIG
// và tạo parser function tương ứng.
// ============================================================

/**
 * BANK_CONFIG - Cấu hình tập trung cho 3 luồng email:
 * 1. creditCardTx: Giao dịch thẻ tín dụng
 * 2. transferTx: Giao dịch chuyển khoản
 * 3. statement: Sao kê thẻ tín dụng
 *
 * Mỗi card/bank entry chứa đầy đủ: name, parser, sender, subjectKeyword
 * → Thêm thẻ/ngân hàng mới chỉ cần thêm 1 entry duy nhất.
 */
var BANK_CONFIG = {
    // ── Luồng 1: Giao dịch thẻ tín dụng ──────────────────────
    creditCardTx: {
        cards: {
            "0487": {
                name: "MSB MDIGI 0487",
                bank: "MSB",
                parser: "parseMSBCreditCardTx",
                sender: "banking_notify@msb.com.vn",
                subjectKeyword: "Biến động"
            },
            "0204": {
                name: "MSB VISA ONLINE 0204",
                bank: "MSB",
                parser: "parseMSBCreditCardTx",
                sender: "banking_notify@msb.com.vn",
                subjectKeyword: "Biến động"
            },
            "6458": {
                name: "VPBank StepUp 6458",
                bank: "VPBANK",
                parser: "parseVPBankCreditCardTx",
                sender: "customercare@care.vpb.com.vn",
                subjectKeyword: "VPBank xin thong bao bien dong so du"
            },
            "3605": {
                name: "VPBank World 3605",
                bank: "VPBANK",
                parser: "parseVPBankCreditCardTx",
                sender: "customercare@care.vpb.com.vn",
                subjectKeyword: "VPBank xin thong bao bien dong so du"
            },
            "1403": {
                name: "UOB Prvi Miles 1403",
                bank: "UOB",
                parser: "parseUOBCreditCardTx",
                sender: "unialerts@uobgroup.com",
                subjectKeyword: "Card Transaction Alert"
            },
            "1348": {
                name: "HSBC Live+ 1348",
                bank: "HSBC",
                parser: "parseHSBCCreditCardTx",
                sender: "HSBC@notification.hsbc.com.hk",
                subjectKeyword: "Purchase"
            },
            "0934": {
                name: "CAKE 0934",
                bank: "CAKE",
                parser: "parseCakeCreditCardTx",
                sender: "no-reply@cake.vn",
                subjectKeyword: "Thông báo giao dịch thẻ tín dụng Cake"
            }
            // Thêm thẻ mới:
            // "1234": { name: "TCB VISA 1234", bank: "TCB", parser: "parseTCBCreditCardTx",
            //           sender: "notify@tcb.com.vn", subjectKeyword: "Thông báo giao dịch thẻ" }
        }
    },

    // ── Luồng 2: Giao dịch chuyển khoản ──────────────────────
    transferTx: {
        banks: {
            "VCB": {
                name: "Vietcombank",
                parser: "parseVCBTransferTx",
                sender: "VCBDigibank@info.vietcombank.com.vn",
                subjectKeyword: "Biên lai chuyển tiền qua tài khoản"
            }
            // Thêm ngân hàng mới:
            // "TCB": { name: "Techcombank", parser: "parseTCBTransferTx",
            //          sender: "notify@tcb.com.vn", subjectKeyword: "Thông báo giao dịch" }
        }
    },

    // ── Luồng 3: Sao kê thẻ tín dụng ─────────────────────────
    statement: {
        cards: {
            // ── MSB: key = 4 số cuối thẻ (có trong body email) ──
            "0487": {
                name: "MSB MDIGI 0487",
                bank: "MSB",
                parser: "parseMSBStatement",
                sender: "cardservicedesk@services.msb.com.vn",
                subjectKeyword: "sao kê"
            },
            "0204": {
                name: "MSB VISA ONLINE 0204",
                bank: "MSB",
                parser: "parseMSBStatement",
                sender: "cardservicedesk@services.msb.com.vn",
                subjectKeyword: "sao kê"
            },
            // ── VPBank: key = định danh nội bộ (body không có số thẻ) ──
            // cardTypeKeyword: chuỗi xuất hiện trong body email để nhận diện thẻ.
            // Dùng khi ngân hàng không ghi số thẻ trong email sao kê,
            // chỉ ghi tên loại thẻ (VD: "MC StepUp Credit", "MC World Credit").
            "VPBANK_STEPUP": {
                name: "VPBank StepUp 6458",
                bank: "VPBANK",
                parser: "parseVPBankStatement",
                sender: "customercare@care.vpb.com.vn",
                subjectKeyword: "Sao kê thẻ tín dụng",
                cardTypeKeyword: "MC StepUp Credit"
            },
            "VPBANK_WORLD": {
                name: "VPBank World 3605",
                bank: "VPBANK",
                parser: "parseVPBankStatement",
                sender: "customercare@care.vpb.com.vn",
                subjectKeyword: "Sao ke the tin dung",
                cardTypeKeyword: "MC World Credit"
            },
            // ── UOB/HSBC: key = 4 số cuối (có trong body email sao kê) ──
            "1403": {
                name: "UOB Prvi Miles 1403",
                bank: "UOB",
                parser: "parseUOBStatement",
                sender: "unialerts@uobgroup.com",
                subjectKeyword: "Credit Card Payment Reminder"
            },
            "1348": {
                name: "HSBC Live+ 1348",
                bank: "HSBC",
                parser: "parseHSBCStatement",
                sender: "HSBC@informationservices.hsbc.com.vn",
                subjectKeyword: "BẢNG TÓM TẮT SAO KÊ THẺ TÍN DỤNG"
            }
            // Thẻ mới có số thẻ trong body → dùng key = last4.
            // Thẻ không có số thẻ trong body → dùng key nội bộ + cardTypeKeyword (xem VPBank).
        }
    }
};

// ── Helper: Lấy tên thẻ từ 4 số cuối ────────────────────────
function getCardName(last4) {
    var card = BANK_CONFIG.creditCardTx.cards[last4];
    return card ? card.name : last4; // Fallback: trả về last4 nếu không tìm thấy
}

// ── Helper: Lấy danh sách tất cả credit card last4 (theo thứ tự) ──
function getCreditCardList() {
    return Object.keys(BANK_CONFIG.creditCardTx.cards);
}

/**
 * Helper: Trích xuất danh sách filters duy nhất từ entries của 1 stream
 * Dùng để quét Gmail — dedup theo sender+subjectKeyword
 * @param {string} streamName - "creditCardTx" | "transferTx" | "statement"
 * @returns {Array} [{sender, subjectKeyword}]
 */
function getStreamFilters(streamName) {
    var stream = BANK_CONFIG[streamName];
    if (!stream) return [];

    var entries = stream.cards || stream.banks || {};
    var seen = {};
    var filters = [];

    for (var key in entries) {
        var entry = entries[key];
        if (entry.sender && entry.subjectKeyword) {
            var dedupKey = entry.sender + "|" + entry.subjectKeyword;
            if (!seen[dedupKey]) {
                seen[dedupKey] = true;
                filters.push({ sender: entry.sender, subjectKeyword: entry.subjectKeyword });
            }
        }
    }

    return filters;
}