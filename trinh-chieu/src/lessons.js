// Bài tập Trình chiếu — SGK Tin học bộ Kết nối tri thức với cuộc sống.
// Tin 3: Bài 11 · Tin 4: Bài 7, 8, 9 · Tin 7: Bài 11, 12, 13 · Tin 8: Bài 10a, 11a
import { newSlide, uid } from './model.js'
import { CLIPART } from './clipart.js'

// ---------- dựng nhanh nội dung ----------
const P = (text, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: text ? [{ type: 'text', text }] : [] })
const doc = (...paras) => ({ type: 'doc', content: paras.map((p) => (typeof p === 'string' ? P(p) : p)) })
// mục danh sách: chuỗi, hoặc [chuỗi, [mục con…]]
function list(items, ordered = false) {
  return {
    type: ordered ? 'orderedList' : 'bulletList',
    content: items.map((it) => {
      const [t, sub] = Array.isArray(it) ? it : [it]
      return { type: 'listItem', content: [P(t), ...(sub ? [list(sub)] : [])] }
    }),
  }
}
const bullets = (items) => ({ type: 'doc', content: [list(items)] })

function sl(layout, { title, sub, body, body2, objs = [] } = {}) {
  const s = newSlide(layout)
  for (const o of s.objs) {
    if (o.ph === 'title' && title != null) o.doc = doc(P(title, o.align ? { textAlign: o.align } : undefined))
    if (o.ph === 'subtitle' && sub != null) o.doc = doc(P(sub, o.align ? { textAlign: o.align } : undefined))
    if (o.ph === 'body' && body != null) o.doc = body
    if (o.ph === 'body2' && body2 != null) o.doc = body2
  }
  s.objs.push(...objs.map((o) => ({ id: uid(), ...o })))
  return s
}
const img = (k, x, y, w, h) => ({ kind: 'image', src: CLIPART[k].src, x, y, w, h })
const textbox = (text, x, y, w, h, align = 'center') => ({ kind: 'text', x, y, w, h, valign: 'top', doc: doc(P(text, { textAlign: align })) })
const deck = (slides, themeId = 'office') => () => JSON.parse(JSON.stringify({ v: 1, theme: themeId, slides }))

// ---------- đề có sẵn nội dung ----------
const truongEm = () => [
  sl('title', { title: 'Trường Tiểu học Hoà Bình', sub: 'Số 1 đường Lê Lợi, phường Hoà Bình' }),
  sl('titleOnly', { title: 'Ngôi trường của em', objs: [img('truong', 400, 190, 480, 360), textbox('Ngôi trường mới khang trang', 340, 570, 600, 50)] }),
  sl('titleContent', { title: 'Hoạt động văn nghệ', body: doc('Hát múa chào mừng ngày 20/11', 'Hội diễn văn nghệ cuối năm', 'Câu lạc bộ âm nhạc') }),
  sl('titleContent', { title: 'Em yêu trường em', body: doc('Em rất yêu ngôi trường của em!') }),
]
const hoGuom = () => [
  sl('title', { title: 'Hồ Hoàn Kiếm', sub: 'Trái tim của Thủ đô Hà Nội' }),
  sl('titleContent', { title: 'Tháp Rùa', body: bullets(['Nằm giữa hồ Hoàn Kiếm', 'Được xây dựng từ cuối thế kỉ XIX']), objs: [img('thapRua', 760, 250, 400, 300)] }),
  sl('titleContent', { title: 'Cầu Thê Húc', body: bullets(['Cây cầu gỗ sơn màu đỏ', 'Dẫn vào đền Ngọc Sơn']) }),
  sl('titleContent', { title: 'Đền Ngọc Sơn', body: bullets(['Nằm trên đảo Ngọc', 'Là di tích lịch sử – văn hoá nổi tiếng']) }),
]
const truongXanhBody = bullets([
  'Cây xanh cho bóng mát',
  'Cây xanh làm không khí trong lành',
  'Cây xanh làm trường học thêm đẹp',
])
const viecLam = bullets([
  ['Chăm sóc cây xanh', ['Tưới cây hằng ngày', 'Không bẻ cành, hái lá']],
  ['Giữ vệ sinh trường lớp', ['Bỏ rác đúng nơi quy định']],
  'Tiết kiệm điện, nước',
])
const scratch = () => [
  sl('title', { title: 'Làm quen với Scratch', sub: 'CLB Tin học – Lớp 8A' }),
  sl('titleContent', { title: 'Scratch là gì?', body: bullets(['Ngôn ngữ lập trình trực quan', 'Lập trình bằng cách kéo thả các khối lệnh', 'Phù hợp để tạo trò chơi, câu chuyện']) }),
  sl('titleContent', { title: 'Các nhóm lệnh', body: bullets(['Chuyển động', 'Hiển thị', 'Âm thanh', 'Điều khiển']) }),
  sl('titleContent', { title: 'Ví dụ chương trình', body: bullets(['Nhân vật mèo di chuyển 10 bước', 'Nói “Xin chào!” trong 2 giây']) }),
]
const anToan = () => [
  sl('title', { title: 'An toàn trong phòng thực hành Tin học', sub: 'Lớp 8A' }),
  sl('titleContent', { title: 'Những điều cần nhớ', body: bullets(['Không ăn uống trong phòng máy', 'Không tự ý tháo lắp thiết bị', 'Tắt máy đúng cách khi ra về']) }),
  sl('titleContent', { title: 'Khi có sự cố', body: bullets(['Báo ngay cho thầy cô', 'Không tự sửa ổ điện, dây điện']) }),
]

export const LESSONS = [
  // ================= LỚP 3 =================
  {
    id: 'l3-b11-trang-tieu-de', lop: 3, bai: 'Bài 11. Bài trình chiếu của em', title: 'Trang tiêu đề “Gia đình em”',
    file: 'Gia dinh em',
    intro: 'Em tạo trang đầu tiên của bài trình chiếu giới thiệu gia đình em. Bấm vào khung “Bấm để thêm tiêu đề” rồi gõ chữ.',
    steps: [
      { text: 'Gõ tiêu đề <b>Gia đình em</b> vào khung tiêu đề.', check: { type: 'text', slide: 1, ph: 'title', contains: 'gia đình em' } },
      { text: 'Gõ <b>họ và tên của em</b> vào khung phụ đề bên dưới.', check: { type: 'text', slide: 1, ph: 'subtitle', minWords: 2 } },
    ],
  },
  {
    id: 'l3-b11-them-trang', lop: 3, bai: 'Bài 11. Bài trình chiếu của em', title: 'Thêm trang và chèn ảnh',
    file: 'Gia dinh em',
    intro: 'Bài đã có trang tiêu đề. Em thêm trang thứ hai giới thiệu bố mẹ, có ảnh minh hoạ. Làm xong bấm phím F5 để trình chiếu thử.',
    start: deck([sl('title', { title: 'Gia đình em', sub: 'Nguyễn Minh An' })]),
    steps: [
      { text: 'Thêm trang mới: <b>Trang chủ → Trang mới</b>.', check: { type: 'slides', min: 2 } },
      { text: 'Gõ tiêu đề trang 2: <b>Bố mẹ của em</b>.', check: { type: 'text', slide: 2, ph: 'title', contains: 'bố mẹ' } },
      { text: 'Gõ ít nhất <b>2 dòng</b> giới thiệu bố mẹ vào khung nội dung trang 2 (gõ xong một dòng bấm Enter).', check: { type: 'text', slide: 2, ph: 'body', minParas: 2 } },
      { text: 'Chèn một ảnh vào trang 2: <b>Chèn → Ảnh mẫu</b> (hoặc Ảnh từ máy tính). Kéo ảnh sang bên cạnh chữ.', check: { type: 'image', slide: 2 } },
    ],
  },

  // ================= LỚP 4 =================
  {
    id: 'l4-b7-truong-em', lop: 4, bai: 'Bài 7. Tạo bài trình chiếu', title: 'Bài trình chiếu “Trường em” (4 trang)',
    file: 'Truong em',
    intro: 'Em tạo bài trình chiếu 4 trang giới thiệu trường em. Dùng <b>Trang chủ → Trang mới</b> để thêm trang; chọn bố cục ở mũi tên ▾ bên cạnh.',
    steps: [
      { text: 'Trang 1: tiêu đề là <b>tên trường em</b> (có chữ “Trường”).', check: { type: 'text', slide: 1, ph: 'title', contains: 'trường' } },
      { text: 'Trang 1: phụ đề là <b>địa chỉ</b> của trường.', check: { type: 'text', slide: 1, ph: 'subtitle', minWords: 3 } },
      { text: 'Trang 2: tiêu đề <b>Ngôi trường của em</b>.', check: { type: 'text', slide: 2, ph: 'title', contains: 'ngôi trường' } },
      { text: 'Trang 2: chèn <b>một ảnh</b> về trường (Chèn → Ảnh mẫu → Trường học).', check: { type: 'image', slide: 2 } },
      { text: 'Trang 3: tiêu đề <b>Hoạt động văn nghệ</b>, nội dung có ít nhất 2 dòng.', check: { type: 'text', slide: 3, ph: 'body', minParas: 2 } },
      { text: 'Trang 4: tiêu đề <b>Em yêu trường em</b>.', check: { type: 'text', slide: 4, ph: 'title', contains: 'yêu trường' } },
    ],
  },
  {
    id: 'l4-b8-dinh-dang', lop: 4, bai: 'Bài 8. Định dạng văn bản trên trang chiếu', title: 'Định dạng bài “Trường em”',
    file: 'Truong em',
    intro: 'Bài “Trường em” đã có sẵn chữ. Em bôi đen chữ (hoặc bấm vào viền khung) rồi chọn phông, cỡ, màu chữ ở tab Trang chủ.',
    start: deck(truongEm()),
    steps: [
      { text: 'Tên trường (trang 1): phông <b>Times New Roman</b>, cỡ <b>50</b>, màu <b>xanh dương</b>.', check: { type: 'fmt', slide: 1, ph: 'title', font: 'Times New Roman', size: 50, color: 'xanh dương' } },
      { text: 'Địa chỉ (trang 1): phông <b>Times New Roman</b>, cỡ <b>30</b>, màu <b>đỏ</b>.', check: { type: 'fmt', slide: 1, ph: 'subtitle', font: 'Times New Roman', size: 30, color: 'đỏ' } },
      { text: 'Chú thích ảnh “Ngôi trường mới khang trang” (trang 2): cỡ <b>30</b>, màu <b>cam</b>.', check: { type: 'fmt', slide: 2, find: 'khang trang', size: 30, color: 'cam' } },
      { text: 'Các hoạt động ở trang 3 có <b>gạch đầu dòng</b>.', check: { type: 'list', slide: 3, ph: 'body', minItems: 3 } },
      { text: 'Câu “Em rất yêu ngôi trường của em!” (trang 4): <b>in đậm</b> và <b>in nghiêng</b>.', check: { type: 'fmt', slide: 4, find: 'em rất yêu', b: true, i: true } },
    ],
  },
  {
    id: 'l4-b9-chuyen-trang', lop: 4, bai: 'Bài 9. Hiệu ứng chuyển trang', title: 'Hiệu ứng chuyển trang “Hồ Hoàn Kiếm”',
    file: 'Ho Hoan Kiem',
    intro: 'Chọn trang ở cột bên trái, rồi chọn hiệu ứng ở tab <b>Chuyển trang</b>. Bấm F5 để xem kết quả.',
    start: deck(hoGuom()),
    steps: [
      { text: 'Trang 1: hiệu ứng <b>Mờ dần</b>.', check: { type: 'trans', slide: 1, kind: 'fade' } },
      { text: 'Trang 2: hiệu ứng <b>Đẩy</b>, Tuỳ chọn hiệu ứng <b>Từ phải sang</b>.', check: { type: 'trans', slide: 2, kind: 'push', dir: 'l' } },
      { text: 'Trang 3 và trang 4 cũng có hiệu ứng chuyển trang (em tự chọn).', check: { type: 'trans', minSlides: 4 } },
      { text: 'Hiệu ứng của trang 4 có <b>Thời gian 2 giây</b>.', check: { type: 'trans', slide: 4, durMin: 2 } },
    ],
  },
  {
    id: 'l4-vd-the-thao', lop: 4, bai: 'Bài 7 – 9. Vận dụng', title: 'Môn thể thao em yêu thích', vanDung: true,
    file: 'The thao',
    intro: 'Em làm bài trình chiếu giới thiệu môn thể thao em yêu thích: trang 1 tên môn; trang 2 ảnh minh hoạ; trang 3 cách chơi; trang 4 lợi ích.',
    steps: [
      { text: 'Có ít nhất <b>4 trang</b>.', check: { type: 'slides', min: 4 } },
      { text: 'Trang 1 có tiêu đề là tên môn thể thao.', check: { type: 'text', slide: 1, ph: 'title' } },
      { text: 'Có ảnh minh hoạ.', check: { type: 'image', slide: 'any' } },
      { text: 'Có các ý được <b>gạch đầu dòng</b>.', check: { type: 'list', slide: 'any', minItems: 2 } },
      { text: 'Chữ được định dạng (phông, cỡ, màu…).', check: { type: 'anyFormat' } },
      { text: 'Ít nhất 3 trang có hiệu ứng chuyển trang.', check: { type: 'trans', minSlides: 3 } },
    ],
  },

  // ================= LỚP 7 =================
  {
    id: 'l7-b11-tao-bai', lop: 7, bai: 'Bài 11. Tạo bài trình chiếu', title: 'Bài trình chiếu “Trường học xanh”',
    file: 'Truonghocxanh',
    intro: 'Tạo bài trình chiếu có cấu trúc: trang tiêu đề và các trang nội dung. Dùng phím <b>Tab</b> để tạo ý cấp 2, <b>Shift+Tab</b> để trở về cấp 1.',
    steps: [
      { text: 'Trang 1: tiêu đề <b>Trường học xanh</b>.', check: { type: 'text', slide: 1, ph: 'title', contains: 'trường học xanh' } },
      { text: 'Trang 1: phụ đề là tên nhóm hoặc lớp em.', check: { type: 'text', slide: 1, ph: 'subtitle', minWords: 2 } },
      { text: 'Trang 2 (bố cục Tiêu đề và nội dung): tiêu đề <b>Thế nào là trường học xanh?</b>', check: { type: 'text', slide: 2, ph: 'title', contains: 'thế nào' } },
      { text: 'Trang 2: ít nhất <b>3 ý</b> có gạch đầu dòng.', check: { type: 'list', slide: 2, ph: 'body', minItems: 3 } },
      { text: 'Trang 3: tiêu đề <b>Những việc em có thể làm</b>; nội dung có <b>ý cấp 2</b> (lùi vào bằng phím Tab).', check: { type: 'list', slide: 3, ph: 'body', minItems: 3, level2: true } },
      { text: 'Trang 3: đổi <b>kí hiệu đầu dòng</b> (mũi tên ▾ cạnh nút gạch đầu dòng).', check: { type: 'list', slide: 3, ph: 'body', styled: true } },
    ],
  },
  {
    id: 'l7-b12-dinh-dang', lop: 7, bai: 'Bài 12. Định dạng đối tượng trên trang chiếu', title: 'Ảnh minh hoạ và định dạng chữ',
    file: 'Truonghocxanh',
    intro: 'Ở trang 2, ảnh đang che mất chữ. Em sắp xếp lại lớp của ảnh, thêm viền ảnh và định dạng chữ cho bài.',
    start: deck([
      sl('title', { title: 'Trường học xanh', sub: 'Lớp 7A – Nhóm 1' }),
      sl('titleContent', { title: 'Lợi ích của cây xanh', body: truongXanhBody, objs: [img('cay', 700, 230, 440, 330)] }),
      sl('titleContent', { title: 'Những việc em có thể làm', body: viecLam }),
    ]),
    steps: [
      { text: 'Trang 2: đưa ảnh <b>xuống dưới chữ</b> (chọn ảnh → Định dạng → Đưa xuống một lớp / Xuống dưới cùng).', check: { type: 'image', slide: 2, behind: 'body' } },
      { text: 'Trang 2: thêm <b>viền</b> cho ảnh (Định dạng → Viền ảnh).', check: { type: 'image', slide: 2, border: true } },
      { text: 'Trang 3: chèn thêm <b>một ảnh</b> minh hoạ.', check: { type: 'image', slide: 3 } },
      { text: 'Tiêu đề trang 1: màu <b>xanh lá</b>, cỡ chữ từ <b>54</b> trở lên.', check: { type: 'fmt', slide: 1, ph: 'title', color: 'xanh lá', sizeMin: 54 } },
      { text: 'Tiêu đề của <b>tất cả các trang</b> in đậm.', check: { type: 'fmt', slide: 'any', ph: 'title', b: true } },
    ],
  },
  {
    id: 'l7-b13-hoan-thien', lop: 7, bai: 'Bài 13. Thực hành tổng hợp: Hoàn thiện bài trình chiếu', title: 'Hiệu ứng cho bài “Trường học xanh”',
    file: 'Truonghocxanh',
    intro: 'Thêm hiệu ứng chuyển trang và hiệu ứng cho đối tượng. Nhớ: dùng <b>cùng một</b> hiệu ứng chuyển trang cho các trang, hiệu ứng đối tượng vừa phải.',
    start: deck([
      sl('title', { title: 'Trường học xanh', sub: 'Lớp 7A – Nhóm 1' }),
      sl('twoContent', { title: 'Lợi ích của cây xanh', body: truongXanhBody, objs: [img('cay', 700, 220, 440, 330)] }),
      sl('titleContent', { title: 'Những việc em có thể làm', body: viecLam }),
    ]),
    steps: [
      { text: '<b>Tất cả các trang</b> dùng cùng một hiệu ứng chuyển trang (Chuyển trang → chọn hiệu ứng → Áp dụng cho tất cả trang).', check: { type: 'trans', slide: 'all', same: true } },
      { text: 'Ảnh ở trang 2 có hiệu ứng xuất hiện (chọn ảnh → tab Hiệu ứng).', check: { type: 'anim', slide: 2, target: 'image' } },
      { text: 'Khung nội dung trang 3 có hiệu ứng <b>Bay vào</b>.', check: { type: 'anim', slide: 3, target: 'body', kind: 'fly' } },
      { text: 'Tiêu đề trang 1 có hiệu ứng <b>Phóng to</b>, Bắt đầu: <b>Sau hiệu ứng trước</b>.', check: { type: 'anim', slide: 1, target: 'title', kind: 'zoom', start: 'after' } },
      { text: 'Thêm <b>trang cuối</b> có chữ “Cảm ơn”.', check: { type: 'text', slide: 'last', contains: 'cảm ơn' } },
    ],
  },
  {
    id: 'l7-vd-danh-lam', lop: 7, bai: 'Bài 11 – 13. Vận dụng', title: 'Giới thiệu một danh lam, di tích ở địa phương', vanDung: true,
    file: 'Danh lam que em',
    intro: 'Em tự làm bài trình chiếu giới thiệu một danh lam thắng cảnh hoặc di tích lịch sử ở địa phương em.',
    steps: [
      { text: 'Có ít nhất <b>5 trang</b>.', check: { type: 'slides', min: 5 } },
      { text: 'Trang 1 là trang tiêu đề.', check: { type: 'layout', slide: 1, layout: 'title' } },
      { text: 'Có nội dung phân cấp (ý cấp 2).', check: { type: 'list', slide: 'any', minItems: 2, level2: true } },
      { text: 'Có ít nhất <b>2 ảnh</b> minh hoạ.', check: { type: 'image', slide: 'any', min: 2 } },
      { text: 'Có hiệu ứng cho đối tượng.', check: { type: 'anim', slide: 'any' } },
      { text: 'Các trang dùng cùng một hiệu ứng chuyển trang.', check: { type: 'trans', slide: 'all', same: true } },
    ],
  },

  // ================= LỚP 8 =================
  {
    id: 'l8-b10a-dinh-dang', lop: 8, bai: 'Bài 10a. Định dạng nâng cao cho trang chiếu', title: 'Số trang, chân trang, màu nền',
    file: 'Scratch',
    intro: 'Hoàn thiện bài “Làm quen với Scratch” cho buổi sinh hoạt CLB: thêm số trang, chân trang, ngày giờ và chọn màu sắc hài hoà.',
    start: deck(scratch()),
    steps: [
      { text: 'Hiện <b>số trang</b> ở mọi trang, <b>trừ trang tiêu đề</b> (Chèn → Đầu trang &amp; chân trang).', check: { type: 'hf', num: true, notOnTitle: true } },
      { text: 'Chân trang có nội dung <b>CLB Tin học</b>.', check: { type: 'hf', footer: 'CLB Tin học' } },
      { text: 'Hiện <b>ngày giờ tự động cập nhật</b>.', check: { type: 'hf', date: true, dateAuto: true } },
      { text: 'Tất cả các trang cùng một <b>màu nền</b> (Thiết kế → Màu nền → Áp dụng cho tất cả trang).', check: { type: 'bg', all: true } },
      { text: 'Tiêu đề trang 1: phông không chân (<b>Arial</b>, <b>Tahoma</b> hoặc <b>Verdana</b>), cỡ từ 54 trở lên.', check: { type: 'fmt', slide: 1, ph: 'title', fonts: ['Arial', 'Tahoma', 'Verdana'], sizeMin: 54 } },
    ],
  },
  {
    id: 'l8-b11a-ban-mau', lop: 8, bai: 'Bài 11a. Sử dụng bản mẫu tạo bài trình chiếu', title: 'Bản mẫu và siêu liên kết',
    file: 'AnToanPhongThucHanh',
    intro: 'Áp dụng bản mẫu cho bài “An toàn trong phòng thực hành”, thêm trang và tạo nút liên kết trên trang tiêu đề.',
    start: deck(anToan()),
    steps: [
      { text: 'Áp dụng một <b>bản mẫu</b> (tab Thiết kế).', check: { type: 'theme' } },
      { text: 'Thêm trang 4 bố cục <b>Hai nội dung</b>.', check: { type: 'layout', slide: 4, layout: 'twoContent' } },
      { text: 'Trang 4 có tiêu đề <b>Biển báo an toàn</b>.', check: { type: 'text', slide: 4, ph: 'title', contains: 'biển báo' } },
      { text: 'Trang 1: vẽ một <b>hình bầu dục (Oval)</b> có chữ <b>Xem biển báo</b> (nháy đúp vào hình để gõ chữ).', check: { type: 'shape', slide: 1, shape: 'ellipse', text: 'xem biển báo' } },
      { text: 'Gắn <b>liên kết</b> cho hình bầu dục tới trang 4 (chọn hình → Chèn → Liên kết).', check: { type: 'shape', slide: 1, shape: 'ellipse', link: true } },
    ],
  },
  {
    id: 'l8-vd-clb', lop: 8, bai: 'Bài 10a – 11a. Vận dụng', title: 'Lễ ra mắt CLB Tin học', vanDung: true,
    file: 'LeRaMatCLBTinhoc',
    intro: 'Em làm bài trình chiếu cho lễ ra mắt câu lạc bộ Tin học của trường: giới thiệu CLB, hoạt động, thành viên, cách đăng kí.',
    steps: [
      { text: 'Có ít nhất <b>4 trang</b>.', check: { type: 'slides', min: 4 } },
      { text: 'Dùng một bản mẫu.', check: { type: 'theme' } },
      { text: 'Có số trang.', check: { type: 'hf', num: true } },
      { text: 'Có chân trang.', check: { type: 'hf', footer: true } },
      { text: 'Có siêu liên kết.', check: { type: 'link', slide: 'any' } },
      { text: 'Có hiệu ứng chuyển trang cho tất cả các trang.', check: { type: 'trans', slide: 'all' } },
    ],
  },
]
