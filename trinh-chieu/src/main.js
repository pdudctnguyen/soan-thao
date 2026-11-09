import '../../src/style.css'
import './slides.css'
import { Editor } from '@tiptap/core'
import {
  W, H, LAYOUTS, THEMES, SHAPES, TRANSITIONS, DIRS, ANIMS, ANIM_STARTS, PROMPTS, textExtensions, theme, uid,
  newSlide, newDeck, changeLayout, emptyDoc, isEmptyDoc, isBody, defaultSize, defaultFont, normalizeDeck, imageRefs,
} from './model.js'
import { renderSlide, decoLayer, hfLayer, applyTextBase, objClasses, placeObj, fillObjVisual, svgShape, fontCss } from './render.js'
import { putImage, imageUrl, preload, gc, fileToDataUrl, imageSize } from './imgstore.js'
import { animBadges } from './anim.js'
import { startShow, previewAnims, previewTransition } from './show.js'
import { BULLET_STYLES, NUMBER_STYLES } from '../../src/extensions.js'
import { LESSONS } from './lessons.js'
import { CLIPART } from './clipart.js'
import { checkExercise } from './checker.js'
import { loadSubmitConfig, saveSubmitConfig, studentLink, getStudent, submit } from '../../src/submit.js'
import { userKey, examFromUrl, examLink, examState, markExamSubmitted } from '../../src/session.js'
import { initSession, askName, renderUserChip, lockScreen, startCountdown } from '../../src/session-ui.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const FONTS = ['Calibri', 'Calibri Light', 'Arial', 'Times New Roman', 'Tahoma', 'Verdana', 'Cambria', 'Georgia', 'Segoe UI', 'Trebuchet MS', 'Comic Sans MS']
const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 50, 54, 60, 66, 72, 80, 88, 96]
const COLORS = [
  ['#000000', 'Đen'], ['#7f7f7f', 'Xám'], ['#ffffff', 'Trắng'], ['#c00000', 'Đỏ đậm'], ['#ff0000', 'Đỏ'], ['#ffc000', 'Cam'],
  ['#ffff00', 'Vàng'], ['#92d050', 'Xanh lá nhạt'], ['#00b050', 'Xanh lá'], ['#00b0f0', 'Xanh da trời'], ['#0070c0', 'Xanh dương'],
  ['#002060', 'Xanh đậm'], ['#7030a0', 'Tím'], ['#ff66cc', 'Hồng'],
]
const BGS = [
  ['#ffffff', 'Trắng'], ['#f2f2f2', 'Xám rất nhạt'], ['#fff2cc', 'Vàng nhạt'], ['#fce4d6', 'Cam nhạt'], ['#e2efda', 'Xanh lá nhạt'],
  ['#ddebf7', 'Xanh nhạt'], ['#e4dfec', 'Tím nhạt'], ['#fde9f1', 'Hồng nhạt'], ['#c6efce', 'Xanh bạc hà'], ['#bdd7ee', 'Xanh da trời'],
  ['#ffe699', 'Vàng'], ['#002060', 'Xanh đậm'], ['#1f3864', 'Xanh đêm'], ['#000000', 'Đen'],
]
const storage = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false }
  },
  del(k) { try { localStorage.removeItem(k) } catch { /* bỏ qua */ } },
}
const clone = (x) => JSON.parse(JSON.stringify(x))
const PX_CM = 96 / 2.54

// ================= Trạng thái =================
let deck = newDeck()
let cur = 0 // trang đang chọn
let selId = null // đối tượng đang chọn
let editId = null // đối tượng đang gõ chữ
let currentLesson = null
const editors = new Map()
let scale = 1
const slide = () => deck.slides[cur]
const objById = (id, s = slide()) => s?.objs.find((o) => o.id === id)
const selObj = () => (selId ? objById(selId) : null)
window.deck = () => deck

// ================= Hoàn tác =================
let undoStack = []
let redoStack = []
let lastTextSnap = 0
let lastTextObj = null
function snapshot() {
  undoStack.push(JSON.stringify({ deck, cur }))
  if (undoStack.length > 80) undoStack.shift()
  redoStack = []
}
function textSnapshot(id) {
  const now = Date.now()
  if (now - lastTextSnap > 1200 || lastTextObj !== id) snapshot()
  lastTextSnap = now
  lastTextObj = id
}
function restore(json) {
  const st = JSON.parse(json)
  deck = st.deck
  cur = Math.min(st.cur, deck.slides.length - 1)
  selId = null
  editId = null
  rebuildAll()
  scheduleSave()
}
function undo() {
  if (!undoStack.length) return
  redoStack.push(JSON.stringify({ deck, cur }))
  restore(undoStack.pop())
  lastTextObj = null
}
function redo() {
  if (!redoStack.length) return
  undoStack.push(JSON.stringify({ deck, cur }))
  restore(redoStack.pop())
}

// ================= Trang đang soạn =================
const holder = $('#holder')
const stage = $('#stage')
let slideEl = null
let frame = null

function destroyEditors() {
  for (const ed of editors.values()) ed.destroy()
  editors.clear()
}
function fitStage() {
  const r = stage.getBoundingClientRect()
  scale = Math.max(0.15, Math.min((r.width - 48) / W, (r.height - 40) / H))
  holder.style.width = `${W * scale}px`
  holder.style.height = `${H * scale}px`
  if (slideEl) {
    slideEl.style.transform = `scale(${scale})`
    slideEl.style.setProperty('--s', scale)
  }
}
new ResizeObserver(fitStage).observe(stage)

function buildStage() {
  destroyEditors()
  holder.innerHTML = ''
  const s = slide()
  const th = theme(deck)
  slideEl = document.createElement('div')
  slideEl.className = 'slide edit'
  slideEl.style.width = `${W}px`
  slideEl.style.height = `${H}px`
  slideEl.style.background = s.bg || th.bg
  slideEl.appendChild(decoLayer(th, s.layout))
  s.objs.forEach((o, z) => slideEl.appendChild(buildObjEl(o, z)))
  slideEl.appendChild(hfLayer(deck, s, cur))
  frame = document.createElement('div')
  frame.className = 'sel-frame hidden'
  frame.innerHTML = ['t', 'r', 'b', 'l'].map((e) => `<div class="sel-edge e-${e}"></div>`).join('') + ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<div class="sel-h h-${h}" data-h="${h}"></div>`).join('')
  slideEl.appendChild(frame)
  holder.appendChild(slideEl)
  fitStage()
  if (selId && !objById(selId)) selId = null
  if (editId && !objById(editId)) editId = null
  updateFrame()
  renderBadges()
  syncToolbar()
  $('#slideInfo').textContent = `Trang ${cur + 1}/${deck.slides.length}`
}

function buildObjEl(o, z) {
  const s = slide()
  const el = document.createElement('div')
  el.className = objClasses(o)
  el.dataset.id = o.id
  placeObj(el, o, z)
  fillObjVisual(el, o)
  if (o.kind !== 'image') {
    const wrap = document.createElement('div')
    wrap.className = `tx-wrap v-${o.valign || (o.kind === 'shape' ? 'middle' : 'top')}`
    el.appendChild(wrap)
    const ed = new Editor({
      element: wrap,
      extensions: textExtensions(),
      content: o.doc,
      editorProps: {
        attributes: { class: 'tx', spellcheck: 'false' },
        handleKeyDown: (view, e) => {
          if (e.key === 'Tab') {
            const ok = e.shiftKey ? ed.commands.liftListItem('listItem') : ed.commands.sinkListItem('listItem')
            if (!ok && !ed.isActive('listItem')) toast('Tab dùng để tăng cấp cho dòng có gạch đầu dòng.')
            return true
          }
          if (e.key === 'Escape') {
            exitEdit()
            return true
          }
          return false
        },
        handleClickOn: (view, pos, node, nodePos, e) => {
          // giữ Ctrl + bấm để mở liên kết khi đang soạn
          const a = e.target.closest?.('a[href]')
          if (a && (e.ctrlKey || e.metaKey)) {
            followLink(a.getAttribute('href'))
            return true
          }
          return false
        },
      },
      onUpdate: ({ editor }) => {
        textSnapshot(o.id)
        o.doc = editor.getJSON()
        el.classList.toggle('empty', o.kind === 'text' && isEmptyDoc(o.doc))
        autoGrow(o, el)
        scheduleSave()
        scheduleThumb(cur)
      },
      onSelectionUpdate: () => syncToolbar(),
      onFocus: () => {
        // làm sau khi trình duyệt xong việc đặt con trỏ, để không mất chữ gõ ngay sau khi bấm
        editId = o.id
        setTimeout(() => {
          if (editId !== o.id) return
          if (selId !== o.id) selectObj(o.id, { keepEdit: true })
          setEdit(o.id)
        }, 0)
      },
    })
    applyTextBase(ed.view.dom, o, deck, s)
    editors.set(o.id, ed)
    if (o.ph) el.style.setProperty('--prompt', JSON.stringify(PROMPTS[o.ph] || ''))
    el.classList.toggle('empty', o.kind === 'text' && isEmptyDoc(o.doc))
  }
  if (o.link) el.classList.add('has-link')
  el.classList.toggle('has-fill', !!(o.fill || o.line))
  return el
}
const objEl = (id) => slideEl?.querySelector(`.obj[data-id="${id}"]`)

// hộp văn bản thường tự cao lên theo chữ (giống PowerPoint)
function autoGrow(o, el) {
  if (o.kind !== 'text' || o.ph || o.autoH === false) return
  const tx = el.querySelector('.tx')
  if (!tx) return
  const need = Math.ceil(tx.offsetHeight + 10)
  if (Math.abs(need - o.h) > 1) {
    o.h = Math.max(30, need)
    el.style.height = `${o.h}px`
    updateFrame()
  }
}
// cập nhật vị trí / hình vẽ của một đối tượng mà không dựng lại
function refreshObj(o) {
  const el = objEl(o.id)
  if (!el) return
  const z = slide().objs.indexOf(o)
  placeObj(el, o, z)
  el.querySelectorAll(':scope > svg.shape-svg, :scope > img').forEach((x) => x.remove())
  el.style.outline = ''
  fillObjVisual(el, o)
  el.classList.toggle('has-link', !!o.link)
  el.classList.toggle('has-fill', !!(o.fill || o.line))
  const wrap = el.querySelector('.tx-wrap')
  if (wrap) wrap.className = `tx-wrap v-${o.valign || (o.kind === 'shape' ? 'middle' : 'top')}`
  updateFrame()
}

// ================= Chọn đối tượng =================
function selectObj(id, { keepEdit = false } = {}) {
  if (!keepEdit && editId && editId !== id) exitEdit(false)
  selId = id
  $$('.obj.selected', slideEl).forEach((e) => e.classList.remove('selected'))
  if (id) objEl(id)?.classList.add('selected')
  updateFrame()
  syncToolbar()
}
function setEdit(id) {
  editId = id
  $$('.obj.editing', slideEl).forEach((e) => e.classList.remove('editing'))
  if (id) objEl(id)?.classList.add('editing')
  updateFrame()
}
function exitEdit(keepSel = true) {
  if (!editId) return
  const ed = editors.get(editId)
  const id = editId
  setEdit(null)
  ed?.commands.blur()
  window.getSelection()?.removeAllRanges()
  if (keepSel) selectObj(id, { keepEdit: true })
}
function deselect() {
  exitEdit(false)
  selectObj(null)
}
function updateFrame() {
  if (!frame) return
  const o = selObj()
  frame.classList.toggle('hidden', !o)
  if (!o) return
  frame.style.left = `${o.x}px`
  frame.style.top = `${o.y}px`
  frame.style.width = `${o.w}px`
  frame.style.height = `${o.h}px`
  frame.classList.toggle('dashed', editId === o.id)
  frame.classList.toggle('img', o.kind === 'image')
  $('#formatTab').classList.remove('hidden')
}

// ================= Chuột trên trang =================
const toSlide = (e) => {
  const r = slideEl.getBoundingClientRect()
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
}
let drawShape = null // đang chờ vẽ hình
holder.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !slideEl) return
  closePops()
  if (drawShape) return startDraw(e)
  const h = e.target.closest('.sel-h')
  if (h) return startResize(e, h.dataset.h)
  if (e.target.closest('.sel-edge')) return startMove(e, selObj())
  const el = e.target.closest('.obj')
  if (!el) {
    if (e.target.closest('.slide')) {
      e.preventDefault()
      deselect()
    }
    return
  }
  const o = objById(el.dataset.id)
  if (!o) return
  if (o.kind === 'text') {
    if (!e.target.closest('.ProseMirror')) {
      e.preventDefault()
      selectObj(o.id, { keepEdit: true })
      editors.get(o.id)?.commands.focus('end')
    }
    return
  }
  if (o.kind === 'shape' && editId === o.id && e.target.closest('.ProseMirror')) return
  e.preventDefault()
  selectObj(o.id)
  startMove(e, o)
})
holder.addEventListener('dblclick', (e) => {
  const el = e.target.closest('.obj')
  const o = el && objById(el.dataset.id)
  if (o?.kind === 'shape') {
    selectObj(o.id)
    setEdit(o.id)
    editors.get(o.id)?.commands.focus('end')
  }
})
function dragLoop(e, onMove, onEnd) {
  const start = toSlide(e)
  let moved = false
  const mm = (ev) => {
    const p = toSlide(ev)
    const dx = p.x - start.x
    const dy = p.y - start.y
    if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return
    if (!moved) {
      moved = true
      snapshot()
    }
    onMove(dx, dy, ev)
  }
  const mu = () => {
    document.removeEventListener('mousemove', mm)
    document.removeEventListener('mouseup', mu)
    if (moved) {
      onEnd?.()
      scheduleSave()
      scheduleThumb(cur)
    }
  }
  document.addEventListener('mousemove', mm)
  document.addEventListener('mouseup', mu)
}
function startMove(e, o) {
  if (!o) return
  e.preventDefault()
  const ox = o.x
  const oy = o.y
  dragLoop(e, (dx, dy, ev) => {
    let nx = Math.round(ox + dx)
    let ny = Math.round(oy + dy)
    if (!ev.altKey) {
      // hút vào giữa trang
      const cx = nx + o.w / 2
      const cy = ny + o.h / 2
      if (Math.abs(cx - W / 2) < 8) nx = Math.round(W / 2 - o.w / 2)
      if (Math.abs(cy - H / 2) < 8) ny = Math.round(H / 2 - o.h / 2)
    }
    o.x = nx
    o.y = ny
    refreshObj(o)
  })
}
function startResize(e, hd) {
  e.preventDefault()
  e.stopPropagation()
  const o = selObj()
  if (!o) return
  const b = { x: o.x, y: o.y, w: o.w, h: o.h }
  const ratio = b.w / b.h
  dragLoop(e, (dx, dy, ev) => {
    let { x, y, w, h } = b
    if (hd.includes('e')) w = b.w + dx
    if (hd.includes('s')) h = b.h + dy
    if (hd.includes('w')) { w = b.w - dx; x = b.x + dx }
    if (hd.includes('n')) { h = b.h - dy; y = b.y + dy }
    const corner = hd.length === 2
    if (corner && (ev.shiftKey || o.kind === 'image')) {
      if (Math.abs(w / b.w) > Math.abs(h / b.h)) h = w / ratio
      else w = h * ratio
      if (hd.includes('w')) x = b.x + b.w - w
      if (hd.includes('n')) y = b.y + b.h - h
    }
    o.w = Math.max(12, Math.round(w))
    o.h = Math.max(12, Math.round(h))
    o.x = Math.round(x)
    o.y = Math.round(y)
    if (o.kind === 'text' && !o.ph) o.autoH = !hd.includes('n') && !hd.includes('s') ? o.autoH : false
    refreshObj(o)
  }, () => syncToolbar())
}
function startDraw(e) {
  e.preventDefault()
  const shape = drawShape
  drawShape = null
  holder.classList.remove('drawing')
  const p0 = toSlide(e)
  const th = theme(deck)
  const o = { id: uid(), kind: 'shape', shape, x: Math.round(p0.x), y: Math.round(p0.y), w: 1, h: 1, fill: th.accent, line: { color: shade(th.accent), w: 1 }, valign: 'middle', align: 'center', doc: emptyDoc(false, 'center') }
  snapshot()
  slide().objs.push(o)
  const el = buildObjEl(o, slide().objs.length - 1)
  slideEl.insertBefore(el, slideEl.querySelector('.hf-layer'))
  selectObj(o.id)
  let moved = false
  const mm = (ev) => {
    const p = toSlide(ev)
    moved = true
    let w = p.x - p0.x
    let h = p.y - p0.y
    if (ev.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m }
    o.x = Math.round(Math.min(p0.x, p0.x + w))
    o.y = Math.round(Math.min(p0.y, p0.y + h))
    o.w = Math.max(4, Math.round(Math.abs(w)))
    o.h = Math.max(4, Math.round(Math.abs(h)))
    refreshObj(o)
  }
  const mu = () => {
    document.removeEventListener('mousemove', mm)
    document.removeEventListener('mouseup', mu)
    if (!moved || o.w < 10 || o.h < 10) {
      o.w = shape === 'rightArrow' ? 220 : 180
      o.h = shape === 'rightArrow' ? 110 : 180
      o.x = Math.round(Math.min(W - o.w, p0.x))
      o.y = Math.round(Math.min(H - o.h, p0.y))
      refreshObj(o)
    }
    buildStage()
    selectObj(o.id)
    scheduleSave()
    scheduleThumb(cur)
  }
  document.addEventListener('mousemove', mm)
  document.addEventListener('mouseup', mu)
}
function shade(hex, k = 0.7) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.round(v * k).toString(16).padStart(2, '0')
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`
}

// ================= Thao tác đối tượng =================
function addObj(o, { edit = false } = {}) {
  snapshot()
  slide().objs.push(o)
  buildStage()
  selectObj(o.id)
  if (edit) editors.get(o.id)?.commands.focus('end')
  scheduleSave()
  scheduleThumb(cur)
}
function deleteObj() {
  const o = selObj()
  if (!o) return
  snapshot()
  slide().objs = slide().objs.filter((x) => x !== o)
  selId = null
  editId = null
  buildStage()
  scheduleSave()
  scheduleThumb(cur)
}
function arrange(kind) {
  const o = selObj()
  if (!o) return toast('Hãy chọn một hình, ảnh hoặc khung chữ trước.')
  const objs = slide().objs
  const i = objs.indexOf(o)
  const j = { forward: Math.min(objs.length - 1, i + 1), backward: Math.max(0, i - 1), front: objs.length - 1, back: 0 }[kind]
  if (i === j) return toast(kind === 'forward' || kind === 'front' ? 'Đối tượng đã ở trên cùng.' : 'Đối tượng đã ở dưới cùng.')
  snapshot()
  objs.splice(i, 1)
  objs.splice(j, 0, o)
  buildStage()
  selectObj(o.id)
  scheduleSave()
  scheduleThumb(cur)
}
function nudge(dx, dy) {
  const o = selObj()
  if (!o) return
  snapshot()
  o.x += dx
  o.y += dy
  refreshObj(o)
  scheduleSave()
  scheduleThumb(cur)
}
let clip = null
function copyObj(cut = false) {
  const o = selObj()
  if (!o) return false
  clip = { kind: 'obj', data: clone(o) }
  if (cut) deleteObj()
  return true
}
function pasteObj() {
  if (clip?.kind !== 'obj') return false
  const o = clone(clip.data)
  o.id = uid()
  delete o.ph
  if (objById(clip.data.id)) {
    o.x += 20
    o.y += 20
    clip.data.x += 20
    clip.data.y += 20
  }
  if (o.anim) delete o.anim
  addObj(o)
  return true
}

// ================= Ảnh, hộp chữ, hình =================
async function insertImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return
  try {
    const url = await fileToDataUrl(file)
    const src = await putImage(url)
    const sz = await imageSize(url)
    const k = Math.min(1, 640 / sz.w, 440 / sz.h)
    const w = Math.round(sz.w * k)
    const h = Math.round(sz.h * k)
    addObj({ id: uid(), kind: 'image', src, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2 + 40), w, h })
    showTab('format')
  } catch (err) {
    console.error(err)
    toast('Không chèn được ảnh này.')
  }
}
$('#imageInput').addEventListener('change', (e) => {
  insertImageFile(e.target.files[0])
  e.target.value = ''
})
$('#clipGrid').innerHTML = Object.entries(CLIPART).map(([k, c]) => `<button data-clip="${k}" title="${c.name}"><img src="${c.src}" alt=""><small>${c.name}</small></button>`).join('')
$('#clipGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-clip]')
  if (!b) return
  closePops()
  addObj({ id: uid(), kind: 'image', src: CLIPART[b.dataset.clip].src, x: 440, y: 230, w: 400, h: 300 })
  showTab('format')
})
function insertTextbox() {
  addObj({ id: uid(), kind: 'text', x: 400, y: 320, w: 480, h: 46, valign: 'top', doc: emptyDoc(false) }, { edit: true })
}

// ================= Liên kết =================
function followLink(href) {
  const m = /^#slide=(\d+)$/.exec(href || '')
  if (m) return goSlide(+m[1] - 1)
  if (href) window.open(/^[a-z]+:/i.test(href) ? href : `https://${href}`, '_blank', 'noopener')
}
function openLinkDialog() {
  const o = selObj()
  if (!o) return toast('Hãy chọn hình / ảnh, hoặc bôi đen chữ cần gắn liên kết.')
  const ed = editors.get(o.id)
  const textMode = ed && editId === o.id && !ed.state.selection.empty
  const d = $('#linkDialog')
  const f = $('form', d)
  f.slide.innerHTML = deck.slides.map((s, i) => `<option value="${i + 1}">Trang ${i + 1}${slideTitle(s) ? ` — ${escapeHtml(slideTitle(s).slice(0, 40))}` : ''}</option>`).join('')
  const curLink = textMode ? ed.getAttributes('link').href : o.link ? (o.link.slide ? `#slide=${o.link.slide}` : o.link.url) : ''
  const sm = /^#slide=(\d+)$/.exec(curLink || '')
  f.kind.value = sm ? 'slide' : 'url'
  f.url.value = sm ? '' : curLink || ''
  if (sm) f.slide.value = sm[1]
  $('#linkNote').textContent = textMode ? 'Gắn liên kết cho phần chữ đang bôi đen.' : `Gắn liên kết cho ${o.kind === 'image' ? 'ảnh' : o.kind === 'shape' ? 'hình' : 'khung chữ'} đang chọn. Khi trình chiếu, bấm vào sẽ mở liên kết.`
  f.url.oninput = () => (f.kind.value = 'url')
  f.slide.onchange = () => (f.kind.value = 'slide')
  d.showModal()
  d.onclose = () => {
    const v = d.returnValue
    if (v === 'cancel' || !v) return
    let href = null
    if (v === 'ok') {
      href = f.kind.value === 'slide' ? `#slide=${f.slide.value}` : f.url.value.trim()
      if (!href) return
      if (f.kind.value === 'url' && !/^[a-z]+:/i.test(href)) href = `https://${href}`
    }
    if (textMode) {
      // onUpdate của trình soạn tự lưu hoàn tác
      if (href) ed.chain().focus().extendMarkRange('link').setLink({ href }).run()
      else ed.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    snapshot()
    o.link = href ? (href.startsWith('#slide=') ? { slide: +href.slice(7) } : { url: href }) : undefined
    if (!o.link) delete o.link
    refreshObj(o)
    scheduleSave()
    toast(href ? 'Đã gắn liên kết. Trình chiếu rồi bấm vào để thử.' : 'Đã bỏ liên kết.')
  }
}

// ================= Đầu trang & chân trang =================
function openHfDialog(focus) {
  const d = $('#hfDialog')
  const f = $('form', d)
  const hf = slide().hf || deck.slides.find((s) => s.hf)?.hf || {}
  f.date.checked = !!hf.date || focus === 'date'
  f.dateMode.value = hf.dateAuto === false ? 'fixed' : 'auto'
  f.dateText.value = hf.dateText || new Date().toLocaleDateString('vi-VN')
  f.num.checked = !!hf.num || focus === 'num'
  f.footer.checked = !!hf.footer
  f.footerText.value = hf.footerText || ''
  f.notOnTitle.checked = !!hf.notOnTitle
  f.footerText.oninput = () => (f.footer.checked = !!f.footerText.value)
  d.showModal()
  d.onclose = () => {
    if (d.returnValue !== 'one' && d.returnValue !== 'all') return
    const v = { date: f.date.checked, dateAuto: f.dateMode.value !== 'fixed', dateText: f.dateText.value.trim(), num: f.num.checked, footer: f.footer.checked, footerText: f.footerText.value.trim(), notOnTitle: f.notOnTitle.checked }
    const empty = !v.date && !v.num && !(v.footer && v.footerText)
    snapshot()
    const targets = d.returnValue === 'all' ? deck.slides : [slide()]
    for (const s of targets) s.hf = empty ? null : { ...v }
    rebuildAll()
    scheduleSave()
  }
}

// ================= Trang chiếu =================
function goSlide(i) {
  i = Math.max(0, Math.min(deck.slides.length - 1, i))
  if (i === cur && slideEl) return
  exitEdit(false)
  cur = i
  selId = null
  editId = null
  buildStage()
  markActiveThumb()
}
function addSlide(layout) {
  snapshot()
  const s = newSlide(layout || (slide()?.layout === 'title' ? 'titleContent' : slide()?.layout === 'blank' ? 'blank' : slide()?.layout || 'titleContent'))
  // giữ hiệu ứng chuyển trang & chân trang giống trang hiện tại
  if (slide()?.hf) s.hf = { ...slide().hf }
  if (slide()?.transition) s.transition = { ...slide().transition }
  deck.slides.splice(cur + 1, 0, s)
  cur++
  selId = null
  rebuildAll()
  scheduleSave()
  // con trỏ vào ô tiêu đề
  const t = s.objs.find((o) => o.ph === 'title')
  if (t) setTimeout(() => editors.get(t.id)?.commands.focus('end'), 30)
}
function dupSlide() {
  snapshot()
  const s = clone(slide())
  s.id = uid('s')
  for (const o of s.objs) o.id = uid()
  deck.slides.splice(cur + 1, 0, s)
  cur++
  rebuildAll()
  scheduleSave()
}
async function delSlide() {
  if (deck.slides.length === 1) return toast('Bài trình chiếu cần ít nhất một trang.')
  snapshot()
  deck.slides.splice(cur, 1)
  cur = Math.min(cur, deck.slides.length - 1)
  selId = null
  rebuildAll()
  scheduleSave()
}
function moveSlide(from, to) {
  if (to < 0 || to >= deck.slides.length || from === to) return
  snapshot()
  const [s] = deck.slides.splice(from, 1)
  deck.slides.splice(to, 0, s)
  cur = to
  rebuildAll()
  scheduleSave()
}
function relayout(layout) {
  snapshot()
  changeLayout(slide(), layout)
  buildStage()
  renderThumb(cur)
  scheduleSave()
}
const slideTitle = (s) => {
  const t = s.objs.find((o) => o.ph === 'title')
  return t ? editorText(t) : ''
}
const editorText = (o) => {
  const out = []
  const walk = (n) => { if (n.text) out.push(n.text); (n.content || []).forEach(walk); if (n.type === 'paragraph') out.push(' ') }
  if (o.doc) walk(o.doc)
  return out.join('').trim()
}

// ================= Danh sách trang (ảnh thu nhỏ) =================
const thumbs = $('#thumbs')
const TW = 168
function renderThumbs() {
  thumbs.innerHTML = ''
  deck.slides.forEach((s, i) => {
    const t = document.createElement('div')
    t.className = `thumb${i === cur ? ' active' : ''}`
    t.dataset.i = i
    t.draggable = true
    t.innerHTML = `<span class="thumb-num">${i + 1}${s.transition?.type && s.transition.type !== 'none' ? '<i title="Có hiệu ứng chuyển trang">★</i>' : ''}${s.objs.some((o) => o.anim) ? '<i title="Có hiệu ứng đối tượng">✦</i>' : ''}</span><div class="thumb-box" style="width:${TW}px;height:${(TW * H) / W}px"></div>`
    thumbs.appendChild(t)
    fillThumb(t, s, i)
  })
}
function fillThumb(t, s, i) {
  const box = t.querySelector('.thumb-box')
  box.innerHTML = ''
  const el = renderSlide(deck, s, i)
  el.style.transform = `scale(${TW / W})`
  box.appendChild(el)
}
function renderThumb(i) {
  const t = thumbs.querySelector(`.thumb[data-i="${i}"]`)
  if (t) fillThumb(t, deck.slides[i], i)
}
const thumbTimers = {}
function scheduleThumb(i) {
  clearTimeout(thumbTimers[i])
  thumbTimers[i] = setTimeout(() => renderThumb(i), 250)
}
function markActiveThumb() {
  $$('.thumb', thumbs).forEach((t) => t.classList.toggle('active', +t.dataset.i === cur))
  thumbs.querySelector('.thumb.active')?.scrollIntoView({ block: 'nearest' })
}
function rebuildAll() {
  buildStage()
  renderThumbs()
}
thumbs.addEventListener('mousedown', (e) => {
  const t = e.target.closest('.thumb')
  if (t) goSlide(+t.dataset.i)
})
let dragFrom = null
thumbs.addEventListener('dragstart', (e) => {
  const t = e.target.closest('.thumb')
  if (!t) return
  dragFrom = +t.dataset.i
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', 'slide')
})
thumbs.addEventListener('dragover', (e) => {
  if (dragFrom == null) return
  e.preventDefault()
  const t = e.target.closest('.thumb')
  $$('.thumb', thumbs).forEach((x) => x.classList.remove('drop-before', 'drop-after'))
  if (t) {
    const r = t.getBoundingClientRect()
    t.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after')
  }
})
thumbs.addEventListener('drop', (e) => {
  e.preventDefault()
  const t = e.target.closest('.thumb')
  $$('.thumb', thumbs).forEach((x) => x.classList.remove('drop-before', 'drop-after'))
  if (t == null || dragFrom == null) return
  const r = t.getBoundingClientRect()
  let to = +t.dataset.i + (e.clientY < r.top + r.height / 2 ? 0 : 1)
  if (to > dragFrom) to--
  moveSlide(dragFrom, to)
  dragFrom = null
})
thumbs.addEventListener('dragend', () => (dragFrom = null))
thumbs.addEventListener('contextmenu', (e) => {
  const t = e.target.closest('.thumb')
  e.preventDefault()
  if (t) goSlide(+t.dataset.i)
  showMenu(e.clientX, e.clientY, [
    ['＋ Trang mới', () => addSlide()],
    ['⧉ Nhân đôi trang', dupSlide],
    ['🗑 Xoá trang', delSlide],
    ['-'],
    ['⬆ Chuyển lên', () => moveSlide(cur, cur - 1)],
    ['⬇ Chuyển xuống', () => moveSlide(cur, cur + 1)],
  ])
})

// ================= Định dạng chữ =================
// Đang gõ trong khung → áp cho phần bôi đen; chỉ chọn khung → áp cho toàn bộ chữ trong khung
function textTarget() {
  const o = selObj()
  if (!o || o.kind === 'image') return null
  return { o, ed: editors.get(o.id), whole: editId !== o.id }
}
function applyText(fn, needMsg = true) {
  const t = textTarget()
  if (!t?.ed) {
    if (needMsg) toast('Hãy bấm vào khung chữ hoặc bôi đen chữ trước.')
    return false
  }
  const ch = t.whole ? t.ed.chain().selectAll() : t.ed.chain().focus()
  fn(ch, t).run()
  syncToolbar()
  return true
}
$('#fontFamily').innerHTML = FONTS.map((f) => `<option style="font-family:${fontCss(f)}">${f}</option>`).join('')
$('#sizeList').innerHTML = SIZES.map((s) => `<option value="${s}">`).join('')
$('#fontFamily').addEventListener('change', (e) => applyText((c) => c.setFontFamily(e.target.value)))
function setSize(v) {
  const n = Math.max(1, Math.min(400, Math.round(parseFloat(v) * 2) / 2))
  if (!n) return
  applyText((c) => c.setFontSize(`${n}pt`))
}
$('#fontSize').addEventListener('change', (e) => setSize(e.target.value))
$('#fontSize').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); setSize(e.target.value) } })
function stepSize(dir) {
  const cs = currentStyle()
  if (!cs) return toast('Hãy bấm vào khung chữ trước.')
  const n = cs.size
  const next = dir > 0 ? SIZES.find((s) => s > n) || n + 4 : [...SIZES].reverse().find((s) => s < n) || Math.max(1, n - 2)
  setSize(next)
}
$$('[data-mark]').forEach((b) => b.addEventListener('click', () => {
  const m = b.dataset.mark
  applyText((c, t) => {
    if (t.whole) {
      const on = t.ed.isActive(m) && allHave(t.ed, m)
      return on ? c.unsetMark(m) : c.setMark(m)
    }
    return c.toggleMark(m)
  })
}))
function allHave(ed, mark) {
  let all = true
  ed.state.doc.descendants((n) => { if (n.isText && !n.marks.some((x) => x.type.name === mark)) all = false })
  return all
}
let lastColor = '#ff0000'
function setColor(c) {
  lastColor = c || lastColor
  $('#colorBar').style.background = lastColor
  applyText((ch) => (c ? ch.setColor(c) : ch.unsetColor()))
}
$$('[data-align]').forEach((b) => b.addEventListener('click', () => applyText((c) => c.setTextAlign(b.dataset.align))))
$$('[data-valign]').forEach((b) => b.addEventListener('click', () => {
  const o = selObj()
  if (!o || o.kind === 'image') return toast('Hãy chọn khung chữ trước.')
  snapshot()
  o.valign = b.dataset.valign
  refreshObj(o)
  closePops()
  scheduleSave()
  scheduleThumb(cur)
}))
function toggleList(kind) {
  const t = textTarget()
  if (!t?.ed) return toast('Hãy bấm vào khung chữ trước.')
  applyText((c) => (kind === 'bulletList' ? c.toggleBulletList() : c.toggleOrderedList()))
}
function setListStyle(kind, style) {
  const t = textTarget()
  if (!t?.ed) return toast('Hãy bấm vào khung chữ trước.')
  closePops()
  // chưa phải danh sách → bật trước
  const isKind = t.whole ? hasNode(t.ed, kind) : t.ed.isActive(kind)
  if (!isKind) applyText((c) => (kind === 'bulletList' ? c.toggleBulletList() : c.toggleOrderedList()))
  applyText((c) => c.updateAttributes(kind, { listStyle: style }))
}
function hasNode(ed, type) {
  let has = false
  ed.state.doc.descendants((n) => { if (n.type.name === type) has = true })
  return has
}
function changeLevel(up) {
  const t = textTarget()
  if (!t?.ed || t.whole) return toast('Bấm vào dòng có gạch đầu dòng rồi bấm nút (hoặc phím Tab / Shift+Tab).')
  const ok = up ? t.ed.chain().focus().sinkListItem('listItem').run() : t.ed.chain().focus().liftListItem('listItem').run()
  if (!ok) toast(up ? 'Không tăng cấp được: dòng đầu tiên của danh sách không thể lùi vào.' : 'Dòng này đang ở cấp cao nhất.')
}
$('#bulletStyles').innerHTML = Object.entries(BULLET_STYLES).map(([k, v]) => `<button data-ls="${k}" title="${v.name}"><span class="ls-glyph">${v.glyph}</span><span class="ls-lines"></span></button>`).join('')
$('#numberStyles').innerHTML = Object.entries(NUMBER_STYLES).map(([k, v]) => `<button data-ns="${k}" title="${v.name}"><span class="ls-sample">${v.sample.split(' ').join('<br>')}</span></button>`).join('')
$('#bulletStyles').addEventListener('click', (e) => { const b = e.target.closest('[data-ls]'); if (b) setListStyle('bulletList', b.dataset.ls) })
$('#numberStyles').addEventListener('click', (e) => { const b = e.target.closest('[data-ns]'); if (b) setListStyle('orderedList', b.dataset.ns) })

// kiểu chữ tại con trỏ (để hiện trên thanh công cụ)
function currentStyle() {
  const t = textTarget()
  if (!t?.ed) return null
  const ed = t.ed
  const a = ed.getAttributes('textStyle')
  const $from = ed.state.selection.$from
  let level = -1
  for (let d = $from.depth; d > 0; d--) if (['bulletList', 'orderedList'].includes($from.node(d).type.name)) level++
  const th = theme(deck)
  return {
    font: a.fontFamily ? String(a.fontFamily).replace(/["']/g, '').split(',')[0] : defaultFont(t.o, th),
    size: a.fontSize ? parseFloat(a.fontSize) : defaultSize(t.o, Math.max(0, level), slide().layout),
    color: a.color,
  }
}

// ================= Đồng bộ thanh công cụ =================
function syncToolbar() {
  const o = selObj()
  const t = textTarget()
  const cs = currentStyle()
  if (cs) {
    if (document.activeElement !== $('#fontFamily')) {
      if (![...$('#fontFamily').options].some((x) => x.value === cs.font)) $('#fontFamily').insertAdjacentHTML('beforeend', `<option>${escapeHtml(cs.font)}</option>`)
      $('#fontFamily').value = cs.font
    }
    if (document.activeElement !== $('#fontSize')) $('#fontSize').value = cs.size
  }
  const ed = t?.ed
  for (const b of $$('[data-mark]')) b.classList.toggle('on', !!ed && (t.whole ? allHave(ed, b.dataset.mark) && hasText(ed) : ed.isActive(b.dataset.mark)))
  const align = ed ? ['left', 'center', 'right', 'justify'].find((x) => ed.isActive({ textAlign: x })) || o?.align || 'left' : null
  for (const b of $$('[data-align]')) b.classList.toggle('on', !!ed && b.dataset.align === align)
  $('#bulletBtn').classList.toggle('on', !!ed && ed.isActive('bulletList'))
  $('#numberBtn').classList.toggle('on', !!ed && ed.isActive('orderedList'))
  // tab Định dạng
  $('#formatTab').classList.toggle('hidden', !o)
  if (!o && $('.tabs button.active')?.dataset.tab === 'format') showTab('home')
  if (o) {
    $('#lineLabel').textContent = o.kind === 'image' ? 'Viền ảnh' : 'Đường viền'
    $('#styleLabel').textContent = o.kind === 'image' ? 'Kiểu ảnh' : 'Kiểu hình'
    $('#fillBtn').disabled = o.kind === 'image'
    if (document.activeElement !== $('#objW')) $('#objW').value = (o.w / PX_CM).toFixed(2)
    if (document.activeElement !== $('#objH')) $('#objH').value = (o.h / PX_CM).toFixed(2)
  }
  syncTransition()
  syncAnim()
  $$('#themeGallery [data-theme]').forEach((b) => b.classList.toggle('on', b.dataset.theme === deck.theme))
}
const hasText = (ed) => !!ed.state.doc.textContent.trim()

// ================= Ribbon =================
function showTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name))
  $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name))
  document.body.classList.toggle('anim-tab', name === 'anim')
  renderBadges()
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)))
function setLevel(lv) {
  lv = +lv
  $('#level').value = String(lv)
  $$('[data-lop]').forEach((el) => el.classList.toggle('lop-hidden', +el.dataset.lop > lv))
  const active = $('.tabs button.active')
  if (active?.classList.contains('lop-hidden')) showTab('home')
  storage.set('tc:level', lv)
}
$('#level').addEventListener('change', (e) => { setLevel(e.target.value); if (!currentLesson) renderLessonList() })
// giữ con trỏ trong khung chữ khi bấm nút trên ribbon
$('.ribbon').addEventListener('mousedown', (e) => { if (e.target.closest('button') && !e.target.closest('[data-tab]')) e.preventDefault() })
document.addEventListener('mousedown', (e) => { if (e.target.closest('.pop button, .pop .sw')) e.preventDefault() }, true)

// bảng màu
function swatches(list, attr) {
  return `<div class="swatches">${list.map(([c, n]) => `<button class="sw" ${attr}="${c}" title="${n}" style="background:${c}"></button>`).join('')}</div>`
}
$('#colorPop').innerHTML = `${swatches(COLORS, 'data-color')}<div class="pop-row"><button data-color="">Tự động</button> Màu khác <input type="color" id="colorCustom" value="#ff0000" /></div>`
$('#colorPop').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) { closePops(); setColor(b.dataset.color) } })
$('#colorCustom').addEventListener('change', (e) => { closePops(); setColor(e.target.value) })
$('#fillPop').innerHTML = `${swatches(COLORS, 'data-fill')}<div class="pop-row"><button data-fill="none">Không tô màu</button> Màu khác <input type="color" id="fillCustom" value="#4472c4" /></div>`
$('#fillPop').addEventListener('click', (e) => { const b = e.target.closest('[data-fill]'); if (b) { closePops(); setFill(b.dataset.fill) } })
$('#fillCustom').addEventListener('change', (e) => { closePops(); setFill(e.target.value) })
$('#linePop').innerHTML = `${swatches(COLORS, 'data-line')}<div class="pop-row">Độ dày <select id="lineW">${[0.75, 1, 1.5, 2.25, 3, 4.5, 6, 8, 12].map((w) => `<option value="${w}">${w} pt</option>`).join('')}</select></div><div class="pop-row" style="margin-top:6px"><button data-line="none">Không viền</button> Màu khác <input type="color" id="lineCustom" value="#000000" /></div>`
$('#linePop').addEventListener('click', (e) => { const b = e.target.closest('[data-line]'); if (b) { closePops(); setLine(b.dataset.line) } })
$('#lineCustom').addEventListener('change', (e) => { closePops(); setLine(e.target.value) })
$('#lineW').addEventListener('change', () => { const o = selObj(); const c = o?.kind === 'image' ? o.border?.color : o?.line?.color; setLine(c || '#000000') })
function setFill(c) {
  const o = selObj()
  if (!o || o.kind === 'image') return toast('Hãy chọn một hình hoặc khung chữ.')
  snapshot()
  if (c === 'none') delete o.fill
  else o.fill = c
  refreshObj(o)
  scheduleSave()
  scheduleThumb(cur)
}
function setLine(c) {
  const o = selObj()
  if (!o) return toast('Hãy chọn một hình hoặc ảnh.')
  snapshot()
  const w = +$('#lineW').value || 1.5
  if (o.kind === 'image') {
    if (c === 'none') delete o.border
    else o.border = { color: c, w }
  } else if (c === 'none') delete o.line
  else o.line = { color: c, w }
  refreshObj(o)
  scheduleSave()
  scheduleThumb(cur)
}
for (const id of ['objW', 'objH']) {
  $(`#${id}`).addEventListener('change', (e) => {
    const o = selObj()
    const v = parseFloat(e.target.value)
    if (!o || !(v > 0)) return
    snapshot()
    const px = Math.round(v * PX_CM)
    if (o.kind === 'image') {
      const r = o.w / o.h
      if (id === 'objW') { o.w = px; o.h = Math.round(px / r) } else { o.h = px; o.w = Math.round(px * r) }
    } else if (id === 'objW') o.w = px
    else o.h = px
    if (o.kind === 'text' && id === 'objH') o.autoH = false
    refreshObj(o)
    syncToolbar()
    scheduleSave()
    scheduleThumb(cur)
  })
}
$$('[data-arr]').forEach((b) => b.addEventListener('click', () => { closePops(); arrange(b.dataset.arr) }))

// bố cục
const layoutItems = Object.entries(LAYOUTS).map(([k, v]) => `<button data-layout="${k}"><b><span class="lay-ic lay-${k}"></span>${v.name}</b></button>`).join('')
$('#layoutPop').innerHTML = `<div class="pop-title">Thêm trang mới với bố cục</div>${layoutItems}`
$('#relayoutPop').innerHTML = `<div class="pop-title">Đổi bố cục trang đang chọn</div>${layoutItems}`
$('#layoutPop').addEventListener('click', (e) => { const b = e.target.closest('[data-layout]'); if (b) { closePops(); addSlide(b.dataset.layout) } })
$('#relayoutPop').addEventListener('click', (e) => { const b = e.target.closest('[data-layout]'); if (b) { closePops(); relayout(b.dataset.layout) } })
// hình
$('#shapePop').innerHTML = `<div class="pop-title">Chọn hình rồi kéo chuột trên trang để vẽ</div>${Object.entries(SHAPES).map(([k, v]) => `<button data-shape="${k}"><b><span class="shape-ic">${svgShape(k, 26, 18, '#c9d6ee', { color: '#4472c4', w: 1 })}</span>${v}</b></button>`).join('')}`
$('#shapePop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-shape]')
  if (!b) return
  closePops()
  deselect()
  drawShape = b.dataset.shape
  holder.classList.add('drawing')
  toast('Kéo chuột trên trang để vẽ hình (giữ Shift để vẽ hình đều).')
})

// bản mẫu
$('#themeGallery').innerHTML = Object.entries(THEMES).map(([k, t]) => `<button class="theme-btn" data-theme="${k}" title="${t.name}"><span class="theme-prev" style="background:${t.bg}">${t.deco.slice(0, 2).map((d) => `<i style="left:${(d.x / W) * 100}%;top:${(d.y / H) * 100}%;width:${(d.w / W) * 100}%;height:${(d.h / H) * 100}%;background:${d.fill || 'transparent'};${d.line ? `border:2px solid ${d.line.color}` : ''};border-radius:${d.shape === 'ellipse' ? '50%' : d.shape === 'star5' ? '30%' : '0'}"></i>`).join('')}<b style="color:${t.title.color};font-family:${fontCss(t.title.font)}">Aa</b></span><small>${t.name}</small></button>`).join('')
$('#themeGallery').addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme]')
  if (!b) return
  snapshot()
  deck.theme = b.dataset.theme
  rebuildAll()
  scheduleSave()
})
// màu nền
$('#bgPop').innerHTML = `<div class="pop-title">Màu nền trang này</div>${swatches(BGS, 'data-bg')}<div class="pop-row">Màu khác <input type="color" id="bgCustom" value="#fff2cc" /></div><div class="pop-row" style="margin-top:8px"><button data-bgall="1">Áp dụng cho tất cả trang</button><button data-bg="">Đặt lại theo bản mẫu</button></div>`
$('#bgPop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-bg]')
  if (b) return setBg(b.dataset.bg || null)
  if (e.target.closest('[data-bgall]')) {
    closePops()
    snapshot()
    for (const s of deck.slides) s.bg = slide().bg
    rebuildAll()
    scheduleSave()
    toast('Đã áp dụng màu nền cho tất cả trang.')
  }
})
$('#bgCustom').addEventListener('change', (e) => setBg(e.target.value))
function setBg(c) {
  snapshot()
  slide().bg = c
  slideEl.style.background = c || theme(deck).bg
  renderThumb(cur)
  scheduleSave()
}

// ================= Chuyển trang =================
$('#transGallery').innerHTML = Object.entries(TRANSITIONS).map(([k, v]) => `<button class="gal" data-trans="${k}"><i class="ic">${v.ic}</i>${v.name}</button>`).join('')
$('#transGallery').addEventListener('click', (e) => {
  const b = e.target.closest('[data-trans]')
  if (!b) return
  snapshot()
  const s = slide()
  const prev = s.transition || {}
  s.transition = b.dataset.trans === 'none' ? (prev.adv ? { type: 'none', adv: prev.adv } : null) : { type: b.dataset.trans, dir: prev.dir || 'u', dur: prev.dur || (b.dataset.trans === 'fade' ? 0.7 : 1), adv: prev.adv }
  renderThumbs()
  syncTransition()
  scheduleSave()
  if (s.transition?.type && s.transition.type !== 'none') previewTransition(holder, deck, s, cur)
})
function syncTransition() {
  const tr = slide()?.transition
  const type = tr?.type || 'none'
  $$('#transGallery [data-trans]').forEach((b) => b.classList.toggle('on', b.dataset.trans === type))
  $('#dirBtn').disabled = !TRANSITIONS[type]?.dirs
  if (document.activeElement !== $('#transDur')) $('#transDur').value = tr?.dur ?? 1
  $('#transDur').disabled = type === 'none'
  $('#transAdvOn').checked = !!tr?.adv
  if (document.activeElement !== $('#transAdv')) $('#transAdv').value = tr?.adv || 5
  $$('#dirPop [data-dir]').forEach((b) => b.classList.toggle('on', b.dataset.dir === (tr?.dir || 'u')))
}
$('#dirPop').innerHTML = Object.entries(DIRS).map(([k, v]) => `<button data-dir="${k}"><b>${{ u: '⬆', d: '⬇', l: '⬅', r: '➡' }[k]} ${v}</b></button>`).join('')
$('#dirPop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dir]')
  const s = slide()
  if (!b || !s.transition) return
  closePops()
  snapshot()
  s.transition.dir = b.dataset.dir
  syncTransition()
  scheduleSave()
  previewTransition(holder, deck, s, cur)
})
$('#transDur').addEventListener('change', (e) => {
  const s = slide()
  if (!s.transition) return
  snapshot()
  s.transition.dur = Math.max(0.25, Math.min(10, +e.target.value || 1))
  scheduleSave()
})
function setAdv() {
  const s = slide()
  snapshot()
  const on = $('#transAdvOn').checked
  const v = Math.max(1, +$('#transAdv').value || 5)
  if (!s.transition) s.transition = { type: 'none' }
  if (on) s.transition.adv = v
  else delete s.transition.adv
  if (s.transition.type === 'none' && !s.transition.adv) s.transition = null
  scheduleSave()
}
$('#transAdvOn').addEventListener('change', setAdv)
$('#transAdv').addEventListener('change', () => { $('#transAdvOn').checked = true; setAdv() })

// ================= Hiệu ứng đối tượng =================
$('#animGallery').innerHTML = Object.entries(ANIMS).map(([k, v]) => `<button class="gal" data-anim="${k}"><i class="ic">${v.ic}</i>${v.name}</button>`).join('')
$('#animStart').innerHTML = Object.entries(ANIM_STARTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')
$('#animGallery').addEventListener('click', (e) => {
  const b = e.target.closest('[data-anim]')
  if (!b) return
  const o = selObj()
  if (!o) return toast('Hãy chọn một đối tượng (khung chữ, ảnh, hình) trên trang trước.')
  snapshot()
  if (b.dataset.anim === 'none') delete o.anim
  else {
    const maxOrder = Math.max(0, ...slide().objs.filter((x) => x.anim).map((x) => x.anim.order || 0))
    o.anim = { type: b.dataset.anim, start: o.anim?.start || 'click', dur: o.anim?.dur || 0.5, order: o.anim?.order || maxOrder + 1 }
  }
  renderBadges()
  syncAnim()
  renderThumbs()
  scheduleSave()
  if (o.anim) previewAnims(slideEl, { objs: [o] })
})
function syncAnim() {
  const o = selObj()
  const a = o?.anim
  $$('#animGallery [data-anim]').forEach((b) => b.classList.toggle('on', !!o && b.dataset.anim === (a?.type || 'none')))
  $('#animStart').disabled = !a
  $('#animDur').disabled = !a
  $('#animStart').value = a?.start || 'click'
  if (document.activeElement !== $('#animDur')) $('#animDur').value = a?.dur ?? 0.5
}
$('#animStart').addEventListener('change', (e) => {
  const o = selObj()
  if (!o?.anim) return
  snapshot()
  o.anim.start = e.target.value
  renderBadges()
  scheduleSave()
})
$('#animDur').addEventListener('change', (e) => {
  const o = selObj()
  if (!o?.anim) return
  snapshot()
  o.anim.dur = Math.max(0.25, Math.min(10, +e.target.value || 0.5))
  scheduleSave()
})
function moveAnim(dir) {
  const o = selObj()
  if (!o?.anim) return toast('Đối tượng này chưa có hiệu ứng.')
  const list = slide().objs.filter((x) => x.anim).sort((a, b) => a.anim.order - b.anim.order)
  const i = list.indexOf(o)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  snapshot()
  list.forEach((x, k) => (x.anim.order = k + 1))
  ;[list[i].anim.order, list[j].anim.order] = [list[j].anim.order, list[i].anim.order]
  renderBadges()
  scheduleSave()
}
function renderBadges() {
  if (!slideEl) return
  $$('.anim-badge', slideEl).forEach((b) => b.remove())
  const nums = animBadges(slide())
  for (const [id, n] of Object.entries(nums)) {
    const el = objEl(id)
    if (el) el.insertAdjacentHTML('beforeend', `<span class="anim-badge">${n}</span>`)
  }
}

// ================= Trình chiếu =================
function runShow(from) {
  exitEdit(false)
  saveNow()
  startShow(deck, from, { onExit: () => buildStage() })
}

// ================= Lệnh =================
const ACTIONS = {
  undo, redo,
  newSlide: () => addSlide(),
  dupSlide, delSlide,
  image: () => $('#imageInput').click(),
  textbox: insertTextbox,
  link: openLinkDialog,
  headerFooter: () => openHfDialog(),
  slideNumber: () => openHfDialog('num'),
  dateTime: () => openHfDialog('date'),
  grow: () => stepSize(1),
  shrink: () => stepSize(-1),
  color: () => setColor(lastColor),
  clearFormat: () => applyText((c) => c.unsetAllMarks().unsetTextAlign()),
  bullet: () => toggleList('bulletList'),
  number: () => toggleList('orderedList'),
  levelUp: () => changeLevel(true),
  levelDown: () => changeLevel(false),
  deleteObj,
  transAll: () => {
    const tr = slide().transition
    snapshot()
    for (const s of deck.slides) s.transition = tr ? { ...tr } : null
    renderThumbs()
    scheduleSave()
    toast(tr?.type && tr.type !== 'none' ? `Đã áp dụng hiệu ứng “${TRANSITIONS[tr.type].name}” cho tất cả ${deck.slides.length} trang.` : 'Đã bỏ hiệu ứng chuyển trang ở tất cả các trang.')
  },
  transPreview: () => {
    if (!slide().transition?.type || slide().transition.type === 'none') return toast('Trang này chưa có hiệu ứng chuyển trang.')
    previewTransition(holder, deck, slide(), cur)
  },
  animPreview: () => {
    if (!slide().objs.some((o) => o.anim)) return toast('Trang này chưa có hiệu ứng cho đối tượng.')
    exitEdit(false)
    previewAnims(slideEl, slide())
  },
  animEarlier: () => moveAnim(-1),
  animLater: () => moveAnim(1),
  showStart: () => runShow(0),
  showHere: () => runShow(cur),
  copy: () => {
    const t = textTarget()
    if (t && !t.whole && !t.ed.state.selection.empty) { t.ed.commands.focus(); document.execCommand('copy'); return }
    if (copyObj()) toast('Đã sao chép đối tượng. Bấm Dán (Ctrl+V) để dán.')
  },
  cut: () => {
    const t = textTarget()
    if (t && !t.whole && !t.ed.state.selection.empty) { t.ed.commands.focus(); document.execCommand('cut'); return }
    copyObj(true)
  },
  paste: async () => {
    const t = textTarget()
    if (t && !t.whole) {
      try {
        const txt = await navigator.clipboard.readText()
        if (txt) return t.ed.chain().focus().insertContent(txt).run()
      } catch { /* trình duyệt chặn */ }
      return toast('Hãy dùng phím Ctrl+V để dán chữ.')
    }
    if (!pasteObj()) toast('Chưa có gì để dán. Hãy dùng Ctrl+V để dán chữ hoặc ảnh.')
  },
  new: async () => {
    if (!(await showAlert('Bài mới', 'Bắt đầu một bài trình chiếu mới? Bài đang làm sẽ bị thay thế (hãy Lưu về máy trước nếu cần).', true))) return
    snapshot()
    deck = newDeck()
    cur = 0
    selId = null
    $('#fileName').value = 'Bài trình chiếu của em'
    rebuildAll()
    scheduleSave()
  },
  open: () => $('#openInput').click(),
  save: () => saveFile(),
  submit: () => doSubmit(),
  student: async () => { if (await askName({ allowGuest: false, cancellable: true })) { saveNow(); renderStudentChip() } },
  submitSetup: () => openSetup(),
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]')
  if (b && ACTIONS[b.dataset.act] && !b.disabled) { closePops(); ACTIONS[b.dataset.act]() }
})

// ================= Bàn phím =================
document.addEventListener('keydown', (e) => {
  if (!$('#show').classList.contains('hidden')) return
  if (document.querySelector('dialog[open]')) return
  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  const inEditor = !!e.target.closest?.('.ProseMirror')
  const inInput = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
  if (e.key === 'F5') { e.preventDefault(); return runShow(e.shiftKey ? cur : 0) }
  if (mod && k === 'z' && !e.shiftKey && !inInput) { e.preventDefault(); return undo() }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey)) && !inInput) { e.preventDefault(); return redo() }
  if (mod && k === 'm') { e.preventDefault(); return addSlide() }
  if (mod && k === 's') { e.preventDefault(); return saveFile() }
  if (mod && k === 'k' && !inInput) { e.preventDefault(); return openLinkDialog() }
  if (inInput || inEditor) return
  if (e.key === 'Escape') {
    if (drawShape) { drawShape = null; holder.classList.remove('drawing') }
    return deselect()
  }
  if (e.key === 'Tab' && slide().objs.length && e.target === document.body) {
    // Tab: chọn lần lượt các đối tượng (kể cả đối tượng bị che)
    e.preventDefault()
    const objs = slide().objs
    const i = objs.findIndex((x) => x.id === selId)
    const j = ((i < 0 ? (e.shiftKey ? 0 : -1) : i) + (e.shiftKey ? -1 : 1) + objs.length) % objs.length
    return selectObj(objs[j].id)
  }
  const o = selObj()
  const thumbsFocus = document.activeElement === thumbs
  if (thumbsFocus || !o) {
    if (['ArrowDown', 'PageDown', 'ArrowRight'].includes(e.key)) { e.preventDefault(); return goSlide(cur + 1) }
    if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); return goSlide(cur - 1) }
    if (thumbsFocus && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); return delSlide() }
    if (mod && k === 'd') { e.preventDefault(); return dupSlide() }
    if (thumbsFocus && e.key === 'Enter') { e.preventDefault(); return addSlide() }
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return deleteObj() }
  const step = e.shiftKey ? 20 : 4
  if (e.key === 'ArrowLeft') { e.preventDefault(); return nudge(-step, 0) }
  if (e.key === 'ArrowRight') { e.preventDefault(); return nudge(step, 0) }
  if (e.key === 'ArrowUp') { e.preventDefault(); return nudge(0, -step) }
  if (e.key === 'ArrowDown') { e.preventDefault(); return nudge(0, step) }
  if (mod && k === 'd') { e.preventDefault(); copyObj(); return pasteObj() }
  if ((e.key === 'Enter' || e.key === 'F2') && o.kind !== 'image') {
    e.preventDefault()
    setEdit(o.id)
    return editors.get(o.id)?.commands.focus('end')
  }
})
document.addEventListener('copy', (e) => {
  if (e.target.closest?.('.ProseMirror, input, textarea') || !selObj()) return
  copyObj()
  e.clipboardData.setData('text/plain', '[[trinh-chieu:doi-tuong]]')
  e.preventDefault()
})
document.addEventListener('cut', (e) => {
  if (e.target.closest?.('.ProseMirror, input, textarea') || !selObj()) return
  e.clipboardData.setData('text/plain', '[[trinh-chieu:doi-tuong]]')
  copyObj(true)
  e.preventDefault()
})
document.addEventListener('paste', (e) => {
  if (document.querySelector('dialog[open]') || !$('#show').classList.contains('hidden')) return
  if (e.target.closest?.('input, textarea')) return
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'))
  if (file) {
    e.preventDefault()
    return insertImageFile(file)
  }
  if (e.target.closest?.('.ProseMirror')) return
  const txt = e.clipboardData?.getData('text/plain') || ''
  e.preventDefault()
  if (txt === '[[trinh-chieu:doi-tuong]]' || (!txt && clip)) return pasteObj()
  if (txt.trim()) {
    const lines = txt.trim().split(/\r?\n/)
    addObj({ id: uid(), kind: 'text', x: 200, y: 260, w: 880, h: 46, valign: 'top', doc: { type: 'doc', content: lines.map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] })) } })
  }
})
// kéo thả ảnh từ máy vào trang
stage.addEventListener('dragover', (e) => { if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault() })
stage.addEventListener('drop', (e) => {
  const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'))
  if (f) { e.preventDefault(); insertImageFile(f) }
})

// ================= Popover, hộp thoại =================
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
    if (trigger.disabled) return
    const pop = document.getElementById(trigger.dataset.pop)
    if (pop.classList.contains('open')) return closePops()
    if (trigger.dataset.pop === 'linePop') {
      const o = selObj()
      const w = o?.kind === 'image' ? o.border?.w : o?.line?.w
      if (w) $('#lineW').value = String(w)
      else $('#lineW').value = o?.kind === 'image' ? '3' : '1.5'
    }
    return openPopAt(pop, trigger.getBoundingClientRect())
  }
  if (!e.target.closest('.pop')) closePops()
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
holder.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('.obj')
  if (!el || e.target.closest('.ProseMirror')) return
  e.preventDefault()
  selectObj(el.dataset.id)
  const o = selObj()
  showMenu(e.clientX, e.clientY, [
    ['✂ Cắt', () => copyObj(true)], ['⧉ Sao chép', () => copyObj()], ['📋 Dán', pasteObj], ['-'],
    ['⬆ Đưa lên một lớp', () => arrange('forward')], ['⬇ Đưa xuống một lớp', () => arrange('backward')],
    ['⇈ Lên trên cùng', () => arrange('front')], ['⇊ Xuống dưới cùng', () => arrange('back')], ['-'],
    ...(+$('#level').value >= 8 ? [['🔗 Liên kết…', openLinkDialog]] : []),
    ...(o?.kind !== 'image' ? [['✎ Sửa chữ', () => { setEdit(o.id); editors.get(o.id)?.commands.focus('end') }]] : []),
    ['🗑 Xoá', deleteObj],
  ])
})
function showAlert(title, text, withCancel) {
  const d = $('#alertDialog')
  $('#alertTitle').textContent = title
  $('#alertText').textContent = text
  $('#alertCancel').classList.toggle('hidden', !withCancel)
  $('#alertOk').textContent = withCancel ? 'Đồng ý' : 'Đóng'
  d.showModal()
  return new Promise((res) => { d.onclose = () => res(d.returnValue === 'ok') })
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

// ================= Lưu tạm =================
const docKey = () => userKey(currentLesson ? `tc:ex:${currentLesson.id}` : 'tc:free')
const FREE = () => userKey('tc:free')
const DONE = () => userKey('tc:done')
let saveTimer
let warnedFull = false
function scheduleSave() {
  $('#saveState').textContent = 'Đang lưu…'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 600)
}
function saveNow() {
  clearTimeout(saveTimer)
  const ok = storage.set(docKey(), { deck, name: $('#fileName').value })
  $('#saveState').textContent = ok ? 'Đã lưu tạm' : 'Chưa lưu được!'
  if (!ok && !warnedFull) {
    warnedFull = true
    toast('Bộ nhớ trình duyệt đã đầy. Hãy Lưu về máy (.pptx) để không mất bài.')
  }
}
$('#fileName').addEventListener('input', scheduleSave)
async function loadDeck(k, start, name) {
  const saved = storage.get(k)
  if (saved?.deck) {
    deck = normalizeDeck(saved.deck)
    $('#fileName').value = saved.name || name
  } else {
    deck = start ? normalizeDeck(start()) : newDeck()
    $('#fileName').value = name
  }
  await preload(imageRefs(deck))
  cur = 0
  selId = null
  editId = null
  undoStack = []
  redoStack = []
  rebuildAll()
}
// dọn ảnh không còn bài nào dùng
async function cleanImages() {
  const keep = new Set()
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('tc:')) continue
      const v = storage.get(k)
      if (v?.deck) for (const id of imageRefs(v.deck)) keep.add(id)
    }
  } catch { return }
  for (const id of imageRefs(deck)) keep.add(id)
  await gc(keep)
}

// ================= Tệp =================
async function saveFile() {
  exitEdit(false)
  toast('Đang tạo tệp .pptx…')
  try {
    const { exportPptx } = await import('./export-pptx.js')
    const blob = await exportPptx(deck, { title: $('#fileName').value })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${($('#fileName').value.trim() || 'trinh-chieu').replace(/[\\/:*?"<>|]/g, '')}.pptx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    toast('Đã lưu tệp .pptx về máy (thư mục Tải xuống).')
  } catch (err) {
    console.error(err)
    toast('Chưa lưu được tệp, em thử lại nhé.')
  }
}
$('#openInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  try {
    const { importPptx } = await import('./export-pptx.js')
    const d = await importPptx(await f.arrayBuffer())
    if (!d) return showAlert('Không mở được', 'Phần mềm chỉ mở được tệp .pptx đã lưu từ chính phần mềm này. Tệp tạo bằng PowerPoint em hãy mở bằng PowerPoint.', false)
    for (const s of d.slides) for (const o of s.objs) if (o.kind === 'image' && o.src?.startsWith('data:')) o.src = await putImage(o.src)
    snapshot()
    deck = normalizeDeck(d)
    await preload(imageRefs(deck))
    cur = 0
    selId = null
    $('#fileName').value = f.name.replace(/\.pptx$/i, '')
    rebuildAll()
    scheduleSave()
    toast('Đã mở tệp.')
  } catch (err) {
    console.error(err)
    showAlert('Không mở được', 'Tệp bị lỗi hoặc không phải tệp .pptx.', false)
  }
})

// ================= Bài tập =================
function renderLessonList() {
  const lv = +$('#level').value
  const groups = {}
  for (const l of LESSONS) {
    if (lv !== 99 && l.lop !== lv) continue
    ;(groups[`Lớp ${l.lop} — ${l.bai}`] ||= []).push(l)
  }
  const done = storage.get(DONE()) || {}
  $('#lessonList').innerHTML = Object.entries(groups).map(([g, ls]) => `<div class="lgroup"><div class="lgroup-title">${g}</div>${ls.map((l) => `<button class="lesson-item" data-id="${l.id}"><span>${l.vanDung ? '<span class="vd-tag">Vận dụng</span> ' : ''}${l.title}</span>${done[l.id] ? '<span class="done">✓</span>' : ''}</button>`).join('')}</div>`).join('') || '<p class="muted">Chưa có bài tập cho mức này. Chọn “Giao diện” Lớp 3, 4, 7 hoặc 8.</p>'
}
$('#lessonList').addEventListener('click', (e) => {
  const b = e.target.closest('.lesson-item')
  if (b) openLesson(LESSONS.find((l) => l.id === b.dataset.id))
})
$('#toggleLessons').addEventListener('click', () => {
  $('#lessons').classList.toggle('hidden')
  if (!$('#lessons').classList.contains('hidden') && !currentLesson) renderLessonList()
})
$('#closeLessons').addEventListener('click', () => $('#lessons').classList.add('hidden'))
async function openLesson(l) {
  exitEdit(false)
  saveNow()
  currentLesson = l
  if (+$('#level').value !== 99 && +$('#level').value !== l.lop) setLevel(l.lop)
  await loadDeck(docKey(), l.start, l.file || l.title)
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
    await loadDeck(docKey(), l.start, l.file || l.title)
    $$('.steps li').forEach((li) => li.classList.remove('ok', 'bad'))
    $$('.hint-text').forEach((x) => (x.textContent = ''))
    $('#score').textContent = ''
  }
  $('#checkLesson').onclick = runCheck
}
function runCheck() {
  exitEdit(false)
  const l = currentLesson
  const res = checkExercise(l, deck)
  if (examMode) return res
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
async function closeLesson() {
  saveNow()
  currentLesson = null
  $('#lessonView').classList.add('hidden')
  $('#lessonList').classList.remove('hidden')
  renderLessonList()
  await loadDeck(FREE(), null, 'Bài trình chiếu của em')
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
  const what = currentLesson ? `bài “${currentLesson.title}”` : 'bài trình chiếu này'
  if (!auto && !(await showAlert('Nộp bài', `${st.hoTen} (${st.lop}) nộp ${what} cho thầy cô?${examMode ? ' Bài kiểm tra chỉ được nộp một lần.' : ''}`, true))) return
  exitEdit(false)
  sending = true
  const btns = $$('[data-act="submit"], #submitLesson')
  btns.forEach((b) => (b.disabled = true))
  toast('Đang nộp bài…')
  try {
    saveNow()
    const results = currentLesson ? runCheck() : null
    const { exportPptx } = await import('./export-pptx.js')
    const blob = await exportPptx(deck, { title: $('#fileName').value })
    const lesson = currentLesson ? { ...currentLesson, id: examMode ? `${currentLesson.id}:kt` : currentLesson.id, bai: `${examMode ? 'KIỂM TRA · ' : ''}Trình chiếu · ${currentLesson.bai}` } : null
    const r = await submit(submitCfg, st, { lesson, results, docxBlob: blob, fileName: $('#fileName').value.trim() || 'trinh-chieu', ext: 'pptx' })
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

// ================= Chế độ kiểm tra =================
let examMode = null
async function startExam(cfg) {
  const l = LESSONS.find((x) => x.id === cfg.lessonId)
  if (!l) return toast('Link kiểm tra không đúng (không tìm thấy bài).')
  if (!submitCfg?.url) toast('Chưa có địa chỉ nộp bài: hãy mở đúng link kiểm tra thầy cô gửi.')
  examMode = { lesson: l, minutes: cfg.minutes, submitted: false }
  document.body.classList.add('exam-mode')
  $('#lessons').classList.remove('hidden')
  await openLesson(l)
  const st = examState('slide', l.id)
  if (st.submittedAt) return finishExam(st.submittedAt)
  examMode.stop = startCountdown($('#examClock'), st.start + cfg.minutes * 60000, () => {
    toast('Hết giờ! Máy đang tự nộp bài…')
    doSubmit({ auto: true })
  })
}
function finishExam(at) {
  const st = at ? { submittedAt: at } : markExamSubmitted('slide', examMode.lesson.id)
  examMode.submitted = true
  examMode.stop?.()
  saveNow()
  const t = new Date(st.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  lockScreen(`Em đã nộp bài lúc ${t}. Chờ thầy cô hướng dẫn nhé.`)
}

// ================= Khởi động =================
setLevel(storage.get('tc:level') ?? 7)
$('#colorBar').style.background = lastColor
window.addEventListener('beforeunload', () => { if (examMode?.submitted) return; saveNow() })
initSession({
  exam: examCfg,
  onEndRequest: async () => {
    exitEdit(false)
    saveNow()
    const u = getStudent()
    return showAlert('Đổi người dùng', u ? `Kết thúc buổi học của ${u.hoTen}? Bài của em đã được lưu.` : 'Kết thúc phiên dùng thử? Bài làm thử sẽ bị xoá.', true)
  },
  onChange: async () => {
    currentLesson = null
    $('#lessonView').classList.add('hidden')
    $('#lessonList').classList.remove('hidden')
    if (!$('#lessons').classList.contains('hidden')) renderLessonList()
    await loadDeck(FREE(), null, 'Bài trình chiếu của em')
  },
}).then(async () => {
  await loadDeck(FREE(), null, 'Bài trình chiếu của em')
  if (examCfg) await startExam(examCfg)
  setTimeout(cleanImages, 3000)
})
