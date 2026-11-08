# Cài đặt nộp bài (làm một lần, khoảng 5 phút)

Bài học sinh nộp sẽ vào **Google Sheet của thầy cô**: mỗi lần nộp thêm một dòng điểm, file .docx được lưu vào Google Drive.

## Bước 1. Tạo Google Sheet
1. Vào [sheets.new](https://sheets.new) và đặt tên, ví dụ “Bài nộp Tin học 6”.
2. Chọn menu **Tiện ích mở rộng → Apps Script**.

## Bước 2. Dán mã
1. Xoá hết nội dung có sẵn trong `Mã.gs`.
2. Dán toàn bộ nội dung file [`apps-script/Code.gs`](apps-script/Code.gs).
3. (Tuỳ chọn) Đặt mã bảo vệ ở dòng `const KHOA = ''`, ví dụ `const KHOA = 'tin6-2026'`.
4. Bấm 💾 **Lưu**.

## Bước 3. Chạy cài đặt và cấp quyền
1. Ở ô chọn hàm phía trên, chọn **caiDat**, rồi bấm **Chạy**.
2. Google sẽ hỏi quyền: bấm **Xem xét quyền**, chọn tài khoản. Nếu hiện “Google chưa xác minh ứng dụng này” thì bấm **Nâng cao → Đi tới … (không an toàn)**. Đây là mã do chính thầy cô vừa dán, nên không sao. Cuối cùng bấm **Cho phép**.
3. Quay lại Sheet sẽ thấy 2 trang tính mới: **Kết quả** và **Bảng điểm**.

## Bước 4. Triển khai thành ứng dụng web
1. Bấm **Triển khai → Tùy chọn triển khai mới**.
2. Bấm ⚙ cạnh “Chọn loại” và chọn **Ứng dụng web**.
3. Thiết lập:
   - **Thực thi với tư cách:** Tôi
   - **Người có quyền truy cập:** **Bất kỳ ai** (bắt buộc, vì học sinh không đăng nhập)
4. Bấm **Triển khai**, rồi sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).

> Nếu tài khoản trường không có lựa chọn “Bất kỳ ai” (do quản trị viên tên miền chặn), hãy dùng tài khoản Gmail cá nhân.

## Bước 5. Lấy đường link cho học sinh
1. Mở phần mềm Soạn thảo, chọn **Tệp → Cài đặt nộp bài (GV)**.
2. Dán URL vừa chép. Nếu có mã bảo vệ thì nhập vào ô “Mã bảo vệ”.
3. Bấm **Kiểm tra kết nối**, phải thấy ✓.
4. Bấm **Sao chép** đường link ở dưới và gửi cho học sinh (qua Zalo, Classroom hoặc ghi lên bảng bằng mã QR).

Học sinh mở link đó một lần là máy nhớ địa chỉ nộp bài. Lần đầu nộp, máy hỏi họ tên và lớp.

## Xem kết quả
- **Kết quả**: mọi lần nộp, gồm thời gian, lớp, họ tên, bài, số yêu cầu đạt, chi tiết từng ý và link file bài làm.
- **Bảng điểm**: mỗi học sinh một dòng, mỗi bài một cột, lấy **điểm cao nhất** (%) nếu em nộp nhiều lần.
- File .docx nằm trong Drive, thư mục **Bài nộp Soạn thảo / <Lớp>**.

## Khi sửa mã Apps Script
Sau khi sửa phải vào **Triển khai → Quản lý các lần triển khai → ✏ → Phiên bản: Phiên bản mới → Triển khai**. Làm theo cách này thì URL giữ nguyên, không phải gửi lại link cho học sinh.
