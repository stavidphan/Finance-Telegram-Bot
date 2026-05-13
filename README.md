# Phin Finance Bot — Hướng dẫn sử dụng

Telegram chatbot quản lý tài chính cá nhân, tự động quét email ngân hàng và ghi giao dịch vào Google Sheet.

---

## Tính năng chính

### 📝 Ghi giao dịch thủ công
Nhập trực tiếp qua Telegram:
```
50k Ăn trưa (Phở bò)          → Chi tiêu 50,000₫, mô tả "Ăn trưa", ghi chú "Phở bò"
+500k Lương                     → Thu nhập 500,000₫
05/04 120k Đổ xăng             → Ngày 05/04, chi tiêu 120,000₫
```

**Format số tiền**: `50k` = 50,000 | `1.5m` = 1,500,000 | `1m5` = 1,500,000

### 📧 Quét email ngân hàng tự động
- **3 loại email được quét**: giao dịch thẻ tín dụng, chuyển khoản ngân hàng, sao kê thẻ
- **Ngân hàng đã hỗ trợ**: MSB, VCB, VPBank, UOB, HSBC, CAKE
- Quét tự động hàng ngày hoặc thủ công qua `/scanmail`
- Sau khi quét, bot gửi danh sách giao dịch → bạn reply ghi chú cho từng giao dịch

### 💳 Sao kê thẻ tín dụng
- Tự động trích xuất dư nợ, hạn thanh toán
- Lưu vào Google Sheet
- **Nhắc thanh toán**: trước 3 ngày và 1 ngày qua Telegram + Google Calendar

### 📊 Báo cáo & Phân tích
- Báo cáo theo ngày, theo tháng
- Phân tích chi tiêu theo danh mục (biểu đồ tròn tự động trên Sheet)
- Chi tiết giao dịch theo ngày/tháng

---

## Danh sách lệnh Telegram

| Lệnh | Mô tả |
|-------|--------|
| `/scanmail` | Quét email giao dịch hôm nay |
| `/danhmuc` | Xem danh sách danh mục |
| `/themtukhoa <từ khóa> <số thứ tự>` | Thêm từ khóa vào danh mục |
| `/baocaongay [dd/mm]` | Báo cáo chi tiêu ngày |
| `/baocaothang [mm]` | Báo cáo chi tiêu tháng |
| `/phantichthang [mm]` | Phân tích chi tiêu theo danh mục |
| `/phantichngay [dd/mm]` | Phân tích chi tiêu ngày |
| `/chitietthang [mm]` | Chi tiết giao dịch tháng |
| `/chitietngay [dd/mm]` | Chi tiết giao dịch ngày |
| `/suaphanloai <số>` | Sửa danh mục giao dịch gần nhất |
| `/suadinhdang <thu nhập/chi tiêu>` | Sửa loại giao dịch gần nhất |
| `/suanoidung <nội dung mới>` | Sửa mô tả giao dịch gần nhất |
| `/huongdan` | Xem hướng dẫn sử dụng |

---

## Google Sheet layout

Mỗi tháng có 1 sheet riêng (format: `MM-YYYY`, ví dụ `05-2026`):

- **Cột A-F**: Bảng giao dịch chính (Ngày, Loại, Danh mục, Số tiền, Mô tả, Ghi chú) — có freeze row 1 + filter
- **Cột G-H**: Tổng thu nhập / chi tiêu (tự động tính)
- **Cột J-L (row 1-11)**: Dữ liệu biểu đồ (tự động)
- **Cột J-M (row 25+)**: Sao kê thẻ tín dụng
- **Cột Q-T**: Bảng giao dịch thẻ tín dụng gộp chung (Tên thẻ | Ngày giờ | Số tiền | Ghi chú) — có filter theo tên thẻ

---

## Quy trình quét email

1. Gửi `/scanmail` hoặc hệ thống tự động quét
2. Bot hiển thị **sao kê** (nếu có) trước
3. Bot hiển thị **danh sách giao dịch** và yêu cầu ghi chú
   - Giao dịch VCB kèm thêm nội dung chuyển khoản (Details of Payment) để dễ nhận biết
4. Reply ghi chú cho từng giao dịch (1 dòng/giao dịch):
   - **Thẻ tín dụng**: `Ăn trưa` → ghi chú lưu: `Ăn trưa - MSB MDIGI 0487`
   - **Chuyển khoản VCB**: `Ăn sáng (Phở)` (mô tả + ghi chú trong ngoặc)
   - Nhập `-` nếu không có ghi chú
5. Bot xác nhận và lưu vào Sheet

---

## Cấu hình hệ thống

Cấu hình email quét nằm trong file `emailConfig.js` → biến `BANK_CONFIG`. Liên hệ developer để thêm thẻ/ngân hàng mới.

Danh mục và từ khóa phân loại nằm trong sheet **"Từ khóa"** trên Google Sheet.
