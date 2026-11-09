import '../../src/style.css'
import './sheet.css'
import { ROWS, COLS, colName, colIndex, key, addr, parseAddr, parseRange, norm, rangeStr, inRange, quoteSheet, shiftFormula, adjustFormula, renameSheetInFormula, normalizeFormula } from './addr.js'
import { createEngine, isFormula, literal, isError, errorText } from './engine.js'
import { displayValue, cellCss } from './format.js'
import { renderCharts, chartDefaults } from './charts.js'
import { LESSONS } from './lessons.js'
import { checkExercise } from './checker.js'
import { FUNCTIONS } from './functions.js'
import { loadSubmitConfig, saveSubmitConfig, studentLink, getStudent, submit } from '../../src/submit.js'
import { userKey, examFromUrl, examLink, examState, markExamSubmitted } from '../../src/session.js'
import { initSession, askName, renderUserChip, lockScreen, startCountdown } from '../../src/session-ui.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const FONTS = ['Calibri', 'Arial', 'Times New Roman', 'Tahoma', 'Verdana', 'Cambria']
const SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36]
const COLORS = [
  ['#000000', 'Đen'], ['#7f7f7f', 'Xám'], ['#ffffff', 'Trắng'], ['#c00000', 'Đỏ đậm'], ['#ff0000', 'Đỏ'], ['#ffc000', 'Cam'],
  ['#ffff00', 'Vàng'], ['#92d050', 'Xanh lá nhạt'], ['#00b050', 'Xanh lá'], ['#00b0f0', 'Xanh da trời'], ['#0070c0', 'Xanh dương'],
  ['#002060', 'Xanh đậm'], ['#7030a0', 'Tím'], ['#ff66cc', 'Hồng'],
]
const FILLS = [
  ['#ffff00', 'Vàng'], ['#fff2cc', 'Vàng nhạt'], ['#c6efce', 'Xanh lá nhạt'], ['#92d050', 'Xanh lá'], ['#ddebf7', 'Xanh nhạt'],
  ['#9bc2e6', 'Xanh da trời'], ['#fce4d6', 'Cam nhạt'], ['#ffc000', 'Cam'], ['#ffc7ce', 'Hồng nhạt'], ['#ff0000', 'Đỏ'],
  ['#d9d9d9', 'Xám nhạt'], ['#a6a6a6', 'Xám'], ['#e4dfec', 'Tím nhạt'], ['#0070c0', 'Xanh dương'],
]
const DEFAULT_W = 80
const storage = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* bộ nhớ đầy hoặc bị chặn */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* bỏ qua */ } },
}

// ================= Mô hình dữ liệu =================
const newSheet = (name) => ({ name, cells: {}, colW: {}, merges: [], filter: null, charts: [], dv: [] })
const newBook = () => ({ sheets: [newSheet('Trang tính 1')], active: 0, page: { orientation: 'portrait', size: 'A4', grid: false, fit: true } })
let wb = newBook()
let currentLesson = null
const sheet = () => wb.sheets[wb.active]
const engine = createEngine(() => wb)
window.wb = () => wb
window.engine = engine

const getCell = (sh, r, c) => sh.cells[key(r, c)]
function setCell(sh, r, c, patch) {
  const k = key(r, c)
  const cur = sh.cells[k] || {}
  const next = { ...cur, ...patch }
  if ((next.v === undefined || next.v === '') && (!next.s || !Object.keys(next.s).length)) delete sh.cells[k]
  else sh.cells[k] = next
}
function setStyle(sh, r, c, patch) {
  const cur = getCell(sh, r, c)?.s || {}
  const s = { ...cur, ...patch }
  for (const k of Object.keys(s)) if (s[k] === undefined || s[k] === null || s[k] === false) delete s[k]
  setCell(sh, r, c, { s })
}
const valueAt = (r, c, sh = sheet()) => engine.value(sh.name, r, c)

// ================= Hoàn tác =================
let undoStack = []
let redoStack = []
function snapshot() {
  undoStack.push(JSON.stringify(wb))
  if (undoStack.length > 100) undoStack.shift()
  redoStack = []
}
function undo() {
  if (!undoStack.length) return
  redoStack.push(JSON.stringify(wb))
  wb = JSON.parse(undoStack.pop())
  afterLoad()
}
function redo() {
  if (!redoStack.length) return
  undoStack.push(JSON.stringify(wb))
  wb = JSON.parse(redoStack.pop())
  afterLoad()
}

// ================= Vùng chọn =================
let sel = { r: 0, c: 0, r2: 0, c2: 0 } // (r,c) là ô hiện hành
const selRange = () => expandMerges(norm({ r1: sel.r, c1: sel.c, r2: sel.r2, c2: sel.c2 }))
function mergeAt(r, c, sh = sheet()) {
  return sh.merges.find((m) => inRange(m, r, c))
}
function expandMerges(rg) {
  let changed = true
  while (changed) {
    changed = false
    for (const m of sheet().merges) {
      const hit = !(m.r2 < rg.r1 || m.r1 > rg.r2 || m.c2 < rg.c1 || m.c1 > rg.c2)
      if (hit && (m.r1 < rg.r1 || m.c1 < rg.c1 || m.r2 > rg.r2 || m.c2 > rg.c2)) {
        rg = { r1: Math.min(rg.r1, m.r1), c1: Math.min(rg.c1, m.c1), r2: Math.max(rg.r2, m.r2), c2: Math.max(rg.c2, m.c2) }
        changed = true
      }
    }
  }
  return rg
}
function select(r, c, extend = false) {
  tabStartCol = null
  r = Math.max(0, Math.min(ROWS - 1, r))
  c = Math.max(0, Math.min(COLS - 1, c))
  if (extend) {
    sel.r2 = r
    sel.c2 = c
  } else {
    const m = mergeAt(r, c)
    sel = m ? { r: m.r1, c: m.c1, r2: m.r2, c2: m.c2 } : { r, c, r2: r, c2: c }
  }
  updateSelection()
  scrollIntoView(extend ? sel.r2 : sel.r, extend ? sel.c2 : sel.c)
}
function move(dr, dc, extend) {
  if (extend) return select(sel.r2 + dr, sel.c2 + dc, true)
  let r = sel.r
  let c = sel.c
  const m = mergeAt(r, c)
  if (m) {
    if (dr > 0) r = m.r2
    if (dc > 0) c = m.c2
  }
  r += dr
  c += dc
  // bỏ qua hàng đang bị ẩn do lọc
  while (dr && hiddenRows.has(r) && r > 0 && r < ROWS - 1) r += dr
  select(r, c)
}

// ================= Vẽ lưới =================
const gridEl = $('#grid')
const wrap = $('#gridWrap')
let tds = []
let ths = []
let rowHeads = []
let hiddenRows = new Set()
let showFormulas = false

function buildGrid() {
  const colgroup = `<colgroup><col class="rh-col">${Array.from({ length: COLS }, () => '<col>').join('')}</colgroup>`
  const head = `<thead><tr><th class="corner" id="corner"></th>${Array.from({ length: COLS }, (_, c) => `<th class="ch" data-c="${c}">${colName(c)}<span class="col-resize" data-c="${c}"></span></th>`).join('')}</tr></thead>`
  let body = '<tbody>'
  for (let r = 0; r < ROWS; r++) {
    body += `<tr><th class="rh" data-r="${r}">${r + 1}</th>`
    for (let c = 0; c < COLS; c++) body += `<td data-r="${r}" data-c="${c}"></td>`
    body += '</tr>'
  }
  gridEl.innerHTML = colgroup + head + body + '</tbody>'
  tds = []
  const trs = $$('tbody tr', gridEl)
  trs.forEach((tr, r) => {
    tds[r] = [...tr.querySelectorAll('td')]
  })
  ths = $$('thead th.ch', gridEl)
  rowHeads = $$('tbody th.rh', gridEl)
}

function computeHidden(sh) {
  hiddenRows = new Set()
  const f = sh.filter
  if (!f) return
  for (let r = f.r1 + 1; r <= f.r2; r++) {
    for (const [c, crit] of Object.entries(f.crit || {})) {
      if (!passFilter(sh, r, +c, crit, f)) {
        hiddenRows.add(r)
        break
      }
    }
  }
}
function passFilter(sh, r, c, crit, f) {
  const v = engine.value(sh.name, r, c)
  const shown = displayValue(v, getCell(sh, r, c)?.s?.nf)
  if (crit.values && !crit.values.includes(shown)) return false
  if (crit.op && crit.op !== 'none') {
    const x = typeof v === 'number' ? v : parseFloat(v)
    const t = parseFloat(crit.val)
    if (crit.op === 'top' || crit.op === 'bottom') {
      const nums = []
      for (let rr = f.r1 + 1; rr <= f.r2; rr++) {
        const vv = engine.value(sh.name, rr, c)
        if (typeof vv === 'number') nums.push(vv)
      }
      nums.sort((a, b) => (crit.op === 'top' ? b - a : a - b))
      const cut = nums[Math.min(nums.length, t) - 1]
      return typeof v === 'number' && (crit.op === 'top' ? v >= cut : v <= cut)
    }
    if (isNaN(x)) return crit.op === 'neq' ? String(v) !== crit.val : crit.op === 'eq' ? String(v) === crit.val : false
    return { gt: x > t, lt: x < t, gte: x >= t, lte: x <= t, eq: x === t, neq: x !== t }[crit.op]
  }
  return true
}

function render() {
  const sh = sheet()
  engine.reset()
  computeHidden(sh)
  // độ rộng cột
  const cols = $$('col', gridEl)
  let total = 46
  for (let c = 0; c < COLS; c++) {
    const w = sh.colW[c] || DEFAULT_W
    cols[c + 1].style.width = `${w}px`
    total += w
  }
  gridEl.style.width = `${total}px` // table-layout: fixed cần độ rộng cụ thể
  // ô bị che bởi ô gộp
  const covered = new Map()
  for (const m of sh.merges) {
    for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) covered.set(key(r, c), r === m.r1 && c === m.c1 ? m : 'hidden')
  }
  for (let r = 0; r < ROWS; r++) {
    tds[r][0].parentElement.style.display = hiddenRows.has(r) ? 'none' : ''
    for (let c = 0; c < COLS; c++) {
      const td = tds[r][c]
      const cell = sh.cells[key(r, c)]
      const cov = covered.get(key(r, c))
      if (cov === 'hidden') {
        if (td.style.display !== 'none') td.style.display = 'none'
        continue
      }
      td.style.display = ''
      td.rowSpan = cov ? cov.r2 - cov.r1 + 1 : 1
      td.colSpan = cov ? cov.c2 - cov.c1 + 1 : 1
      if (!cell) {
        if (td.dataset.k) {
          td.textContent = ''
          td.style.cssText = ''
          td.className = ''
          delete td.dataset.k
        }
        continue
      }
      const v = cell.v === undefined || cell.v === '' ? null : valueAt(r, c)
      let text = showFormulas && isFormula(cell.v) ? cell.v : displayValue(v, cell.s?.nf)
      const css = cellCss(cell.s, showFormulas && isFormula(cell.v) ? '' : v)
      const sig = text + '|' + css
      if (td.dataset.k === sig) continue
      td.dataset.k = sig
      td.textContent = text
      td.style.cssText = css
      td.className = isError(v) ? 'err' : ''
    }
  }
  // chữ dài tràn sang ô trống bên phải (giống Excel)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const td = tds[r][c]
      if (!td.textContent || td.colSpan > 1) continue
      const s = sh.cells[key(r, c)]?.s || {}
      const left = (s.align || 'left') === 'left' && !s.wrap && typeof valueAt(r, c) !== 'number'
      const nextEmpty = c + 1 < COLS && !sh.cells[key(r, c + 1)]?.v && !covered.has(key(r, c + 1))
      td.classList.toggle('spill', left && nextEmpty)
    }
  }
  renderFilterButtons(sh)
  renderSheetTabs()
  renderChartsNow()
  updateSelection()
}

function renderFilterButtons(sh) {
  $$('.flt-btn', gridEl).forEach((b) => b.remove())
  $('#filterBtn').classList.toggle('on', !!sh.filter)
  $('#filterBtn2').classList.toggle('on', !!sh.filter)
  if (!sh.filter) return
  const f = sh.filter
  for (let c = f.c1; c <= f.c2; c++) {
    const b = document.createElement('button')
    b.className = 'flt-btn' + (f.crit?.[c] ? ' active' : '')
    b.dataset.c = c
    b.textContent = f.crit?.[c] ? '⏷' : '▾'
    b.title = 'Lọc / sắp xếp cột này'
    tds[f.r1][c].appendChild(b)
  }
}

// ---- toạ độ ô trong vùng cuộn ----
function cellBox(r, c) {
  const m = mergeAt(r, c)
  const td = tds[m ? m.r1 : r][m ? m.c1 : c]
  return { x: td.offsetLeft, y: td.offsetTop, w: td.offsetWidth, h: td.offsetHeight }
}
function rangeBox(rg) {
  // lấy ô nhìn thấy ở góc trên trái và dưới phải (bỏ qua hàng ẩn)
  let r1 = rg.r1
  while (hiddenRows.has(r1) && r1 < rg.r2) r1++
  let r2 = rg.r2
  while (hiddenRows.has(r2) && r2 > r1) r2--
  const a = cellBox(r1, rg.c1)
  const b = cellBox(r2, rg.c2)
  return { x: a.x, y: a.y, w: b.x + b.w - a.x, h: b.y + b.h - a.y }
}
function placeBox(el, b) {
  el.style.left = `${b.x - 1}px`
  el.style.top = `${b.y - 1}px`
  el.style.width = `${b.w + 1}px`
  el.style.height = `${b.h + 1}px`
}

function updateSelection() {
  const rg = selRange()
  placeBox($('#selBox'), rangeBox(rg))
  $('#selBox').classList.toggle('multi', rg.r1 !== rg.r2 || rg.c1 !== rg.c2)
  // ô hiện hành bên trong vùng chọn
  const sh = sheet()
  $$('td.sel-in').forEach((t) => t.classList.remove('sel-in'))
  if (rg.r2 - rg.r1 + 1 <= ROWS && (rg.r1 !== rg.r2 || rg.c1 !== rg.c2)) {
    for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) if (!(r === sel.r && c === sel.c)) tds[r][c].classList.add('sel-in')
  }
  ths.forEach((th, c) => th.classList.toggle('hl', c >= rg.c1 && c <= rg.c2))
  rowHeads.forEach((th, r) => th.classList.toggle('hl', r >= rg.r1 && r <= rg.r2))
  if (!editing) {
    $('#nameBox').value = rg.r1 === rg.r2 && rg.c1 === rg.c2 ? addr(sel.r, sel.c) : rangeStr(rg)
    const cell = getCell(sh, sel.r, sel.c)
    $('#formulaInput').value = cell?.v ?? ''
    positionInput()
  }
  placeCopyBox()
  updateDvArrow()
  syncToolbar()
  updateStats()
}

function scrollIntoView(r, c) {
  const b = cellBox(r, c)
  const pad = 30
  if (b.y < wrap.scrollTop + pad) wrap.scrollTop = Math.max(0, b.y - pad)
  else if (b.y + b.h > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = b.y + b.h - wrap.clientHeight + 4
  if (b.x < wrap.scrollLeft + 46) wrap.scrollLeft = Math.max(0, b.x - 46)
  else if (b.x + b.w > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = b.x + b.w - wrap.clientWidth + 4
}

function updateStats() {
  const rg = selRange()
  if (rg.r1 === rg.r2 && rg.c1 === rg.c2) return ($('#statInfo').textContent = '')
  let sum = 0
  let n = 0
  let cnt = 0
  for (let r = rg.r1; r <= Math.min(rg.r2, ROWS - 1); r++) {
    if (hiddenRows.has(r)) continue
    for (let c = rg.c1; c <= rg.c2; c++) {
      const v = valueAt(r, c)
      if (v !== null && v !== '') cnt++
      if (typeof v === 'number') { sum += v; n++ }
    }
  }
  $('#statInfo').textContent = n ? `Trung bình: ${displayValue(sum / n)}   Đếm: ${cnt}   Tổng: ${displayValue(sum)}` : cnt ? `Đếm: ${cnt}` : ''
}

// ================= Sửa ô =================
const input = $('#cellInput')
const fbar = $('#formulaInput')
let editing = null // { r, c, sheet, mode: 'enter'|'edit', from: 'cell'|'bar' }
let point = null // vùng tham chiếu vừa chèn bằng chuột: { start, end }

function positionInput() {
  if (editing && editing.sheet !== wb.active) {
    input.classList.add('away')
    return
  }
  input.classList.remove('away')
  const r = editing ? editing.r : sel.r
  const c = editing ? editing.c : sel.c
  const b = cellBox(r, c)
  input.style.left = `${b.x}px`
  input.style.top = `${b.y}px`
  input.style.minWidth = `${b.w}px`
  input.style.width = `${b.w}px`
  input.style.height = `${b.h}px`
  if (editing) autoSizeInput()
}
function autoSizeInput() {
  const min = parseFloat(input.style.minWidth) || 60
  input.style.width = `${min}px`
  if (input.scrollWidth > input.clientWidth) input.style.width = `${Math.min(600, input.scrollWidth + 12)}px`
}
function startEdit(mode, text, from = 'cell') {
  const sh = sheet()
  const cell = getCell(sh, sel.r, sel.c)
  editing = { r: sel.r, c: sel.c, sheet: wb.active, mode, from }
  point = null
  clearCopy()
  input.value = text !== undefined ? text : cell?.v ?? ''
  fbar.value = input.value
  const s = cell?.s || {}
  input.style.font = `${s.b ? 700 : 400} ${s.i ? 'italic' : ''} ${s.size || 11}pt '${s.font || 'Calibri'}', Arial, sans-serif`.replace('  ', ' ')
  input.style.textAlign = s.align === 'center' || s.align === 'right' ? s.align : 'left'
  input.classList.add('editing')
  positionInput()
  if (from === 'cell') {
    input.focus()
    const n = input.value.length
    input.setSelectionRange(n, n)
  }
  drawRefBoxes()
}
function cancelEdit() {
  if (!editing) return
  const back = editing.sheet
  editing = null
  point = null
  input.value = ''
  input.classList.remove('editing')
  if (wb.active !== back) {
    wb.active = back
    render()
  }
  drawRefBoxes()
  updateSelection()
  input.focus()
}
// trả về true nếu ghi được
function commitEdit() {
  if (!editing) return true
  let raw = (editing.from === 'bar' ? fbar.value : input.value)
  const target = wb.sheets[editing.sheet]
  const { r, c } = editing
  if (raw.trim() === '=') {
    showAlert('Công thức có lỗi', 'Công thức chưa có nội dung sau dấu =.', false)
    return false
  }
  if (isFormula(raw)) {
    // tự đóng ngoặc như Excel
    const open = (raw.match(/\(/g) || []).length - (raw.match(/\)/g) || []).length
    if (open > 0) raw += ')'.repeat(open)
    raw = normalizeFormula(raw.replace(/^=\s*/, '='))
    engine.reset()
    const test = engine.evaluate(raw.slice(1), target.name, r, c)
    if (isError(test) && errorText(test) === '#ERROR!') {
      showAlert('Công thức có lỗi', 'Công thức chưa đúng cú pháp. Kiểm tra lại dấu ngoặc, dấu phẩy và tên hàm.', false)
      return false
    }
  } else {
    const bad = validateEntry(target, r, c, raw)
    if (bad) {
      showAlert(bad.title || 'Nhập sai', bad.message || 'Giá trị không hợp lệ cho ô này.', false)
      return false
    }
  }
  snapshot()
  const prev = getCell(target, r, c)
  setCell(target, r, c, { v: raw === '' ? undefined : raw })
  // gõ 15% thì tự đổi sang kiểu phần trăm
  if (/^\s*[-+]?[\d.]+%\s*$/.test(raw) && !prev?.s?.nf) setStyle(target, r, c, { nf: { kind: 'percent', dec: 0 } })
  extendFilter(target)
  const back = editing.sheet
  editing = null
  point = null
  input.value = ''
  input.classList.remove('editing')
  if (wb.active !== back) wb.active = back
  drawRefBoxes()
  scheduleSave()
  render()
  return true
}
// Giống Excel: gõ – Tab – Tab – Enter thì xuống hàng dưới, về lại cột bắt đầu
let tabStartCol = null
function tabKey(shift, isEditing) {
  if (tabStartCol === null) tabStartCol = sel.c
  if (isEditing) {
    if (!commitEdit()) return
    input.focus()
  }
  const keep = tabStartCol
  move(0, shift ? -1 : 1)
  tabStartCol = keep
}
function enterKey(shift, isEditing) {
  const col = tabStartCol
  if (isEditing) {
    if (!commitEdit()) return
    input.focus()
  }
  if (col !== null && !shift) select(sel.r + 1, col)
  else move(shift ? -1 : 1, 0)
  tabStartCol = null
}
function commitAndMove(dr, dc) {
  if (commitEdit()) {
    move(dr, dc)
    input.focus()
  }
}

// gõ chữ khi đang chọn ô → bắt đầu sửa (hỗ trợ Unikey vì chữ đi thẳng vào ô nhập ẩn)
input.addEventListener('input', () => {
  if (!editing) {
    const typed = input.value
    startEdit('enter', '')
    input.value = typed
  }
  point = null
  fbar.value = input.value
  autoSizeInput()
  drawRefBoxes()
})
input.addEventListener('compositionstart', () => {
  if (!editing) startEdit('enter', '')
})
fbar.addEventListener('focus', () => {
  if (!editing) startEdit('edit', undefined, 'bar')
  else editing.from = 'bar'
})
fbar.addEventListener('input', () => {
  if (!editing) startEdit('edit', undefined, 'bar')
  point = null
  input.value = fbar.value
  autoSizeInput()
  drawRefBoxes()
})
fbar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitAndMove(1, 0) }
  else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
  else if (e.key === 'Tab') { e.preventDefault(); commitAndMove(0, 1) }
})

input.addEventListener('keydown', (e) => {
  const k = e.key
  const ctrl = e.ctrlKey || e.metaKey
  if (editing) {
    if (k === 'Enter' && e.altKey) {
      // Alt+Enter: xuống dòng trong ô
      e.preventDefault()
      const p = input.selectionStart
      input.setRangeText('\n', p, input.selectionEnd, 'end')
      input.dispatchEvent(new Event('input'))
      return
    }
    if (k === 'Enter') { e.preventDefault(); return enterKey(e.shiftKey, true) }
    if (k === 'Tab') { e.preventDefault(); return tabKey(e.shiftKey, true) }
    if (k === 'Escape') { e.preventDefault(); return cancelEdit() }
    if (k === 'F2') { e.preventDefault(); editing.mode = editing.mode === 'enter' ? 'edit' : 'enter'; return }
    if (k === 'F4' && isFormula(input.value)) { e.preventDefault(); return toggleAbsolute() }
    if (editing.mode === 'enter' && k.startsWith('Arrow')) {
      // đang trỏ ô trong công thức: mũi tên chọn ô tham chiếu
      if (canPoint()) {
        e.preventDefault()
        return pointByArrow(k, e.shiftKey)
      }
      e.preventDefault()
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]
      return commitAndMove(...d)
    }
    return
  }
  // ---- không ở chế độ sửa: phím điều hướng ----
  const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
  if (arrows[k]) {
    e.preventDefault()
    if (ctrl) return jumpEdge(...arrows[k], e.shiftKey)
    return move(...arrows[k], e.shiftKey)
  }
  if (k === 'Enter') { e.preventDefault(); return enterKey(e.shiftKey, false) }
  if (k === 'Tab') { e.preventDefault(); return tabKey(e.shiftKey, false) }
  if (k === 'F2') { e.preventDefault(); return startEdit('edit') }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return clearContents() }
  if (k === 'Escape') { clearCopy(); return }
  if (k === 'Home') { e.preventDefault(); return select(ctrl ? 0 : sel.r, 0) }
  if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); return move(k === 'PageDown' ? 20 : -20, 0, e.shiftKey) }
  if (ctrl) {
    const lk = k.toLowerCase()
    const map = {
      z: undo, y: redo, b: () => toggleStyle('b'), i: () => toggleStyle('i'), u: () => toggleStyle('u'),
      a: () => { sel = { r: 0, c: 0, r2: ROWS - 1, c2: COLS - 1 }; updateSelection() },
      s: saveXlsx, o: () => $('#openInput').click(), p: printSheet, f: () => toast('Dùng tab Dữ liệu → Lọc để tìm theo giá trị.'),
      '`': () => ACTIONS.showFormulas(),
    }
    if (map[lk]) { e.preventDefault(); map[lk]() }
  }
})

// Ctrl + mũi tên: nhảy tới mép vùng dữ liệu
function jumpEdge(dr, dc, extend) {
  const sh = sheet()
  let r = extend ? sel.r2 : sel.r
  let c = extend ? sel.c2 : sel.c
  const filled = (rr, cc) => rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS && !!getCell(sh, rr, cc)?.v
  const startFilled = filled(r, c)
  const nextFilled = filled(r + dr, c + dc)
  if (startFilled && nextFilled) {
    while (filled(r + dr, c + dc)) { r += dr; c += dc }
  } else {
    r += dr
    c += dc
    while (r > 0 && c > 0 && r < ROWS - 1 && c < COLS - 1 && !filled(r, c)) { r += dr; c += dc }
  }
  select(r, c, extend)
}

// ---- trỏ chuột / mũi tên để chèn địa chỉ ô vào công thức ----
const edEl = () => (editing?.from === 'bar' ? fbar : input)
function canPoint() {
  if (!editing || !input.value.startsWith('=')) return false
  if (point) return true
  const el = edEl()
  const before = el.value.slice(0, el.selectionStart)
  return /[=+\-*/^(,;:<>&]\s*$/.test(before)
}
function insertRef(rg, sheetIdx) {
  const prefix = sheetIdx !== editing.sheet ? `${quoteSheet(wb.sheets[sheetIdx].name)}!` : ''
  const text = prefix + rangeStr(rg)
  const el = edEl()
  const v = el.value
  const start = point ? point.start : el.selectionStart
  const end = point ? point.end : el.selectionEnd
  el.value = v.slice(0, start) + text + v.slice(end)
  point = { start, end: start + text.length, anchor: point?.anchor || { r: rg.r1, c: rg.c1 }, rg }
  if (el === fbar) input.value = fbar.value
  else fbar.value = input.value
  el.setSelectionRange(point.end, point.end)
  autoSizeInput()
  drawRefBoxes()
}
function pointByArrow(k, extend) {
  const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]
  let cur = point?.rg || { r1: editing.r, c1: editing.c, r2: editing.r, c2: editing.c }
  if (extend && point) {
    const a = point.anchor
    const far = { r: cur.r1 === a.r ? cur.r2 : cur.r1, c: cur.c1 === a.c ? cur.c2 : cur.c1 }
    cur = norm({ r1: a.r, c1: a.c, r2: far.r + d[0], c2: far.c + d[1] })
    insertRef(cur, wb.active)
    return
  }
  const base = point ? { r: cur.r1, c: cur.c1 } : { r: editing.r, c: editing.c }
  const r = Math.max(0, Math.min(ROWS - 1, base.r + d[0]))
  const c = Math.max(0, Math.min(COLS - 1, base.c + d[1]))
  const keepAnchor = point
  point = keepAnchor ? { ...point, anchor: { r, c } } : null
  insertRef({ r1: r, c1: c, r2: r, c2: c }, wb.active)
  point.anchor = { r, c }
}
// F4: đổi A1 → $A$1 → A$1 → $A1 → A1 cho tham chiếu tại con trỏ
function toggleAbsolute() {
  const v = input.value
  const pos = input.selectionStart
  const re = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g
  let m
  while ((m = re.exec(v))) {
    const s = m.index
    const e = s + m[0].length
    if (pos >= s && pos <= e) {
      const state = (m[1] ? 2 : 0) + (m[3] ? 1 : 0) // 0: A1, 3: $A$1, 1: A$1, 2: $A1
      const next = { 0: [1, 1], 3: [0, 1], 1: [1, 0], 2: [0, 0] }[state]
      const rep = `${next[0] ? '$' : ''}${m[2]}${next[1] ? '$' : ''}${m[4]}`
      input.value = v.slice(0, s) + rep + v.slice(e)
      input.setSelectionRange(s + rep.length, s + rep.length)
      fbar.value = input.value
      drawRefBoxes()
      return
    }
  }
}
// tô màu các vùng được tham chiếu trong công thức đang sửa
const REF_COLORS = ['#1f6fd1', '#d1341f', '#7a3fc2', '#13895a', '#c2731f', '#c21f8f']
function drawRefBoxes() {
  const holder = $('#refBoxes')
  holder.innerHTML = ''
  if (!editing || !isFormula(input.value)) return
  const re = /((?:'(?:[^']|'')+'|[A-Za-z_À-ỹ][\w.À-ỹ]*)!)?(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![\w(])/g
  const parts = input.value.split(/("(?:[^"]|"")*")/)
  let i = 0
  for (const part of parts) {
    if (part.startsWith('"')) continue
    let m
    while ((m = re.exec(part))) {
      const sheetName = m[1] ? m[1].slice(0, -1).replace(/^'(.*)'$/, '$1') : wb.sheets[editing.sheet].name
      const color = REF_COLORS[i++ % REF_COLORS.length]
      if (sheetName.toLowerCase() !== sheet().name.toLowerCase()) continue
      const rg = parseRange(m[2])
      if (!rg || rg.r2 >= ROWS || rg.c2 >= COLS) continue
      const d = document.createElement('div')
      d.className = 'ref-box'
      d.style.borderColor = color
      d.style.background = color + '14'
      placeBox(d, rangeBox(rg))
      holder.appendChild(d)
    }
  }
}

// ================= Chuột trên lưới =================
let dragSel = false
let dragPoint = false
wrap.addEventListener('mousedown', (e) => {
  if (e.button === 2) return
  const td = e.target.closest('td')
  const th = e.target.closest('th')
  if (e.target.closest('.flt-btn')) return openFilterPop(+e.target.closest('.flt-btn').dataset.c, e.target.closest('.flt-btn'))
  if (e.target.closest('.chart-box') || e.target.closest('#fillHandle') || e.target.closest('.col-resize') || e.target === input || e.target.closest('#dvArrow')) return
  if (td) {
    const r = +td.dataset.r
    const c = +td.dataset.c
    if (editing && canPoint()) {
      e.preventDefault()
      insertRef({ r1: r, c1: c, r2: r, c2: c }, wb.active)
      point.anchor = { r, c }
      dragPoint = true
      return
    }
    if (editing && !commitEdit()) { e.preventDefault(); return }
    e.preventDefault()
    select(r, c, e.shiftKey)
    dragSel = true
    selectChart(null)
    input.focus()
    return
  }
  if (th) {
    if (editing && !commitEdit()) return
    e.preventDefault()
    selectChart(null)
    if (th.id === 'corner') sel = { r: 0, c: 0, r2: ROWS - 1, c2: COLS - 1 }
    else if (th.dataset.c !== undefined) {
      const c = +th.dataset.c
      sel = e.shiftKey ? { ...sel, r: 0, r2: ROWS - 1, c2: c } : { r: 0, c, r2: ROWS - 1, c2: c }
      dragSel = 'col'
    } else if (th.dataset.r !== undefined) {
      const r = +th.dataset.r
      sel = e.shiftKey ? { ...sel, c: 0, c2: COLS - 1, r2: r } : { r, c: 0, r2: r, c2: COLS - 1 }
      dragSel = 'row'
    }
    updateSelection()
    input.focus()
  }
})
wrap.addEventListener('mousemove', (e) => {
  if (!dragSel && !dragPoint) return
  const target = e.target.closest('td, th')
  if (!target) return
  if (dragPoint && target.dataset.r !== undefined && target.dataset.c !== undefined) {
    const a = point.anchor
    insertRef(norm({ r1: a.r, c1: a.c, r2: +target.dataset.r, c2: +target.dataset.c }), wb.active)
    return
  }
  if (dragSel === 'col' && target.dataset.c !== undefined) { sel.c2 = +target.dataset.c; updateSelection(); return }
  if (dragSel === 'row' && target.dataset.r !== undefined) { sel.r2 = +target.dataset.r; updateSelection(); return }
  if (dragSel === true && target.tagName === 'TD') {
    const r = +target.dataset.r
    const c = +target.dataset.c
    if (r !== sel.r2 || c !== sel.c2) { sel.r2 = r; sel.c2 = c; updateSelection() }
  }
})
window.addEventListener('mouseup', () => {
  dragSel = false
  if (dragPoint) {
    dragPoint = false
    input.focus()
  }
})
wrap.addEventListener('dblclick', (e) => {
  const td = e.target.closest('td')
  if (td && !e.target.closest('.flt-btn')) startEdit('edit')
})
wrap.addEventListener('scroll', () => { closePops() })

// ---- kéo đổi độ rộng cột; nháy đúp để vừa chữ ----
let resizing = null
wrap.addEventListener('mousedown', (e) => {
  const h = e.target.closest('.col-resize')
  if (!h) return
  e.preventDefault()
  e.stopPropagation()
  const c = +h.dataset.c
  resizing = { c, x: e.clientX, w: sheet().colW[c] || DEFAULT_W, snap: false }
}, true)
window.addEventListener('mousemove', (e) => {
  if (!resizing) return
  if (!resizing.snap) { snapshot(); resizing.snap = true }
  const z = zoom()
  sheet().colW[resizing.c] = Math.max(20, Math.round(resizing.w + (e.clientX - resizing.x) / z))
  render()
})
window.addEventListener('mouseup', () => {
  if (resizing?.snap) scheduleSave()
  resizing = null
})
wrap.addEventListener('dblclick', (e) => {
  const h = e.target.closest('.col-resize')
  if (!h) return
  e.stopPropagation()
  autofit(+h.dataset.c)
}, true)
function autofit(c) {
  const sh = sheet()
  const ctx = document.createElement('canvas').getContext('2d')
  let w = 30
  for (let r = 0; r < ROWS; r++) {
    const cell = getCell(sh, r, c)
    if (!cell?.v || mergeAt(r, c)) continue
    const s = cell.s || {}
    ctx.font = `${s.b ? 700 : 400} ${s.i ? 'italic ' : ''}${(s.size || 11) * 1.333}px '${s.font || 'Calibri'}', Arial`
    w = Math.max(w, ctx.measureText(tds[r][c].textContent).width + 14)
  }
  snapshot()
  sh.colW[c] = Math.min(500, Math.ceil(w))
  scheduleSave()
  render()
}

// ================= Kéo sao chép (fill handle) =================
let filling = null
$('#fillHandle').addEventListener('mousedown', (e) => {
  e.preventDefault()
  e.stopPropagation()
  if (editing && !commitEdit()) return
  filling = { src: selRange(), to: null }
})
window.addEventListener('mousemove', (e) => {
  if (!filling) return
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const td = el?.closest?.('td')
  if (!td) return
  const r = +td.dataset.r
  const c = +td.dataset.c
  const s = filling.src
  let to
  const dr = r > s.r2 ? r - s.r2 : r < s.r1 ? r - s.r1 : 0
  const dc = c > s.c2 ? c - s.c2 : c < s.c1 ? c - s.c1 : 0
  if (!dr && !dc) to = null
  else if (Math.abs(dr) >= Math.abs(dc)) to = dr > 0 ? { ...s, r2: r } : { ...s, r1: r }
  else to = dc > 0 ? { ...s, c2: c } : { ...s, c1: c }
  filling.to = to
  const box = $('#fillBox')
  box.classList.toggle('hidden', !to)
  if (to) placeBox(box, rangeBox(to))
})
window.addEventListener('mouseup', () => {
  if (!filling) return
  const { src, to } = filling
  filling = null
  $('#fillBox').classList.add('hidden')
  if (to) fillRange(src, to)
})
function fillRange(src, to) {
  const sh = sheet()
  snapshot()
  const vertical = to.r1 !== src.r1 || to.r2 !== src.r2
  const lines = vertical ? [src.c1, src.c2] : [src.r1, src.r2]
  for (let line = lines[0]; line <= lines[1]; line++) {
    // dãy ô nguồn theo chiều kéo
    const seq = []
    const n = vertical ? src.r2 - src.r1 + 1 : src.c2 - src.c1 + 1
    for (let i = 0; i < n; i++) {
      const r = vertical ? src.r1 + i : line
      const c = vertical ? line : src.c1 + i
      seq.push({ r, c, cell: getCell(sh, r, c) })
    }
    const nums = seq.map((x) => (isFormula(x.cell?.v) ? NaN : typeof literal(x.cell?.v) === 'number' ? literal(x.cell.v) : NaN))
    const series = n >= 2 && nums.every((x) => !isNaN(x))
    const step = series ? (nums[n - 1] - nums[0]) / (n - 1) : 0
    const forward = vertical ? to.r2 > src.r2 : to.c2 > src.c2
    const count = vertical ? to.r2 - to.r1 + 1 - n : to.c2 - to.c1 + 1 - n
    for (let k = 1; k <= count; k++) {
      const off = forward ? n - 1 + k : -k
      const r = vertical ? src.r1 + off : line
      const c = vertical ? line : src.c1 + off
      const srcIdx = forward ? (k - 1) % n : (n - (k % n)) % n
      const from = seq[srcIdx]
      let v = from.cell?.v
      if (series) v = String(+(forward ? nums[n - 1] + step * k : nums[0] - step * k).toFixed(10))
      else if (isFormula(v)) v = shiftFormula(v, r - from.r, c - from.c)
      else if (typeof v === 'string' && n === 1 && /\d+$/.test(v) && isNaN(literal(v))) {
        // "Tuần 1" → "Tuần 2", "Tuần 3"…
        v = v.replace(/(\d+)$/, (d) => String(+d + (forward ? k : -k)))
      }
      setCell(sh, r, c, { v, s: from.cell?.s ? { ...from.cell.s } : undefined })
    }
  }
  sel = { r: to.r1, c: to.c1, r2: to.r2, c2: to.c2 }
  extendFilter(sh)
  scheduleSave()
  render()
  input.focus()
}

// ================= Sao chép / cắt / dán =================
let clip = null // { sheet, rg, cells, cut, text }
function rangeText(rg) {
  const rows = []
  for (let r = rg.r1; r <= rg.r2; r++) {
    if (hiddenRows.has(r)) continue
    const row = []
    for (let c = rg.c1; c <= rg.c2; c++) row.push(tds[r][c].textContent.replace(/[▾⏷]$/, ''))
    rows.push(row.join('\t'))
  }
  return rows.join('\n')
}
function doCopy(cut) {
  const rg = selRange()
  if (rg.r2 - rg.r1 > 300) return null
  const sh = sheet()
  const cells = []
  for (let r = rg.r1; r <= rg.r2; r++) {
    const row = []
    for (let c = rg.c1; c <= rg.c2; c++) row.push(structuredClone(getCell(sh, r, c) || null))
    cells.push(row)
  }
  clip = { sheet: wb.active, rg, cells, cut, text: rangeText(rg) }
  placeCopyBox()
  return clip.text
}
function placeCopyBox() {
  let box = $('#copyBox')
  if (!clip || clip.sheet !== wb.active) return box?.remove()
  if (!box) {
    box = document.createElement('div')
    box.id = 'copyBox'
    box.className = 'copy-box'
    wrap.appendChild(box)
  }
  placeBox(box, rangeBox(clip.rg))
}
function clearCopy() {
  clip = null
  $('#copyBox')?.remove()
}
function pasteInternal() {
  const sh = sheet()
  const src = clip
  const h = src.cells.length
  const w = src.cells[0].length
  const rg = selRange()
  // dán lặp lại nếu vùng chọn là bội số của vùng sao chép
  const tilesR = !src.cut && (rg.r2 - rg.r1 + 1) % h === 0 ? (rg.r2 - rg.r1 + 1) / h : 1
  const tilesC = !src.cut && (rg.c2 - rg.c1 + 1) % w === 0 ? (rg.c2 - rg.c1 + 1) / w : 1
  snapshot()
  if (src.cut) {
    const from = wb.sheets[src.sheet]
    for (let r = src.rg.r1; r <= src.rg.r2; r++) for (let c = src.rg.c1; c <= src.rg.c2; c++) delete from.cells[key(r, c)]
  }
  for (let tr = 0; tr < tilesR; tr++) {
    for (let tc = 0; tc < tilesC; tc++) {
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          const r = rg.r1 + tr * h + i
          const c = rg.c1 + tc * w + j
          if (r >= ROWS || c >= COLS) continue
          const cell = src.cells[i][j]
          if (!cell) { delete sh.cells[key(r, c)]; continue }
          let v = cell.v
          if (isFormula(v) && !src.cut) v = shiftFormula(v, r - (src.rg.r1 + i), c - (src.rg.c1 + j))
          sh.cells[key(r, c)] = { ...structuredClone(cell), v }
        }
      }
    }
  }
  sel = { r: rg.r1, c: rg.c1, r2: rg.r1 + h * tilesR - 1, c2: rg.c1 + w * tilesC - 1 }
  if (src.cut) clearCopy()
  extendFilter(sh)
  scheduleSave()
  render()
}
function pasteText(text) {
  const sh = sheet()
  const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'))
  snapshot()
  rows.forEach((row, i) => row.forEach((v, j) => {
    if (sel.r + i < ROWS && sel.c + j < COLS) setCell(sh, sel.r + i, sel.c + j, { v: v === '' ? undefined : v })
  }))
  sel = { r: sel.r, c: sel.c, r2: Math.min(ROWS - 1, sel.r + rows.length - 1), c2: Math.min(COLS - 1, sel.c + Math.max(...rows.map((r) => r.length)) - 1) }
  scheduleSave()
  render()
}
input.addEventListener('copy', (e) => {
  if (editing) return
  e.preventDefault()
  const t = doCopy(false)
  if (t !== null) e.clipboardData.setData('text/plain', t)
})
input.addEventListener('cut', (e) => {
  if (editing) return
  e.preventDefault()
  const t = doCopy(true)
  if (t !== null) e.clipboardData.setData('text/plain', t)
})
input.addEventListener('paste', (e) => {
  if (editing) return
  e.preventDefault()
  const text = e.clipboardData.getData('text/plain')
  if (clip && text === clip.text) pasteInternal()
  else if (text) pasteText(text)
})

// ================= Xoá, định dạng =================
function forEachSel(fn) {
  const rg = selRange()
  const r2 = Math.min(rg.r2, ROWS - 1)
  for (let r = rg.r1; r <= r2; r++) for (let c = rg.c1; c <= rg.c2; c++) fn(r, c)
}
function clearContents() {
  snapshot()
  const sh = sheet()
  forEachSel((r, c) => setCell(sh, r, c, { v: undefined }))
  scheduleSave()
  render()
}
function clearAll() {
  snapshot()
  const sh = sheet()
  forEachSel((r, c) => delete sh.cells[key(r, c)])
  scheduleSave()
  render()
}
function styleSel(patch) {
  if (editing && !commitEdit()) return
  snapshot()
  const sh = sheet()
  forEachSel((r, c) => setStyle(sh, r, c, typeof patch === 'function' ? patch(getCell(sh, r, c)?.s || {}, r, c) : patch))
  scheduleSave()
  render()
  input.focus()
}
function toggleStyle(k) {
  const on = !getCell(sheet(), sel.r, sel.c)?.s?.[k]
  styleSel({ [k]: on || undefined })
}
function setBorders(kind) {
  const rg = selRange()
  styleSel((s, r, c) => {
    if (kind === 'none') return { bt: undefined, br: undefined, bb: undefined, bl: undefined }
    if (kind === 'all') return { bt: true, br: true, bb: true, bl: true }
    if (kind === 'bottom') return r === rg.r2 ? { bb: true } : {}
    return { bt: r === rg.r1 || s.bt || undefined, bb: r === rg.r2 || s.bb || undefined, bl: c === rg.c1 || s.bl || undefined, br: c === rg.c2 || s.br || undefined }
  })
}
function mergeCells(center, unmerge) {
  const sh = sheet()
  const rg = selRange()
  if (unmerge) {
    snapshot()
    sh.merges = sh.merges.filter((m) => !(m.r1 >= rg.r1 && m.r2 <= rg.r2 && m.c1 >= rg.c1 && m.c2 <= rg.c2))
    scheduleSave()
    return render()
  }
  if (rg.r1 === rg.r2 && rg.c1 === rg.c2) return
  const existing = sh.merges.find((m) => m.r1 === rg.r1 && m.c1 === rg.c1 && m.r2 === rg.r2 && m.c2 === rg.c2)
  if (existing && center) return mergeCells(false, true)
  let others = 0
  for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) if ((r !== rg.r1 || c !== rg.c1) && getCell(sh, r, c)?.v) others++
  const go = () => {
    snapshot()
    for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) if (r !== rg.r1 || c !== rg.c1) setCell(sh, r, c, { v: undefined })
    sh.merges = sh.merges.filter((m) => m.r2 < rg.r1 || m.r1 > rg.r2 || m.c2 < rg.c1 || m.c1 > rg.c2)
    sh.merges.push({ ...rg })
    if (center) setStyle(sh, rg.r1, rg.c1, { align: 'center' })
    sel = { r: rg.r1, c: rg.c1, r2: rg.r2, c2: rg.c2 }
    scheduleSave()
    render()
  }
  if (others) showAlert('Gộp ô', 'Gộp ô chỉ giữ lại giá trị ở ô trên cùng bên trái, các giá trị khác sẽ bị xoá. Tiếp tục?', true).then((ok) => ok && go())
  else go()
}
function changeDecimals(delta) {
  // giống Excel: lấy số chữ số của ô hiện hành rồi áp cho cả vùng
  const s0 = getCell(sheet(), sel.r, sel.c)?.s || {}
  const nf0 = s0.nf || {}
  const v0 = valueAt(sel.r, sel.c)
  let cur = nf0.dec
  if (cur === undefined) {
    if (nf0.kind && nf0.kind !== 'general') cur = nf0.kind === 'currency' ? 0 : 2
    else cur = typeof v0 === 'number' && !Number.isInteger(v0) ? Math.min(10, (String(+v0.toPrecision(10)).split('.')[1] || '').length) : 0
  }
  const dec = Math.max(0, Math.min(10, cur + delta))
  styleSel((s) => ({ nf: { kind: s.nf?.kind && s.nf.kind !== 'general' ? s.nf.kind : nf0.kind && nf0.kind !== 'general' ? nf0.kind : 'number', sep: s.nf?.sep, dec } }))
}

// ================= Chèn / xoá hàng, cột =================
function shiftStructure(axis, at, count) {
  const shIdx = wb.active
  const sh = sheet()
  snapshot()
  // dịch các ô của trang hiện tại
  const cells = {}
  for (const [k, cell] of Object.entries(sh.cells)) {
    let [r, c] = k.split(',').map(Number)
    const v = axis === 'row' ? r : c
    if (count < 0 && v >= at && v < at - count) continue
    const nv = v >= at ? v + count : v
    if (nv >= (axis === 'row' ? ROWS : COLS)) continue
    if (axis === 'row') r = nv
    else c = nv
    cells[key(r, c)] = cell
  }
  sh.cells = cells
  // sửa công thức ở mọi trang tham chiếu tới trang này
  for (const other of wb.sheets) {
    for (const cell of Object.values(other.cells)) {
      if (isFormula(cell.v)) cell.v = adjustFormula(cell.v, other.name, sh.name, axis, at, count)
    }
  }
  const fixRange = (rg) => {
    const a1 = axis === 'row' ? 'r1' : 'c1'
    const a2 = axis === 'row' ? 'r2' : 'c2'
    const out = { ...rg }
    if (count > 0) {
      if (rg[a1] >= at) out[a1] += count
      if (rg[a2] >= at) out[a2] += count
    } else {
      const del = -count
      const map = (v) => (v >= at + del ? v - del : v >= at ? at : v)
      out[a1] = map(rg[a1])
      out[a2] = rg[a2] >= at + del ? rg[a2] - del : rg[a2] >= at ? at - 1 : rg[a2]
      if (out[a2] < out[a1]) return null
    }
    return out
  }
  sh.merges = sh.merges.map(fixRange).filter((m) => m && (m.r1 !== m.r2 || m.c1 !== m.c2))
  if (sh.filter) {
    const f = fixRange(sh.filter)
    if (!f) sh.filter = null
    else {
      const crit = {}
      for (const [c, v] of Object.entries(sh.filter.crit || {})) {
        let nc = +c
        if (axis === 'col') {
          if (count < 0 && nc >= at && nc < at - count) continue
          if (nc >= at) nc += count
        }
        crit[nc] = v
      }
      sh.filter = { ...sh.filter, ...f, crit }
    }
  }
  sh.dv = sh.dv.map((d) => { const rg = fixRange(parseRange(d.range)); return rg ? { ...d, range: rangeStr(rg) } : null }).filter(Boolean)
  sh.charts.forEach((ch) => { const rg = fixRange(parseRange(ch.range)); if (rg) ch.range = rangeStr(rg) })
  if (axis === 'col') {
    const w = {}
    for (const [c, v] of Object.entries(sh.colW)) {
      const ci = +c
      if (count < 0 && ci >= at && ci < at - count) continue
      w[ci >= at ? ci + count : ci] = v
    }
    sh.colW = w
  }
  wb.active = shIdx
  scheduleSave()
  render()
}
function insertRows() { const rg = selRange(); shiftStructure('row', rg.r1, rg.r2 - rg.r1 + 1) }
function insertCols() { const rg = selRange(); shiftStructure('col', rg.c1, rg.c2 - rg.c1 + 1) }
function deleteRows() { const rg = selRange(); shiftStructure('row', rg.r1, -(rg.r2 - rg.r1 + 1)); select(rg.r1, sel.c) }
function deleteCols() { const rg = selRange(); shiftStructure('col', rg.c1, -(rg.c2 - rg.c1 + 1)); select(sel.r, rg.c1) }

// ================= Trang tính =================
function renderSheetTabs() {
  const box = $('#sheetTabs')
  // giữ nguyên nút nếu không đổi (để nháy đúp đổi tên không bị mất)
  const same = box.children.length === wb.sheets.length && wb.sheets.every((s, i) => box.children[i].tagName === 'BUTTON' && box.children[i].textContent === s.name)
  if (same) {
    ;[...box.children].forEach((b, i) => b.classList.toggle('active', i === wb.active))
    return
  }
  box.innerHTML = ''
  wb.sheets.forEach((s, i) => {
    const b = document.createElement('button')
    b.className = 'sheet-tab' + (i === wb.active ? ' active' : '')
    b.textContent = s.name
    b.dataset.i = i
    b.title = 'Nháy đúp để đổi tên, chuột phải để xem thêm'
    box.appendChild(b)
  })
}
$('#sheetTabs').addEventListener('mousedown', (e) => {
  const b = e.target.closest('.sheet-tab')
  if (!b || e.button !== 0) return
  const i = +b.dataset.i
  if (editing && isFormula(input.value)) {
    // đang gõ công thức: chuyển trang để trỏ ô ở trang khác
    e.preventDefault()
    wb.active = i
    sel = { r: 0, c: 0, r2: 0, c2: 0 }
    render()
    input.focus()
    point = null
    return
  }
  if (editing && !commitEdit()) return
  if (i !== wb.active) switchSheet(i)
})
function switchSheet(i) {
  wb.active = i
  sel = { r: 0, c: 0, r2: 0, c2: 0 }
  selectChart(null)
  for (const td of tds.flat()) td.dataset.k = '~' // buộc vẽ lại (kể cả ô trống)
  render()
  input.focus()
}
$('#sheetTabs').addEventListener('dblclick', (e) => {
  const b = e.target.closest('.sheet-tab')
  if (b) renameSheet(+b.dataset.i)
})
$('#sheetTabs').addEventListener('contextmenu', (e) => {
  const b = e.target.closest('.sheet-tab')
  if (!b) return
  e.preventDefault()
  const i = +b.dataset.i
  showMenu(e.clientX, e.clientY - 120, [
    ['Đổi tên', () => renameSheet(i)],
    ['Chèn trang tính', () => addSheet()],
    ['Xoá trang tính', () => deleteSheet(i)],
  ])
})
$('#addSheet').addEventListener('click', () => addSheet())
function addSheet() {
  snapshot()
  let n = wb.sheets.length + 1
  while (wb.sheets.some((s) => s.name === `Trang tính ${n}`)) n++
  wb.sheets.push(newSheet(`Trang tính ${n}`))
  scheduleSave()
  switchSheet(wb.sheets.length - 1)
}
function deleteSheet(i) {
  if (wb.sheets.length === 1) return toast('Bảng tính phải có ít nhất một trang tính.')
  showAlert('Xoá trang tính', `Xoá trang “${wb.sheets[i].name}” và toàn bộ dữ liệu trong đó?`, true).then((ok) => {
    if (!ok) return
    snapshot()
    wb.sheets.splice(i, 1)
    scheduleSave()
    switchSheet(Math.max(0, Math.min(i, wb.sheets.length - 1)))
  })
}
function renameSheet(i) {
  const b = $(`.sheet-tab[data-i="${i}"]`)
  const old = wb.sheets[i].name
  const ip = document.createElement('input')
  ip.className = 'sheet-rename'
  ip.value = old
  b.replaceWith(ip)
  ip.focus()
  ip.select()
  let done = false
  const finish = (ok) => {
    if (done) return
    done = true
    const name = ip.value.trim().slice(0, 31)
    if (ok && name && name !== old) {
      if (/[\\/?*[\]:]/.test(name)) { toast('Tên trang tính không được có các kí tự \\ / ? * [ ] :'); return renderSheetTabs() }
      if (wb.sheets.some((s, j) => j !== i && s.name.toLowerCase() === name.toLowerCase())) { toast('Đã có trang tính tên này.'); return renderSheetTabs() }
      snapshot()
      wb.sheets[i].name = name
      for (const s of wb.sheets) for (const cell of Object.values(s.cells)) if (isFormula(cell.v)) cell.v = renameSheetInFormula(cell.v, old, name)
      scheduleSave()
      render()
    } else renderSheetTabs()
    input.focus()
  }
  ip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true)
    if (e.key === 'Escape') finish(false)
  })
  ip.addEventListener('blur', () => finish(true))
}

// ================= Sắp xếp =================
function currentRegion(r, c) {
  const sh = sheet()
  const has = (rr, cc) => rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS && (getCell(sh, rr, cc)?.v ?? '') !== ''
  let rg = { r1: r, c1: c, r2: r, c2: c }
  let grew = true
  while (grew) {
    grew = false
    const t = { ...rg }
    for (let cc = rg.c1 - 1; cc <= rg.c2 + 1; cc++) { if (has(rg.r1 - 1, cc)) t.r1 = rg.r1 - 1; if (has(rg.r2 + 1, cc)) t.r2 = rg.r2 + 1 }
    for (let rr = rg.r1 - 1; rr <= rg.r2 + 1; rr++) { if (has(rr, rg.c1 - 1)) t.c1 = rg.c1 - 1; if (has(rr, rg.c2 + 1)) t.c2 = rg.c2 + 1 }
    if (t.r1 !== rg.r1 || t.r2 !== rg.r2 || t.c1 !== rg.c1 || t.c2 !== rg.c2) { rg = t; grew = true }
  }
  return rg
}
function guessHeader(rg) {
  const sh = sheet()
  if (rg.r1 === rg.r2) return false
  let textTop = 0
  let numBelow = 0
  for (let c = rg.c1; c <= rg.c2; c++) {
    const v = valueAt(rg.r1, c)
    if (typeof v === 'string') textTop++
    if (typeof valueAt(rg.r1 + 1, c) === 'number') numBelow++
    if (getCell(sh, rg.r1, c)?.s?.b) return true
  }
  return textTop === rg.c2 - rg.c1 + 1 && numBelow > 0
}
function sortRange(rg, levels, header) {
  const sh = sheet()
  if (sh.merges.some((m) => !(m.r2 < rg.r1 || m.r1 > rg.r2 || m.c2 < rg.c1 || m.c1 > rg.c2))) {
    return showAlert('Không sắp xếp được', 'Vùng sắp xếp có ô đã gộp. Hãy bỏ gộp ô hoặc chọn vùng không chứa ô gộp.', false)
  }
  const start = header ? rg.r1 + 1 : rg.r1
  const rows = []
  for (let r = start; r <= rg.r2; r++) {
    const vals = {}
    for (const l of levels) vals[l.c] = valueAt(r, l.c)
    const cells = []
    for (let c = rg.c1; c <= rg.c2; c++) cells.push(getCell(sh, r, c))
    rows.push({ r, vals, cells })
  }
  const cmp = (a, b) => {
    const an = typeof a === 'number'
    const bn = typeof b === 'number'
    const ae = a === null || a === ''
    const be = b === null || b === ''
    if (ae || be) return ae && be ? 0 : ae ? 1 : -1
    if (an && bn) return a - b
    if (an) return -1
    if (bn) return 1
    return String(a).localeCompare(String(b), 'vi', { sensitivity: 'base', numeric: true })
  }
  rows.sort((x, y) => {
    for (const l of levels) {
      let d = cmp(x.vals[l.c], y.vals[l.c])
      const blank = (v) => v === null || v === ''
      if (l.desc && !blank(x.vals[l.c]) && !blank(y.vals[l.c])) d = -d
      if (d) return d
    }
    return x.r - y.r
  })
  snapshot()
  rows.forEach((row, i) => {
    const r = start + i
    row.cells.forEach((cell, j) => {
      const c = rg.c1 + j
      if (!cell) return delete sh.cells[key(r, c)]
      sh.cells[key(r, c)] = { ...cell, v: isFormula(cell.v) ? shiftFormula(cell.v, r - row.r, 0) : cell.v }
    })
  })
  scheduleSave()
  render()
}
function quickSort(desc) {
  const rg0 = selRange()
  const rg = rg0.r1 === rg0.r2 && rg0.c1 === rg0.c2 ? currentRegion(sel.r, sel.c) : rg0
  if (rg.r1 === rg.r2) return toast('Hãy đặt con trỏ vào bảng dữ liệu cần sắp xếp.')
  const header = guessHeader(rg)
  sortRange(rg, [{ c: sel.c, desc }], header)
  toast(`Đã sắp xếp ${rangeStr(rg)} theo cột ${colName(sel.c)} ${desc ? 'giảm dần' : 'tăng dần'}${header ? ' (giữ nguyên hàng tiêu đề)' : ''}.`)
}
function openSortDialog() {
  const rg0 = selRange()
  const rg = rg0.r1 === rg0.r2 && rg0.c1 === rg0.c2 ? currentRegion(sel.r, sel.c) : rg0
  if (rg.r1 === rg.r2) return toast('Hãy đặt con trỏ vào bảng dữ liệu cần sắp xếp.')
  const d = $('#sortDialog')
  const f = $('form', d)
  f.header.checked = guessHeader(rg)
  $('#sortRangeNote').textContent = `Vùng sắp xếp: ${rangeStr(rg)}`
  const colOptions = () => {
    let o = ''
    for (let c = rg.c1; c <= rg.c2; c++) {
      const h = f.header.checked ? displayValue(valueAt(rg.r1, c)) : ''
      o += `<option value="${c}">Cột ${colName(c)}${h ? ` – ${escapeHtml(h)}` : ''}</option>`
    }
    return o
  }
  const levels = $('#sortLevels')
  const addLevel = (c = sel.c) => {
    const div = document.createElement('div')
    div.className = 'sort-level'
    div.innerHTML = `<span>${levels.children.length ? 'Sau đó theo' : 'Sắp xếp theo'}</span><select class="sl-col">${colOptions()}</select><select class="sl-ord"><option value="asc">Tăng dần (A→Z, nhỏ→lớn)</option><option value="desc">Giảm dần (Z→A, lớn→nhỏ)</option></select><button type="button" class="icon sl-del" title="Bỏ mức này">✕</button>`
    $('.sl-col', div).value = String(Math.max(rg.c1, Math.min(rg.c2, c)))
    $('.sl-del', div).onclick = () => { if (levels.children.length > 1) div.remove() }
    levels.appendChild(div)
  }
  levels.innerHTML = ''
  addLevel()
  $('#addSortLevel').onclick = () => addLevel(rg.c1)
  f.header.onchange = () => $$('.sl-col', levels).forEach((s) => { const v = s.value; s.innerHTML = colOptions(); s.value = v })
  d.showModal()
  d.onclose = () => {
    if (d.returnValue !== 'ok') return input.focus()
    const lv = $$('.sort-level', levels).map((x) => ({ c: +$('.sl-col', x).value, desc: $('.sl-ord', x).value === 'desc' }))
    sortRange(rg, lv, f.header.checked)
    input.focus()
  }
}

// ================= Lọc =================
function toggleFilter() {
  const sh = sheet()
  snapshot()
  if (sh.filter) {
    sh.filter = null
    toast('Đã tắt lọc.')
  } else {
    const rg0 = selRange()
    const rg = rg0.r1 === rg0.r2 ? currentRegion(sel.r, sel.c) : rg0
    if (rg.r1 === rg.r2 && rg.c1 === rg.c2 && !getCell(sh, rg.r1, rg.c1)?.v) return toast('Hãy đặt con trỏ vào bảng dữ liệu (có hàng tiêu đề) rồi bấm Lọc.')
    sh.filter = { ...rg, crit: {} }
    toast('Bấm nút ▾ ở hàng tiêu đề để chọn điều kiện lọc.')
  }
  scheduleSave()
  render()
}
function extendFilter(sh) {
  const f = sh.filter
  if (!f) return
  while (f.r2 + 1 < ROWS) {
    let any = false
    for (let c = f.c1; c <= f.c2; c++) if (getCell(sh, f.r2 + 1, c)?.v) any = true
    if (!any) break
    f.r2++
  }
}
function openFilterPop(c, btn) {
  const sh = sheet()
  const f = sh.filter
  if (editing && !commitEdit()) return
  const values = new Map()
  for (let r = f.r1 + 1; r <= f.r2; r++) {
    const v = valueAt(r, c)
    const t = displayValue(v, getCell(sh, r, c)?.s?.nf)
    if (!values.has(t)) values.set(t, v)
  }
  const list = [...values.entries()].sort((a, b) => (typeof a[1] === 'number' && typeof b[1] === 'number' ? a[1] - b[1] : String(a[0]).localeCompare(String(b[0]), 'vi')))
  const crit = f.crit?.[c] || {}
  const chosen = new Set(crit.values || list.map((x) => x[0]))
  const pop = $('#filterPop')
  pop.innerHTML = `
    <div class="fp-head">Cột ${colName(c)}: ${escapeHtml(displayValue(valueAt(f.r1, c)))}</div>
    <button type="button" class="fp-sort" data-s="asc">↑ Sắp xếp tăng dần</button>
    <button type="button" class="fp-sort" data-s="desc">↓ Sắp xếp giảm dần</button>
    <div class="fp-sec">Lọc theo số</div>
    <div class="fp-num"><select id="fpOp">
      <option value="none">(không dùng)</option><option value="gt">lớn hơn</option><option value="gte">lớn hơn hoặc bằng</option>
      <option value="lt">nhỏ hơn</option><option value="lte">nhỏ hơn hoặc bằng</option><option value="eq">bằng</option><option value="neq">khác</option>
      <option value="top">lớn nhất (Top N)</option><option value="bottom">nhỏ nhất (N)</option>
    </select><input id="fpVal" placeholder="giá trị" /></div>
    <div class="fp-sec">Chọn giá trị</div>
    <label class="fp-all"><input type="checkbox" id="fpAll"> (Chọn tất cả)</label>
    <div class="fp-list">${list.map(([t]) => `<label><input type="checkbox" value="${escapeHtml(t)}" ${chosen.has(t) ? 'checked' : ''}> ${t === '' ? '(Trống)' : escapeHtml(t)}</label>`).join('')}</div>
    <div class="fp-actions"><button type="button" id="fpClear">Bỏ lọc cột</button><button type="button" class="btn-primary" id="fpOk">Lọc</button></div>`
  $('#fpOp', pop).value = crit.op || 'none'
  $('#fpVal', pop).value = crit.val ?? ''
  const boxes = () => $$('.fp-list input', pop)
  $('#fpAll', pop).checked = boxes().every((b) => b.checked)
  $('#fpAll', pop).onchange = (e) => boxes().forEach((b) => (b.checked = e.target.checked))
  $$('.fp-sort', pop).forEach((b) => (b.onclick = () => {
    closePops()
    sortRange({ r1: f.r1, c1: f.c1, r2: f.r2, c2: f.c2 }, [{ c, desc: b.dataset.s === 'desc' }], true)
  }))
  $('#fpClear', pop).onclick = () => {
    snapshot()
    delete f.crit[c]
    closePops()
    scheduleSave()
    render()
  }
  $('#fpOk', pop).onclick = () => {
    snapshot()
    const picked = boxes().filter((b) => b.checked).map((b) => b.value)
    const op = $('#fpOp', pop).value
    const next = {}
    if (picked.length < boxes().length) next.values = picked
    if (op !== 'none') { next.op = op; next.val = $('#fpVal', pop).value.trim() }
    f.crit = f.crit || {}
    if (Object.keys(next).length) f.crit[c] = next
    else delete f.crit[c]
    closePops()
    scheduleSave()
    render()
    input.focus()
  }
  openPopAt(pop, btn.getBoundingClientRect())
}
function clearFilterCriteria() {
  const sh = sheet()
  if (!sh.filter) return
  snapshot()
  sh.filter.crit = {}
  scheduleSave()
  render()
}

// ================= Xác thực dữ liệu =================
function dvFor(sh, r, c) {
  for (let i = sh.dv.length - 1; i >= 0; i--) {
    const rg = parseRange(sh.dv[i].range)
    if (rg && inRange(rg, r, c)) return sh.dv[i]
  }
  return null
}
function dvListValues(sh, d) {
  const src = (d.list || '').trim()
  if (src.startsWith('=')) {
    const m = /^=(?:(.+)!)?(.+)$/.exec(src)
    const target = m[1] ? wb.sheets.find((s) => s.name === m[1].replace(/^'(.*)'$/, '$1')) || sh : sh
    const rg = parseRange(m[2])
    const out = []
    if (rg) for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) {
      const v = engine.value(target.name, r, c)
      if (v !== null && v !== '') out.push(displayValue(v))
    }
    return out
  }
  return src.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
}
function validateEntry(sh, r, c, raw) {
  const d = dvFor(sh, r, c)
  if (!d || d.type === 'any' || raw === '') return null
  const v = literal(raw)
  let ok = true
  const cmp = (x) => {
    const a = parseFloat(d.min)
    const b = parseFloat(d.max)
    return { between: x >= a && x <= b, notBetween: x < a || x > b, greaterThan: x > a, lessThan: x < a, greaterThanOrEqual: x >= a, lessThanOrEqual: x <= a, equal: x === a }[d.op || 'between']
  }
  if (d.type === 'list') ok = dvListValues(sh, d).some((x) => x.toLowerCase() === String(raw).trim().toLowerCase())
  else if (d.type === 'whole') ok = typeof v === 'number' && Number.isInteger(v) && cmp(v)
  else if (d.type === 'decimal') ok = typeof v === 'number' && cmp(v)
  else if (d.type === 'textLength') ok = cmp(String(raw).length)
  return ok ? null : { title: d.title, message: d.message || defaultDvMessage(d, sh) }
}
function defaultDvMessage(d, sh) {
  const opText = { between: `từ ${d.min} đến ${d.max}`, notBetween: `ngoài khoảng ${d.min}–${d.max}`, greaterThan: `lớn hơn ${d.min}`, lessThan: `nhỏ hơn ${d.min}`, greaterThanOrEqual: `từ ${d.min} trở lên`, lessThanOrEqual: `không quá ${d.min}`, equal: `bằng ${d.min}` }[d.op || 'between']
  if (d.type === 'list') return `Chỉ được chọn một trong: ${dvListValues(sh, d).join(', ')}.`
  if (d.type === 'whole') return `Chỉ được nhập số nguyên ${opText}.`
  if (d.type === 'decimal') return `Chỉ được nhập số ${opText}.`
  return `Độ dài văn bản phải ${opText}.`
}
function openDvDialog() {
  const sh = sheet()
  const rg = selRange()
  const d = $('#dvDialog')
  const f = $('form', d)
  const cur = dvFor(sh, sel.r, sel.c) || { type: 'any', op: 'between' }
  $('#dvRangeNote').textContent = `Áp dụng cho vùng: ${rangeStr(rg)}`
  for (const k of ['type', 'op', 'min', 'max', 'list', 'title', 'message']) f[k].value = cur[k] ?? (k === 'type' ? 'any' : k === 'op' ? 'between' : '')
  const sync = () => {
    const t = f.type.value
    $$('.dv-num', d).forEach((x) => x.classList.toggle('hidden', !['whole', 'decimal', 'textLength'].includes(t)))
    $('.dv-max', d).classList.toggle('hidden', !['whole', 'decimal', 'textLength'].includes(t) || !['between', 'notBetween'].includes(f.op.value))
    $('.dv-list-src', d).classList.toggle('hidden', t !== 'list')
  }
  f.type.onchange = sync
  f.op.onchange = sync
  sync()
  d.showModal()
  d.onclose = () => {
    if (d.returnValue === 'cancel' || !d.returnValue) return input.focus()
    snapshot()
    const range = rangeStr(rg)
    sh.dv = sh.dv.filter((x) => {
      const o = parseRange(x.range)
      return !(o && o.r1 >= rg.r1 && o.r2 <= rg.r2 && o.c1 >= rg.c1 && o.c2 <= rg.c2)
    })
    if (d.returnValue === 'ok' && f.type.value !== 'any') {
      sh.dv.push({ range, type: f.type.value, op: f.op.value, min: f.min.value.trim(), max: f.max.value.trim(), list: f.list.value.trim(), title: f.title.value.trim(), message: f.message.value.trim() })
    }
    scheduleSave()
    render()
    input.focus()
  }
}
function updateDvArrow() {
  const btn = $('#dvArrow')
  const d = !editing && dvFor(sheet(), sel.r, sel.c)
  if (!d || d.type !== 'list') return btn.classList.add('hidden')
  const b = cellBox(sel.r, sel.c)
  btn.classList.remove('hidden')
  btn.style.left = `${b.x + b.w + 1}px`
  btn.style.top = `${b.y}px`
  btn.style.height = `${b.h}px`
}
$('#dvArrow').addEventListener('mousedown', (e) => {
  e.preventDefault()
  const sh = sheet()
  const d = dvFor(sh, sel.r, sel.c)
  const pop = $('#dvList')
  pop.innerHTML = dvListValues(sh, d).map((v) => `<button data-v="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('')
  openPopAt(pop, $('#dvArrow').getBoundingClientRect())
})
$('#dvList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-v]')
  if (!b) return
  snapshot()
  setCell(sheet(), sel.r, sel.c, { v: b.dataset.v })
  closePops()
  scheduleSave()
  render()
  input.focus()
})

// ================= Biểu đồ =================
let selectedChart = null
function renderChartsNow() {
  renderCharts($('#charts'), sheet(), {
    value: (r, c) => valueAt(r, c),
    display: (r, c) => displayValue(valueAt(r, c), getCell(sheet(), r, c)?.s?.nf),
    box: (rg) => rangeBox(rg),
    selected: selectedChart,
    onSelect: (id) => selectChart(id),
    onChange: () => { scheduleSave() },
    onBeforeChange: () => snapshot(),
    zoom: () => zoom(),
  })
}
function selectChart(id) {
  if (selectedChart === id) return
  selectedChart = id
  const ch = sheet().charts.find((x) => x.id === id)
  $('#chartTab').classList.toggle('hidden', !ch)
  if (ch) {
    showTab('chart')
    $('#chartTitle').value = ch.title || ''
    $('#chartLegend').checked = ch.legend !== false
    $('#chartLabels').checked = !!ch.labels
    $$('[data-ctype]').forEach((b) => b.classList.toggle('on', b.dataset.ctype === ch.type))
  } else if ($('#chartTab').classList.contains('active')) showTab('home')
  renderChartsNow()
}
function insertChart(type) {
  const sh = sheet()
  let rg = selRange()
  if (rg.r1 === rg.r2 && rg.c1 === rg.c2) rg = currentRegion(sel.r, sel.c)
  if (rg.r1 === rg.r2 && rg.c1 === rg.c2) return toast('Hãy chọn vùng dữ liệu (gồm cả hàng tiêu đề) trước khi chèn biểu đồ.')
  snapshot()
  const b = rangeBox(rg)
  const ch = { ...chartDefaults(), id: `c${Date.now()}`, type, range: rangeStr(rg), x: b.x + b.w + 20, y: b.y, title: displayValue(valueAt(rg.r1, rg.c1 + 1)) || 'Tiêu đề biểu đồ' }
  sh.charts.push(ch)
  scheduleSave()
  selectedChart = null
  selectChart(ch.id)
}
function updateChart(patch) {
  const ch = sheet().charts.find((x) => x.id === selectedChart)
  if (!ch) return
  snapshot()
  Object.assign(ch, patch)
  scheduleSave()
  renderChartsNow()
}
$$('[data-chart]').forEach((b) => b.addEventListener('click', () => insertChart(b.dataset.chart)))
$$('[data-ctype]').forEach((b) => b.addEventListener('click', () => {
  updateChart({ type: b.dataset.ctype })
  $$('[data-ctype]').forEach((x) => x.classList.toggle('on', x === b))
}))
$('#chartTitle').addEventListener('change', (e) => updateChart({ title: e.target.value }))
$('#chartLegend').addEventListener('change', (e) => updateChart({ legend: e.target.checked }))
$('#chartLabels').addEventListener('change', (e) => updateChart({ labels: e.target.checked }))

// ================= Hàm (fx), tự động tính tổng =================
function autoFunction(fn) {
  if (editing && !commitEdit()) return
  const sh = sheet()
  const rg = selRange()
  const isNum = (r, c) => typeof valueAt(r, c) === 'number'
  if (rg.r1 !== rg.r2 || rg.c1 !== rg.c2) {
    // đã chọn sẵn vùng số: điền kết quả ngay bên dưới mỗi cột (hoặc bên phải nếu chọn một hàng)
    snapshot()
    if (rg.r1 === rg.r2) {
      setCell(sh, rg.r1, rg.c2 + 1, { v: `=${fn}(${rangeStr(rg)})` })
    } else {
      for (let c = rg.c1; c <= rg.c2; c++) setCell(sh, rg.r2 + 1, c, { v: `=${fn}(${rangeStr({ r1: rg.r1, c1: c, r2: rg.r2, c2: c })})` })
    }
    scheduleSave()
    return render()
  }
  // một ô: đoán vùng số liền kề phía trên, nếu không có thì bên trái
  let target = null
  let r = sel.r - 1
  while (r >= 0 && isNum(r, sel.c)) r--
  if (r < sel.r - 1) target = { r1: r + 1, c1: sel.c, r2: sel.r - 1, c2: sel.c }
  else {
    let c = sel.c - 1
    while (c >= 0 && isNum(sel.r, c)) c--
    if (c < sel.c - 1) target = { r1: sel.r, c1: c + 1, r2: sel.r, c2: sel.c - 1 }
  }
  const inner = target ? rangeStr(target) : ''
  startEdit('enter', `=${fn}(${inner})`)
  const start = fn.length + 2
  if (target) {
    point = { start, end: start + inner.length, anchor: { r: target.r1, c: target.c1 }, rg: target }
    input.setSelectionRange(start, start + inner.length)
  } else input.setSelectionRange(start, start)
  drawRefBoxes()
}
function openFx() {
  const d = $('#fxDialog')
  const lv = +$('#level').value
  const list = FUNCTIONS.filter((f) => lv === 99 || f.lop <= lv)
  let picked = list[0]
  const draw = (q = '') => {
    const s = q.trim().toLowerCase()
    const items = list.filter((f) => !s || f.name.toLowerCase().includes(s) || f.vi.toLowerCase().includes(s))
    $('#fxList').innerHTML = items.map((f) => `<button type="button" data-f="${f.name}" class="${f === picked ? 'on' : ''}"><b>${f.name}</b><small>${f.vi}</small></button>`).join('')
    if (!items.includes(picked)) picked = items[0]
    showHelp()
  }
  const showHelp = () => {
    $('#fxHelp').innerHTML = picked ? `<div class="fx-syntax">${picked.syntax}</div><p>${picked.help}</p>${picked.example ? `<p class="fx-ex">Ví dụ: <code>${picked.example}</code></p>` : ''}` : ''
  }
  $('#fxList').onclick = (e) => {
    const b = e.target.closest('[data-f]')
    if (!b) return
    picked = FUNCTIONS.find((f) => f.name === b.dataset.f)
    $$('#fxList button').forEach((x) => x.classList.toggle('on', x === b))
    showHelp()
  }
  $('#fxList').ondblclick = () => { d.close('ok') }
  $('#fxSearch').value = ''
  $('#fxSearch').oninput = (e) => draw(e.target.value)
  draw()
  d.showModal()
  d.onclose = () => {
    if (d.returnValue !== 'ok' || !picked) return input.focus()
    if (editing) {
      const p = input.selectionStart
      input.setRangeText(`${picked.name}(`, p, input.selectionEnd, 'end')
      if (!isFormula(input.value)) input.value = '=' + input.value
    } else startEdit('enter', `=${picked.name}(`)
    fbar.value = input.value
    input.focus()
    toast(`Cú pháp: ${picked.syntax}`)
  }
}

// ================= Ribbon =================
function showTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name))
  $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name))
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)))
function setLevel(lv) {
  lv = +lv
  $('#level').value = String(lv)
  $$('[data-lop]').forEach((el) => el.classList.toggle('lop-hidden', +el.dataset.lop > lv))
  const active = $('.tabs button.active')
  if (active?.classList.contains('lop-hidden')) showTab('home')
  storage.set('bt:level', lv)
}
$('#level').addEventListener('change', (e) => { setLevel(e.target.value); if (!currentLesson) renderLessonList() })

$('#fontFamily').innerHTML = FONTS.map((f) => `<option style="font-family:'${f}'">${f}</option>`).join('')
$('#fontSize').innerHTML = SIZES.map((s) => `<option>${s}</option>`).join('')
$('#fontFamily').addEventListener('change', (e) => styleSel({ font: e.target.value === 'Calibri' ? undefined : e.target.value }))
$('#fontSize').addEventListener('change', (e) => styleSel({ size: +e.target.value === 11 ? undefined : +e.target.value }))
$('#numFmt').addEventListener('change', (e) => styleSel((s) => ({ nf: e.target.value === 'general' ? undefined : { kind: e.target.value, dec: e.target.value === 'currency' ? 0 : 2, sep: e.target.value === 'number' ? true : undefined } })))
$$('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleStyle(b.dataset.toggle)))
$$('[data-align]').forEach((b) => b.addEventListener('click', () => styleSel({ align: b.dataset.align })))
$$('[data-valign]').forEach((b) => b.addEventListener('click', () => styleSel({ valign: b.dataset.valign === 'bottom' ? undefined : b.dataset.valign })))
$$('[data-border]').forEach((b) => b.addEventListener('click', () => { closePops(); setBorders(b.dataset.border) }))
$$('[data-merge]').forEach((b) => b.addEventListener('click', () => { closePops(); mergeCells(b.dataset.merge === 'center', b.dataset.merge === 'unmerge') }))
$$('[data-ins]').forEach((b) => b.addEventListener('click', () => { closePops(); ({ rowAbove: insertRows, colLeft: insertCols, sheet: addSheet })[b.dataset.ins]() }))
$$('[data-del]').forEach((b) => b.addEventListener('click', () => { closePops(); ({ row: deleteRows, col: deleteCols, sheet: () => deleteSheet(wb.active) })[b.dataset.del]() }))
$$('[data-auto]').forEach((b) => b.addEventListener('click', () => { closePops(); autoFunction(b.dataset.auto) }))
$$('[data-orient]').forEach((b) => b.addEventListener('click', () => { closePops(); snapshot(); wb.page.orientation = b.dataset.orient; scheduleSave(); toast(`Hướng giấy: ${b.dataset.orient === 'landscape' ? 'ngang' : 'đứng'}.`) }))
$$('[data-psize]').forEach((b) => b.addEventListener('click', () => { closePops(); snapshot(); wb.page.size = b.dataset.psize; scheduleSave(); toast(`Khổ giấy: ${b.dataset.psize}.`) }))
$('#printGrid').addEventListener('change', (e) => { wb.page.grid = e.target.checked; scheduleSave() })
$('#fitWidth').addEventListener('change', (e) => { wb.page.fit = e.target.checked; scheduleSave() })

let currentColor = '#ff0000'
let currentFill = '#ffff00'
function buildPalette(el, list, onPick, noneLabel) {
  el.innerHTML = `<div class="swatches">${list.map(([c, n]) => `<button class="sw" style="background:${c}" data-c="${c}" title="${n}"></button>`).join('')}</div><div class="pop-row"><button data-c="">${noneLabel}</button><label>Màu khác <input type="color" value="#ff0000"></label></div>`
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { onPick(b.dataset.c); closePops() } })
  $('input[type=color]', el).addEventListener('change', (e) => { onPick(e.target.value); closePops() })
}
buildPalette($('#colorPop'), COLORS, (c) => { if (c) { currentColor = c; $('#colorBar').style.background = c } styleSel({ color: c || undefined }) }, 'Tự động (đen)')
buildPalette($('#fillPop'), FILLS, (c) => { if (c) { currentFill = c; $('#fillBar').style.background = c } styleSel({ fill: c || undefined }) }, 'Không tô')
$('#colorBar').style.background = currentColor
$('#fillBar').style.background = currentFill

const ACTIONS = {
  new: async () => {
    if (!(await showAlert('Bảng tính mới', 'Xoá dữ liệu đang có để bắt đầu bảng tính mới?', true))) return
    if (currentLesson) closeLesson()
    storage.del(FREE())
    loadBook(FREE(), null, 'Bảng tính của em')
  },
  open: () => $('#openInput').click(),
  save: () => saveXlsx(),
  print: () => printSheet(),
  undo, redo,
  cut: () => { input.focus(); if (!document.execCommand('cut')) toast('Hãy dùng Ctrl+X.') },
  copy: () => { input.focus(); if (!document.execCommand('copy')) toast('Hãy dùng Ctrl+C.') },
  paste: async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (clip && text === clip.text) pasteInternal()
      else if (text) pasteText(text)
    } catch {
      if (clip) pasteInternal()
      else toast('Trình duyệt chặn nút Dán. Hãy dùng Ctrl+V.')
    }
  },
  color: () => styleSel({ color: currentColor }),
  fill: () => styleSel({ fill: currentFill }),
  border: () => setBorders('all'),
  wrap: () => styleSel({ wrap: !getCell(sheet(), sel.r, sel.c)?.s?.wrap || undefined }),
  mergeCenter: () => mergeCells(true),
  percent: () => styleSel({ nf: { kind: 'percent', dec: 0 } }),
  thousands: () => styleSel((s) => ({ nf: { kind: 'number', dec: s.nf?.dec ?? 0, sep: true } })),
  decMore: () => changeDecimals(1),
  decLess: () => changeDecimals(-1),
  colWidth: () => {
    const d = $('#colWidthDialog')
    const f = $('form', d)
    f.w.value = sheet().colW[sel.c] || DEFAULT_W
    d.showModal()
    d.onclose = () => {
      if (d.returnValue !== 'ok') return input.focus()
      snapshot()
      const rg = selRange()
      for (let c = rg.c1; c <= rg.c2; c++) sheet().colW[c] = Math.max(20, Math.min(600, +f.w.value || DEFAULT_W))
      scheduleSave()
      render()
      input.focus()
    }
  },
  clearAll,
  sortAsc: () => quickSort(false),
  sortDesc: () => quickSort(true),
  sortDialog: openSortDialog,
  filter: toggleFilter,
  clearFilter: clearFilterCriteria,
  validation: openDvDialog,
  fx: openFx,
  showFormulas: () => {
    showFormulas = !showFormulas
    $('#showFormulasBtn').classList.toggle('on', showFormulas)
    for (const td of tds.flat()) td.dataset.k = '~' // buộc vẽ lại (kể cả ô trống)
    render()
  },
  chartData: () => {
    const ch = sheet().charts.find((x) => x.id === selectedChart)
    if (!ch) return
    const d = $('#chartDataDialog')
    $('form', d).range.value = ch.range
    d.showModal()
    d.onclose = () => {
      const v = $('form', d).range.value.trim().toUpperCase()
      if (d.returnValue === 'ok' && parseRange(v)) updateChart({ range: rangeStr(parseRange(v)) })
    }
  },
  chartDelete: () => {
    snapshot()
    sheet().charts = sheet().charts.filter((x) => x.id !== selectedChart)
    scheduleSave()
    selectChart(null)
  },
  submit: () => doSubmit(),
  student: async () => { if (await askName({ allowGuest: false, cancellable: true })) { saveNow(); renderStudentChip() } },
  submitSetup: () => openSetup(),
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]')
  if (b && ACTIONS[b.dataset.act]) { closePops(); ACTIONS[b.dataset.act]() }
})

function syncToolbar() {
  const s = getCell(sheet(), sel.r, sel.c)?.s || {}
  $$('[data-toggle]').forEach((b) => b.classList.toggle('on', !!s[b.dataset.toggle]))
  const v = valueAt(sel.r, sel.c)
  const align = s.align || ''
  $$('[data-align]').forEach((b) => b.classList.toggle('on', align === b.dataset.align))
  $$('[data-valign]').forEach((b) => b.classList.toggle('on', (s.valign || 'bottom') === b.dataset.valign))
  $('#wrapBtn').classList.toggle('on', !!s.wrap)
  $('#mergeBtn').classList.toggle('on', !!mergeAt(sel.r, sel.c))
  $('#fontFamily').value = s.font || 'Calibri'
  $('#fontSize').value = String(s.size || 11)
  $('#numFmt').value = s.nf?.kind || 'general'
  $('[data-act="undo"]').disabled = !undoStack.length
  $('[data-act="redo"]').disabled = !redoStack.length
  void v
}

// ================= Popover, menu, hộp thoại =================
function closePops() { $$('.pop.open').forEach((p) => p.classList.remove('open')) }
function openPopAt(pop, rect) {
  closePops()
  pop.classList.add('open')
  const w = pop.offsetWidth
  const h = pop.offsetHeight
  pop.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - w - 8))}px`
  pop.style.top = `${Math.max(8, Math.min(rect.bottom + 4, innerHeight - h - 8))}px`
}
document.addEventListener('mousedown', (e) => {
  const trigger = e.target.closest('[data-pop]')
  if (trigger) {
    e.preventDefault()
    const pop = document.getElementById(trigger.dataset.pop)
    if (pop.classList.contains('open')) return closePops()
    return openPopAt(pop, trigger.getBoundingClientRect())
  }
  if (!e.target.closest('.pop') && !e.target.closest('.flt-btn') && !e.target.closest('#dvArrow')) closePops()
})
function showMenu(x, y, items) {
  const m = $('#ctxMenu')
  m.innerHTML = ''
  for (const [label, fn] of items) {
    if (label === '-') { m.insertAdjacentHTML('beforeend', '<hr>'); continue }
    const b = document.createElement('button')
    b.innerHTML = `<b>${label}</b>`
    b.onclick = () => { closePops(); fn() }
    m.appendChild(b)
  }
  openPopAt(m, { left: x, bottom: y })
}
wrap.addEventListener('contextmenu', (e) => {
  const td = e.target.closest('td, th')
  if (!td) return
  e.preventDefault()
  if (editing && !commitEdit()) return
  const r = td.dataset.r
  const c = td.dataset.c
  const rg = selRange()
  if (td.tagName === 'TD' && !inRange(rg, +r, +c)) select(+r, +c)
  if (td.classList.contains('ch') && !(+c >= rg.c1 && +c <= rg.c2 && rg.r1 === 0 && rg.r2 === ROWS - 1)) { sel = { r: 0, c: +c, r2: ROWS - 1, c2: +c }; updateSelection() }
  if (td.classList.contains('rh') && !(+r >= rg.r1 && +r <= rg.r2 && rg.c1 === 0 && rg.c2 === COLS - 1)) { sel = { r: +r, c: 0, r2: +r, c2: COLS - 1 }; updateSelection() }
  showMenu(e.clientX, e.clientY, [
    ['✂ Cắt', ACTIONS.cut], ['⧉ Sao chép', ACTIONS.copy], ['📋 Dán', ACTIONS.paste], ['-'],
    ['Chèn hàng phía trên', insertRows], ['Chèn cột bên trái', insertCols], ['Xoá hàng', deleteRows], ['Xoá cột', deleteCols], ['-'],
    ['Xoá nội dung', clearContents],
  ])
})
function showAlert(title, text, withCancel) {
  const d = $('#alertDialog')
  $('#alertTitle').textContent = title
  $('#alertText').textContent = text
  $('#alertCancel').classList.toggle('hidden', !withCancel)
  $('#alertOk').textContent = withCancel ? 'Đồng ý' : 'Thử lại'
  d.showModal()
  return new Promise((res) => {
    d.onclose = () => {
      res(d.returnValue === 'ok')
      if (editing) input.focus()
    }
  })
}
let toastTimer
function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500)
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}

// ================= Hộp tên (name box) =================
$('#nameBox').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const rg = parseRange(e.target.value.trim().toUpperCase())
  if (!rg || rg.r2 >= ROWS || rg.c2 >= COLS) return toast('Địa chỉ không hợp lệ. Ví dụ: B3 hoặc A1:C5')
  sel = { r: rg.r1, c: rg.c1, r2: rg.r2, c2: rg.c2 }
  updateSelection()
  scrollIntoView(rg.r1, rg.c1)
  input.focus()
})

// ================= Thu phóng =================
const zoom = () => +$('#zoom').value / 100
$('#zoom').addEventListener('input', (e) => {
  gridEl.style.zoom = e.target.value / 100
  $('#zoomVal').textContent = `${e.target.value}%`
  $('#selBox').parentElement.style.setProperty('--z', e.target.value / 100)
  for (const el of [$('#selBox'), $('#fillBox'), $('#refBoxes'), input, $('#dvArrow'), $('#charts')]) el.style.zoom = e.target.value / 100
  updateSelection()
  renderChartsNow()
})

// ================= Lưu tạm =================
const docKey = () => userKey(currentLesson ? `bt:ex:${currentLesson.id}` : 'bt:free')
const FREE = () => userKey('bt:free')
const DONE = () => userKey('bt:done')
let saveTimer
function scheduleSave() {
  $('#saveState').textContent = 'Đang lưu…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 500)
}
function saveNow() {
  storage.set(docKey(), { wb, name: $('#fileName').value })
  $('#saveState').textContent = 'Đã lưu tạm'
}
function loadBook(k, start, name) {
  const saved = storage.get(k)
  if (saved?.wb) {
    wb = saved.wb
    $('#fileName').value = saved.name || name
  } else {
    wb = start ? fromLesson(start) : newBook()
    $('#fileName').value = name
  }
  undoStack = []
  redoStack = []
  afterLoad()
}
function afterLoad() {
  wb.page = wb.page || newBook().page
  for (const s of wb.sheets) {
    s.colW = s.colW || {}
    s.merges = s.merges || []
    s.charts = s.charts || []
    s.dv = s.dv || []
  }
  wb.active = Math.min(wb.active || 0, wb.sheets.length - 1)
  $('#printGrid').checked = !!wb.page.grid
  $('#fitWidth').checked = wb.page.fit !== false
  for (const td of tds.flat()) td.dataset.k = '~' // buộc vẽ lại (kể cả ô trống)
  selectedChart = null
  $('#chartTab').classList.add('hidden')
  if (editing) { editing = null; input.classList.remove('editing'); input.value = '' }
  clearCopy()
  sel = { ...sel, r2: sel.r, c2: sel.c }
  render()
  scheduleSave()
  input.focus()
}
$('#fileName').addEventListener('input', scheduleSave)

// đề bài → bảng tính: { sheets: [{ name, rows: [[...]] , colW, merges, styles }] }
function fromLesson(start) {
  const book = newBook()
  book.sheets = start.sheets.map((s) => {
    const sh = newSheet(s.name)
    ;(s.rows || []).forEach((row, r) => row.forEach((v, c) => { if (v !== null && v !== undefined && v !== '') sh.cells[key(r + (s.at?.r || 0), c + (s.at?.c || 0))] = { v: String(v) } }))
    for (const [a, st] of Object.entries(s.styles || {})) {
      const rg = parseRange(a)
      for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) sh.cells[key(r, c)] = { ...(sh.cells[key(r, c)] || {}), s: { ...(sh.cells[key(r, c)]?.s || {}), ...st } }
    }
    for (const [col, w] of Object.entries(s.colW || {})) sh.colW[colIndex(col)] = w
    sh.merges = (s.merges || []).map(parseRange)
    sh.dv = s.dv || []
    return sh
  })
  return book
}

// ================= Mở / lưu .xlsx, in =================
async function saveXlsx() {
  if (editing && !commitEdit()) return
  toast('Đang tạo tệp .xlsx…')
  const { exportXlsx } = await import('./xlsx.js')
  const blob = await exportXlsx(wb, engine, { chartImage: (id) => chartImage(id) })
  const name = ($('#fileName').value.trim() || 'bang-tinh').replace(/[\\/:*?"<>|]/g, '')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  toast(`Đã lưu “${name}.xlsx” vào thư mục Tải về.`)
}
function chartImage(id) {
  const canvas = $(`.chart-box[data-id="${id}"] canvas`)
  return canvas ? canvas.toDataURL('image/png') : null
}
$('#openInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  try {
    const { importXlsx } = await import('./xlsx.js')
    const book = await importXlsx(await f.arrayBuffer())
    if (currentLesson) closeLesson()
    wb = book
    $('#fileName').value = f.name.replace(/\.xlsx$/i, '')
    undoStack = []
    afterLoad()
    toast('Đã mở tệp.')
  } catch (err) {
    console.error(err)
    toast('Không mở được tệp này. Chỉ mở được tệp .xlsx.')
  }
})
function printSheet() {
  if (editing && !commitEdit()) return
  const sh = sheet()
  let r2 = 0
  let c2 = 0
  for (const k of Object.keys(sh.cells)) {
    const [r, c] = k.split(',').map(Number)
    if (sh.cells[k].v !== undefined || sh.cells[k].s?.fill || sh.cells[k].s?.bb) { r2 = Math.max(r2, r); c2 = Math.max(c2, c) }
  }
  for (const m of sh.merges) { r2 = Math.max(r2, m.r2); c2 = Math.max(c2, m.c2) }
  let html = `<table class="print-table${wb.page.grid ? ' grid-lines' : ''}"><colgroup>`
  for (let c = 0; c <= c2; c++) html += `<col style="width:${sh.colW[c] || DEFAULT_W}px">`
  html += '</colgroup>'
  for (let r = 0; r <= r2; r++) {
    if (hiddenRows.has(r)) continue
    html += '<tr>'
    for (let c = 0; c <= c2; c++) {
      const td = tds[r][c]
      if (td.style.display === 'none') continue
      html += `<td rowspan="${td.rowSpan}" colspan="${td.colSpan}" style="${td.style.cssText}">${escapeHtml(td.firstChild?.nodeType === 3 ? td.firstChild.textContent : td.textContent.replace(/[▾⏷]$/, ''))}</td>`
    }
    html += '</tr>'
  }
  html += '</table>'
  for (const ch of sh.charts) {
    const img = chartImage(ch.id)
    if (img) html += `<img class="print-chart" src="${img}" style="width:${ch.w}px">`
  }
  $('#printArea').innerHTML = html
  let tag = $('#pageStyle')
  if (!tag) { tag = document.createElement('style'); tag.id = 'pageStyle'; document.head.appendChild(tag) }
  tag.textContent = `@page { size: ${wb.page.size} ${wb.page.orientation}; margin: 1.5cm; }`
  // vừa một trang ngang: thu nhỏ bảng nếu quá rộng
  const pageW = (wb.page.orientation === 'landscape' ? 29.7 : 21) - 3
  const tableW = Array.from({ length: c2 + 1 }, (_, c) => sh.colW[c] || DEFAULT_W).reduce((a, b) => a + b, 0)
  const maxPx = (pageW / 2.54) * 96
  $('#printArea').style.zoom = wb.page.fit !== false && tableW > maxPx ? maxPx / tableW : 1
  setTimeout(() => window.print(), 50)
}

// ================= Bài tập =================
function renderLessonList() {
  const lv = +$('#level').value
  const groups = {}
  for (const l of LESSONS) {
    if (lv !== 99 && l.lop !== lv) continue
    ;(groups[`Lớp ${l.lop} — ${l.bai}`] ||= []).push(l)
  }
  const done = storage.get(DONE()) || {}
  $('#lessonList').innerHTML = Object.entries(groups).map(([g, ls]) => `<div class="lgroup"><div class="lgroup-title">${g}</div>${ls.map((l) => `<button class="lesson-item" data-id="${l.id}"><span>${l.vanDung ? '<span class="vd-tag">Vận dụng</span> ' : ''}${l.title}</span>${done[l.id] ? '<span class="done">✓</span>' : ''}</button>`).join('')}</div>`).join('') || '<p class="muted">Chưa có bài tập cho mức này.</p>'
}
$('#lessonList').addEventListener('click', (e) => {
  const b = e.target.closest('.lesson-item')
  if (b) openLesson(LESSONS.find((l) => l.id === b.dataset.id))
})
$('#toggleLessons').addEventListener('click', () => {
  $('#lessons').classList.toggle('hidden')
  if (!$('#lessons').classList.contains('hidden') && !currentLesson) renderLessonList()
  setTimeout(() => { updateSelection(); renderChartsNow() })
})
$('#closeLessons').addEventListener('click', () => $('#lessons').classList.add('hidden'))
function openLesson(l) {
  if (editing && !commitEdit()) return
  saveNow()
  currentLesson = l
  if (+$('#level').value !== 99 && +$('#level').value < l.lop) setLevel(l.lop)
  sel = { r: 0, c: 0, r2: 0, c2: 0 }
  loadBook(docKey(), l.start, l.title)
  $('#lessonList').classList.add('hidden')
  const v = $('#lessonView')
  v.classList.remove('hidden')
  v.innerHTML = examMode
    ? `
    <div class="exam-head"><span>BÀI KIỂM TRA</span><span class="exam-clock" id="examClock">--:--</span></div>
    <div class="lesson-bai">Lớp ${l.lop} · ${l.bai}</div>
    <h3>${l.title}</h3>
    <p>${l.intro}</p>
    <ol class="steps exam">${l.steps.map((s, i) => `<li data-i="${i}"><span class="mark num">${i + 1}</span><div>${s.text}</div></li>`).join('')}</ol>
    <p class="dlg-note">Làm xong bấm <b>Nộp bài</b>. Chỉ được nộp một lần; hết giờ máy tự nộp.</p>
    <div class="lesson-actions submit-row">
      <span class="student-chip" id="studentChip"></span>
      <button id="submitLesson" class="btn-primary submit-btn">Nộp bài</button>
    </div>`
    : `
    <button class="back" id="backToList">‹ Danh sách bài</button>
    <div class="lesson-bai">Lớp ${l.lop} · ${l.bai}</div>
    <h3>${l.vanDung ? '<span class="vd-tag">Vận dụng</span> ' : ''}${l.title}</h3>
    <p>${l.intro}</p>
    ${l.vanDung ? '<p class="vd-note">Bài vận dụng: em tự chọn nội dung. Máy chỉ kiểm tra các kĩ năng bên dưới, thầy cô sẽ xem bài em nộp.</p>' : ''}
    <ol class="steps">${l.steps.map((s, i) => `<li data-i="${i}"><span class="mark"></span><div><div>${s.text}</div><div class="hint-text"></div></div></li>`).join('')}</ol>
    <div class="score" id="score"></div>
    <div class="lesson-actions">
      <button id="resetLesson">Làm lại từ đầu</button>
      <button id="checkLesson" class="btn-primary">Kiểm tra</button>
    </div>
    <div class="lesson-actions submit-row ${submitCfg ? '' : 'hidden'}">
      <span class="student-chip" id="studentChip"></span>
      <button id="submitLesson" class="btn-primary submit-btn">Nộp bài</button>
    </div>`
  renderStudentChip()
  $('#submitLesson').onclick = () => doSubmit()
  if (examMode) return
  $('#backToList').onclick = closeLesson
  $('#resetLesson').onclick = async () => {
    if (!(await showAlert('Làm lại', 'Xoá bài đang làm và bắt đầu lại?', true))) return
    storage.del(docKey())
    loadBook(docKey(), l.start, l.title)
    $$('.steps li').forEach((li) => li.classList.remove('ok', 'bad'))
    $('#score').textContent = ''
  }
  $('#checkLesson').onclick = runCheck
}
function runCheck() {
  if (editing && !commitEdit()) return null
  const l = currentLesson
  engine.reset()
  const res = checkExercise(l, wb, engine, { hiddenRows: (sh) => { const save = hiddenRows; computeHidden(sh); const h = hiddenRows; hiddenRows = save; return h } })
  render()
  if (examMode) return res // kiểm tra: không hiện kết quả cho học sinh
  res.forEach((r, i) => {
    const li = $(`.steps li[data-i="${i}"]`)
    li.classList.toggle('ok', r.ok)
    li.classList.toggle('bad', !r.ok)
    $('.hint-text', li).textContent = r.ok ? '' : r.hint
  })
  const n = res.filter((r) => r.ok).length
  const all = n === res.length
  $('#score').className = `score ${all ? 'win' : ''}`
  $('#score').textContent = all ? `Tuyệt vời! Em đã hoàn thành ${n}/${res.length} yêu cầu.` : `Đạt ${n}/${res.length} yêu cầu. Xem gợi ý màu đỏ để sửa nhé.`
  if (all) {
    const done = storage.get(DONE()) || {}
    done[l.id] = true
    storage.set(DONE(), done)
  }
  return res
}
function closeLesson() {
  saveNow()
  currentLesson = null
  $('#lessonView').classList.add('hidden')
  $('#lessonList').classList.remove('hidden')
  renderLessonList()
  loadBook(FREE(), null, 'Bảng tính của em')
}

// ================= Nộp bài =================
let submitCfg = loadSubmitConfig()
const examCfg = examFromUrl()
if (location.search) history.replaceState(null, '', location.pathname)
function renderStudentChip() {
  renderUserChip()
  const chip = $('#studentChip')
  if (!chip) return
  const st = getStudent()
  chip.innerHTML = st ? 'Em: <b></b> · <span></span>' : '<span class="muted">Chưa có tên (đang dùng thử)</span>'
  if (st) { $('b', chip).textContent = st.hoTen; $('span', chip).textContent = st.lop }
}
// Khách muốn nộp bài: hỏi tên, rồi lưu bài đang làm sang tên đó
async function askStudent() {
  const u = await askName({ allowGuest: false, cancellable: true, title: 'Nộp bài', note: 'Nhập họ tên và lớp để thầy cô ghi điểm cho em.' })
  if (u) saveNow()
  renderStudentChip()
  return getStudent()
}
let sending = false
async function doSubmit({ auto = false } = {}) {
  if (sending) return
  if (!submitCfg?.url) return toast('Thầy cô chưa cài đặt nộp bài. Hãy mở bằng đường link thầy cô gửi.')
  let st = getStudent()
  if (!st) st = await askStudent()
  if (!st) return
  if (examMode?.submitted) return
  const what = currentLesson ? `bài “${currentLesson.title}”` : 'bảng tính này'
  if (!auto && !(await showAlert('Nộp bài', `${st.hoTen} (${st.lop}) nộp ${what} cho thầy cô?${examMode ? ' Bài kiểm tra chỉ được nộp một lần.' : ''}`, true))) return
  if (editing) commitEdit()
  sending = true
  const btns = $$('[data-act="submit"], #submitLesson')
  btns.forEach((b) => (b.disabled = true))
  toast('Đang nộp bài…')
  try {
    saveNow()
    const results = currentLesson ? runCheck() : null
    const { exportXlsx } = await import('./xlsx.js')
    const blob = await exportXlsx(wb, engine, { chartImage })
    const lesson = currentLesson ? { ...currentLesson, id: examMode ? `${currentLesson.id}:kt` : currentLesson.id, bai: `${examMode ? 'KIỂM TRA · ' : ''}Bảng tính · ${currentLesson.bai}` } : null
    const r = await submit(submitCfg, st, { lesson, results, docxBlob: blob, fileName: $('#fileName').value.trim() || 'bang-tinh', ext: 'xlsx' })
    if (r.ok) {
      toast(r.confirmed ? 'Nộp bài thành công!' : 'Đã gửi bài. Nếu thầy cô chưa nhận được, em nộp lại nhé.')
      if (examMode) finishExam()
    } else toast(`Chưa nộp được: ${r.error}${examMode ? ' Bấm Nộp bài để thử lại.' : ''}`)
  } catch (err) {
    console.error(err)
    toast('Chưa nộp được bài, em thử lại nhé.')
  } finally {
    sending = false
    btns.forEach((b) => (b.disabled = false))
  }
}
function openSetup() {
  const d = $('#setupDialog')
  const f = $('form', d)
  f.url.value = submitCfg?.url || ''
  f.khoa.value = submitCfg?.khoa || ''
  $('#testResult').textContent = ''
  const showLink = () => {
    const url = f.url.value.trim()
    $('#linkBox').classList.toggle('hidden', !url)
    if (url) $('#studentLink').value = studentLink({ url, khoa: f.khoa.value.trim() })
    $('#examBox').classList.toggle('hidden', !url)
    if (url) $('#examLinkOut').value = examLink($('#studentLink').value, $('#examLesson').value, +$('#examMinutes').value || 30)
  }
  $('#examLesson').innerHTML = LESSONS.map((l) => `<option value="${l.id}">Lớp ${l.lop} · ${l.title}</option>`).join('')
  $('#examLesson').onchange = showLink
  $('#examMinutes').oninput = showLink
  $('#copyExam').onclick = async () => {
    try { await navigator.clipboard.writeText($('#examLinkOut').value); $('#copyExam').textContent = 'Đã chép ✓' } catch { $('#examLinkOut').select() }
    setTimeout(() => ($('#copyExam').textContent = 'Sao chép'), 1500)
  }
  f.url.oninput = showLink
  f.khoa.oninput = showLink
  showLink()
  $('#copyLink').onclick = async () => {
    try { await navigator.clipboard.writeText($('#studentLink').value); $('#copyLink').textContent = 'Đã chép ✓' } catch { $('#studentLink').select() }
    setTimeout(() => ($('#copyLink').textContent = 'Sao chép'), 1500)
  }
  $('#testSubmit').onclick = async () => {
    const url = f.url.value.trim()
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) return ($('#testResult').textContent = '✗ Địa chỉ phải bắt đầu bằng https://script.google.com/')
    $('#testResult').textContent = 'Đang thử…'
    try {
      const data = await (await fetch(url)).json()
      $('#testResult').textContent = data.ok ? '✓ Kết nối được.' : '✗ Máy chủ trả lời lạ.'
    } catch {
      $('#testResult').textContent = '✗ Không kết nối được. Kiểm tra quyền “Bất kỳ ai” khi triển khai.'
    }
  }
  d.showModal()
  d.onclose = () => {
    if (d.returnValue !== 'ok') return
    const url = f.url.value.trim()
    submitCfg = url ? { url, khoa: f.khoa.value.trim() } : null
    saveSubmitConfig(submitCfg)
    $$('.submit-row').forEach((el) => el.classList.toggle('hidden', !submitCfg))
    toast(url ? 'Đã lưu cài đặt nộp bài.' : 'Đã tắt nộp bài.')
  }
}

// ================= Khởi động =================
// ================= Chế độ kiểm tra =================
let examMode = null
function startExam(cfg) {
  const l = LESSONS.find((x) => x.id === cfg.lessonId)
  if (!l) return toast('Link kiểm tra không đúng (không tìm thấy bài).')
  if (!submitCfg?.url) toast('Chưa có địa chỉ nộp bài: hãy mở đúng link kiểm tra thầy cô gửi.')
  examMode = { lesson: l, minutes: cfg.minutes, submitted: false }
  document.body.classList.add('exam-mode')
  $('#lessons').classList.remove('hidden')
  openLesson(l)
  const st = examState('sheet', l.id)
  if (st.submittedAt) return finishExam(st.submittedAt)
  examMode.stop = startCountdown($('#examClock'), st.start + cfg.minutes * 60000, () => {
    toast('Hết giờ! Máy đang tự nộp bài…')
    doSubmit({ auto: true })
  })
}
function finishExam(at) {
  const st = at ? { submittedAt: at } : markExamSubmitted('sheet', examMode.lesson.id)
  examMode.submitted = true
  examMode.stop?.()
  saveNow()
  const t = new Date(st.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  lockScreen(`Em đã nộp bài lúc ${t}. Chờ thầy cô hướng dẫn nhé.`)
}

buildGrid()
setLevel(storage.get('bt:level') ?? 7)
window.addEventListener('beforeunload', () => { if (examMode?.submitted) return; if (editing) commitEdit(); saveNow() })
initSession({
  exam: examCfg,
  onEndRequest: async () => {
    if (editing) commitEdit()
    saveNow()
    const u = getStudent()
    return showAlert('Đổi người dùng', u ? `Kết thúc buổi học của ${u.hoTen}? Bài của em đã được lưu.` : 'Kết thúc phiên dùng thử? Bài làm thử sẽ bị xoá.', true)
  },
  onChange: () => {
    currentLesson = null
    $('#lessonView').classList.add('hidden')
    $('#lessonList').classList.remove('hidden')
    if (!$('#lessons').classList.contains('hidden')) renderLessonList()
    loadBook(FREE(), null, 'Bảng tính của em')
  },
}).then(() => {
  loadBook(FREE(), null, 'Bảng tính của em')
  if (examCfg) startExam(examCfg)
})
window.addEventListener('resize', () => updateSelection())
document.addEventListener('keydown', (e) => {
  // phím tắt khi đang đứng ở ribbon (không ở ô): Esc quay lại lưới
  if (e.key === 'Escape' && document.activeElement !== input && document.activeElement !== fbar && !document.querySelector('dialog[open]')) input.focus()
})
