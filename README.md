# Soạn thảo văn bản — phần mềm thực hành Tin học (SGK Kết nối tri thức)

Bám các bài: Tin 4 (Bài 10, 11) · Tin 5 (Bài 7) · Tin 6 (Bài 11, 12, 13) · Tin 8 Tự chọn 1 (Bài 8a, 9a).

Trình soạn thảo giống Word, chạy trên trình duyệt, có bài tập chấm tự động theo SGK.

## Dùng ngay
Mở file `dist/index.html` bằng Chrome/Edge. Chỉ có **một file**, chép sang máy học sinh hoặc đưa lên mạng nội bộ là dùng được, không cần mạng Internet.

- **Giao diện** (góc trên phải): Lớp 4 / 5 / 6 / 8 / Đầy đủ — ẩn bớt nút chưa học.
- **Nộp bài**: xem [HUONG-DAN-GIAO-VIEN.md](HUONG-DAN-GIAO-VIEN.md) — điểm vào Google Sheet, bài làm vào Drive.
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
- Chia trang theo từng khối: một đoạn văn / bảng cao hơn cả trang sẽ không bị cắt đôi (tràn qua lề dưới).
- Trang đầu khác: trang 1 không có đầu/chân trang (chưa soạn được đầu trang riêng cho trang 1).
- Mở `.docx` có sẵn: giữ chữ, đậm/nghiêng, bảng, danh sách, ảnh; mất màu chữ, cỡ chữ, lề.
