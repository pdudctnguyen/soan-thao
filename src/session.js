// Người đang dùng máy + chế độ kiểm tra — dùng chung cho Soạn thảo và Bảng tính.
//
// Phòng máy: nhiều học sinh dùng chung một máy, nên
//  - tên học sinh chỉ nhớ trong phiên (sessionStorage): đóng trình duyệt là quên;
//  - bài làm lưu riêng theo từng học sinh (tiền tố khoá theo lớp + tên);
//  - "Khách" (không nộp bài) bị xoá bài mỗi khi bắt đầu phiên khách mới;
//  - bài của học sinh không dùng quá 14 ngày tự xoá để không đầy bộ nhớ.

const SESSION_KEY = 'stt:session'
const EXAM_KEY = 'stt:exam'
const USERS_KEY = 'stt:users'
const KEEP_DAYS = 14

const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)) } catch { return null } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)) } catch { /* bị chặn */ } },
  del(k) { try { sessionStorage.removeItem(k) } catch { /* bị chặn */ } },
}
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* đầy */ } },
  keys() { try { return Object.keys(localStorage) } catch { return [] } },
  del(k) { try { localStorage.removeItem(k) } catch { /* bỏ qua */ } },
}

// u: { hoTen, lop } hoặc { guest: true }
export const currentUser = () => ss.get(SESSION_KEY)
export const namedUser = () => {
  const u = currentUser()
  return u && !u.guest ? u : null
}

function slug(u) {
  if (!u || u.guest) return 'g'
  return `u-${(u.lop + '-' + u.hoTen).toLowerCase().normalize('NFC').replace(/\s+/g, '_').replace(/[:]/g, '')}`
}
// tiền tố chèn vào khoá lưu bài: 'stt:free' → 'stt:u-6a1-nguyễn_an:free'
export function userKey(k) {
  return k.replace(/^(stt|bt|tc):/, `$1:${slug(currentUser())}:`)
}

export function setUser(u) {
  ss.set(SESSION_KEY, u)
  if (u.guest) wipe('g')
  else touch(slug(u))
}
export function endSession() {
  ss.del(SESSION_KEY)
}

function wipe(sl) {
  for (const k of ls.keys()) if (/^(stt|bt|tc):/.test(k) && k.split(':')[1] === sl) ls.del(k)
}
function touch(sl) {
  const users = ls.get(USERS_KEY) || {}
  users[sl] = Date.now()
  ls.set(USERS_KEY, users)
}
// xoá bài của học sinh lâu không dùng
export function purgeOld() {
  const users = ls.get(USERS_KEY) || {}
  const limit = Date.now() - KEEP_DAYS * 864e5
  let changed = false
  for (const [sl, t] of Object.entries(users)) {
    if (t < limit) {
      wipe(sl)
      delete users[sl]
      changed = true
    }
  }
  if (changed) ls.set(USERS_KEY, users)
}

// ---------------- Chế độ kiểm tra ----------------
// Link kiểm tra: ...?nop=...&khoa=...&kt=<mã bài>&phut=<số phút>
export function examFromUrl() {
  const q = new URLSearchParams(location.search)
  if (q.get('kt')) ss.set(EXAM_KEY, { lessonId: q.get('kt'), minutes: Math.max(1, Math.min(180, +q.get('phut') || 45)) })
  return ss.get(EXAM_KEY)
}
export function examLink(base, lessonId, minutes) {
  const u = new URL(base)
  u.searchParams.set('kt', lessonId)
  u.searchParams.set('phut', String(minutes))
  return u.toString()
}
// trạng thái bài kiểm tra của học sinh hiện tại (giữ qua tải lại trang)
const examStateKey = (app, lessonId) => `stt:${slug(currentUser())}:exam:${app}:${lessonId}`
export function examState(app, lessonId) {
  const k = examStateKey(app, lessonId)
  let st = ls.get(k)
  if (!st) {
    st = { start: Date.now(), submittedAt: null }
    ls.set(k, st)
  }
  return st
}
export function markExamSubmitted(app, lessonId) {
  const k = examStateKey(app, lessonId)
  const st = ls.get(k) || { start: Date.now() }
  st.submittedAt = Date.now()
  ls.set(k, st)
  return st
}
export const fmtClock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
