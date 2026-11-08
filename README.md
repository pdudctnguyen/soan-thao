# Soạn thảo văn bản — phần mềm thực hành Tin học (SGK Kết nối tri thức)

Trình soạn thảo giống Word, chạy trên trình duyệt, có bài tập chấm tự động theo SGK.

## Dùng ngay
Mở file `dist/index.html` bằng Chrome/Edge. Chỉ có **một file**, chép sang máy học sinh hoặc đưa lên mạng nội bộ là dùng được, không cần mạng Internet.

- **Giao diện** (góc trên phải): Lớp 4 / Lớp 5 / Lớp 6 / Đầy đủ — ẩn bớt nút chưa học.
- **Bài tập**: chọn bài → làm → bấm **Kiểm tra**. Bài đang làm tự lưu trên máy (trình duyệt).
- **Tệp → Lưu về máy**: xuất `.docx` mở được bằng Word/LibreOffice.

## Sửa / thêm đề bài
- Sửa `src/lessons.js` (có chú thích các loại kiểm tra ở đầu file) rồi chạy `npm run build`.
- Hoặc soạn file `.json` cùng cấu trúc, trong khung Bài tập bấm **Mở đề bài từ tệp (.json)** — không cần build lại.

## Phát triển
```
npm install
npm run dev     # chạy thử, tự tải lại khi sửa code
npm run build   # tạo dist/index.html
```

## Giới hạn hiện tại
- Ngắt trang chỉ là vạch giả lập; chưa có đầu trang/chân trang, đánh số trang.
- Mở `.docx` có sẵn: giữ chữ, đậm/nghiêng, bảng, danh sách, ảnh; mất màu chữ, cỡ chữ, lề.
