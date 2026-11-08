// Đề bài thực hành, bám SGK Tin học — bộ Kết nối tri thức.
// Mỗi đề: lop, bai (tên bài trong SGK), title, intro, start (nội dung có sẵn, HTML), steps (yêu cầu + cách chấm).
// Giáo viên có thể thêm đề bằng cách sửa file này, hoặc soạn file .json cùng cấu trúc rồi bấm "Mở đề bài".
//
// Các loại check:
//   contains / notContains {text}         — có / không có dòng chữ
//   count {text, n}                       — dòng chữ xuất hiện đúng n lần
//   order {texts:[...]}                   — các câu theo đúng thứ tự
//   format {text, bold, italic, underline, color:'đỏ', fontSize:16, fontFamily:'Times New Roman', highlight}
//   align {text, value:'left|center|right|justify'}
//   para {text, lineHeight, indentFirst(cm), indentLeft(cm), spaceBefore(pt), spaceAfter(pt)}
//   list {texts:[...], kind:'bullet|ordered'}
//   table {rows, cols, merged, filled, cellText:[...]}
//   image {min}
//   page {orientation:'portrait|landscape', size:'A4', top, bottom, left, right}

export const LESSONS = [
  // ===================== LỚP 4 =====================
  {
    id: 'l4-b10-go-tho',
    lop: 4,
    bai: 'Bài 10. Phần mềm soạn thảo văn bản',
    title: 'Gõ khổ thơ',
    intro: 'Dùng Unikey (kiểu gõ Telex) để gõ khổ thơ dưới đây. Mỗi câu thơ một dòng, hết dòng thì nhấn Enter.',
    start: '',
    show: '<p><i>Em yêu màu đỏ<br>Như máu con tim<br>Lá cờ Tổ quốc<br>Khăn quàng đội viên</i></p>',
    steps: [
      { text: 'Gõ đúng câu 1: “Em yêu màu đỏ”', check: { type: 'contains', text: 'Em yêu màu đỏ' } },
      { text: 'Gõ đúng câu 2: “Như máu con tim”', check: { type: 'contains', text: 'Như máu con tim' } },
      { text: 'Gõ đúng câu 3: “Lá cờ Tổ quốc”', check: { type: 'contains', text: 'Lá cờ Tổ quốc' } },
      { text: 'Gõ đúng câu 4: “Khăn quàng đội viên”', check: { type: 'contains', text: 'Khăn quàng đội viên' } },
    ],
  },
  {
    id: 'l4-b10-sua-loi',
    lop: 4,
    bai: 'Bài 10. Phần mềm soạn thảo văn bản',
    title: 'Sửa lỗi bằng Delete và Backspace',
    intro: 'Đoạn văn có chữ gõ sai. Đặt con trỏ cạnh chữ sai, dùng Backspace (xoá bên trái) hoặc Delete (xoá bên phải) rồi gõ lại cho đúng.',
    start: '<p>Mùa xuân, cây gạo gọi đếnn bao nhiêu là chim. Từ xa nhìn lại, cây gạo sừng sững như một tháp đèn khổng lồ. Hàng ngàn bônng hoa là hàng ngàn ngọn lửa hồng tươi.</p>',
    steps: [
      { text: 'Sửa “đếnn” thành “đến”', check: { type: 'notContains', text: 'đếnn' } },
      { text: 'Sửa “bônng” thành “bông”', check: { type: 'notContains', text: 'bônng' } },
      { text: 'Không làm mất chữ nào khác', check: { type: 'contains', text: 'Hàng ngàn bông hoa là hàng ngàn ngọn lửa hồng tươi.' } },
    ],
  },
  {
    id: 'l4-b11-di-chuyen',
    lop: 4,
    bai: 'Bài 11. Chỉnh sửa văn bản',
    title: 'Sắp xếp lại các câu thơ',
    intro: 'Các câu thơ bị xếp lộn xộn. Chọn cả dòng, dùng Cắt (Ctrl+X) và Dán (Ctrl+V) để đưa về đúng thứ tự.',
    start: '<p>Bàn tay mẹ ru</p><p>Ơi những bàn tay</p><p>Mẹ chăm cho con</p><p>Cho con khôn lớn</p>',
    show: '<p>Thứ tự đúng:<br>1. Ơi những bàn tay<br>2. Mẹ chăm cho con<br>3. Cho con khôn lớn<br>4. Bàn tay mẹ ru</p>',
    steps: [
      { text: 'Bốn câu theo đúng thứ tự', check: { type: 'order', texts: ['Ơi những bàn tay', 'Mẹ chăm cho con', 'Cho con khôn lớn', 'Bàn tay mẹ ru'] } },
      { text: 'Mỗi câu chỉ xuất hiện một lần', check: { type: 'count', text: 'Bàn tay mẹ ru', n: 1 } },
    ],
  },
  {
    id: 'l4-b11-sao-chep',
    lop: 4,
    bai: 'Bài 11. Chỉnh sửa văn bản',
    title: 'Sao chép điệp khúc',
    intro: 'Bài hát có câu điệp khúc lặp lại. Chọn câu “Kìa con bướm vàng” rồi Sao chép (Ctrl+C), đặt con trỏ xuống dòng trống và Dán (Ctrl+V).',
    start: '<p>Kìa con bướm vàng</p><p></p><p>Xoè đôi cánh</p><p>Xoè đôi cánh</p>',
    steps: [
      { text: '“Kìa con bướm vàng” xuất hiện 2 lần', check: { type: 'count', text: 'Kìa con bướm vàng', n: 2 } },
      { text: 'Vẫn giữ 2 câu “Xoè đôi cánh”', check: { type: 'count', text: 'Xoè đôi cánh', n: 2 } },
    ],
  },

  // ===================== LỚP 5 =====================
  {
    id: 'l5-b7-chinh-sua',
    lop: 5,
    bai: 'Bài 7. Thực hành soạn thảo văn bản',
    title: 'Chọn, xoá, di chuyển đoạn văn',
    intro: 'Đoạn giới thiệu bị thừa một câu và đặt sai chỗ một câu. Hãy sửa lại.',
    start:
      '<p>Vịnh Hạ Long là một di sản thiên nhiên thế giới.</p><p>Câu này bị thừa, hãy xoá đi.</p><p>Hằng năm có hàng triệu du khách đến tham quan.</p><p>Vịnh có hàng nghìn hòn đảo lớn nhỏ.</p>',
    steps: [
      { text: 'Xoá câu “Câu này bị thừa, hãy xoá đi.”', check: { type: 'notContains', text: 'Câu này bị thừa' } },
      {
        text: 'Đưa câu “Vịnh có hàng nghìn hòn đảo lớn nhỏ.” lên ngay sau câu đầu tiên',
        check: { type: 'order', texts: ['Vịnh Hạ Long là một di sản', 'Vịnh có hàng nghìn hòn đảo', 'Hằng năm có hàng triệu du khách'] },
      },
    ],
  },
  {
    id: 'l5-b7-hinh-anh',
    lop: 5,
    bai: 'Bài 7. Thực hành soạn thảo văn bản',
    title: 'Đưa hình ảnh vào văn bản',
    intro: 'Làm tấm thiệp nhỏ: chèn một hình ảnh (tab Chèn → Hình ảnh), đặt hình ở giữa và trang trí lời chúc.',
    start: '<p>CHÚC MỪNG NGÀY NHÀ GIÁO VIỆT NAM 20-11</p><p></p><p>Em kính chúc thầy cô luôn mạnh khoẻ và hạnh phúc!</p>',
    steps: [
      { text: 'Chèn ít nhất 1 hình ảnh', check: { type: 'image', min: 1 } },
      { text: 'Dòng tiêu đề căn giữa', check: { type: 'align', text: 'CHÚC MỪNG NGÀY NHÀ GIÁO', value: 'center' } },
      { text: 'Dòng tiêu đề in đậm, màu đỏ', check: { type: 'format', text: 'CHÚC MỪNG NGÀY NHÀ GIÁO VIỆT NAM 20-11', bold: true, color: 'đỏ' } },
      { text: 'Lời chúc in nghiêng', check: { type: 'format', text: 'Em kính chúc thầy cô luôn mạnh khoẻ và hạnh phúc!', italic: true } },
    ],
  },

  // ===================== LỚP 6 =====================
  {
    id: 'l6-b11-ki-tu',
    lop: 6,
    bai: 'Bài 11. Định dạng văn bản',
    title: 'Định dạng kí tự',
    intro: 'Định dạng bài giới thiệu theo yêu cầu bên dưới (tab Trang chủ, nhóm Phông chữ).',
    start:
      '<p>GIỚI THIỆU TRƯỜNG EM</p><p>Trường em nằm bên dòng sông xanh mát. Sân trường có cây phượng già, mùa hè hoa nở đỏ rực.</p><p>Em rất yêu ngôi trường của em.</p>',
    steps: [
      { text: 'Tiêu đề: phông Times New Roman, cỡ 16', check: { type: 'format', text: 'GIỚI THIỆU TRƯỜNG EM', fontFamily: 'Times New Roman', fontSize: 16 } },
      { text: 'Tiêu đề: in đậm, màu xanh dương', check: { type: 'format', text: 'GIỚI THIỆU TRƯỜNG EM', bold: true, color: 'xanh dương' } },
      { text: 'Cụm “cây phượng già” gạch chân', check: { type: 'format', text: 'cây phượng già', underline: true } },
      { text: 'Câu cuối in nghiêng', check: { type: 'format', text: 'Em rất yêu ngôi trường của em.', italic: true } },
    ],
  },
  {
    id: 'l6-b11-doan-van',
    lop: 6,
    bai: 'Bài 11. Định dạng văn bản',
    title: 'Định dạng đoạn văn',
    intro: 'Dùng nhóm Đoạn văn (tab Trang chủ) hoặc hộp Định dạng đoạn để trình bày văn bản.',
    start:
      '<p>CÂY TRE VIỆT NAM</p><p>Cây tre là người bạn thân của nông dân Việt Nam. Tre ăn ở với người, đời đời, kiếp kiếp.</p><p>Tre, nứa, mai, vầu giúp người trăm nghìn công việc khác nhau.</p>',
    steps: [
      { text: 'Tiêu đề căn giữa', check: { type: 'align', text: 'CÂY TRE VIỆT NAM', value: 'center' } },
      { text: 'Đoạn 1 căn đều hai bên', check: { type: 'align', text: 'Cây tre là người bạn thân', value: 'justify' } },
      { text: 'Đoạn 1 thụt dòng đầu 1 cm', check: { type: 'para', text: 'Cây tre là người bạn thân', indentFirst: 1 } },
      { text: 'Đoạn 2 giãn dòng 1.5', check: { type: 'para', text: 'Tre, nứa, mai, vầu', lineHeight: 1.5 } },
    ],
  },
  {
    id: 'l6-b11-trang',
    lop: 6,
    bai: 'Bài 11. Định dạng văn bản',
    title: 'Định dạng trang',
    intro: 'Mở tab Bố cục để chọn hướng trang và lề trang.',
    start: '<p>THỜI KHOÁ BIỂU CỦA EM</p><p>(Trang này sẽ được in theo chiều ngang.)</p>',
    steps: [
      { text: 'Hướng trang nằm ngang', check: { type: 'page', orientation: 'landscape' } },
      { text: 'Lề trái 3 cm, lề phải 2 cm', check: { type: 'page', left: 3, right: 2 } },
      { text: 'Lề trên 2 cm, lề dưới 2 cm', check: { type: 'page', top: 2, bottom: 2 } },
    ],
  },
  {
    id: 'l6-b12-bang',
    lop: 6,
    bai: 'Bài 12. Trình bày thông tin ở dạng bảng',
    title: 'Tạo bảng thời khoá biểu',
    intro: 'Tab Chèn → Bảng, tạo bảng 4 hàng × 3 cột rồi điền nội dung. Hàng đầu là tiêu đề cột.',
    start: '<p>THỜI KHOÁ BIỂU SÁNG THỨ HAI</p><p></p>',
    show: '<table><tr><td><b>Tiết</b></td><td><b>Môn</b></td><td><b>Giáo viên</b></td></tr><tr><td>1</td><td>Toán</td><td>...</td></tr><tr><td>2</td><td>Ngữ văn</td><td>...</td></tr><tr><td>3</td><td>Tin học</td><td>...</td></tr></table>',
    steps: [
      { text: 'Có bảng 4 hàng, 3 cột', check: { type: 'table', rows: 4, cols: 3 } },
      { text: 'Hàng đầu có “Tiết”, “Môn”, “Giáo viên”', check: { type: 'table', cellText: ['Tiết', 'Môn', 'Giáo viên'] } },
      { text: 'Có các môn Toán, Ngữ văn, Tin học', check: { type: 'table', cellText: ['Toán', 'Ngữ văn', 'Tin học'] } },
      { text: 'Điền đủ, không để ô trống', check: { type: 'table', filled: true } },
    ],
  },
  {
    id: 'l6-b12-gop-o',
    lop: 6,
    bai: 'Bài 12. Trình bày thông tin ở dạng bảng',
    title: 'Thêm hàng và gộp ô',
    intro: 'Thêm một hàng ở đầu bảng, gộp các ô của hàng đó thành một ô và gõ tiêu đề “DANH SÁCH TỔ 1”. Thêm một hàng cuối cho bạn thứ ba.',
    start:
      '<table><tr><th>STT</th><th>Họ và tên</th><th>Điểm</th></tr><tr><td>1</td><td>Nguyễn An</td><td>9</td></tr><tr><td>2</td><td>Trần Bình</td><td>8</td></tr></table><p></p>',
    steps: [
      { text: 'Có ô gộp', check: { type: 'table', merged: true } },
      { text: 'Có tiêu đề “DANH SÁCH TỔ 1” trong bảng', check: { type: 'table', cellText: ['DANH SÁCH TỔ 1'] } },
      { text: 'Bảng có 5 hàng (1 tiêu đề + 1 hàng tên cột + 3 bạn)', check: { type: 'table', rows: 5 } },
    ],
  },
  {
    id: 'l6-b13-tim-thay',
    lop: 6,
    bai: 'Bài 13. Thực hành: Tìm kiếm và thay thế',
    title: 'Thay thế hàng loạt',
    intro: 'Bạn gõ nhầm “Ha Noi” ở nhiều chỗ. Mở Tìm và thay thế (Ctrl+H), thay tất cả bằng “Hà Nội”.',
    start:
      '<p>Ha Noi là thủ đô của nước Việt Nam. Ha Noi có Hồ Gươm, có phố cổ.</p><p>Mùa thu Ha Noi có hương hoa sữa. Em mong được đến thăm Ha Noi.</p>',
    steps: [
      { text: 'Không còn “Ha Noi”', check: { type: 'notContains', text: 'Ha Noi' } },
      { text: '“Hà Nội” xuất hiện đủ 4 lần', check: { type: 'count', text: 'Hà Nội', n: 4 } },
    ],
  },
  {
    id: 'l6-danh-sach',
    lop: 6,
    bai: 'Luyện thêm: Danh sách liệt kê',
    title: 'Danh sách dấu đầu dòng và đánh số',
    intro: 'Chọn các dòng cần liệt kê rồi bấm nút Dấu đầu dòng hoặc Đánh số (tab Trang chủ).',
    start: '<p>Đồ dùng mang đi dã ngoại:</p><p>Mũ</p><p>Nước uống</p><p>Áo mưa</p><p>Các bước rửa tay:</p><p>Làm ướt tay</p><p>Xoa xà phòng</p><p>Rửa sạch và lau khô</p>',
    steps: [
      { text: 'Mũ, Nước uống, Áo mưa: dấu đầu dòng', check: { type: 'list', texts: ['Mũ', 'Nước uống', 'Áo mưa'], kind: 'bullet' } },
      { text: 'Ba bước rửa tay: đánh số', check: { type: 'list', texts: ['Làm ướt tay', 'Xoa xà phòng', 'Rửa sạch và lau khô'], kind: 'ordered' } },
    ],
  },
]
