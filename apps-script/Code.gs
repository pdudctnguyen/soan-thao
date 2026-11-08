/**
 * NHẬN BÀI NỘP — dán toàn bộ file này vào Tiện ích mở rộng → Apps Script của một Google Sheet.
 * Hướng dẫn cài đặt: xem HUONG-DAN-GIAO-VIEN.md
 *
 * Mỗi lần học sinh bấm "Nộp bài":
 *   - thêm một dòng vào trang tính "Kết quả"
 *   - lưu tệp .docx vào thư mục Drive "Bài nộp Soạn thảo/<Lớp>/"
 * Trang tính "Bảng điểm" tự tổng hợp điểm cao nhất của mỗi học sinh theo từng bài.
 */

// Mã bảo vệ (tuỳ chọn). Nếu đặt, đường link cho học sinh phải có cùng mã (&khoa=...).
const KHOA = ''

const TEN_THU_MUC = 'Bài nộp Soạn thảo'
const TIEU_DE = ['Thời gian', 'Lớp', 'Họ và tên', 'Mã bài', 'Tên bài', 'Đạt', 'Tổng', 'Điểm (%)', 'Chi tiết', 'Tệp bài làm']

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const d = JSON.parse(e.postData.contents)
    if (KHOA && d.khoa !== KHOA) return traLoi({ ok: false, loi: 'Sai mã bảo vệ.' })
    if (!d.hoTen || !d.lop) return traLoi({ ok: false, loi: 'Thiếu họ tên hoặc lớp.' })

    // chống ghi trùng khi trình duyệt gửi lại
    const cache = CacheService.getScriptCache()
    if (d.maNop && cache.get(d.maNop)) return traLoi({ ok: true, trung: true })

    let link = ''
    if (d.tep) {
      const thuMuc = layThuMuc(sachTen(d.lop))
      const ten = `${sachTen(d.lop)} - ${sachTen(d.hoTen)} - ${sachTen(d.tenTep || d.maBai)} - ${Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd-MM HH.mm')}.docx`
      const blob = Utilities.newBlob(Utilities.base64Decode(d.tep), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ten)
      link = thuMuc.createFile(blob).getUrl()
    }

    const sheet = layTrang('Kết quả')
    const diem = d.tong ? Math.round((d.dat / d.tong) * 100) : ''
    sheet.appendRow([new Date(), d.lop.trim(), chuanTen(d.hoTen), d.maBai, d.tenBai, d.dat ?? '', d.tong ?? '', diem, d.chiTiet || '', link])
    if (d.maNop) cache.put(d.maNop, '1', 21600)
    return traLoi({ ok: true })
  } catch (err) {
    return traLoi({ ok: false, loi: String(err) })
  } finally {
    lock.releaseLock()
  }
}

function doGet() {
  return traLoi({ ok: true, thongBao: 'Địa chỉ nộp bài đang hoạt động.' })
}

// Chạy hàm này MỘT LẦN trong trình soạn Apps Script để tạo trang tính và cấp quyền.
function caiDat() {
  layTrang('Kết quả')
  let bd = SpreadsheetApp.getActive().getSheetByName('Bảng điểm')
  if (!bd) bd = SpreadsheetApp.getActive().insertSheet('Bảng điểm')
  bd.clear()
  // setFormula luôn dùng dấu phẩy kiểu tiếng Anh, bất kể ngôn ngữ của trang tính
  bd.getRange('A1').setFormula(
    "=IFERROR(QUERY('Kết quả'!A:H, \"select B, C, max(H) where B is not null and H is not null group by B, C pivot E label B 'Lớp', C 'Họ và tên'\", 1), \"Chưa có bài nộp\")",
  )
  bd.getRange('1:1').setWrap(true).setFontWeight('bold')
  bd.setFrozenRows(1)
  bd.setFrozenColumns(2)
  layThuMuc('_kiem-tra-quyen').setTrashed(true)
}

function layTrang(ten) {
  const ss = SpreadsheetApp.getActive()
  let sh = ss.getSheetByName(ten)
  if (!sh) {
    sh = ss.insertSheet(ten, 0)
    sh.appendRow(TIEU_DE)
    sh.getRange(1, 1, 1, TIEU_DE.length).setFontWeight('bold').setBackground('#dce6f4')
    sh.setFrozenRows(1)
    sh.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm')
    sh.setColumnWidth(3, 180)
    sh.setColumnWidth(5, 320)
    sh.setColumnWidth(9, 320)
  }
  return sh
}

function layThuMuc(con) {
  const goc = timHoacTao(DriveApp.getRootFolder(), TEN_THU_MUC)
  return timHoacTao(goc, con)
}
function timHoacTao(cha, ten) {
  const it = cha.getFoldersByName(ten)
  return it.hasNext() ? it.next() : cha.createFolder(ten)
}

function sachTen(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 60) || 'khong-ten'
}
function chuanTen(s) {
  return String(s).trim().replace(/\s+/g, ' ')
}
function traLoi(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
