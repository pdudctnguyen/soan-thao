// Đề thực hành bảng tính — bám SGK Tin học Kết nối tri thức (Tin 7: Bài 6–10; Tin 8: Bài 5–7; Tin 9: Bài 9a–12a).
//
// start: { sheets: [{ name, rows: [[...hàng 1], [...hàng 2]], colW: { A: 140 }, merges: ['A1:E1'], styles: { 'A1:E1': { b: true } }, dv: [] }] }
// Các loại check (xem checker.js):
//   value {cell|range, equals}            formula {cell|range, func, abs, noFunc, equals}
//   style {cell|range, b, i, fill, align, nf:{kind,dec}}   border {range, kind:'all'|'outline'}   merge {range}
//   colWidth {col, min}   sheetName {name}   sheetCount {min}   page {orientation}
//   sorted {range, col, desc, keepRow}    filter {col, equals|gte, count}
//   chart {chartType, titleIncludes, covers, legend, labels}    dv {range, dvType, listHas, message}

const THU_CHI = [
  ['SỔ THU CHI CỦA LỚP 9A'],
  ['Ngày', 'Khoản', 'Nội dung', 'Số tiền'],
  ['05/09', 'Thu', 'Quỹ lớp tháng 9', 500000],
  ['08/09', 'Chi', 'Mua giấy màu', 120000],
  ['12/09', 'Chi', 'In ảnh kỉ niệm', 80000],
  ['15/09', 'Thu', 'Bán đồ tái chế', 150000],
  ['20/09', 'Chi', 'Mua bóng đá', 200000],
  ['22/09', 'Chi', 'Nước uống', 60000],
  ['25/09', 'Thu', 'Phụ huynh ủng hộ', 300000],
  ['30/09', 'Chi', 'Phần thưởng', 250000],
]

const DIEM_8 = [
  ['Họ và tên', 'Lớp', 'Điểm'],
  ['Nguyễn An', '8A', 7.5],
  ['Trần Bình', '8B', 9],
  ['Lê Chi', '8A', 9.5],
  ['Phạm Dũng', '8C', 6],
  ['Võ Giang', '8A', 8],
  ['Đỗ Hà', '8B', 7],
  ['Bùi Khánh', '8A', 6.5],
  ['Hồ Lan', '8C', 8.5],
]

export const LESSONS = [
  // ===================== LỚP 7 =====================
  {
    id: 'l7-b6-nhap',
    lop: 7,
    bai: 'Bài 6. Làm quen với phần mềm bảng tính',
    title: 'Nhập và sửa dữ liệu',
    intro: 'Nháy chuột chọn ô rồi gõ, nhấn Enter để xuống ô dưới, Tab để sang phải. Nháy đúp vào tên trang tính ở góc dưới để đổi tên.',
    start: { sheets: [{ name: 'Trang tính 1', colW: { B: 150 }, styles: { 'A1:E1': { b: true } }, rows: [['STT', 'Họ và tên', 'Toán', 'Ngữ văn', 'Tin học'], [1, 'Nguyễn Văn An', 7, 8, 9], [2, 'Trần Thị Bình', 9, 7, 8]] }] },
    steps: [
      { text: 'Hàng 4: nhập bạn số 3 “Lê Minh Châu”', check: { type: 'value', range: 'A4:B4', equals: [3, 'Lê Minh Châu'] } },
      { text: 'Điểm của Châu: Toán 8, Ngữ văn 7, Tin học 9', check: { type: 'value', range: 'C4:E4', equals: [8, 7, 9] } },
      { text: 'Sửa điểm Toán của bạn An (ô C2) thành 9', check: { type: 'value', cell: 'C2', equals: 9 } },
      { text: 'Đổi tên trang tính thành “Lớp 7A”', check: { type: 'sheetName', name: 'Lớp 7A' } },
    ],
  },
  {
    id: 'l7-b7-cong-thuc',
    lop: 7,
    bai: 'Bài 7. Tính toán tự động trên bảng tính',
    title: 'Công thức tính tiền',
    intro: 'Ở D2 gõ công thức =B2*C2 rồi Enter. Chọn lại D2, kéo ô vuông nhỏ ở góc dưới phải xuống D5 để sao chép công thức. Ô D6 tính tổng bằng phép cộng.',
    start: { sheets: [{ name: 'Mua đồ dùng', colW: { A: 110, D: 100 }, styles: { 'A1:D1': { b: true }, 'A6': { b: true } }, rows: [['Mặt hàng', 'Số lượng', 'Đơn giá', 'Thành tiền'], ['Vở', 10, 8000], ['Bút bi', 5, 5000], ['Thước kẻ', 2, 7000], ['Hộp màu', 1, 35000], ['Tổng cộng']] }] },
    steps: [
      { text: 'D2 dùng công thức Số lượng × Đơn giá', check: { type: 'formula', cell: 'D2', equals: 80000, refs: ['B2', 'C2'] } },
      { text: 'Sao chép công thức xuống D3:D5', check: { type: 'formula', range: 'D3:D5', equals: [25000, 14000, 35000] } },
      { text: 'D6 cộng các ô thành tiền bằng phép +', check: { type: 'formula', cell: 'D6', noFunc: true, equals: 154000 } },
    ],
  },
  {
    id: 'l7-b8-ham',
    lop: 7,
    bai: 'Bài 8. Công cụ hỗ trợ tính toán',
    title: 'Dùng hàm SUM, AVERAGE, MAX, MIN, COUNT',
    intro: 'Ở E2 gõ =AVERAGE(B2:D2) rồi kéo xuống E6. Hàng 7–10 tính cho cột Toán bằng các hàm MAX, MIN, SUM, COUNT (có thể dùng nút Σ ▾ ở tab Trang chủ).',
    start: {
      sheets: [{
        name: 'Bảng điểm', colW: { A: 120 }, styles: { 'A1:E1': { b: true }, 'A7:A10': { i: true } },
        rows: [['Họ và tên', 'Toán', 'Ngữ văn', 'Tiếng Anh', 'Điểm TB'], ['An', 8, 7, 9], ['Bình', 6, 8, 7], ['Chi', 9, 9, 10], ['Dũng', 5, 6, 7], ['Hà', 7, 8, 6], ['Cao nhất'], ['Thấp nhất'], ['Tổng điểm'], ['Số bạn']],
      }],
    },
    steps: [
      { text: 'E2:E6 tính điểm trung bình bằng hàm AVERAGE', check: { type: 'formula', range: 'E2:E6', func: 'AVERAGE', equals: [8, 7, 9.3333, 6, 7] } },
      { text: 'B7: điểm Toán cao nhất (MAX)', check: { type: 'formula', cell: 'B7', func: 'MAX', equals: 9 } },
      { text: 'B8: điểm Toán thấp nhất (MIN)', check: { type: 'formula', cell: 'B8', func: 'MIN', equals: 5 } },
      { text: 'B9: tổng điểm Toán (SUM)', check: { type: 'formula', cell: 'B9', func: 'SUM', equals: 35 } },
      { text: 'B10: đếm số bạn có điểm Toán (COUNT)', check: { type: 'formula', cell: 'B10', func: 'COUNT', equals: 5 } },
    ],
  },
  {
    id: 'l7-b9-trinh-bay',
    lop: 7,
    bai: 'Bài 9. Trình bày bảng tính',
    title: 'Định dạng bảng điểm',
    intro: 'Làm cho bảng điểm đẹp và dễ đọc. Gợi ý: chọn E3:E7 → ô Định dạng số chọn “Số” → bấm “.00→.0” một lần.',
    start: {
      sheets: [{
        name: 'Bảng điểm',
        rows: [['BẢNG ĐIỂM LỚP 7A'], ['Họ và tên', 'Toán', 'Ngữ văn', 'Tiếng Anh', 'Điểm TB'], ['Nguyễn Văn An', 8, 7, 9, '=AVERAGE(B3:D3)'], ['Trần Thị Bình', 6, 8, 7, '=AVERAGE(B4:D4)'], ['Lê Minh Châu', 9, 9, 10, '=AVERAGE(B5:D5)'], ['Phạm Dũng', 5, 6, 7, '=AVERAGE(B6:D6)'], ['Đỗ Thu Hà', 7, 8, 6, '=AVERAGE(B7:D7)']],
      }],
    },
    steps: [
      { text: 'Gộp A1:E1 và căn giữa tiêu đề', check: { type: 'merge', range: 'A1:E1' } },
      { text: 'Hàng tiêu đề cột (A2:E2) in đậm và tô màu nền', check: { type: 'style', range: 'A2:E2', b: true, fill: 'any' } },
      { text: 'Kẻ tất cả đường viền cho A2:E7', check: { type: 'border', range: 'A2:E7', kind: 'all' } },
      { text: 'Điểm TB (E3:E7) hiện 1 chữ số thập phân', check: { type: 'style', range: 'E3:E7', nf: { kind: 'number', dec: 1 } } },
      { text: 'Cột A đủ rộng để hiện hết họ tên', check: { type: 'colWidth', col: 'A', min: 110 } },
    ],
  },
  {
    id: 'l7-b9-chen-xoa',
    lop: 7,
    bai: 'Bài 9. Trình bày bảng tính',
    title: 'Chèn hàng, chèn cột',
    intro: 'Làm theo thứ tự: (1) chọn hàng 3, Trang chủ → Chèn → Chèn hàng phía trên, nhập bạn “Phạm Gia Huy”, Tổ 2. (2) Chọn cột A, chèn cột bên trái, gõ STT. (3) Gõ 1, 2 vào A2, A3, chọn cả hai ô rồi kéo xuống để đánh số tự động.',
    start: { sheets: [{ name: 'Danh sách', colW: { A: 140 }, styles: { 'A1:C1': { b: true } }, rows: [['Họ và tên', 'Ngày sinh', 'Tổ'], ['Nguyễn An', "'12/03/2013", 1], ['Trần Bình', "'25/07/2013", 1], ['Lê Chi', "'02/11/2013", 2], ['Võ Dung', "'18/01/2013", 3]] }] },
    steps: [
      { text: 'Hàng 3 là bạn mới “Phạm Gia Huy”', check: { type: 'value', cell: 'B3', equals: 'Phạm Gia Huy' } },
      { text: 'Bạn Trần Bình được đẩy xuống hàng 4', check: { type: 'value', cell: 'B4', equals: 'Trần Bình' } },
      { text: 'Có cột STT ở cột A (A1 là “STT”)', check: { type: 'value', cell: 'A1', equals: 'STT' } },
      { text: 'A2:A6 đánh số 1 đến 5', check: { type: 'value', range: 'A2:A6', equals: [1, 2, 3, 4, 5] } },
    ],
  },
  {
    id: 'l7-b10-hoan-thien',
    lop: 7,
    bai: 'Bài 10. Hoàn thiện bảng tính',
    title: 'Sổ theo dõi thể chất',
    intro: 'Chỉ số BMI = Cân nặng ÷ (Chiều cao × Chiều cao). Tính BMI cho cả lớp, làm tròn hiển thị 1 chữ số thập phân, thêm trang tính cho tháng sau và đặt giấy in nằm ngang.',
    start: { sheets: [{ name: 'Tháng 9', colW: { A: 120, B: 100, C: 100 }, styles: { 'A1:D1': { b: true, wrap: true } }, rows: [['Họ và tên', 'Chiều cao (m)', 'Cân nặng (kg)', 'BMI'], ['Nguyễn An', 1.5, 42], ['Trần Bình', 1.45, 38], ['Lê Chi', 1.52, 45]] }] },
    steps: [
      { text: 'D2:D4 tính BMI bằng công thức', check: { type: 'formula', range: 'D2:D4', equals: [18.6667, 18.0737, 19.4772], tol: 0.01 } },
      { text: 'BMI hiện 1 chữ số thập phân', check: { type: 'style', range: 'D2:D4', nf: { dec: 1 } } },
      { text: 'Thêm trang tính “Tháng 10”', check: { type: 'sheetName', name: 'Tháng 10' } },
      { text: 'Hướng giấy in nằm ngang', check: { type: 'page', orientation: 'landscape' } },
    ],
  },

  // ===================== LỚP 8 =====================
  {
    id: 'l8-b5-tuyet-doi',
    lop: 8,
    bai: 'Bài 5. Sử dụng bảng tính giải quyết bài toán thực tế',
    title: 'Địa chỉ tuyệt đối',
    intro: 'Tỉ lệ = Số lượng ÷ Tổng. Ở C2 gõ =B2/B6 rồi nhấn F4 khi con trỏ ở B6 để thành $B$6, Enter, rồi kéo xuống C5. Cuối cùng định dạng Phần trăm.',
    start: { sheets: [{ name: 'Thư viện', colW: { A: 110 }, styles: { 'A1:C1': { b: true }, 'A6:B6': { b: true } }, rows: [['Loại sách', 'Số lượng', 'Tỉ lệ'], ['Truyện', 120], ['Khoa học', 80], ['Lịch sử', 50], ['Ngoại ngữ', 50], ['Tổng', '=SUM(B2:B5)']] }] },
    steps: [
      { text: 'C2:C5 tính tỉ lệ, dùng địa chỉ tuyệt đối $B$6', check: { type: 'formula', range: 'C2:C5', abs: true, equals: [0.4, 0.2667, 0.1667, 0.1667] } },
      { text: 'C2:C5 định dạng Phần trăm', check: { type: 'style', range: 'C2:C5', nf: { kind: 'percent' } } },
    ],
  },
  {
    id: 'l8-b6-sap-xep',
    lop: 8,
    bai: 'Bài 6. Sắp xếp và lọc dữ liệu',
    title: 'Sắp xếp theo điểm',
    intro: 'Đặt con trỏ vào một ô của cột Điểm, bấm Z→A (Giảm dần). Phần mềm tự giữ hàng tiêu đề và di chuyển cả hàng.',
    start: { sheets: [{ name: 'Điểm thi', colW: { A: 120 }, styles: { 'A1:C1': { b: true } }, rows: DIEM_8 }] },
    steps: [
      { text: 'Cột Điểm sắp xếp giảm dần', check: { type: 'sorted', range: 'A2:C9', col: 'C', desc: true } },
      { text: 'Tên và điểm của từng bạn vẫn đi cùng nhau', check: { type: 'sorted', range: 'A2:C9', col: 'C', desc: true, keepRow: [[['A', 'Lê Chi'], ['C', 9.5]], [['A', 'Phạm Dũng'], ['C', 6]], [['A', 'Hồ Lan'], ['B', '8C']]] } },
      { text: 'Bạn điểm cao nhất ở hàng 2', check: { type: 'value', cell: 'A2', equals: 'Lê Chi' } },
    ],
  },
  {
    id: 'l8-b6-loc',
    lop: 8,
    bai: 'Bài 6. Sắp xếp và lọc dữ liệu',
    title: 'Lọc dữ liệu',
    intro: 'Tab Dữ liệu → Lọc. Bấm ▾ ở cột Lớp, chỉ để lại 8A. Tiếp tục bấm ▾ ở cột Điểm → “lớn hơn hoặc bằng” 8.',
    start: { sheets: [{ name: 'Điểm thi', colW: { A: 120 }, styles: { 'A1:C1': { b: true } }, rows: DIEM_8 }] },
    steps: [
      { text: 'Bật Lọc và chỉ hiện các bạn lớp 8A', check: { type: 'filter', col: 'B', equals: '8A' } },
      { text: 'Chỉ hiện các bạn đạt từ 8 điểm trở lên', check: { type: 'filter', col: 'C', gte: 8 } },
      { text: 'Còn đúng 2 bạn', check: { type: 'filter', count: 2 } },
    ],
  },
  {
    id: 'l8-b7-bieu-do-cot',
    lop: 8,
    bai: 'Bài 7. Trực quan hoá dữ liệu',
    title: 'Biểu đồ cột',
    intro: 'Chọn vùng A1:C5 (gồm cả hàng tiêu đề), tab Chèn → Cột. Bấm vào biểu đồ, tab Biểu đồ: sửa tiêu đề thành “Số sách mượn theo tháng”.',
    start: { sheets: [{ name: 'Mượn sách', styles: { 'A1:C1': { b: true } }, rows: [['Tháng', 'Lớp 8A', 'Lớp 8B'], ['Tháng 9', 25, 30], ['Tháng 10', 40, 35], ['Tháng 11', 32, 28], ['Tháng 12', 45, 50]] }] },
    steps: [
      { text: 'Có biểu đồ cột', check: { type: 'chart', chartType: 'column' } },
      { text: 'Biểu đồ dùng dữ liệu A1:C5', check: { type: 'chart', chartType: 'column', covers: 'A1:C5' } },
      { text: 'Tiêu đề có chữ “sách mượn”', check: { type: 'chart', titleIncludes: 'sách mượn' } },
      { text: 'Có chú thích (tên hai lớp)', check: { type: 'chart', legend: true } },
    ],
  },
  {
    id: 'l8-b7-bieu-do-tron',
    lop: 8,
    bai: 'Bài 7. Trực quan hoá dữ liệu',
    title: 'Biểu đồ tròn',
    intro: 'Biểu đồ tròn cho biết mỗi phần chiếm bao nhiêu trong tổng thể. Chọn A1:B5 → Chèn → Tròn, bật Nhãn dữ liệu.',
    start: { sheets: [{ name: 'Phương tiện', colW: { A: 120 }, styles: { 'A1:B1': { b: true } }, rows: [['Phương tiện đến trường', 'Số bạn'], ['Đi bộ', 8], ['Xe đạp', 15], ['Bố mẹ đưa', 12], ['Xe buýt', 5]] }] },
    steps: [
      { text: 'Có biểu đồ tròn', check: { type: 'chart', chartType: 'pie' } },
      { text: 'Biểu đồ dùng dữ liệu A1:B5', check: { type: 'chart', chartType: 'pie', covers: 'A2:B5' } },
      { text: 'Bật Nhãn dữ liệu', check: { type: 'chart', chartType: 'pie', labels: true } },
    ],
  },

  // ===================== LỚP 9 =====================
  {
    id: 'l9-9a-xac-thuc',
    lop: 9,
    bai: 'Bài 9a. Sử dụng công cụ xác thực dữ liệu',
    title: 'Chống nhập sai dữ liệu',
    intro: 'Chọn B3:B12 → Dữ liệu → Xác thực dữ liệu → Danh sách, nguồn: Thu,Chi. Chọn D3:D12 → Số nguyên, lớn hơn 0, nhập thông báo lỗi. Thử gõ sai để thấy thông báo.',
    start: { sheets: [{ name: 'Thu chi', colW: { C: 150, D: 100 }, merges: ['A1:D1'], styles: { 'A1': { b: true, align: 'center', size: 14 }, 'A2:D2': { b: true } }, rows: THU_CHI.slice(0, 6) }] },
    steps: [
      { text: 'B3:B12 chỉ cho chọn “Thu” hoặc “Chi”', check: { type: 'dv', range: 'B3:B12', dvType: 'list', listHas: ['Thu', 'Chi'] } },
      { text: 'D3:D12 chỉ cho nhập số nguyên', check: { type: 'dv', range: 'D3:D12', dvType: 'whole' } },
      { text: 'Có thông báo lỗi cho ô Số tiền', check: { type: 'dv', range: 'D3:D12', message: true } },
    ],
  },
  {
    id: 'l9-10a-countif',
    lop: 9,
    bai: 'Bài 10a. Sử dụng hàm COUNTIF',
    title: 'Đếm số lần thu, chi',
    intro: 'Ở G3 gõ =COUNTIF($B$3:$B$10,F3) rồi kéo xuống G4. Vùng đếm phải dùng địa chỉ tuyệt đối để khi sao chép không bị lệch.',
    start: { sheets: [{ name: 'Thu chi', colW: { C: 150, D: 100, G: 90 }, merges: ['A1:D1'], styles: { 'A1': { b: true, align: 'center', size: 14 }, 'A2:D2': { b: true }, 'F2:G2': { b: true } }, rows: THU_CHI.map((r, i) => (i === 1 ? [...r, '', 'Khoản', 'Số lần'] : i === 2 ? [...r, '', 'Thu'] : i === 3 ? [...r, '', 'Chi'] : r)) }] },
    steps: [
      { text: 'G3 dùng hàm COUNTIF', check: { type: 'formula', cell: 'G3', func: 'COUNTIF', equals: 3 } },
      { text: 'Vùng đếm dùng địa chỉ tuyệt đối', check: { type: 'formula', cell: 'G3', abs: true } },
      { text: 'Sao chép xuống G4 (đếm số lần Chi)', check: { type: 'formula', cell: 'G4', func: 'COUNTIF', equals: 5 } },
    ],
  },
  {
    id: 'l9-11a-sumif',
    lop: 9,
    bai: 'Bài 11a. Sử dụng hàm SUMIF',
    title: 'Tổng tiền thu, chi',
    intro: 'Ở G3 gõ =SUMIF($B$3:$B$10,F3,$D$3:$D$10), kéo xuống G4. Sau đó G5 tính số tiền còn lại = Thu − Chi.',
    start: { sheets: [{ name: 'Thu chi', colW: { C: 150, D: 100, G: 100 }, merges: ['A1:D1'], styles: { 'A1': { b: true, align: 'center', size: 14 }, 'A2:D2': { b: true }, 'F2:G2': { b: true } }, rows: THU_CHI.map((r, i) => (i === 1 ? [...r, '', 'Khoản', 'Tổng tiền'] : i === 2 ? [...r, '', 'Thu'] : i === 3 ? [...r, '', 'Chi'] : i === 4 ? [...r, '', 'Còn lại'] : r)) }] },
    steps: [
      { text: 'G3: tổng tiền thu bằng SUMIF', check: { type: 'formula', cell: 'G3', func: 'SUMIF', abs: true, equals: 950000 } },
      { text: 'G4: tổng tiền chi bằng SUMIF', check: { type: 'formula', cell: 'G4', func: 'SUMIF', equals: 710000 } },
      { text: 'G5: số tiền còn lại = Thu − Chi', check: { type: 'formula', cell: 'G5', equals: 240000 } },
    ],
  },
  {
    id: 'l9-12a-if',
    lop: 9,
    bai: 'Bài 12a. Sử dụng hàm IF',
    title: 'Xét kết quả và xếp loại',
    intro: 'C2: =IF(B2>=5,"Đạt","Chưa đạt"). D2 dùng IF lồng nhau: từ 8 là “Giỏi”, từ 6,5 là “Khá”, từ 5 là “Trung bình”, còn lại “Yếu”. Kéo cả hai công thức xuống hàng 7.',
    start: { sheets: [{ name: 'Kết quả', colW: { A: 120, C: 90, D: 100 }, styles: { 'A1:D1': { b: true } }, rows: [['Họ và tên', 'Điểm TB', 'Kết quả', 'Xếp loại'], ['Nguyễn An', 8.5], ['Trần Bình', 4.5], ['Lê Chi', 6.8], ['Phạm Dũng', 5], ['Đỗ Hà', 9.2], ['Vũ Khoa', 3.9]] }] },
    steps: [
      { text: 'C2:C7 dùng IF: “Đạt” / “Chưa đạt”', check: { type: 'formula', range: 'C2:C7', func: 'IF', equals: ['Đạt', 'Chưa đạt', 'Đạt', 'Đạt', 'Đạt', 'Chưa đạt'] } },
      { text: 'D2:D7 xếp loại bằng IF lồng nhau', check: { type: 'formula', range: 'D2:D7', func: 'IF', equals: ['Giỏi', 'Yếu', 'Khá', 'Trung bình', 'Giỏi', 'Yếu'] } },
    ],
  },
]
