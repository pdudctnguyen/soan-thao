import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Subscript from './subsup.js'
import { ParagraphFormat } from './extensions.js'
import { findNext, replaceAll, replaceCurrent, findAll } from './find-replace.js'
import { PAGE_SIZES, DEFAULT_PAGE, applyPage } from './page.js'
import { LESSONS } from './lessons.js'
import { checkExercise, DEFAULT_RUN } from './checker.js'

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
const docKey = () => (currentLesson ? `stt:ex:${currentLesson.id}` : 'stt:free')

// ---------------- Trình soạn thảo ----------------
const editor = new Editor({
  element: $('#editor'),
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
    TextStyle, Color, FontFamily, FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ inline: true, allowBase64: true, resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 30, minHeight: 30 } }),
    Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
    ...Subscript,
    ParagraphFormat,
  ],
  content: '<p></p>',
  autofocus: true,
  onUpdate: () => { scheduleSave(); updateStatus() },
  onSelectionUpdate: () => syncToolbar(),
  onTransaction: () => syncToolbar(),
})
window.editor = editor // tiện kiểm tra trong DevTools

// ---------------- Lưu tạm tự động ----------------
let saveTimer
function scheduleSave() {
  $('#saveState').textContent = 'Đang lưu…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 600)
}
function saveNow() {
  storage.set(docKey(), { doc: editor.getJSON(), page, name: $('#fileName').value })
  $('#saveState').textContent = 'Đã lưu tạm'
}
function loadDoc(key, fallbackHtml, fallbackName) {
  const saved = storage.get(key)
  if (saved?.doc) {
    editor.commands.setContent(saved.doc, { emitUpdate: false })
    page = saved.page || structuredClone(DEFAULT_PAGE)
    $('#fileName').value = saved.name || fallbackName
  } else {
    editor.commands.setContent(fallbackHtml || '<p></p>', { emitUpdate: false })
    page = structuredClone(DEFAULT_PAGE)
    $('#fileName').value = fallbackName
  }
  editor.commands.focus('end')
  applyPage($('#page'), page)
  updateStatus()
}
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
    storage.del('stt:free')
    loadDoc('stt:free', '<p></p>', 'Văn bản của em')
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
  find: () => openFind(false),
  replace: () => openFind(true),
  image: () => $('#imageInput').click(),
  hr: () => editor.chain().focus().setHorizontalRule().run(),
  marginDialog: openMarginDialog,
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
      editor.chain().focus().setImage({ src: reader.result, width: w, height: h }).run()
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
  applyPage($('#page'), page)
  scheduleSave()
  updateStatus()
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
  const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
  if (sel && sel.length < 60) $('#findText').value = sel
  $('#findText').focus()
  $('#findText').select()
  updateFindCount()
}
function updateFindCount(idx) {
  const q = $('#findText').value
  const n = findAll(editor.state.doc, q, $('#matchCase').checked).length
  $('#findCount').textContent = !q ? '' : n === 0 ? 'Không thấy' : idx != null && idx >= 0 ? `${idx + 1}/${n}` : `${n} kết quả`
}
$('#findText').addEventListener('input', () => updateFindCount())
$('#matchCase').addEventListener('change', () => updateFindCount())
$('#findText').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); doFindNext() }
})
function doFindNext() {
  const r = findNext(editor, $('#findText').value, $('#matchCase').checked)
  updateFindCount(r.index)
  $('#findText').focus()
}
$('#findNext').addEventListener('click', doFindNext)
$('#replaceOne').addEventListener('click', () => {
  const r = replaceCurrent(editor, $('#findText').value, $('#replaceText').value, $('#matchCase').checked)
  updateFindCount(r.index)
})
$('#replaceAll').addEventListener('click', () => {
  const n = replaceAll(editor, $('#findText').value, $('#replaceText').value, $('#matchCase').checked)
  toast(n ? `Đã thay ${n} chỗ.` : 'Không tìm thấy chữ cần thay.')
  updateFindCount()
})
function closeFind() { $('#findbar').classList.add('hidden'); editor.commands.focus() }
$('#closeFind').addEventListener('click', closeFind)

// ---------------- Phím tắt kiểu Word ----------------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#findbar').classList.contains('hidden')) return closeFind()
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
}

// ---------------- Thanh trạng thái, thu phóng ----------------
function updateStatus() {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' ')
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  $('#wordInfo').textContent = `${words} từ`
  requestAnimationFrame(() => {
    const el = $('#page')
    const pageH = parseFloat(getComputedStyle(el).getPropertyValue('--page-h-px')) || cmPx(el)
    const pages = Math.max(1, Math.ceil(el.scrollHeight / pageH - 0.001))
    el.style.setProperty('--pages', pages)
    $('#pageInfo').textContent = `${pages} trang`
  })
}
function cmPx(el) {
  const probe = document.createElement('div')
  probe.style.height = 'var(--page-h)'
  probe.style.position = 'absolute'
  el.appendChild(probe)
  const h = probe.offsetHeight
  probe.remove()
  return h
}
$('#zoom').addEventListener('input', (e) => {
  $('#pageWrap').style.zoom = e.target.value / 100
  $('#zoomVal').textContent = `${e.target.value}%`
})

// ---------------- Mở / lưu tệp .docx ----------------
async function saveDocx() {
  toast('Đang tạo tệp .docx…')
  const { exportDocx } = await import('./export-docx.js')
  const blob = await exportDocx(editor.getJSON(), page, DEFAULTS)
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
    editor.commands.setContent(value || '<p></p>')
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
  const done = storage.get('stt:done') || {}
  $('#lessonList').innerHTML =
    Object.entries(groups).map(([g, ls]) => `<div class="lgroup"><div class="lgroup-title">${g}</div>${ls.map((l) => `<button class="lesson-item" data-id="${l.id}"><span>${l.title}</span>${done[l.id] ? '<span class="done">✓</span>' : ''}</button>`).join('')}</div>`).join('') ||
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
  loadDoc(docKey(), l.start, l.title)
  $('#lessonList').classList.add('hidden')
  const v = $('#lessonView')
  v.classList.remove('hidden')
  v.innerHTML = `
    <button class="back" id="backToList">‹ Danh sách bài</button>
    <div class="lesson-bai">Lớp ${l.lop} · ${l.bai}</div>
    <h3>${l.title}</h3>
    <p>${l.intro}</p>
    ${l.show ? `<div class="sample"><div class="sample-label">Mẫu</div>${l.show}</div>` : ''}
    <ol class="steps">${l.steps.map((s, i) => `<li data-i="${i}"><span class="mark"></span><div><div>${s.text}</div><div class="hint-text"></div></div></li>`).join('')}</ol>
    <div class="score" id="score"></div>
    <div class="lesson-actions">
      <button id="resetLesson">Làm lại từ đầu</button>
      <button id="checkLesson" class="btn-primary">Kiểm tra</button>
    </div>`
  $('#backToList').onclick = closeLesson
  $('#resetLesson').onclick = async () => {
    if (!(await confirmBox('Làm lại', 'Xoá bài đang làm và bắt đầu lại?'))) return
    storage.del(docKey())
    loadDoc(docKey(), l.start, l.title)
    $$('.steps li').forEach((li) => li.classList.remove('ok', 'bad'))
    $('#score').textContent = ''
  }
  $('#checkLesson').onclick = runCheck
}
function runCheck() {
  const l = currentLesson
  const res = checkExercise(l, editor.getJSON(), page)
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
    const done = storage.get('stt:done') || {}
    done[l.id] = true
    storage.set('stt:done', done)
  }
}
function closeLesson() {
  saveNow()
  currentLesson = null
  $('#lessonView').classList.add('hidden')
  $('#lessonList').classList.remove('hidden')
  renderLessonList()
  loadDoc('stt:free', '<p></p>', 'Văn bản của em')
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
setLevel(storage.get('stt:level') ?? 6)
loadDoc('stt:free', '<p></p>', 'Văn bản của em')
syncToolbar()
window.addEventListener('beforeunload', saveNow)
