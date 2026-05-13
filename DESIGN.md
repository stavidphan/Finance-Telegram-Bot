# Email Processor — Architecture & Design

Hệ thống tự động quét email ngân hàng, trích xuất giao dịch, và ghi vào Google Sheet thông qua Telegram chatbot.

---

## Mục lục

- [Tổng quan kiến trúc](#tổng-quan-kiến-trúc)
- [Cấu trúc file](#cấu-trúc-file)
- [3 luồng email](#3-luồng-email)
- [BANK_CONFIG — Cấu hình tập trung](#bank_config--cấu-hình-tập-trung)
- [Luồng xử lý chính](#luồng-xử-lý-chính)
- [Google Sheet layout](#google-sheet-layout)
- [Nhắc thanh toán](#nhắc-thanh-toán)
- [Lưu trữ tạm (PropertiesService)](#lưu-trữ-tạm-propertiesservice)
- [Hướng dẫn mở rộng](#hướng-dẫn-mở-rộng)

---

## Tổng quan kiến trúc

```
Telegram (/scanmail)  ──→  emailScanner.js (orchestrator)
       hoặc                       │
Daily Trigger (21:00)             ├── scanEmailStream("creditCardTx")
                                  ├── scanEmailStream("transferTx")
                                  └── scanEmailStream("statement")
                                          │
                    ┌─────────────────────┤
                    ▼                     ▼
            Sao kê (xử lý ngay)   Giao dịch (pending)
            statementManager.js    emailSaver.js
            ├─ Lưu sheet J25+     ├─ Lưu pending vào PropertiesService
            ├─ Tạo Calendar event  ├─ Gửi Telegram hỏi ghi chú
            ├─ Lưu due date       └─ User reply → confirmAndSave
            └─ Gửi Telegram              ├─ Lưu bảng chính (A-F)
                                          └─ Lưu bảng riêng thẻ (Q+)
```

**Nguyên tắc thiết kế:**
- **Filter-based classification**: email type xác định bởi sender/subject match trong `BANK_CONFIG`, không detect từ body
- **Router + per-card/bank parser**: mỗi luồng có 1 router function, route đến parser cụ thể dựa trên card number hoặc bank
- **Self-contained config**: mỗi card/bank entry trong `BANK_CONFIG` chứa đủ thông tin (name, parser, sender, subjectKeyword)

---

## Cấu trúc file

| File | Chức năng | Phụ thuộc |
|------|-----------|-----------|
| `emailConfig.js` | `BANK_CONFIG` + helpers (`getCardName`, `getStreamFilters`) | — |
| `emailHelpers.js` | Utility functions dùng chung (parse amount, date, ...) | — |
| `creditCardTxParser.js` | Router + MSB parser cho giao dịch thẻ tín dụng | `emailConfig`, `emailHelpers` |
| `transferTxParser.js` | Router + VCB parser cho giao dịch chuyển khoản | `emailConfig`, `emailHelpers` |
| `statementParser.js` | Router + MSB parser cho sao kê | `emailConfig` |
| `creditCardLedger.js` | Bảng giao dịch riêng từng thẻ (cột Q+) | `emailConfig` |
| `statementManager.js` | Lưu sao kê vào sheet + nhắc thanh toán | `emailConfig` |
| `emailSaver.js` | Pending management + lưu giao dịch vào sheet | `emailHelpers`, `creditCardLedger` |
| `emailScanner.js` | Orchestrator: quét 3 luồng, điều phối xử lý | Tất cả file trên |
| `app.js` | Telegram bot chính, sheet management, commands | `emailScanner`, `emailSaver` |

> **Lưu ý:** Google Apps Script share global scope — tất cả file `.js` trong project đều truy cập được function/variable của nhau mà không cần `import`.

---

## 3 luồng email

### Luồng 1: Giao dịch thẻ tín dụng (`credit_card_tx`)

- **Nguồn**: Email thông báo biến động thẻ tín dụng
- **Parser router**: `parseCreditCardTxEmail(body)` → detect `last4` từ body → lookup `BANK_CONFIG.creditCardTx.cards[last4].parser` → gọi parser cụ thể
- **Output**: `{ emailType, bankType, last4, amountRaw, content, transactionTime }`
- **Lưu trữ**: Bảng chính (A-F) + Bảng riêng thẻ (Q+)

### Luồng 2: Giao dịch chuyển khoản (`transfer_tx`)

- **Nguồn**: Email biên lai chuyển tiền
- **Parser router**: `parseTransferTxEmail(body)` → detect bank từ body markers → lookup `BANK_CONFIG.transferTx.banks[bank].parser`
- **Output**: `{ emailType, bankType, last4, amountRaw, content, transferContent, transactionTime }`
  - `transferContent`: nội dung "Details of Payment" từ email VCB (hiển thị kèm trong Telegram để user dễ nhận biết)
- **Lưu trữ**: Chỉ bảng chính (A-F)

### Luồng 3: Sao kê thẻ tín dụng (`statement`)

- **Nguồn**: Email sao kê hàng tháng
- **Parser router**: `parseStatementEmail(body)` → detect `last4` từ body → lookup `BANK_CONFIG.statement.cards[last4].parser`
- **Output**: `{ emailType, cardNumber, cardName, outstandingBalance, dueDate, statementPeriod, minimumDue }`
- **Lưu trữ**: Khu vực sao kê trên sheet (J25+)
- **Side effect**: Tạo reminder (ScriptApp trigger + Google Calendar)

---

## BANK_CONFIG — Cấu hình tập trung

```javascript
// emailConfig.js
var BANK_CONFIG = {
    creditCardTx: {
        cards: {
            "<last4>": {
                name: "Tên hiển thị",    // VD: "MSB VISA ONLINE 0204"
                bank: "Mã bank",         // VD: "MSB"
                parser: "tên function",  // VD: "parseMSBCreditCardTx"
                sender: "email sender",  // VD: "banking_notify@msb.com.vn"
                subjectKeyword: "keyword trong tiêu đề email"
            }
        }
    },
    transferTx: {
        banks: {
            "<mã bank>": {
                name: "Tên bank",
                parser: "tên function",
                sender: "email sender",
                subjectKeyword: "keyword"
            }
        }
    },
    statement: {
        cards: {
            "<last4>": {
                parser: "tên function",
                sender: "email sender",
                subjectKeyword: "keyword"
            }
        }
    }
};
```

**`getStreamFilters(streamName)`** — Tự động trích xuất danh sách `{sender, subjectKeyword}` duy nhất từ các entries trong 1 stream để quét Gmail.

---

## Luồng xử lý chính

### Quét email (`processDailyEmails`)

```
1. Tính mốc đầu ngày GMT+7
2. Load processedEmailIds 1 lần vào bộ nhớ (loadProcessedEmailSet) → tránh đọc PropertiesService mỗi email
3. Với mỗi luồng (creditCardTx, transferTx, statement):
   a. getStreamFilters() → lấy filters từ BANK_CONFIG
   b. Với mỗi filter → GmailApp.search(from + subject + newer_than:1d)
   c. Với mỗi email:
      - Bỏ qua nếu trước mốc đầu ngày
      - Bỏ qua nếu đã xử lý (kiểm tra in-memory idSet)
      - Parse body → phân loại vào statements[] hoặc transactions[]
      - Gom emailId vào newProcessedIds[]
4. Ghi toàn bộ newProcessedIds 1 lần vào PropertiesService (batchMarkEmailsProcessed)
5. Xử lý sao kê TRƯỚC (processStatements)
6. Xử lý giao dịch SAU (savePendingTransactions → gửi Telegram hỏi ghi chú)
```

### Lưu giao dịch (`confirmAndSaveEmailTransactions`)

```
1. User reply ghi chú (1 dòng/giao dịch) → doPost() → confirmAndSaveEmailTransactions()
2. Với mỗi giao dịch pending:
   a. Parse ghi chú:
      - Thẻ tín dụng: "<ghi chú>" → note = "<ghi chú> - <tên thẻ>" (không có tiền tố "thẻ")
      - Chuyển khoản VCB: "<mô tả> (<ghi chú>)" → content + note riêng
   b. Xây dựng rowData [ngày, loại, danh mục, số tiền, mô tả, ghi chú]
3. Bulk insert vào bảng chính (A-F) theo tháng — getSheetByMonth với lightMode=true để bỏ qua setup nặng
4. Cập nhật chart 1 lần/sheet sau khi đã insert xong tất cả
5. Ghi vào bảng riêng thẻ tín dụng (Q+) — batch per sheet (saveCreditCardSubLedgerBatch)
6. Gửi Telegram xác nhận
```

### Router pattern (ví dụ creditCardTxParser)

```
parseCreditCardTxEmail(body)          ← Router
  ├─ extractCreditCardLast4(body)     ← Detect card number
  ├─ BANK_CONFIG.creditCardTx.cards[last4].parser  ← Lookup
  └─ CREDIT_CARD_TX_PARSERS[parser](body, last4)   ← Call
         └─ parseMSBCreditCardTx(rawBody, cleanBody, last4)  ← Concrete parser
```

**Thêm parser mới:**
1. Viết function `parseXXXCreditCardTx(rawBody, cleanBody, last4)` trả về `{ bankType, last4, amountRaw, content, transactionTime }`
2. Đăng ký vào registry: `CREDIT_CARD_TX_PARSERS["parseXXXCreditCardTx"] = parseXXXCreditCardTx;`
3. Thêm entry vào `BANK_CONFIG.creditCardTx.cards`

---

## Google Sheet layout

### Bảng chính (cột A-H) — mỗi sheet = 1 tháng (format: `MM-YYYY`)

| Cột | Nội dung | Ví dụ |
|-----|----------|-------|
| A | Ngày (hoặc ngày giờ) | `05/04` hoặc `22/04/2026 21:42` |
| B | Loại giao dịch | `Chi tiêu` / `Thu nhập` |
| C | Danh mục (từ sheet "Từ khóa") | `Ăn uống`, `Đi lại` |
| D | Số tiền | `143,100` |
| E | Mô tả | `Đồ xăng`, `Chuyển khoản VCB` |
| F | Ghi chú | `Ăn trưa - thẻ MSB MDIGI 0487` |
| G | Tổng thu nhập (formula) | `=SUMIF(B:B;"Thu nhập";D:D)` |
| H | Tổng chi tiêu (formula) | `=SUMIF(B:B;"Chi tiêu";D:D)` |

### Khu vực biểu đồ (cột J-L, row 1-11)

| Cột | Nội dung |
|-----|----------|
| J | Danh mục (cho chart) |
| K | Số tiền (cho chart) |
| L | Label (danh mục + % + số tiền) |

Chart: Pie chart vị trí J4, kích thước 500x400px.

### Khu vực sao kê (cột J-M, row 25-27+)

| Row | J | K | L | M |
|-----|---|---|---|---|
| 25 | 📋 Sao kê thẻ tín dụng (merged) | | | |
| 26 | Tên thẻ | Dư nợ | Hạn thanh toán | Kỳ sao kê |
| 27+ | MSB VISA ONLINE 0204 | 3,417,058 | 10/05/2026 | 30/03 - 25/04/2026 |

- Sheet xác định bởi due date month
- Nếu cùng thẻ đã có → update row cũ (không tạo mới)

> **⚠️ QUAN TRỌNG**: Khi insert vào bảng chính (A-F), luôn dùng `getLastMainTableRow(sheet)` thay vì `sheet.getLastRow()` để tránh insert vào khu vực sao kê hoặc chart.

### Bảng riêng thẻ tín dụng (cột Q+)

Mỗi thẻ chiếm 3 cột liên tiếp, bắt đầu từ cột Q (17):

| | Q | R | S | T | U | V |
|---|---|---|---|---|---|---|
| Row 1 | MSB MDIGI 0487 (merged) | | | MSB VISA ONLINE 0204 (merged) | | |
| Row 2 | Ngày giờ | Số tiền | Ghi chú | Ngày giờ | Số tiền | Ghi chú |
| Row 3+ | 22/04/2026 21:42 | 143,100 | Ăn trưa | ... | ... | ... |

- Công thức: `cột bắt đầu = 17 + (thứ tự thẻ × 3)`
- Ghi chú **không** có đuôi "- thẻ XXX" (khác với bảng chính)
- Thứ tự thẻ = thứ tự key trong `BANK_CONFIG.creditCardTx.cards`

---

## Nhắc thanh toán

### ScriptApp Trigger

- **Trigger**: Daily lúc 22:00 GMT+7
- **Function**: `checkAndRemindDueDates()`
- **Setup**: `setupDueDateCheckTrigger()` — idempotent: tự detect trigger đã tồn tại, bỏ qua nếu có
- **Lưu trữ**: Due dates lưu trong `PropertiesService` key `statementDueDates`
- **Hành vi**:
  - Còn 3 ngày → gửi Telegram ⚠️
  - Còn 1 ngày → gửi Telegram 🚨
  - Quá hạn → tự động xóa khỏi storage

### Google Calendar

- **Function**: `createCalendarReminder(statementData)`
- **Event**: All-day event vào ngày due date
- **Reminders**: Popup + Email trước 3 ngày và 1 ngày
- Xóa event cũ cùng title trước khi tạo mới (tránh trùng)

---

## Lưu trữ tạm (PropertiesService)

| Key | Mục đích | Format |
|-----|----------|--------|
| `pendingEmailTransactions` | Giao dịch chờ user nhập ghi chú | `JSON array` of transaction objects |
| `processedEmailIds` | Chống trùng lặp email (TTL 7 ngày) | `JSON array` of `{id, ts}` |
| `statementDueDates` | Due dates cho nhắc thanh toán | `JSON object` keyed by card number |
| `categoryCache` | Cache danh mục từ sheet "Từ khóa" | `JSON array` of `[category, icon]` |
| `keywordCache` | Cache từ khóa phân loại | `JSON array` of `[keyword, category]` |

---

## Hướng dẫn mở rộng

### Thêm thẻ tín dụng mới (cùng bank MSB)

Chỉ cần thêm 1 entry vào `BANK_CONFIG.creditCardTx.cards` trong `emailConfig.js`:

```javascript
"1234": {
    name: "MSB NEW CARD 1234",
    bank: "MSB",
    parser: "parseMSBCreditCardTx",  // Dùng lại parser MSB
    sender: "banking_notify@msb.com.vn",
    subjectKeyword: "Biến động chi tiêu thẻ tín dụng"
}
```

→ Tự động: quét email, parse, tạo bảng riêng cột tiếp theo (W-Y), lưu giao dịch.

### Thêm thẻ tín dụng bank khác (VD: Techcombank)

1. **`emailConfig.js`** — Thêm entry với parser mới:
```javascript
"5678": {
    name: "TCB VISA 5678",
    bank: "TCB",
    parser: "parseTCBCreditCardTx",
    sender: "notify@techcombank.com.vn",
    subjectKeyword: "Thông báo giao dịch thẻ"
}
```

2. **`creditCardTxParser.js`** — Viết parser + đăng ký:
```javascript
function parseTCBCreditCardTx(rawBody, cleanBody, last4) {
    // Parse body format của Techcombank
    return { bankType: "TCB", last4: last4, amountRaw: ..., content: ..., transactionTime: ... };
}
CREDIT_CARD_TX_PARSERS["parseTCBCreditCardTx"] = parseTCBCreditCardTx;
```

### Thêm ngân hàng chuyển khoản mới

1. **`emailConfig.js`** — Thêm vào `BANK_CONFIG.transferTx.banks`
2. **`transferTxParser.js`** — Viết parser, đăng ký vào `TRANSFER_TX_PARSERS`, thêm detection vào `detectTransferBank()`

### Thêm sao kê thẻ mới

1. **`emailConfig.js`** — Thêm vào `BANK_CONFIG.statement.cards`
2. **`statementParser.js`** — Viết parser, đăng ký vào `STATEMENT_PARSERS`
