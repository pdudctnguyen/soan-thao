// Giao diện "Em là ai?", nút đổi người, đồng hồ kiểm tra — dùng chung cho hai phần mềm.
import { currentUser, setUser, endSession, purgeOld, fmtClock } from './session.js'

const $ = (s, r = document) => r.querySelector(s)

function ensureDom() {
  if ($('#welcomeDialog')) return
  document.body.insertAdjacentHTML(
    'beforeend',
    `<dialog id="welcomeDialog" class="welcome">
      <form method="dialog">
        <h3 id="welcomeTitle">Chào em! 👋</h3>
        <p class="dlg-note" id="welcomeNote">Nhập họ tên và lớp để bắt đầu. Bài em làm sẽ được lưu riêng cho em.</p>
        <fieldset class="col-fields">
          <label>Họ và tên <input name="hoTen" maxlength="60" autocomplete="off" placeholder="Nguyễn Văn An" /></label>
          <label>Lớp <input name="lop" maxlength="12" autocomplete="off" placeholder="6A1" /></label>
        </fieldset>
        <p class="welcome-err" id="welcomeErr"></p>
        <div class="dlg-actions">
          <button value="guest" formnovalidate id="welcomeGuest" class="link-btn">Chỉ thử, không nộp bài</button>
          <button value="cancel-soft" formnovalidate id="welcomeCancel">Huỷ</button>
          <button value="ok" class="btn-primary">Bắt đầu</button>
        </div>
      </form>
    </dialog>
    <div class="lock-overlay hidden" id="lockOverlay"><div class="lock-card"><div class="lock-icon">✅</div><div id="lockText">Em đã nộp bài.</div></div></div>`,
  )
  const chip = document.createElement('button')
  chip.id = 'userChip'
  chip.className = 'user-chip'
  chip.title = 'Đổi người dùng / kết thúc buổi học'
  $('.topbar .level').before(chip)
}

export function renderUserChip() {
  const u = currentUser()
  const chip = $('#userChip')
  if (!chip) return
  chip.textContent = !u ? '👤 Chưa đăng nhập' : u.guest ? '👤 Khách · Đổi người' : `👤 ${u.hoTen} · ${u.lop}`
}

// Hỏi tên. allowGuest=false: bắt buộc nhập (chế độ kiểm tra, hoặc khi nộp bài)
export function askName({ allowGuest = true, cancellable = false, title, note } = {}) {
  ensureDom()
  const d = $('#welcomeDialog')
  const f = $('form', d)
  const u = currentUser()
  f.hoTen.value = u && !u.guest ? u.hoTen : ''
  f.lop.value = u && !u.guest ? u.lop : ''
  $('#welcomeTitle').textContent = title || 'Chào em! 👋'
  $('#welcomeNote').textContent = note || 'Nhập họ tên và lớp để bắt đầu. Bài em làm sẽ được lưu riêng cho em.'
  $('#welcomeGuest').classList.toggle('hidden', !allowGuest)
  $('#welcomeCancel').classList.toggle('hidden', !cancellable)
  $('#welcomeErr').textContent = ''
  return new Promise((resolve) => {
    const onClose = () => {
      if (d.returnValue === 'guest' && allowGuest) {
        setUser({ guest: true })
        return done({ guest: true })
      }
      const v = { hoTen: f.hoTen.value.trim().replace(/\s+/g, ' '), lop: f.lop.value.trim().toUpperCase().replace(/\s+/g, '') }
      if (d.returnValue === 'ok' && v.hoTen.length >= 2 && v.lop) {
        setUser(v)
        return done(v)
      }
      if ((d.returnValue === 'cancel-soft' || d.returnValue === '') && cancellable) return done(null)
      // chưa hợp lệ: mở lại
      $('#welcomeErr').textContent = d.returnValue === 'ok' ? 'Em nhập đủ họ tên và lớp nhé.' : allowGuest ? 'Hãy nhập tên hoặc chọn “Chỉ thử”.' : 'Em cần nhập họ tên và lớp để làm bài.'
      d.showModal()
    }
    const done = (val) => {
      d.removeEventListener('close', onClose)
      renderUserChip()
      resolve(val)
    }
    d.addEventListener('close', onClose)
    // Esc không thoát được hộp này
    d.oncancel = (e) => { if (!cancellable) e.preventDefault() }
    d.showModal()
    setTimeout(() => f.hoTen.focus(), 50)
  })
}

// Khởi động: dọn bài cũ, hỏi tên nếu phiên chưa có người
export async function initSession({ onChange, exam, onEndRequest }) {
  ensureDom()
  purgeOld()
  renderUserChip()
  $('#userChip').addEventListener('click', async () => {
    if (exam) return // đang kiểm tra: không cho đổi người
    if (onEndRequest && !(await onEndRequest())) return
    endSession()
    renderUserChip()
    await askName({})
    onChange()
  })
  if (!currentUser() || (exam && currentUser().guest)) {
    await askName(exam ? { allowGuest: false, title: 'Bài kiểm tra', note: 'Nhập đúng họ tên và lớp của em. Thời gian bắt đầu tính khi em bấm “Bắt đầu”.' } : {})
  }
  return currentUser()
}

export function lockScreen(text) {
  ensureDom()
  $('#lockText').textContent = text
  $('#lockOverlay').classList.remove('hidden')
}

// Đồng hồ đếm ngược. Trả về hàm dừng.
export function startCountdown(el, endAt, onTimeout) {
  let fired = false
  const tick = () => {
    const left = endAt - Date.now()
    el.textContent = fmtClock(left)
    el.classList.toggle('warn', left < 5 * 60 * 1000)
    if (left <= 0 && !fired) {
      fired = true
      onTimeout()
    }
  }
  tick()
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
}
