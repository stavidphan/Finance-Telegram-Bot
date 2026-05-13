// ============================================================
// transferTxParser.js - Parse giao dịch chuyển khoản
// ============================================================
// Router pattern: detect bank → lookup parser → call
// Thêm ngân hàng: tạo function parseXXXTransferTx(body)
// và thêm vào BANK_CONFIG.transferTx.banks
// ============================================================

var TRANSFER_TX_PARSERS = {
    "parseVCBTransferTx": parseVCBTransferTx
};

/**
 * Router: parse email giao dịch chuyển khoản
 * 1. Detect bank từ body content
 * 2. Lookup parser trong BANK_CONFIG
 * 3. Gọi parser cụ thể
 */
function parseTransferTxEmail(body) {
    try {
        var rawBody = body.replace(/\r/g, "").trim();
        var cleanBody = rawBody.replace(/[ \t]+/g, " ");

        // Detect bank
        var bank = detectTransferBank(rawBody, cleanBody);
        if (!bank) {
            Logger.log("⚠️ [TransferTxParser] Không xác định được ngân hàng.");
            return null;
        }

        var bankConfig = BANK_CONFIG.transferTx.banks[bank];
        if (!bankConfig) {
            Logger.log("⚠️ [TransferTxParser] Bank '" + bank + "' không có trong BANK_CONFIG.");
            return null;
        }

        var parserFn = TRANSFER_TX_PARSERS[bankConfig.parser];
        if (!parserFn) {
            Logger.log("❌ [TransferTxParser] Parser '" + bankConfig.parser + "' chưa được đăng ký.");
            return null;
        }

        var result = parserFn(rawBody, cleanBody);
        if (result) {
            result.emailType = "transfer_tx";
        }
        return result;
    } catch (e) {
        Logger.log("❌ [TransferTxParser] Lỗi: " + e.message);
        return null;
    }
}

// ── Detect bank từ body markers ──────────────────────────────
function detectTransferBank(rawBody, cleanBody) {
    if (rawBody.match(/\*?Trans\.?\s*Date,\s*Time\*?/i) ||
        rawBody.match(/Biên lai chuyển tiền/i) ||
        cleanBody.indexOf("VCBDigibank") !== -1) {
        return "VCB";
    }
    // Thêm detection cho bank khác ở đây:
    // if (cleanBody.indexOf("Techcombank") !== -1) return "TCB";
    return null;
}

// ============================================================
// VCB Transfer Transaction Parser
// ============================================================
function parseVCBTransferTx(rawBody, cleanBody) {
    // Thời gian
    var timeMatchVCB = rawBody.match(/\*?Trans\.?\s*Date,\s*Time\*?\s+(.+?)(?:\n|$)/i);
    var transactionTimeVCB = null;
    if (timeMatchVCB && timeMatchVCB[1]) {
        var mT = timeMatchVCB[1].match(/(\d{2}:\d{2}).*?(\d{2}\/\d{2}\/\d{4})/);
        if (mT) transactionTimeVCB = mT[2] + " " + mT[1];
    }

    // Số tiền
    var amountMatchVCB = rawBody.match(/\*?Amount\*?\s+([\d,]+(?:\.\d+)?)\s*VND/i);
    var amountRawVCB = amountMatchVCB ? "-" + amountMatchVCB[1].trim() : null;

    // Tài khoản
    var debitMatchVCB = rawBody.match(/\*?Debit Account\*?\s+(\d+)/i);
    var last4VCB = debitMatchVCB ? debitMatchVCB[1].slice(-4) : "VCB";

    // Nội dung chuyển tiền (Details of Payment)
    var transferContent = "";
    var detailsMatch = rawBody.match(/\*?Details of Payment\*?\s+(.+?)(?:\n|$)/i);
    if (detailsMatch && detailsMatch[1]) {
        transferContent = detailsMatch[1].trim();
    }

    if (amountRawVCB && transactionTimeVCB) {
        Logger.log("✅ [TransferTxParser] VCB → last4: " + last4VCB + ", amount: " + amountRawVCB + ", time: " + transactionTimeVCB + ", details: " + transferContent);
        return {
            bankType: "VCB",
            last4: last4VCB,
            amountRaw: amountRawVCB,
            content: "Chuyển khoản VCB",
            transferContent: transferContent,
            transactionTime: transactionTimeVCB
        };
    } else {
        Logger.log("⚠️ [TransferTxParser] Thiếu dữ liệu VCB.");
        return null;
    }
}
