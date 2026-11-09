import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Subscript from './subsup.js'
import { ParagraphFormat, ListStyle, WrapImage, PageNumber, PageBreak, BULLET_STYLES, NUMBER_STYLES, FREE_WRAPS } from './extensions.js'
import { Pagination, repaginate, geometry, PAGE_GAP } from './pagination.js'
import { findNext, replaceAll, replaceCurrent, findAll } from './find-replace.js'
import { PAGE_SIZES, DEFAULT_PAGE, applyPage } from './page.js'
import { LESSONS } from './lessons.js'
import { checkExercise, DEFAULT_RUN } from './checker.js'
import { loadSubmitConfig, saveSubmitConfig, studentLink, getStudent, submit } from './submit.js'
import { userKey, examFromUrl, examLink, examState, markExamSubmitted } from './session.js'
import { initSession, askName, renderUserChip, lockScreen, startCountdown } from './session-ui.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]

const DEFAULTS = { fontFamily: DEFAULT_RUN.fontFamily, fontSize: parseFloat(DEFAULT_RUN.fontSize) }
const FONTS = ['Times New Roman', 'Arial', 'Tahoma', 'Calibri', 'Verdana', 'Cambria', 'Courier New', 'Comic Sans MS']
const SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
const COLORS = [
  ['#000000', 'Đen'], ['#7f7f7f', 'Xám'], ['#ffffff', 'Trắng'], ['#c00000', 'Đỏ đậm'], ['#ff0000', 'Đỏ'], ['#ffc000', 'Cam'],
  ['#ffff00', 'Vàng'], ['#92d050', 'Xanh lá nhạt'], ['#00b050', 'Xanh lá'], ['#00b0f0', 'Xanh da trời'], ['#0070c0', 'Xanh dương'],
  ['#002060', 'Xanh đậm'], ['#7030a0', 'Tím'], ['#ff66cc', 'Hồng'],
]
const HL = [['#ffff00', 'Vàng'], ['#00ff00', 'Xanh lá'], ['#00ffff', 'Xanh ngọc'], ['#ff00ff', 'Hồng'], ['#ffc000', 'Cam'], ['#d9d9d9', 'Xám']]
const SYMBOLS = '© ® ™ ° ± × ÷ ≠ ≤ ≥ ≈ √ ∞ π Ω α β γ ∑ ← → ↑ ↓ ↔ ⇒ ★ ☆ ♥ ♦ ♣ ♠ ✓ ✗ • ● ○ ■ □ ▲ ► ☺ ☎ ✉ € £ ¥ § ¶ … “ ” «»'.split(' ')

// ---------------- Trạng thái ----------------
let page = structuredClone(DEFAULT_PAGE)
let currentLesson = null // đề bài đang làm
let currentColor = '#ff0000'
let currentHl = '#ffff00'
const storage = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* bộ nhớ đầy hoặc bị chặn */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* bỏ qua */ } },
}
const docKey = () => userKey(currentLesson ? `stt:ex:${currentLesson.id}` : 'stt:free')
const FREE = () => userKey('stt:free')
const DONE = () => userKey('stt:done')

// ---------------- Trình soạn thảo ----------------
const commonExtensions = () => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
  TextStyle, Color, FontFamily, FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  WrapImage.configure({ inline: true, allowBase64: true, resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 30, minHeight: 30 } }),
  ...Subscript,
  ParagraphFormat,
  ListStyle,
]
const body = new Editor({
  element: $('#editor'),
  extensions: [...commonExtensions(), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Pagination, PageBreak],
  content: '<p></p>',
  onUpdate: () => { scheduleSave(); updateStatus() },
  onSelectionUpdate: () => syncToolbar(),
  onTransaction: () => syncToolbar(),
  onFocus: () => setActive(body),
})
// Đầu trang / chân trang: hai trình soạn thảo nhỏ, dùng chung thanh công cụ
const makeHF = (el) =>
  new Editor({
    element: el,
    extensions: [...commonExtensions(), PageNumber],
    content: '',
    onUpdate: () => { scheduleSave(); scheduleLayout() },
    onSelectionUpdate: () => syncToolbar(),
    onTransaction: () => syncToolbar(),
    onFocus: ({ editor: e }) => setActive(e),
  })
const header = makeHF($('#headerEditor'))
const footer = makeHF($('#footerEditor'))
let editor = body // trình soạn thảo đang gõ: thân văn bản, đầu trang hoặc chân trang
window.editor = body // tiện kiểm tra trong DevTools
window.hf = { header, footer }

// ---------------- Lưu tạm tự động ----------------
let saveTimer
function scheduleSave() {
  $('#saveState').textContent = 'Đang lưu…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 600)
}
function saveNow() {
  storage.set(docKey(), { doc: body.getJSON(), header: header.getJSON(), footer: footer.getJSON(), page, name: $('#fileName').value })
  $('#saveState').textContent = 'Đã lưu tạm'
}
function loadDoc(key, fallbackHtml, fallbackName) {
  const saved = storage.get(key)
  if (saved?.doc) {
    body.commands.setContent(saved.doc, { emitUpdate: false })
    header.commands.setContent(saved.header || '', { emitUpdate: false })
    footer.commands.setContent(saved.footer || '', { emitUpdate: false })
    page = saved.page || structuredClone(DEFAULT_PAGE)
    $('#fileName').value = saved.name || fallbackName
  } else {
    body.commands.setContent(fallbackHtml || '<p></p>', { emitUpdate: false })
    header.commands.setContent(lessonHF?.header || '', { emitUpdate: false })
    footer.commands.setContent(lessonHF?.footer || '', { emitUpdate: false })
    page = { ...structuredClone(DEFAULT_PAGE), ...(lessonHF?.page || {}) }
    $('#fileName').value = fallbackName
  }
  setActive(body)
  body.commands.focus('end')
  applyPage($('#pageWrap'), page)
  updateStatus()
}
let lessonHF = null // đầu/chân trang có sẵn của đề bài (nếu có)
$('#fileName').addEventListener('input', scheduleSave)

// ---------------- Tab ribbon ----------------
function showTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name))
  $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name))
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)))

// ---------------- Mức giao diện theo lớp ----------------
function setLevel(lv) {
  lv = +lv
  $('#level').value = String(lv)
  $$('[data-lop]').forEach((el) => el.classList.toggle('lop-hidden', +el.dataset.lop > lv))
  const active = $('.tabs button.active')
  if (active?.classList.contains('lop-hidden')) showTab('home')
  storage.set('stt:level', lv)
}
$('#level').addEventListener('change', (e) => setLevel(e.target.value))

// ---------------- Chọn phông / cỡ ----------------
$('#fontFamily').innerHTML = FONTS.map((f) => `<option style="font-family:'${f}'">${f}</option>`).join('')
$('#fontSize').innerHTML = SIZES.map((s) => `<option>${s}</option>`).join('')
$('#fontFamily').addEventListener('change', (e) => editor.chain().focus().setFontFamily(e.target.value).run())
$('#fontSize').addEventListener('change', (e) => editor.chain().focus().setFontSize(`${e.target.value}pt`).run())
function currentSize() {
  return parseFloat(editor.getAttributes('textStyle').fontSize) || DEFAULTS.fontSize
}
function stepSize(dir) {
  const cur = currentSize()
  const next = dir > 0 ? SIZES.find((s) => s > cur) : [...SIZES].reverse().find((s) => s < cur)
  if (next) editor.chain().focus().setFontSize(`${next}pt`).run()
}

// ---------------- Màu ----------------
function buildPalette(el, list, onPick, withNone) {
  el.innerHTML =
    `<div class="swatches">${list.map(([c, n]) => `<button class="sw" style="background:${c}" data-c="${c}" title="${n}"></button>`).join('')}</div>` +
    `<div class="pop-row">${withNone ? `<button data-c="">${withNone}</button>` : ''}<label>Màu khác <input type="color" value="#ff0000"></label></div>`
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]')
    if (b) { onPick(b.dataset.c); closePops() }
  })
  $('input[type=color]', el).addEventListener('change', (e) => { onPick(e.target.value); closePops() })
}
buildPalette($('#colorPop'), COLORS, (c) => {
  if (!c) return editor.chain().focus().unsetColor().run()
  currentColor = c
  $('#colorBar').style.background = c
  editor.chain().focus().setColor(c).run()
}, 'Tự động (đen)')
buildPalette($('#hlPop'), HL, (c) => {
  if (!c) return editor.chain().focus().unsetHighlight().run()
  currentHl = c
  $('#hlBar').style.background = c
  editor.chain().focus().setHighlight({ color: c }).run()
}, 'Không tô')
$('#colorBar').style.background = currentColor
$('#hlBar').style.background = currentHl

// ---------------- Kí hiệu, khổ giấy, bảng ----------------
$('#symbolPop').innerHTML = `<div class="symbols">${SYMBOLS.map((s) => `<button data-sym="${s}">${s}</button>`).join('')}</div>`
$('#symbolPop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sym]')
  if (b) { editor.chain().focus().insertContent(b.dataset.sym).run(); closePops() }
})
$('#sizePop').innerHTML = Object.entries(PAGE_SIZES).map(([k, v]) => `<button data-size="${k}"><b>${k}</b><small>${v.name}</small></button>`).join('')

const grid = $('#tableGrid')
for (let r = 1; r <= 8; r++) for (let c = 1; c <= 10; c++) grid.insertAdjacentHTML('beforeend', `<span data-r="${r}" data-c="${c}"></span>`)
grid.addEventListener('mouseover', (e) => {
  const t = e.target.dataset
  if (!t.r) return
  $$('span', grid).forEach((s) => s.classList.toggle('on', +s.dataset.r <= +t.r && +s.dataset.c <= +t.c))
  $('#gridLabel').textContent = `Bảng ${t.r} hàng × ${t.c} cột`
})
grid.addEventListener('click', (e) => {
  const t = e.target.dataset
  if (t.r) insertTable(+t.r, +t.c)
})
$('#tInsert').addEventListener('click', () => insertTable(+$('#tRows').value || 3, +$('#tCols').value || 3))
function insertTable(rows, cols) {
  editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run()
  closePops()
}

// ---------------- Popover ----------------
function closePops() { $$('.pop.open').forEach((p) => p.classList.remove('open')) }
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-pop]')
  if (trigger) {
    const pop = document.getElementById(trigger.dataset.pop)
    const wasOpen = pop.classList.contains('open')
    closePops()
    if (!wasOpen) {
      const r = trigger.getBoundingClientRect()
      pop.classList.add('open')
      const w = pop.offsetWidth
      pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`
      pop.style.top = `${r.bottom + 4}px`
    }
    return
  }
  if (!e.target.closest('.pop')) closePops()
})

// ---------------- Nút lệnh ----------------
const SIMPLE = {
  undo: (c) => c.undo(), redo: (c) => c.redo(), bold: (c) => c.toggleBold(), italic: (c) => c.toggleItalic(),
  underline: (c) => c.toggleUnderline(), strike: (c) => c.toggleStrike(),
  subscript: (c) => c.toggleSubscript(), superscript: (c) => c.toggleSuperscript(),
}
$$('[data-cmd]').forEach((b) => b.addEventListener('click', () => SIMPLE[b.dataset.cmd](editor.chain().focus()).run()))
$$('[data-align]').forEach((b) => b.addEventListener('click', () => editor.chain().focus().setTextAlign(b.dataset.align).run()))
$$('[data-tcmd]').forEach((b) =>
  b.addEventListener('click', () => {
    const ok = editor.chain().focus()[b.dataset.tcmd]().run()
    if (!ok && b.dataset.tcmd === 'mergeCells') toast('Kéo chuột để chọn từ 2 ô liền nhau trở lên, rồi bấm Gộp ô.')
  }),
)
$$('[data-style]').forEach((b) =>
  b.addEventListener('click', () => {
    const s = b.dataset.style
    const c = editor.chain().focus()
    ;(s === 'p' ? c.setParagraph() : c.setHeading({ level: +s[1] })).run()
  }),
)
$('#lineHeight').addEventListener('change', (e) => {
  editor.chain().focus().setParagraphFormat({ lineHeight: e.target.value || null }).run()
})

const ACTIONS = {
  new: async () => {
    if (!(await confirmBox('Văn bản mới', 'Xoá nội dung đang có để bắt đầu văn bản mới?'))) return
    if (currentLesson) closeLesson()
    storage.del(FREE())
    loadDoc(FREE(), '<p></p>', 'Văn bản của em')
  },
  open: () => $('#openInput').click(),
  save: saveDocx,
  print: () => window.print(),
  cut: () => clip('cut'),
  copy: () => clip('copy'),
  paste: pasteFromButton,
  grow: () => stepSize(1),
  shrink: () => stepSize(-1),
  color: () => editor.chain().focus().setColor(currentColor).run(),
  highlight: () => editor.chain().focus().toggleHighlight({ color: currentHl }).run(),
  clearFormat: () => editor.chain().focus().unsetAllMarks().setParagraphFormat({ lineHeight: null, indentLeft: null, indentFirst: null, spaceBefore: null, spaceAfter: null }).unsetTextAlign().run(),
  bullet: () => editor.chain().focus().toggleBulletList().run(),
  ordered: () => editor.chain().focus().toggleOrderedList().run(),
  indent: () => (editor.can().sinkListItem('listItem') ? editor.chain().focus().sinkListItem('listItem').run() : editor.chain().focus().changeIndent(1.27).run()),
  outdent: () => (editor.isActive('listItem') ? editor.chain().focus().liftListItem('listItem').run() : editor.chain().focus().changeIndent(-1.27).run()),
  paraDialog: openParaDialog,
  find: () => { setActive(body); openFind(false) },
  replace: () => { setActive(body); openFind(true) },
  image: () => $('#imageInput').click(),
  hr: () => editor.chain().focus().setHorizontalRule().run(),
  pageBreak: () => { setActive(body); body.chain().focus().setPageBreak().run() },
  marginDialog: openMarginDialog,
  submit: () => doSubmit(),
  editHeader: () => editHF('header'),
  editFooter: () => editHF('footer'),
  closeHF: () => closeHF(),
  gotoHeader: () => editHF('header'),
  gotoFooter: () => editHF('footer'),
  student: async () => { if (await askName({ allowGuest: false, cancellable: true })) { saveNow(); renderStudentChip() } },
  submitSetup: openSetup,
}
$$('[data-act]').forEach((b) => b.addEventListener('click', () => ACTIONS[b.dataset.act]()))

function clip(kind) {
  editor.commands.focus()
  // execCommand vẫn là cách duy nhất để cắt/chép qua nút bấm mà giữ nguyên định dạng
  const ok = document.execCommand(kind)
  if (!ok) toast(`Hãy dùng phím tắt ${kind === 'cut' ? 'Ctrl+X' : 'Ctrl+C'}.`)
}
async function pasteFromButton() {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const html = await (await item.getType('text/html')).text()
        return editor.chain().focus().insertContent(html).run()
      }
      const img = item.types.find((t) => t.startsWith('image/'))
      if (img) return insertImageBlob(await item.getType(img))
      if (item.types.includes('text/plain')) {
        const text = await (await item.getType('text/plain')).text()
        return editor.chain().focus().insertContent(text).run()
      }
    }
  } catch {
    toast('Trình duyệt chặn nút Dán. Hãy dùng phím tắt Ctrl+V.')
  }
}

// ---------------- Hình ảnh ----------------
$('#imageInput').addEventListener('change', (e) => {
  const f = e.target.files[0]
  if (f) insertImageBlob(f)
  e.target.value = ''
})
function insertImageBlob(blob) {
  const reader = new FileReader()
  reader.onload = () => {
    const img = new window.Image()
    img.onload = () => {
      // thu nhỏ ảnh to cho vừa trang
      const max = 450
      const w = Math.min(img.naturalWidth, max)
      const h = Math.round((img.naturalHeight * w) / img.naturalWidth)
      // đang bôi đen chữ: chèn ảnh vào sau phần bôi đen, không thay mất chữ
      const sel = editor.state.selection
      const at = sel.empty ? sel.from : sel.to
      editor.chain().focus().setTextSelection(at).setImage({ src: reader.result, width: w, height: h }).run()
      // chọn luôn ảnh vừa chèn và mở tab Ảnh (giống Word)
      const $pos = editor.state.selection.$from
      const imgPos = $pos.nodeBefore?.type.name === 'image' ? $pos.pos - $pos.nodeBefore.nodeSize : null
      if (imgPos != null) {
        editor.commands.setNodeSelection(imgPos)
        if (!$('#imageTab').classList.contains('hidden')) showTab('image')
      }
    }
    img.src = reader.result
  }
  reader.readAsDataURL(blob)
}

// ---------------- Hộp thoại đoạn văn & lề ----------------
function openParaDialog() {
  const d = $('#paraDialog')
  const type = editor.isActive('heading') ? 'heading' : 'paragraph'
  const a = editor.getAttributes(type)
  const f = $('form', d)
  f.align.value = a.textAlign || 'left'
  f.indentLeft.value = a.indentLeft || 0
  f.indentFirst.value = a.indentFirst || 0
  f.spaceBefore.value = a.spaceBefore || 0
  f.spaceAfter.value = a.spaceAfter || 0
  f.lineHeight.value = a.lineHeight || ''
  d.showModal()
  d.onclose = () => {
    if (d.returnValue !== 'ok') return editor.commands.focus()
    const num = (v) => (parseFloat(v) > 0 ? parseFloat(v) : null)
    editor.chain().focus().setTextAlign(f.align.value).setParagraphFormat({
      indentLeft: num(f.indentLeft.value), indentFirst: num(f.indentFirst.value),
      spaceBefore: num(f.spaceBefore.value), spaceAfter: num(f.spaceAfter.value), lineHeight: f.lineHeight.value || null,
    }).run()
  }
}
function openMarginDialog() {
  closePops()
  const d = $('#marginDialog')
  const f = $('form', d)
  for (const k of ['top', 'bottom', 'left', 'right']) f[k].value = page.margins[k]
  d.showModal()
  d.onclose = () => {
    if (d.returnValue !== 'ok') return
    const m = {}
    for (const k of ['top', 'bottom', 'left', 'right']) m[k] = Math.max(0, parseFloat(f[k].value) || 0)
    setPage({ margins: m })
  }
}
function setPage(patch) {
  page = { ...page, ...patch, margins: { ...page.margins, ...(patch.margins || {}) } }
  applyPage($('#pageWrap'), page)
  scheduleSave()
  updateStatus()
  syncToolbar()
}
$('#marginPop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-margin]')
  if (!b) return
  const [top, bottom, left, right] = b.dataset.margin.split(',').map(Number)
  setPage({ margins: { top, bottom, left, right } })
  closePops()
})
$('#orientPop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-orient]')
  if (b) { setPage({ orientation: b.dataset.orient }); closePops() }
})
$('#sizePop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-size]')
  if (b) { setPage({ size: b.dataset.size }); closePops() }
})

function confirmBox(title, text) {
  const d = $('#confirmDialog')
  $('#confirmTitle').textContent = title
  $('#confirmText').textContent = text
  d.showModal()
  return new Promise((res) => { d.onclose = () => res(d.returnValue === 'ok') })
}

// ---------------- Tìm & thay thế ----------------
function openFind(withReplace) {
  const bar = $('#findbar')
  bar.classList.remove('hidden')
  $('#replaceRow').classList.toggle('hidden', !withReplace)
  const sel = body.state.doc.textBetween(body.state.selection.from, body.state.selection.to)
  if (sel && sel.length < 60) $('#findText').value = sel
  $('#findText').focus()
  $('#findText').select()
  updateFindCount()
}
function updateFindCount(idx) {
  const q = $('#findText').value
  const n = findAll(body.state.doc, q, $('#matchCase').checked).length
  $('#findCount').textContent = !q ? '' : n === 0 ? 'Không thấy' : idx != null && idx >= 0 ? `${idx + 1}/${n}` : `${n} kết quả`
}
$('#findText').addEventListener('input', () => updateFindCount())
$('#matchCase').addEventListener('change', () => updateFindCount())
$('#findText').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); doFindNext() }
})
function doFindNext() {
  const r = findNext(body, $('#findText').value, $('#matchCase').checked)
  updateFindCount(r.index)
  $('#findText').focus()
}
$('#findNext').addEventListener('click', doFindNext)
$('#replaceOne').addEventListener('click', () => {
  const r = replaceCurrent(body, $('#findText').value, $('#replaceText').value, $('#matchCase').checked)
  updateFindCount(r.index)
})
$('#replaceAll').addEventListener('click', () => {
  const n = replaceAll(body, $('#findText').value, $('#replaceText').value, $('#matchCase').checked)
  toast(n ? `Đã thay ${n} chỗ.` : 'Không tìm thấy chữ cần thay.')
  updateFindCount()
})
function closeFind() { $('#findbar').classList.add('hidden'); body.commands.focus() }
$('#closeFind').addEventListener('click', closeFind)

// ---------------- Phím tắt kiểu Word ----------------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#findbar').classList.contains('hidden')) return closeFind()
  if (e.key === 'Escape' && editor !== body) return closeHF()
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return
  const k = e.key.toLowerCase()
  const map = {
    e: () => editor.chain().focus().setTextAlign('center').run(),
    l: () => editor.chain().focus().setTextAlign('left').run(),
    r: () => editor.chain().focus().setTextAlign('right').run(),
    j: () => editor.chain().focus().setTextAlign('justify').run(),
    f: () => openFind(false),
    h: () => openFind(true),
    s: saveDocx,
    o: () => $('#openInput').click(),
    p: () => window.print(),
    y: () => editor.chain().focus().redo().run(),
    ']': () => stepSize(1),
    '[': () => stepSize(-1),
  }
  if (e.shiftKey || !map[k]) return
  e.preventDefault()
  map[k]()
})

// ---------------- Đồng bộ trạng thái nút ----------------
function syncToolbar() {
  for (const [cmd, name] of [['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'], ['strike', 'strike'], ['subscript', 'subscript'], ['superscript', 'superscript']]) {
    $(`[data-cmd="${cmd}"]`)?.classList.toggle('on', editor.isActive(name))
  }
  const type = editor.isActive('heading') ? 'heading' : 'paragraph'
  const pa = editor.getAttributes(type)
  $$('[data-align]').forEach((b) => b.classList.toggle('on', (pa.textAlign || 'left') === b.dataset.align))
  $('[data-act="bullet"]').classList.toggle('on', editor.isActive('bulletList'))
  $('[data-act="ordered"]').classList.toggle('on', editor.isActive('orderedList'))
  $('[data-style="p"]').classList.toggle('on', editor.isActive('paragraph'))
  $('[data-style="h1"]').classList.toggle('on', editor.isActive('heading', { level: 1 }))
  $('[data-style="h2"]').classList.toggle('on', editor.isActive('heading', { level: 2 }))
  const ts = editor.getAttributes('textStyle')
  const fam = (ts.fontFamily || DEFAULTS.fontFamily).replace(/["']/g, '').split(',')[0].trim()
  const fs = $('#fontFamily')
  if (!FONTS.includes(fam) && ![...fs.options].some((o) => o.value === fam)) fs.add(new Option(fam))
  fs.value = fam
  const size = String(parseFloat(ts.fontSize) || DEFAULTS.fontSize)
  const ss = $('#fontSize')
  if (![...ss.options].some((o) => o.value === size)) ss.add(new Option(size))
  ss.value = size
  $('#lineHeight').value = pa.lineHeight || ''
  $('[data-cmd="undo"]').disabled = !editor.can().undo()
  $('[data-cmd="redo"]').disabled = !editor.can().redo()
  // tab Bảng theo ngữ cảnh
  const inTable = editor.isActive('table')
  $('#tableTab').classList.toggle('hidden', !inTable || +$('#level').value < 6)
  if (!inTable && $('#tableTab').classList.contains('active')) showTab('home')
  const img = selectedImage()
  $('#imageTab').classList.toggle('hidden', !img || +$('#level').value < 5)
  if (img) $$('[data-wrap]').forEach((b) => b.classList.toggle('on', (img.attrs.wrap || 'inline') === b.dataset.wrap))
  if (!img && $('#imageTab').classList.contains('active')) showTab('home')
  $('#titlePage').checked = !!page.titlePage
}

// ---------------- Thanh trạng thái, thu phóng ----------------
function updateStatus() {
  const text = body.state.doc.textBetween(0, body.state.doc.content.size, ' ', ' ')
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  $('#wordInfo').textContent = `${words} từ`
  scheduleLayout()
}

// ---------------- Chia trang, vẽ tờ giấy, đầu/chân trang ----------------
let pageCount = 1
let layoutQueued = false
let printGap = null // khi in: các tờ sát nhau, không có khoảng xám
function scheduleLayout() {
  if (layoutQueued) return
  layoutQueued = true
  requestAnimationFrame(() => {
    layoutQueued = false
    layout()
  })
}
function layout() {
  const gap = printGap ?? PAGE_GAP
  const g = geometry(page)
  const wrap = $('#pageWrap')
  wrap.style.setProperty('--gap', `${gap}px`)
  pageCount = repaginate(body, page, gap)
  const stride = g.H + gap
  $('#page').style.minHeight = `${pageCount * stride - gap}px`
  wrap.style.setProperty('--pages-str', `"${pageCount}"`)
  wrap.classList.toggle('title-page', !!page.titlePage)
  // vẽ đủ số tờ giấy, mỗi tờ có bản sao đầu trang / chân trang
  const sheets = $('#sheets')
  while (sheets.children.length < pageCount) {
    const sh = document.createElement('div')
    sh.className = 'sheet'
    sh.innerHTML = '<div class="hf-clone hf-clone-h tiptap"></div><div class="hf-clone hf-clone-f tiptap"></div>'
    sheets.appendChild(sh)
  }
  while (sheets.children.length > pageCount) sheets.lastChild.remove()
  const hHtml = header.isEmpty ? '' : header.getHTML()
  const fHtml = footer.isEmpty ? '' : footer.getHTML()
  ;[...sheets.children].forEach((sh, i) => {
    const show = i > 0 && !(page.titlePage && i === 0)
    fillClone($('.hf-clone-h', sh), show ? hHtml : '', i + 1)
    fillClone($('.hf-clone-f', sh), show ? fHtml : '', i + 1)
  })
  $('#pageInfo').textContent = `${pageCount} trang`
}
function fillClone(el, html, n) {
  if (el.dataset.src === html + n + pageCount) return
  el.dataset.src = html + n + pageCount
  el.innerHTML = html
  el.querySelectorAll('[data-page-number="current"]').forEach((s) => (s.dataset.n = n))
}
new ResizeObserver(scheduleLayout).observe($('#editor'))
window.addEventListener('beforeprint', () => { printGap = 0; layout() })
window.addEventListener('afterprint', () => { printGap = null; layout() })

// ---------------- Chế độ sửa đầu trang / chân trang ----------------
function setActive(ed) {
  if (editor === ed) return
  editor = ed
  const hfMode = ed !== body
  $('#pageWrap').classList.toggle('hf-editing', hfMode)
  $('#hfTab').classList.toggle('hidden', !hfMode)
  if (hfMode) showTab('hf')
  else if ($('#hfTab').classList.contains('active')) showTab('home')
  syncToolbar()
}
function editHF(which) {
  const ed = which === 'footer' ? footer : header
  setActive(ed)
  showTab('hf')
  ed.commands.focus('end')
}
function closeHF() {
  setActive(body)
  body.commands.focus()
}
$('#hfHeader').addEventListener('mousedown', (e) => { if (editor !== header) { e.preventDefault(); editHF('header') } })
$('#hfFooter').addEventListener('mousedown', (e) => { if (editor !== footer) { e.preventDefault(); editHF('footer') } })
$('#sheets').addEventListener('dblclick', (e) => {
  if (e.target.closest('.hf-clone-h')) editHF('header')
  else if (e.target.closest('.hf-clone-f')) editHF('footer')
})
$('#editor').addEventListener('mousedown', () => { if (editor !== body) setActive(body) })
function insertPageNumber(where, align, kind = 'current') {
  const ed = where === 'footer' ? footer : header
  setActive(ed)
  const nodes = kind === 'of'
    ? [{ type: 'text', text: 'Trang ' }, { type: 'pageNumber', attrs: { kind: 'current' } }, { type: 'text', text: '/' }, { type: 'pageNumber', attrs: { kind: 'total' } }]
    : [{ type: 'pageNumber', attrs: { kind: 'current' } }]
  const para = { type: 'paragraph', attrs: { textAlign: align }, content: nodes }
  if (ed.isEmpty) ed.commands.setContent({ type: 'doc', content: [para] })
  else ed.commands.insertContentAt(ed.state.doc.content.size, para)
  ed.commands.focus('end')
  closePops()
}
$('#pageNumPop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pn]')
  if (!b) return
  const [where, align, kind] = b.dataset.pn.split(',')
  insertPageNumber(where, align, kind)
})
$('#titlePage').addEventListener('change', (e) => setPage({ titlePage: e.target.checked }))

// ---------------- Kiểu danh sách ----------------
function setListStyle(kind, style) {
  const typeName = kind === 'bullet' ? 'bulletList' : 'orderedList'
  if (!editor.isActive(typeName)) (kind === 'bullet' ? editor.chain().focus().toggleBulletList() : editor.chain().focus().toggleOrderedList()).run()
  const { state, view } = editor
  const $f = state.selection.$from
  for (let d = $f.depth; d > 0; d--) {
    const n = $f.node(d)
    if (n.type.name === typeName) {
      view.dispatch(state.tr.setNodeMarkup($f.before(d), undefined, { ...n.attrs, listStyle: style }))
      break
    }
  }
  editor.commands.focus()
  closePops()
}
$('#bulletPop').innerHTML = `<div class="list-styles">${Object.entries(BULLET_STYLES).map(([k, v]) => `<button data-ls="bullet,${k}" title="${v.name}"><span class="ls-glyph">${v.glyph}</span><span class="ls-lines"></span></button>`).join('')}</div>`
$('#numberPop').innerHTML = `<div class="list-styles">${Object.entries(NUMBER_STYLES).map(([k, v]) => `<button data-ls="ordered,${k}" title="${v.name}"><span class="ls-sample">${v.sample.split(' ').join('<br>')}</span></button>`).join('')}</div>`
for (const id of ['#bulletPop', '#numberPop']) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('[data-ls]')
    if (b) setListStyle(...b.dataset.ls.split(','))
  })
}

// ---------------- Ảnh: bố trí và kích thước ----------------
// Đổi thuộc tính ảnh rồi chọn lại ảnh (đổi thuộc tính làm mất vùng chọn → tab Ảnh sẽ biến mất)
function updateImage(attrs) {
  const pos = editor.state.selection.from
  // chuyển sang “sau chữ / trước chữ”: giữ ảnh đứng nguyên chỗ cũ trên trang
  if (FREE_WRAPS.includes(attrs.wrap)) {
    const cur = selectedImage()
    const dom = editor.view.nodeDOM(pos)
    const anchor = dom?.parentElement
    if (cur && dom && anchor && !FREE_WRAPS.includes(cur.attrs.wrap)) {
      const zoom = parseFloat(getComputedStyle($('#pageWrap')).zoom) || 1
      const a = anchor.getBoundingClientRect()
      const r = dom.getBoundingClientRect()
      attrs = { ...attrs, posX: Math.round((r.left - a.left) / zoom), posY: Math.round((r.top - a.top) / zoom) }
    }
  }
  editor.chain().focus().updateAttributes('image', attrs).setNodeSelection(pos).run()
}
function selectedImage() {
  const sel = editor.state.selection
  return sel.node?.type.name === 'image' ? sel.node : null
}
$$('[data-wrap]').forEach((b) => b.addEventListener('click', () => {
  if (selectedImage()) updateImage({ wrap: b.dataset.wrap })
}))
$$('[data-imgsize]').forEach((b) => b.addEventListener('click', () => {
  const img = selectedImage()
  if (!img) return
  const g = geometry(page)
  const w = Math.round((g.W - g.left - g.right) * parseFloat(b.dataset.imgsize))
  const ratio = img.attrs.width && img.attrs.height ? img.attrs.height / img.attrs.width : 0.75
  updateImage({ width: w, height: Math.round(w * ratio) })
}))
$('#zoom').addEventListener('input', (e) => {
  $('#pageWrap').style.zoom = e.target.value / 100
  $('#zoomVal').textContent = `${e.target.value}%`
})

// ---------------- Mở / lưu tệp .docx ----------------
async function saveDocx() {
  toast('Đang tạo tệp .docx…')
  const { exportDocx } = await import('./export-docx.js')
  const blob = await exportDocx(body.getJSON(), page, DEFAULTS, hfJSON())
  const name = ($('#fileName').value.trim() || 'van-ban').replace(/[\\/:*?"<>|]/g, '')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  toast(`Đã lưu “${name}.docx” vào thư mục Tải về.`)
}
$('#openInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  try {
    const mammoth = (await import('mammoth/mammoth.browser.js')).default
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })
    if (currentLesson) closeLesson()
    body.commands.setContent(value || '<p></p>')
    header.commands.clearContent()
    footer.commands.clearContent()
    $('#fileName').value = f.name.replace(/\.docx$/i, '')
    toast('Đã mở tệp. Lưu ý: một số định dạng (màu, cỡ chữ, lề) có thể không giữ được.')
  } catch (err) {
    console.error(err)
    toast('Không mở được tệp này. Chỉ mở được tệp .docx.')
  }
})

// ---------------- Bài tập ----------------
function renderLessonList() {
  const lv = +$('#level').value
  const groups = {}
  for (const l of LESSONS) {
    if (lv !== 9 && l.lop !== lv) continue
    ;(groups[`Lớp ${l.lop} — ${l.bai}`] ||= []).push(l)
  }
  const done = storage.get(DONE()) || {}
  $('#lessonList').innerHTML =
    Object.entries(groups).map(([g, ls]) => `<div class="lgroup"><div class="lgroup-title">${g}</div>${ls.map((l) => `<button class="lesson-item" data-id="${l.id}"><span>${l.vanDung ? '<span class="vd-tag">Vận dụng</span> ' : ''}${l.title}</span>${done[l.id] ? '<span class="done">✓</span>' : ''}</button>`).join('')}</div>`).join('') ||
    '<p class="muted">Chưa có bài tập cho mức này.</p>'
  $('#lessonList').insertAdjacentHTML('beforeend', `<div class="lesson-foot"><button id="loadLessonFile">Mở đề bài từ tệp (.json)…</button><input type="file" id="lessonFile" accept=".json" hidden></div>`)
  $('#loadLessonFile').onclick = () => $('#lessonFile').click()
  $('#lessonFile').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text())
      const list = Array.isArray(data) ? data : [data]
      for (const l of list) { if (!LESSONS.find((x) => x.id === l.id)) LESSONS.push(l) }
      toast(`Đã thêm ${list.length} đề bài.`)
      renderLessonList()
    } catch { toast('Tệp đề bài không đúng định dạng.') }
  }
}
$('#lessonList').addEventListener('click', (e) => {
  const b = e.target.closest('.lesson-item')
  if (b) openLesson(LESSONS.find((l) => l.id === b.dataset.id))
})
$('#toggleLessons').addEventListener('click', () => {
  $('#lessons').classList.toggle('hidden')
  if (!$('#lessons').classList.contains('hidden')) renderLessonList()
})
$('#closeLessons').addEventListener('click', () => $('#lessons').classList.add('hidden'))
$('#level').addEventListener('change', () => { if (!currentLesson) renderLessonList() })

function openLesson(l) {
  saveNow()
  currentLesson = l
  if (+$('#level').value !== 9 && +$('#level').value < l.lop) setLevel(l.lop)
  lessonHF = { header: l.startHeader, footer: l.startFooter, page: l.startPage }
  loadDoc(docKey(), l.start, l.title)
  lessonHF = null
  $('#lessonList').classList.add('hidden')
  const v = $('#lessonView')
  v.classList.remove('hidden')
  v.innerHTML = examMode
    ? `
    <div class="exam-head"><span>BÀI KIỂM TRA</span><span class="exam-clock" id="examClock">--:--</span></div>
    <div class="lesson-bai">Lớp ${l.lop} · ${l.bai}</div>
    <h3>${l.title}</h3>
    <p>${l.intro}</p>
    ${l.show ? `<div class="sample"><div class="sample-label">Mẫu</div>${l.show}</div>` : ''}
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
    ${l.show ? `<div class="sample"><div class="sample-label">Mẫu</div>${l.show}</div>` : ''}
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
    if (!(await confirmBox('Làm lại', 'Xoá bài đang làm và bắt đầu lại?'))) return
    storage.del(docKey())
    lessonHF = { header: l.startHeader, footer: l.startFooter, page: l.startPage }
    loadDoc(docKey(), l.start, l.title)
    lessonHF = null
    $$('.steps li').forEach((li) => li.classList.remove('ok', 'bad'))
    $('#score').textContent = ''
  }
  $('#checkLesson').onclick = runCheck
}
function runCheck() {
  const l = currentLesson
  const res = checkExercise(l, body.getJSON(), page, hfJSON())
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
  loadDoc(FREE(), '<p></p>', 'Văn bản của em')
}

// ---------------- Nộp bài ----------------
let submitCfg = loadSubmitConfig()
// ẩn địa chỉ nộp bài khỏi thanh địa chỉ sau khi đã nhớ
const examCfg = examFromUrl()
if (location.search) history.replaceState(null, '', location.pathname)

function renderStudentChip() {
  renderUserChip()
  const chip = $('#studentChip')
  if (!chip) return
  const st = getStudent()
  chip.innerHTML = st ? 'Em: <b></b> · <span></span>' : '<span class="muted">Chưa có tên (đang dùng thử)</span>'
  if (st) {
    $('b', chip).textContent = st.hoTen
    $('span', chip).textContent = st.lop
  }
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
  const what = currentLesson ? `bài “${currentLesson.title}”` : 'văn bản này'
  if (!auto && !(await confirmBox('Nộp bài', `${st.hoTen} (${st.lop}) nộp ${what} cho thầy cô?${examMode ? ' Bài kiểm tra chỉ được nộp một lần.' : ''}`))) return
  sending = true
  const btns = $$('[data-act="submit"], #submitLesson')
  btns.forEach((b) => (b.disabled = true))
  toast('Đang nộp bài…')
  try {
    saveNow()
    const results = currentLesson ? runCheck() : null
    const { exportDocx } = await import('./export-docx.js')
    const docxBlob = await exportDocx(body.getJSON(), page, DEFAULTS, hfJSON())
    const lesson = currentLesson && examMode ? { ...currentLesson, id: `${currentLesson.id}:kt`, bai: `KIỂM TRA · ${currentLesson.bai}` } : currentLesson
    const r = await submit(submitCfg, st, { lesson, results, docxBlob, fileName: $('#fileName').value.trim() || 'van-ban' })
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
    try {
      await navigator.clipboard.writeText($('#studentLink').value)
      $('#copyLink').textContent = 'Đã chép ✓'
    } catch {
      $('#studentLink').select()
    }
    setTimeout(() => ($('#copyLink').textContent = 'Sao chép'), 1500)
  }
  $('#testSubmit').onclick = async () => {
    const url = f.url.value.trim()
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) {
      $('#testResult').textContent = '✗ Địa chỉ phải bắt đầu bằng https://script.google.com/'
      return
    }
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

function hfJSON() {
  return { header: header.isEmpty ? null : header.getJSON(), footer: footer.isEmpty ? null : footer.getJSON() }
}

// ---------------- Thông báo ----------------
let toastTimer
function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500)
}

// ---------------- Khởi động ----------------
// ---------------- Chế độ kiểm tra ----------------
let examMode = null // { lesson, minutes, submitted, stop }
function startExam(cfg) {
  const l = LESSONS.find((x) => x.id === cfg.lessonId)
  if (!l) return toast('Link kiểm tra không đúng (không tìm thấy bài).')
  if (!submitCfg?.url) toast('Chưa có địa chỉ nộp bài: hãy mở đúng link kiểm tra thầy cô gửi.')
  examMode = { lesson: l, minutes: cfg.minutes, submitted: false }
  document.body.classList.add('exam-mode')
  $('#lessons').classList.remove('hidden')
  openLesson(l)
  const st = examState('word', l.id)
  if (st.submittedAt) return finishExam(st.submittedAt)
  examMode.stop = startCountdown($('#examClock'), st.start + cfg.minutes * 60000, () => {
    toast('Hết giờ! Máy đang tự nộp bài…')
    doSubmit({ auto: true })
  })
}
function finishExam(at) {
  const st = at ? { submittedAt: at } : markExamSubmitted('word', examMode.lesson.id)
  examMode.submitted = true
  examMode.stop?.()
  saveNow()
  body.setEditable(false)
  header.setEditable(false)
  footer.setEditable(false)
  const t = new Date(st.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  lockScreen(`Em đã nộp bài lúc ${t}. Chờ thầy cô hướng dẫn nhé.`)
}

// ---------------- Khởi động ----------------
setLevel(storage.get('stt:level') ?? 6)
syncToolbar()
window.addEventListener('beforeunload', () => { if (!examMode?.submitted) saveNow() })
initSession({
  exam: examCfg,
  onEndRequest: async () => {
    saveNow()
    const u = getStudent()
    return confirmBox('Đổi người dùng', u ? `Kết thúc buổi học của ${u.hoTen}? Bài của em đã được lưu.` : 'Kết thúc phiên dùng thử? Bài làm thử sẽ bị xoá.')
  },
  onChange: () => {
    currentLesson = null
    $('#lessonView').classList.add('hidden')
    $('#lessonList').classList.remove('hidden')
    if (!$('#lessons').classList.contains('hidden')) renderLessonList()
    loadDoc(FREE(), '<p></p>', 'Văn bản của em')
  },
}).then(() => {
  loadDoc(FREE(), '<p></p>', 'Văn bản của em')
  if (examCfg) startExam(examCfg)
})
