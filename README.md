# Soạn thảo văn bản — phần mềm thực hành Tin học (SGK Kết nối tri thức)

Gồm ba phần mềm, dùng chung cách nộp bài:

| Phần mềm | Đường dẫn | Bám các bài SGK |
|---|---|---|
| **Soạn thảo** | `/` | Tin 4 (Bài 10, 11) · Tin 5 (Bài 7) · Tin 6 (Bài 11–13) · Tin 8 (Bài 8a, 9a) |
| **Bảng tính** | `/bang-tinh/` | Tin 7 (Bài 6–10) · Tin 8 (Bài 5–7) · Tin 9 (Bài 9a–12a) |
| **Trình chiếu** | `/trinh-chieu/` | Tin 3 (Bài 11) · Tin 4 (Bài 7–9) · Tin 7 (Bài 11–13) · Tin 8 (Bài 10a, 11a) |

Trình soạn thảo giống Word, chạy trên trình duyệt, có bài tập chấm tự động theo SGK.

## Dùng ngay
Mở `dist/index.html` (Soạn thảo), `dist/bang-tinh/index.html` (Bảng tính) hoặc `dist/trinh-chieu/index.html` (Trình chiếu) bằng Chrome/Edge. Chỉ có **một file**, chép sang máy học sinh hoặc đưa lên mạng nội bộ là dùng được, không cần mạng Internet.

- **Giao diện** (góc trên phải): Lớp 4 / 5 / 6 / 8 / Đầy đủ — ẩn bớt nút chưa học.
- **Nộp bài**: xem [HUONG-DAN-GIAO-VIEN.md](HUONG-DAN-GIAO-VIEN.md) — điểm vào Google Sheet, bài làm vào Drive.
- **Bài tập**: chọn bài → làm → bấm **Kiểm tra**. Bài đang làm tự lưu trên máy (trình duyệt).
- **Tệp → Lưu về máy**: xuất `.docx` mở được bằng Word/LibreOffice.

## Sửa / thêm đề bài
- Bảng tính: sửa `bang-tinh/src/lessons.js` (cách viết đề ghi ở đầu file).
- Trình chiếu: sửa `trinh-chieu/src/lessons.js`; các kiểu chấm nằm trong `trinh-chieu/src/checker.js`.
- Soạn thảo: sửa `src/lessons.js` (có chú thích các loại kiểm tra ở đầu file) rồi chạy `npm run build`.
- Hoặc soạn file `.json` cùng cấu trúc, trong khung Bài tập bấm **Mở đề bài từ tệp (.json)** — không cần build lại.

## Phát triển
```
npm install
npm run dev             # chạy thử Soạn thảo
npm run dev:bang-tinh   # chạy thử Bảng tính
npm run dev:trinh-chieu # chạy thử Trình chiếu
npm run build           # tạo dist/index.html, dist/bang-tinh/ và dist/trinh-chieu/
```

## Giới hạn hiện tại
- Trình chiếu: mở được tệp .pptx do chính phần mềm lưu; tệp tạo bằng PowerPoint thì chưa mở được. Chưa có bảng, biểu đồ, âm thanh/video trong trang chiếu. Ảnh lưu trong trình duyệt (IndexedDB), bài lưu tạm trong localStorage.
- Bảng tính: 100 hàng × 26 cột (A–Z) mỗi trang tính. Biểu đồ được lưu vào .xlsx dưới dạng ảnh. Chưa có định dạng có điều kiện, cố định hàng/cột.
- Chia trang theo từng khối: một đoạn văn / bảng cao hơn cả trang sẽ không bị cắt đôi (tràn qua lề dưới).
- Trang đầu khác: trang 1 không có đầu/chân trang (chưa soạn được đầu trang riêng cho trang 1).
- Mở `.docx` có sẵn: giữ chữ, đậm/nghiêng, bảng, danh sách, ảnh; mất màu chữ, cỡ chữ, lề.
