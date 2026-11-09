// Mô hình bài trình chiếu: trang 16:9 kích thước 1280×720 (điểm ảnh ở 96 dpi = 13,333 × 7,5 inch,
// đúng khổ "Màn hình rộng" mặc định của PowerPoint). Cỡ chữ tính bằng pt như PowerPoint.
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { ListStyle } from '../../src/extensions.js'

export const W = 1280
export const H = 720

export const textExtensions = () => [
  StarterKit.configure({
    heading: false, codeBlock: false, blockquote: false, horizontalRule: false, code: false,
    undoRedo: false, trailingNode: false, dropcursor: false, gapcursor: false,
    link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: null, rel: null } },
  }),
  TextStyle, Color, FontFamily, FontSize,
  TextAlign.configure({ types: ['paragraph'] }),
  ListStyle,
]

// ---------------- Bố cục trang (Layout) ----------------
const T = { ph: 'title', x: 88, y: 38, w: 1104, h: 139, valign: 'middle' }
export const LAYOUTS = {
  title: {
    name: 'Trang tiêu đề',
    phs: [
      { ph: 'title', x: 160, y: 118, w: 960, h: 251, valign: 'bottom', align: 'center' },
      { ph: 'subtitle', x: 160, y: 379, w: 960, h: 174, valign: 'top', align: 'center' },
    ],
  },
  titleContent: { name: 'Tiêu đề và nội dung', phs: [T, { ph: 'body', x: 88, y: 192, w: 1104, h: 457, valign: 'top' }] },
  section: {
    name: 'Đầu mục',
    phs: [
      { ph: 'title', x: 87, y: 180, w: 1104, h: 300, valign: 'bottom' },
      { ph: 'subtitle', x: 87, y: 483, w: 1104, h: 158, valign: 'top' },
    ],
  },
  twoContent: {
    name: 'Hai nội dung',
    phs: [T, { ph: 'body', x: 88, y: 192, w: 544, h: 457, valign: 'top' }, { ph: 'body2', x: 648, y: 192, w: 544, h: 457, valign: 'top' }],
  },
  titleOnly: { name: 'Chỉ tiêu đề', phs: [T] },
  blank: { name: 'Trống', phs: [] },
}
export const PROMPTS = { title: 'Bấm để thêm tiêu đề', subtitle: 'Bấm để thêm phụ đề', body: 'Bấm để thêm văn bản', body2: 'Bấm để thêm văn bản' }
export const isBody = (ph) => ph === 'body' || ph === 'body2'

// ---------------- Bản mẫu (Design → Themes) ----------------
// deco: hình trang trí nằm dưới cùng; on: 'title' (chỉ trang tiêu đề) | 'content' (các trang khác)
export const THEMES = {
  office: { name: 'Office (trắng)', bg: '#ffffff', title: { font: 'Calibri Light', color: '#000000' }, body: { font: 'Calibri', color: '#000000' }, accent: '#4472c4', deco: [] },
  'thien-nhien': {
    name: 'Thiên nhiên', bg: '#f4f9ef', title: { font: 'Arial', color: '#2e7d32' }, body: { font: 'Arial', color: '#33402f' }, accent: '#43a047',
    deco: [
      { shape: 'ellipse', x: 1110, y: -90, w: 260, h: 260, fill: '#c5e1a5' },
      { shape: 'rect', x: 0, y: 0, w: 1280, h: 14, fill: '#66bb6a' },
      { shape: 'rect', x: 0, y: 700, w: 1280, h: 20, fill: '#2e7d32' },
    ],
  },
  'bien-xanh': {
    name: 'Biển xanh', bg: '#eaf4fc', title: { font: 'Tahoma', color: '#0d47a1' }, body: { font: 'Tahoma', color: '#1c2b3a' }, accent: '#1e88e5',
    deco: [
      { shape: 'rect', x: 0, y: 0, w: 30, h: 720, fill: '#1e88e5' },
      { shape: 'rect', x: 30, y: 0, w: 8, h: 720, fill: '#90caf9' },
      { shape: 'rect', x: 160, y: 372, w: 960, h: 5, fill: '#1e88e5', on: 'title' },
    ],
  },
  'hoang-hon': {
    name: 'Hoàng hôn', bg: '#fff6ea', title: { font: 'Verdana', color: '#d84315' }, body: { font: 'Verdana', color: '#4e342e' }, accent: '#fb8c00',
    deco: [
      { shape: 'ellipse', x: -130, y: 520, w: 360, h: 360, fill: '#ffcc80' },
      { shape: 'ellipse', x: 1090, y: -110, w: 300, h: 300, fill: '#ffe0b2' },
      { shape: 'rect', x: 0, y: 704, w: 1280, h: 16, fill: '#fb8c00' },
    ],
  },
  'bau-troi-dem': {
    name: 'Bầu trời đêm', bg: '#16213e', title: { font: 'Segoe UI', color: '#ffd54f' }, body: { font: 'Segoe UI', color: '#ffffff' }, accent: '#ffd54f',
    deco: [
      { shape: 'star5', x: 1150, y: 36, w: 64, h: 64, fill: '#ffd54f' },
      { shape: 'star5', x: 1072, y: 112, w: 30, h: 30, fill: '#fff59d' },
      { shape: 'star5', x: 70, y: 636, w: 36, h: 36, fill: '#fff59d' },
    ],
  },
  'tim-mong-mo': {
    name: 'Tím mộng mơ', bg: '#f7effa', title: { font: 'Cambria', color: '#6a1b9a' }, body: { font: 'Cambria', color: '#3e2a47' }, accent: '#8e24aa',
    deco: [
      { shape: 'rect', x: 0, y: 0, w: 1280, h: 12, fill: '#8e24aa' },
      { shape: 'roundRect', x: 1060, y: 610, w: 260, h: 150, fill: '#e1bee7' },
    ],
  },
  'bang-den': {
    name: 'Bảng đen', bg: '#2f4f3e', title: { font: 'Comic Sans MS', color: '#fff59d' }, body: { font: 'Comic Sans MS', color: '#ffffff' }, accent: '#a5d6a7',
    deco: [{ shape: 'rect', x: 9, y: 9, w: 1262, h: 702, fill: null, line: { color: '#8d6e63', w: 14 } }],
  },
  'toi-gian': {
    name: 'Tối giản', bg: '#fafafa', title: { font: 'Georgia', color: '#263238' }, body: { font: 'Georgia', color: '#455a64' }, accent: '#e53935',
    deco: [
      { shape: 'rect', x: 92, y: 176, w: 120, h: 6, fill: '#e53935', on: 'content' },
      { shape: 'rect', x: 580, y: 372, w: 120, h: 6, fill: '#e53935', on: 'title' },
    ],
  },
}
export const theme = (deck) => THEMES[deck.theme] || THEMES.office
export function decoFor(th, layout) {
  return th.deco.filter((d) => !d.on || (d.on === 'title' ? layout === 'title' : layout !== 'title' && layout !== 'blank'))
}

// ---------------- Hình dạng ----------------
export const SHAPES = {
  rect: 'Hình chữ nhật',
  roundRect: 'Chữ nhật bo góc',
  ellipse: 'Hình bầu dục (Oval)',
  triangle: 'Tam giác',
  rightArrow: 'Mũi tên phải',
  star5: 'Ngôi sao 5 cánh',
}
export function shapePath(shape, w, h) {
  switch (shape) {
    case 'roundRect': {
      const r = Math.min(w, h) * 0.167
      return `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`
    }
    case 'ellipse':
      return `M0,${h / 2} A${w / 2},${h / 2} 0 1,0 ${w},${h / 2} A${w / 2},${h / 2} 0 1,0 0,${h / 2} Z`
    case 'triangle':
      return `M${w / 2},0 L${w},${h} L0,${h} Z`
    case 'rightArrow': {
      const hx = w - Math.min(h / 2, w)
      return `M0,${h * 0.25} H${hx} V0 L${w},${h / 2} L${hx},${h} V${h * 0.75} H0 Z`
    }
    case 'star5': {
      const pts = []
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const r = i % 2 ? 0.38 : 0.5
        pts.push(`${w / 2 + Math.cos(a) * r * w},${h / 2 + Math.sin(a) * r * h * 1.05 + h * 0.03}`)
      }
      return `M${pts.join(' L')} Z`
    }
    default:
      return `M0,0 H${w} V${h} H0 Z`
  }
}

// ---------------- Hiệu ứng ----------------
export const TRANSITIONS = {
  none: { name: 'Không', ic: '⨯' },
  fade: { name: 'Mờ dần', ic: '◐' },
  push: { name: 'Đẩy', ic: '⇧', dirs: true },
  wipe: { name: 'Lau', ic: '▤', dirs: true },
  split: { name: 'Tách', ic: '⇔' },
  cover: { name: 'Che phủ', ic: '▨', dirs: true },
  zoom: { name: 'Phóng to', ic: '⊕' },
  dissolve: { name: 'Hoà tan', ic: '░' },
  random: { name: 'Ngẫu nhiên', ic: '?' },
}
export const DIRS = { u: 'Từ dưới lên', d: 'Từ trên xuống', l: 'Từ phải sang', r: 'Từ trái sang' }
export const ANIMS = {
  none: { name: 'Không', ic: '⨯' },
  appear: { name: 'Xuất hiện', ic: '★' },
  fade: { name: 'Mờ dần', ic: '◐' },
  fly: { name: 'Bay vào', ic: '↑' },
  wipe: { name: 'Lau', ic: '▤' },
  zoom: { name: 'Phóng to', ic: '⊕' },
}
export const ANIM_STARTS = { click: 'Khi bấm chuột', with: 'Cùng lúc với hiệu ứng trước', after: 'Sau hiệu ứng trước' }

// ---------------- Tạo mới ----------------
let seq = 0
export const uid = (p = 'o') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

export const emptyDoc = (body, align) =>
  body
    ? { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }] }
    : { type: 'doc', content: [{ type: 'paragraph', attrs: align ? { textAlign: align } : {} }] }

export function placeholderObj(def) {
  return { id: uid(), kind: 'text', ph: def.ph, x: def.x, y: def.y, w: def.w, h: def.h, valign: def.valign || 'top', align: def.align || null, doc: emptyDoc(isBody(def.ph)) }
}
export function newSlide(layout = 'titleContent') {
  return { id: uid('s'), layout, bg: null, transition: null, hf: null, objs: LAYOUTS[layout].phs.map(placeholderObj) }
}
export const newDeck = () => ({ v: 1, theme: 'office', slides: [newSlide('title')] })

// Đổi bố cục: giữ nội dung các ô đã có, giống PowerPoint
export function changeLayout(slide, layout) {
  const old = slide.objs
  const used = new Set()
  const phs = LAYOUTS[layout].phs.map((def) => {
    const same = old.find((o) => !used.has(o) && o.ph && (o.ph === def.ph || (isBody(o.ph) && isBody(def.ph)) || (o.ph === 'subtitle' && isBody(def.ph)) || (isBody(o.ph) && def.ph === 'subtitle')))
    if (same) {
      used.add(same)
      return { ...same, ph: def.ph, x: def.x, y: def.y, w: def.w, h: def.h, valign: def.valign || 'top', align: def.align || null }
    }
    return placeholderObj(def)
  })
  const rest = old.filter((o) => !used.has(o) && (!o.ph || !isEmptyDoc(o.doc))).map((o) => (o.ph ? { ...o, ph: null } : o))
  slide.layout = layout
  slide.objs = [...phs, ...rest]
}

// ---------------- Đọc nội dung chữ ----------------
export function docText(doc) {
  const out = []
  const walk = (n) => {
    if (n.type === 'text') out.push(n.text)
    if (n.type === 'hardBreak') out.push('\n')
    ;(n.content || []).forEach(walk)
    if (n.type === 'paragraph') out.push('\n')
  }
  if (doc) walk(doc)
  return out.join('').replace(/\n+$/, '')
}
export const isEmptyDoc = (doc) => !docText(doc).trim()
export const objText = (o) => (o.doc ? docText(o.doc) : '')

export const BODY_SIZES = [28, 24, 20, 20, 20]
export function defaultSize(o, level, layout) {
  if (o.ph === 'title') return layout === 'title' ? 60 : layout === 'section' ? 54 : 44
  if (o.ph === 'subtitle') return 24
  if (isBody(o.ph)) return BODY_SIZES[Math.min(level, 4)]
  return 18
}
export function defaultFont(o, th) {
  return o.ph === 'title' ? th.title.font : th.body.font
}
export function defaultColor(o, th) {
  if (o.kind === 'shape') return '#ffffff'
  return o.ph === 'title' ? th.title.color : th.body.color
}

const ptOf = (v) => (v == null ? null : parseFloat(String(v)))
// Các đoạn văn của một khung chữ, kèm định dạng thực tế của từng đoạn chữ (đã tính mặc định của bản mẫu)
export function paragraphs(o, deck, slide) {
  const th = theme(deck)
  const out = []
  const walk = (n, ctx) => {
    if (n.type === 'paragraph') {
      const runs = []
      let brk = false
      for (const c of n.content || []) {
        if (c.type === 'hardBreak') { brk = true; continue }
        if (c.type !== 'text') continue
        const m = {}
        for (const mk of c.marks || []) {
          if (mk.type === 'bold') m.b = true
          else if (mk.type === 'italic') m.i = true
          else if (mk.type === 'underline') m.u = true
          else if (mk.type === 'strike') m.s = true
          else if (mk.type === 'link') m.link = mk.attrs?.href || ''
          else if (mk.type === 'textStyle') {
            if (mk.attrs?.fontFamily) m.font = String(mk.attrs.fontFamily).replace(/["']/g, '').split(',')[0].trim()
            if (mk.attrs?.fontSize) m.size = ptOf(mk.attrs.fontSize)
            if (mk.attrs?.color) m.color = mk.attrs.color
          }
        }
        const lv = Math.max(0, ctx.level)
        runs.push({
          text: c.text,
          br: brk,
          b: !!m.b, i: !!m.i, u: !!m.u, s: !!m.s,
          link: m.link || null,
          font: m.font || defaultFont(o, th),
          size: m.size || defaultSize(o, lv, slide?.layout),
          color: m.color || defaultColor(o, th),
          explicit: { font: !!m.font, size: !!m.size, color: !!m.color },
        })
        brk = false
      }
      out.push({
        text: runs.map((r) => r.text).join(''),
        runs,
        align: n.attrs?.textAlign || o.align || (o.kind === 'shape' ? 'center' : 'left'),
        list: ctx.list,
        level: Math.max(0, ctx.level),
        listStyle: ctx.style || null,
      })
      return
    }
    if (n.type === 'bulletList' || n.type === 'orderedList') {
      for (const li of n.content || []) {
        for (const c of li.content || []) walk(c, { list: n.type === 'bulletList' ? 'bullet' : 'number', level: ctx.level + 1, style: n.attrs?.listStyle || null })
      }
      return
    }
    for (const c of n.content || []) walk(c, ctx)
  }
  if (o.doc) walk(o.doc, { list: null, level: -1, style: null })
  return out
}

// ---------------- Đầu trang & chân trang ----------------
export const HF_POS = {
  date: { x: 88, y: 667, w: 288, h: 38, align: 'left' },
  footer: { x: 424, y: 667, w: 432, h: 38, align: 'center' },
  num: { x: 904, y: 667, w: 288, h: 38, align: 'right' },
}
export function hfOf(deck, slide) {
  const hf = slide.hf
  if (!hf) return null
  if (hf.notOnTitle && slide.layout === 'title') return null
  return hf
}
export function todayText() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
export function hfItems(deck, slide, index) {
  const hf = hfOf(deck, slide)
  if (!hf) return []
  const items = []
  if (hf.date) items.push({ key: 'date', text: hf.dateAuto !== false ? todayText() : hf.dateText || '' })
  if (hf.footer && hf.footerText) items.push({ key: 'footer', text: hf.footerText })
  if (hf.num) items.push({ key: 'num', text: String(index + 1) })
  return items
}

// ---------------- Ảnh: tham chiếu tới kho ảnh ----------------
export function imageRefs(deck) {
  const ids = new Set()
  for (const s of deck.slides) for (const o of s.objs) if (o.kind === 'image' && o.src?.startsWith('idb:')) ids.add(o.src.slice(4))
  return ids
}

// Chuẩn hoá dữ liệu cũ / thiếu trường
export function normalizeDeck(d) {
  if (!d || !Array.isArray(d.slides) || !d.slides.length) return newDeck()
  d.theme = THEMES[d.theme] ? d.theme : 'office'
  for (const s of d.slides) {
    s.id ||= uid('s')
    s.layout = LAYOUTS[s.layout] ? s.layout : 'blank'
    s.objs = (s.objs || []).filter(Boolean)
    for (const o of s.objs) o.id ||= uid()
  }
  return d
}
