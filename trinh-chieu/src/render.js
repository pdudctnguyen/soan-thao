// Vẽ trang chiếu (không chỉnh sửa): dùng cho ảnh thu nhỏ, trình chiếu, và lớp nền khi soạn.
import { getSchema } from '@tiptap/core'
import { Node as PMNode, DOMSerializer } from '@tiptap/pm/model'
import { W, H, textExtensions, theme, decoFor, shapePath, isBody, isEmptyDoc, defaultSize, defaultFont, defaultColor, hfItems, HF_POS } from './model.js'
import { imageUrl } from './imgstore.js'

const schema = getSchema(textExtensions())
const serializer = DOMSerializer.fromSchema(schema)

const FALLBACK = {
  calibri: 'Calibri, Carlito, sans-serif',
  'calibri light': "'Calibri Light', Calibri, Carlito, sans-serif",
  cambria: 'Cambria, Caladea, Georgia, serif',
  'times new roman': "'Times New Roman', Tinos, Times, serif",
  arial: 'Arial, Arimo, Helvetica, sans-serif',
  georgia: 'Georgia, serif',
  'comic sans ms': "'Comic Sans MS', 'Comic Neue', cursive",
}
export const fontCss = (f) => FALLBACK[String(f).toLowerCase()] || `'${f}', sans-serif`

export function svgShape(shape, w, h, fill, line, cls = '') {
  const lw = line ? (line.w || 1) * (96 / 72) : 0
  return `<svg class="shape-svg ${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible" aria-hidden="true"><path d="${shapePath(shape, w, h)}" fill="${fill || 'none'}" ${line ? `stroke="${line.color}" stroke-width="${lw}" stroke-linejoin="round"` : ''}/></svg>`
}

export function docHtml(doc) {
  try {
    const frag = serializer.serializeFragment(PMNode.fromJSON(schema, doc).content)
    const div = document.createElement('div')
    div.appendChild(frag)
    return div.innerHTML
  } catch {
    return ''
  }
}

// kiểu chữ mặc định của khung (theo bản mẫu + vai trò ô giữ chỗ)
export function applyTextBase(el, o, deck, slide) {
  const th = theme(deck)
  el.style.fontFamily = fontCss(defaultFont(o, th))
  el.style.fontSize = `${defaultSize(o, 0, slide.layout)}pt`
  el.style.color = defaultColor(o, th)
  el.style.textAlign = o.align || (o.kind === 'shape' ? 'center' : 'left')
}

export function objClasses(o) {
  return `obj kind-${o.kind}${o.ph ? ` ph ph-${isBody(o.ph) ? 'body' : o.ph}` : ''}`
}
export function placeObj(el, o, z) {
  el.style.left = `${o.x}px`
  el.style.top = `${o.y}px`
  el.style.width = `${o.w}px`
  el.style.height = `${o.h}px`
  el.style.zIndex = String(z + 1)
}

// Nội dung bên trong một đối tượng (trừ phần chữ khi đang soạn)
export function fillObjVisual(el, o) {
  if (o.kind === 'image') {
    const img = document.createElement('img')
    img.src = imageUrl(o.src)
    img.alt = ''
    img.draggable = false
    el.appendChild(img)
    if (o.border) {
      el.style.outline = `${o.border.w}pt solid ${o.border.color}`
      el.style.outlineOffset = `-${o.border.w / 2}pt`
    } else {
      el.style.outline = ''
    }
    return
  }
  if (o.kind === 'shape' || o.fill || o.line) el.insertAdjacentHTML('afterbegin', svgShape(o.shape || 'rect', o.w, o.h, o.fill, o.line))
}

export function renderSlide(deck, slide, index, { show = false } = {}) {
  const th = theme(deck)
  const root = document.createElement('div')
  root.className = 'slide'
  root.style.width = `${W}px`
  root.style.height = `${H}px`
  root.style.background = slide.bg || th.bg
  root.appendChild(decoLayer(th, slide.layout))
  slide.objs.forEach((o, z) => {
    if (o.ph && o.kind === 'text' && isEmptyDoc(o.doc)) return
    const el = document.createElement('div')
    el.className = objClasses(o)
    el.dataset.id = o.id
    placeObj(el, o, z)
    fillObjVisual(el, o)
    if (o.kind !== 'image') {
      const wrap = document.createElement('div')
      wrap.className = `tx-wrap v-${o.valign || (o.kind === 'shape' ? 'middle' : 'top')}`
      const tx = document.createElement('div')
      tx.className = 'tx'
      applyTextBase(tx, o, deck, slide)
      tx.innerHTML = docHtml(o.doc)
      wrap.appendChild(tx)
      el.appendChild(wrap)
    }
    if (show && o.link) el.dataset.link = JSON.stringify(o.link)
    root.appendChild(el)
  })
  root.appendChild(hfLayer(deck, slide, index))
  return root
}

export function decoLayer(th, layout) {
  const d = document.createElement('div')
  d.className = 'deco'
  d.innerHTML = decoFor(th, layout)
    .map((s) => `<div style="position:absolute;left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px">${svgShape(s.shape, s.w, s.h, s.fill, s.line)}</div>`)
    .join('')
  return d
}

export function hfLayer(deck, slide, index) {
  const th = theme(deck)
  const d = document.createElement('div')
  d.className = 'hf-layer'
  for (const it of hfItems(deck, slide, index)) {
    const p = HF_POS[it.key]
    const el = document.createElement('div')
    el.className = `tc-hf tc-hf-${it.key}`
    el.style.cssText = `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;text-align:${p.align};font-family:${fontCss(th.body.font)};color:${th.body.color}`
    el.textContent = it.text
    d.appendChild(el)
  }
  return d
}
