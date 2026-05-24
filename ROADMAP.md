# Phin Finance Bot — Roadmap

Tài liệu mô tả tính năng hiện tại và hướng phát triển. Dùng cho agent và developer để hiểu context.

---

## Tính năng đã hoàn thành ✅

### Core — Ghi giao dịch thủ công
- [x] Nhập giao dịch qua Telegram (format: `<số tiền> <mô tả> (<ghi chú>)`)
- [x] Hỗ trợ shorthand số tiền: `50k`, `1.5m`, `1m5`
- [x] Phân loại tự động theo từ khóa (sheet "Từ khóa")
- [x] Ghi vào sheet tháng tương ứng (tạo sheet tự động nếu chưa có)
- [x] Sửa giao dịch gần nhất (`/suaphanloai`, `/suadinhdang`, `/suanoidung`)

### Email Processing — Quét email ngân hàng
- [x] Kiến trúc 4 luồng modular (credit card tx, transfer tx, statement, cashback)
- [x] Router + per-card/bank parser pattern
- [x] BANK_CONFIG tập trung: mỗi card/bank entry chứa đủ name, parser, sender, subjectKeyword
- [x] Quét thủ công `/scanmail` + daily trigger tự động
- [x] Chống trùng lặp email (processedEmailIds, TTL 7 ngày)
- [x] Pending transaction flow: quét → user ghi chú → lưu
- [x] **VCB: parse và hiển thị nội dung chuyển khoản** ("Details of Payment") khi thông báo giao dịch

### Banks & Cards đã hỗ trợ
- [x] **MSB** thẻ tín dụng: MDIGI 0487, VISA ONLINE 0204
- [x] **VPBank** thẻ tín dụng: StepUp 6458, World 3605
- [x] **UOB** thẻ tín dụng: Prvi Miles 1403
- [x] **HSBC** thẻ tín dụng: Live+ 1348
- [x] **CAKE** thẻ tín dụng
- [x] **VCB** chuyển khoản
- [x] **MSB, VPBank, UOB, HSBC, CAKE** sao kê
- [x] **MSB, VPBank** sao kê hoàn tiền (cashback)

### Statement & Reminders
- [x] Parse sao kê: dư nợ, hạn thanh toán, kỳ sao kê
- [x] Lưu sao kê vào sheet (J25+)
- [x] **Thông báo sao kê có số thứ tự** (1., 2., ...) cho từng thẻ
- [x] Nhắc thanh toán ScriptApp trigger (3 ngày + 1 ngày trước) — idempotent (không tạo lại nếu đã tồn tại)
- [x] Nhắc thanh toán Google Calendar (event timed + popup/email reminders)

### Per-Card Ledger
- [x] Bảng giao dịch gộp tất cả thẻ tín dụng (cột Q-T, 4 cột: Tên thẻ | Ngày giờ | Số tiền | Ghi chú)
- [x] Tự động tạo header khi tạo sheet mới
- [x] Ghi chú trên bảng riêng không có "- thẻ XXX"
- [x] Filter theo tên thẻ để xem giao dịch riêng từng thẻ

### Reporting
- [x] Báo cáo ngày / tháng
- [x] Phân tích chi tiêu theo danh mục
- [x] Chi tiết giao dịch
- [x] Biểu đồ tròn tự động trên Google Sheet

### Sheet Management
- [x] Tạo sheet tháng tự động (format: MM-YYYY)
- [x] **Header bảng chính (A-F): highlight màu xanh + freeze row 1 + auto-filter**
- [x] **Header vùng chart data (J1:L1): highlight** để phân biệt với data
- [x] Summary formulas (G-H)
- [x] Chart data (J-L)
- [x] Statement area (J25+)
- [x] Credit card ledger (Q+)

### Performance Optimizations
- [x] **Bulk email save**: `getSheetByMonth(lightMode=true)` skip setup nặng khi sheet đã tồn tại
- [x] **Batch credit card ledger write**: gom N giao dịch → 1 lần `setValues` thay vì N lần
- [x] **`createOrUpdateChart` chỉ gọi 1 lần/sheet** sau khi insert xong thay vì mid-loop
- [x] **Processed email IDs**: load 1 lần vào memory → batch write 1 lần cuối (giảm từ N xuống 1 PropertiesService I/O)

---

## Tính năng tiềm năng 🔮

### Email Processing
- [ ] Thêm ngân hàng mới (Techcombank, BIDV, ...)
- [ ] Thêm loại email mới (QR pay, ví điện tử, ...)
- [ ] Quét email khoảng thời gian tùy chọn (không chỉ hôm nay)

### Multi-user & Platform
- [ ] **Multi-user support**: mỗi user có bộ config thẻ riêng (BANK_CONFIG per-user), sheet riêng, Telegram chat ID riêng
- [ ] **Mini App / Web UI**: giao diện web để xem báo cáo, thêm giao dịch, quản lý danh mục — tích hợp qua Telegram Mini App hoặc web độc lập

### Reporting & Analytics
- [ ] So sánh chi tiêu giữa các tháng
- [ ] Budget alerts (cảnh báo khi chi tiêu vượt ngưỡng)
- [ ] Export PDF báo cáo

### Automation
- [ ] Auto-categorize bằng AI
- [ ] Recurring transaction detection

---

## Stack kỹ thuật

| Component | Technology |
|-----------|------------|
| Runtime | Google Apps Script (V8) |
| Bot | Telegram Bot API (webhook) |
| Storage | Google Sheets |
| Cache | PropertiesService |
| Email | GmailApp |
| Calendar | CalendarApp |
| Trigger | ScriptApp time-based |
