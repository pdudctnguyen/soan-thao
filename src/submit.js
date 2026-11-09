// Nộp bài: gửi kết quả + tệp .docx tới Google Apps Script của giáo viên.
// Địa chỉ nộp bài lấy từ đường link giáo viên chia sẻ (?nop=...&khoa=...), nhớ lại trong trình duyệt.

const KEY_CFG = 'stt:submitCfg'

function read(k) { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* bị chặn */ } }

export function loadSubmitConfig() {
  const q = new URLSearchParams(location.search)
  if (q.get('nop')) {
    const cfg = { url: q.get('nop'), khoa: q.get('khoa') || '' }
    write(KEY_CFG, cfg)
    return cfg
  }
  return read(KEY_CFG)
}
export function saveSubmitConfig(cfg) { write(KEY_CFG, cfg) }

export function studentLink(cfg) {
  const u = new URL(location.href)
  u.search = ''
  u.hash = ''
  u.searchParams.set('nop', cfg.url)
  if (cfg.khoa) u.searchParams.set('khoa', cfg.khoa)
  return u.toString()
}

// Tên học sinh: chỉ nhớ trong phiên (xem session.js) để máy dùng chung không nộp nhầm tên
export { namedUser as getStudent } from './session.js'

// bỏ thẻ HTML trong đề (<b>…) trước khi ghi vào trang tính
const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// payload: { lesson, results, docxBlob, fileName }
export async function submit(cfg, student, { lesson, results, docxBlob, fileName, ext = 'docx' }) {
  const dat = results ? results.filter((r) => r.ok).length : null
  const body = {
    maNop: crypto.randomUUID?.() || String(Date.now()) + Math.random(), // chống ghi trùng khi gửi lại
    khoa: cfg.khoa || '',
    hoTen: student.hoTen,
    lop: student.lop,
    maBai: lesson?.id || 'tu-do',
    tenBai: lesson ? `Lớp ${lesson.lop} · ${lesson.bai} · ${lesson.title}` : 'Bài tự do',
    dat,
    tong: results ? results.length : null,
    chiTiet: results ? lesson.steps.map((s, i) => `${results[i].ok ? '✓' : '✗'} ${plain(s.text)}`).join('\n') : '',
    tenTep: fileName,
    duoiTep: ext,
    tep: docxBlob ? await blobToBase64(docxBlob) : '',
  }
  // text/plain để trình duyệt không gửi yêu cầu kiểm tra CORS trước (Apps Script không trả lời được)
  const opts = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }
  try {
    const res = await fetch(cfg.url, opts)
    const data = await res.json()
    if (!data.ok) throw new Error(data.loi || 'Máy chủ từ chối')
    return { ok: true, confirmed: true }
  } catch (err) {
    if (err instanceof TypeError) {
      // không đọc được phản hồi (mạng chặn CORS): gửi lại kiểu "gửi rồi thôi"
      try {
        await fetch(cfg.url, { ...opts, mode: 'no-cors' })
        return { ok: true, confirmed: false }
      } catch {
        return { ok: false, error: 'Không kết nối được mạng.' }
      }
    }
    if (err instanceof SyntaxError) return { ok: false, error: 'Địa chỉ nộp bài chưa đúng, hoặc Apps Script chưa cho phép “Bất kỳ ai” truy cập.' }
    return { ok: false, error: err.message }
  }
}
