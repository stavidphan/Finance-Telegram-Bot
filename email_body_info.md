# Luồng 1: creditCardTx
## 1.1. MSB MDIGI 0487
Sender: banking_notify@msb.com.vn
subjectKeyword: Biến động chi tiêu thẻ tín dụng
Body for parse:
"""
Số thẻ tín dụng

Main Card Number


xxxx-xxxx-xxxx-0487

Số tiền thay đổi

Changed Amount


-143,100 VND

Nội dung giao dịch

Content


Shopee

Thời gian giao dịch

Transaction time 


22/04/2026 21:42
"""


## 1.2 MSB VISA ONLINE 0204
Sender: banking_notify@msb.com.vn
subjectKeyword: Biến động chi tiêu thẻ tín dụng
Body for parse: 
"""
Số thẻ tín dụng

Main Card Number


xxxx-xxxx-xxxx-0204

Số tiền thay đổi

Changed Amount


-143,100 VND

Nội dung giao dịch

Content


Shopee

Thời gian giao dịch

Transaction time 


22/04/2026 21:42
"""


## 1.3. VPBank StepUp 6458
sender: "customercare@care.vpb.com.vn",
subjectKeyword: "VPBank xin thong bao bien dong so du"
Body for parse:
"""
Chúng tôi xin trân trọng thông báo, số dư thẻ Tín dụng của Quý khách đã
thay đổi như sau: *Your credit card balance has changed as below:*
*- 83,144 VND*

Số tiền thay đổi / *Changed Amount*
*PLX_SAI GON_CH18*

Nội dung / *Transaction Content*
*06/05/2026 17:52:33*

Thời gian /*Time*
*377,646 VND*

Hạn mức còn lại / *Available Limit*
*MasterCard *6458*

Thẻ /* Card*
*612623233440*

Mã giao dịch / *Transaction Code*
"""


## 1.4 VPBank World 3605
sender: "customercare@care.vpb.com.vn",
subjectKeyword: "VPBank xin thong bao bien dong so du"
body for parse:
"""
Chúng tôi xin trân trọng thông báo, số dư thẻ Tín dụng của Quý khách đã
thay đổi như sau: *Your credit card balance has changed as below:*
*- 83,144 VND*

Số tiền thay đổi / *Changed Amount*
*PLX_SAI GON_CH18*

Nội dung / *Transaction Content*
*06/05/2026 17:52:33*

Thời gian /*Time*
*377,646 VND*

Hạn mức còn lại / *Available Limit*
*MasterCard *3605*

Thẻ /* Card*
*612623233440*

Mã giao dịch / *Transaction Code*
"""

## 1.5. UOB - Prvi Miles 1403
Sender: unialerts@uobgroup.com
subjectKeyword: Card Transaction Alert
Body for parse: 
"""[English below]

Kinh gui Quy khach,

The cua Quy khach voi so cuoi 1403 da thuc hien giao dich 90,038 VND vao
ngay 14/03/2026.
...
"""

## 1.6. HSBC - Live+ 1348
Sender: HSBC@notification.hsbc.com.hk
subjectKeyword: Purchase
Body for parse:
"""
Kính gởi Quý khách,

Chúng tôi xin thông báo thẻ tín dụng X1348 của Quý khách vừa thực hiện giao
dịch với số tiền 166,000 VND tại Shopee vào ngày 07/03/2026.
"""

## 1.7. CAKE 0934
Sender: no-reply@cake.vn
subjectKeyword: Thông báo giao dịch thẻ tín dụng Cake
Body for parse: 
"""
Kính gửi Quý khách PHAN ANH TUẤN
Cám ơn Quý khách đã sử dụng sản phẩm dịch vụ của Cake.
Thẻ tín dụng Cake của Quý khách vừa phát sinh giao dịch như sau:
Thông tin thẻ tín dụng
Số thẻ ••0934
Giao dịch Thanh toán thẻ qua ECOM
Giá trị 29.000 đ
Vào lúc 08:45 06/05/2026
"""


# Luồng 2
## 1. VCB
body:
"""
*Biên lai chuyển tiền qua tài khoản* 
*(Payment Receipt)* 
*Ngày, giờ giao dịch*
*Trans. Date, Time* 12:11 Thứ Tư 13/05/2026 
*Số lệnh giao dịch*
*Order Number* 14200192146 
*Tài khoản nguồn*
*Debit Account* 9399101660 
*Tên người chuyển tiền*
*Remitter’s name* PHAN THANH DUY 
*Tài khoản người hưởng*
*Credit Account* 0611001967110 
*Tên người hưởng*
*Beneficiary Name* NGUYEN MANH CUONG 
*Tên ngân hàng hưởng*
*Beneficiary Bank Name* Vietcombank 
*Số tiền*
*Amount* 45,000 VND 
*Loại phí*
*Charge Code* Người chuyển trả
*Exclude * *Số tiền phí*


*Charge AmountNet incomeVAT* 0 VND
 
0 VND
0 VND 
*Nội dung chuyển tiền*
*Details of Payment* PHAN THANH DUY chuyen tien COM 

*Cám ơn Quý khách đã sử dụng dịch vụ của Vietcombank!*
*Thank you for banking with Vietcombank!* 
"""


# Luồng 3: statement
## 3.1. MSB mdigi 0487
sender: "cardservicedesk@services.msb.com.vn",
subjectKeyword: "sao kê"
Body for parse:
"""Thẻ tín dụng (loại thẻ)/Credit card type:
Mastercard mDigi
Số thẻ/Card number:
4022-****-****-0487 
Kì sao kê/Statement Period:
30/03/2026 - 25/04/2026 
Dư nợ hiện tại/Outstanding balance: 
3,417,058 
Số tiền thanh toán tối thiểu/
Minimum amount due: 
100,000
Hạn thanh toán/Due date: 
10/05/2026 
"""

## 3.2 MSB visa online 0204
sender: "cardservicedesk@services.msb.com.vn",
subjectKeyword: "sao kê"
Body for parse:
"""Thẻ tín dụng (loại thẻ)/Credit card type:
Visa Online
Số thẻ/Card number:
4022-****-****-0204 
Kì sao kê/Statement Period:
30/03/2026 - 25/04/2026 
Dư nợ hiện tại/Outstanding balance: 
3,417,058 
Số tiền thanh toán tối thiểu/
Minimum amount due: 
100,000
Hạn thanh toán/Due date: 
10/05/2026 """

## 3.3 VPBANK - StepUp 6458
Sender: customercare@care.vpb.com.vn
subjectKeywords: Sao kê thẻ tín dụng
Body for parse: 
"""
*Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank) xin trân trọng thông báo số
dư cuối kỳ và hạn thanh toán thẻ tín dụng của Quý Khách như sau: */*Vietnam
Prosperity Joint Stock Commercial Bank (VPBank) is pleased to inform your
monthly statement & payment due date with details below:*
Thẻ Tín dụng *MC StepUp Credit*
Từ *21/03/2026*  đến *20/04/2026*

*Số tiền thanh toán tối thiểu*
*Minimum Amount Due*

*VND -227,505.00 *
*Hạn thanh toán*
*Payment Due Date*

*17H 05/05/2026*
*VND -4,550,089.00*
*Số dư cuối kỳ /** Outstanding Balance: *
"""

## 3.4 VPBANK - World 3605
Sender: customercare@care.vpb.com.vn
subjectKeywords: Sao ke the tin dung
Body for parse: 
"""
*Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank) xin trân trọng thông báo số
dư cuối kỳ và hạn thanh toán thẻ tín dụng của Quý Khách như sau: **/Vietnam
Prosperity Joint Stock Commercial Bank (VPBank) is pleased to inform your
monthly statement & payment due date with details below:*
Thẻ Tín dụng *MC World Credit*
Từ *28/03/2026*  đến *27/04/2026*

*Số tiền thanh toán tối thiểu*
*Minimum Amount Due*


*VND -135,385.00 *
*Hạn thanh toán*
*Payment Due Date*


*17H 12/05/2026*
*VND -2,707,701.00*
*Số dư cuối kỳ /** Outstanding Balance: *
------------------------------
"""

## 3.5. Thẻ UOB - Prvi Miles
Sender: unialerts@uobgroup.com
subjectKeyword: Credit Card Payment Reminder
Body for parse:
"""
Kinh gui Quy khach,

Day la thong bao nhac han thanh toan the tin dung.

Tai khoan The Tin Dung voi so duoi ket thuc 1403 den han thanh toan vao
ngay 29/04/26:

- Khoan thanh toan toi thieu la VND 50,000.
- Tong thanh toan den han la VND 90,038.
"""

## 3.6. HSBC - Live+ 1348
Sender: HSBC@informationservices.hsbc.com.vn
subjectKeyword: BẢNG TÓM TẮT SAO KÊ THẺ TÍN DỤNG
Body for parse:
"""Thông báo thông tin tóm tắt Bảng Sao Kê tháng 04/2026
*BẢNG TÓM TẮT SAO KÊ THẺ TÍN DỤNG*

Kính gửi Quý khách MR PHAN ANH TUAN,

Cảm ơn Quý khách đã lựa chọn và sử dụng Thẻ Tín Dụng của Ngân hàng TNHH Một
Thành Viên HSBC Việt Nam *(“HSBC”,”Ngân Hàng”)*.

Ngân Hàng thông báo thông tin tóm tắt Bảng Sao Kê tháng 04/2026 như sau:

• Thẻ Tín Dụng: 43784100xxxx1348.

• Dư nợ cuối kỳ: 1.150.671 VNĐ.

• Thanh toán tối thiểu: 50.000 VNĐ.

• Ngày đến hạn thanh toán: 02/05/26."""

# Luồng 4: cashback
## 4.1. MSB mdigi 0487
Sender: cardservicedesk@msb.com.vn
subjectKeyword: SAO KÊ TÍCH ĐIỂM HOÀN TIỀN
Body for parse:
"""
Ngân hàng TMCP Hàng Hải Việt Nam - MSB xin gửi tới Quý khách lời chào và 
trân trọng cảm ơn Quý khách đã quan tâm sử dụng sản phẩm thẻ tín dụng của 
MSB trong thời gian qua.

MSB xin chúc mừng Quý khách *đã tích lũy được 8.090 VNĐ* hoàn tiền từ chi 
tiêu thẻ tín dụng MSB Mastercard mDigi trong kỳ sao kê từ ngày 21/04/2026 
đến 20/05/2026.

Quý khách vui lòng xem chi tiết bản sao kê tích điểm hoàn tiền thẻ 
Mastercard mDigi trong file đính kèm.
"""

## 4.2 MSB visa online 0204
<tương tự 4.1>

## 4.3 VPBANK - StepUp 6458
Sender: i2bservices@vpb.com.vn
subjectKeyword: Sao kê hoàn tiền
Body for parse: 
"""
Ngân hàng Việt Nam Thịnh Vượng - VPBank xin chúc mừng Quý khách *đã tích
lũy vào tài khoản tiền hoàn thêm 148,307 VND cho các chi tiêu thẻ tín dụng
MC StepUp Credit *trong khoảng thời gian *từ ngày 21/01/2026 đến
20/02/2026.* Vui lòng xem Chi tiết bản sao kê hoàn tiền trong file đính
kèm: /*Vietnam Prosperity Joint Stock Commercial Bank – VPBank would like
to congratulate you on 148,307 VND cashback of your spending MC StepUp
Credit from 21/01/2026 to 20/02/2026. For more detail, please check
cashback statement in attachment*

*324-P-4091270*
Số hợp đồng / Contract Number

*MC StepUp Credit*
Thẻ sao kê/Card

*21/01/2026 - 20/02/2026*
Kỳ sao kê hoàn tiền/Cashback Statement period

*148,307 VND*
Tổng số tiền hoàn/Your cashback amount
"""

## 4.4 VPBANK - World 3605
<tương tự 4.3>


