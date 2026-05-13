# Agent Instructions — Phin Finance Bot

Hướng dẫn cho AI agent khi làm việc với codebase này.

---

## Đọc context trước khi bắt đầu

**Luôn đọc 3 file sau theo thứ tự ưu tiên khi nhận task mới:**

1. **`DESIGN.md`** — Kiến trúc hệ thống, cấu trúc file, luồng xử lý, sheet layout, hướng dẫn mở rộng. Đọc khi cần hiểu code hoặc thêm tính năng.

2. **`ROADMAP.md`** — Danh sách tính năng đã hoàn thành và tiềm năng. Đọc để biết hệ thống đã support gì, tránh implement trùng.

3. **`README.md`** — Hướng dẫn sử dụng cho user. Đọc khi cần hiểu UX/flow từ góc nhìn user.

---

## Nguyên tắc khi sửa code

### Kiến trúc
- **Google Apps Script**: tất cả file `.js` share global scope — không dùng `import/export`
- **3 luồng email**: credit card tx, transfer tx, statement — mỗi luồng có router + per-card/bank parsers
- **BANK_CONFIG** (`emailConfig.js`): cấu hình tập trung — mỗi card/bank entry chứa đủ `name`, `bank`, `parser`, `sender`, `subjectKeyword`
- **app.js**: chỉ sửa tối thiểu, không refactor

### Sheet layout (quan trọng!)
- **Cột A-F**: Bảng chính — dùng `getLastMainTableRow(sheet)` để tìm last row, KHÔNG dùng `sheet.getLastRow()` (vì sẽ bị lẫn với data ở khu vực khác)
- **Cột G-H**: Summary formulas
- **Cột J-L row 1-11**: Chart data
- **Cột J-M row 25+**: Sao kê (STATEMENT_TITLE_ROW=25, STATEMENT_HEADER_ROW=26, STATEMENT_DATA_START_ROW=27)
- **Cột Q+**: Per-card ledger (3 cột/thẻ, bắt đầu cột 17)

### Lưu trữ PropertiesService
- `pendingEmailTransactions`: giao dịch chờ user input
- `processedEmailIds`: chống trùng email (TTL 7 ngày)
- `statementDueDates`: due dates cho nhắc thanh toán
- `categoryCache`, `keywordCache`: cache từ sheet "Từ khóa"

---

## Khi thêm tính năng mới

1. Đọc `DESIGN.md` trước
2. Nếu thêm thẻ/bank → chỉ cần thêm entry vào `BANK_CONFIG` + parser function (xem hướng dẫn trong DESIGN.md)
3. Nếu thay đổi sheet layout → cập nhật constants + `DESIGN.md` + `README.md`
4. Nếu thêm tính năng lớn → cập nhật `ROADMAP.md`

---

## Yêu cầu update tài liệu

Sau mỗi thay đổi lớn, **bắt buộc** cập nhật:

| Thay đổi | File cần update |
|----------|-----------------|
| Thêm thẻ/bank mới | `ROADMAP.md` (section "Banks & Cards đã hỗ trợ") |
| Thay đổi sheet layout | `DESIGN.md` (section "Google Sheet layout") + `README.md` |
| Thêm tính năng mới | `ROADMAP.md` + `README.md` (nếu user-facing) |
| Thay đổi kiến trúc | `DESIGN.md` |
| Thêm lệnh Telegram | `README.md` (bảng lệnh) |
| Thay đổi PropertiesService keys | `DESIGN.md` + `AGENTS.md` |
