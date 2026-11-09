import { Extension } from '@tiptap/core'

// Định dạng đoạn văn: giãn dòng, thụt lề trái, thụt dòng đầu, khoảng cách trước/sau.
// Gắn vào paragraph và heading (giống Word: định dạng đoạn thuộc về đoạn, không thuộc về chữ).
const PARA_ATTRS = {
  lineHeight: { css: 'line-height', parse: (v) => v || null, render: (v) => v },
  indentLeft: { css: 'margin-left', parse: cm, render: (v) => `${v}cm` },
  indentFirst: { css: 'text-indent', parse: cm, render: (v) => `${v}cm` },
  spaceBefore: { css: 'margin-top', parse: pt, render: (v) => `${v}pt` },
  spaceAfter: { css: 'margin-bottom', parse: pt, render: (v) => `${v}pt` },
}

function cm(v) {
  if (!v) return null
  const n = parseFloat(v)
  if (Number.isNaN(n)) return null
  if (v.endsWith('px')) return +(n / 37.8).toFixed(2)
  if (v.endsWith('pt')) return +(n / 28.35).toFixed(2)
  return n
}
function pt(v) {
  if (!v) return null
  const n = parseFloat(v)
  if (Number.isNaN(n)) return null
  if (v.endsWith('px')) return Math.round(n * 0.75)
  return n
}

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  addGlobalAttributes() {
    const attributes = {}
    for (const [key, def] of Object.entries(PARA_ATTRS)) {
      attributes[key] = {
        default: null,
        parseHTML: (el) => def.parse(el.style.getPropertyValue(def.css)),
        renderHTML: (attrs) => (attrs[key] == null || attrs[key] === 0 ? {} : { style: `${def.css}: ${def.render(attrs[key])}` }),
      }
    }
    return [{ types: ['paragraph', 'heading'], attributes }]
  },
  addCommands() {
    return {
      setParagraphFormat:
        (attrs) =>
        ({ commands }) => {
          commands.updateAttributes('paragraph', attrs)
          commands.updateAttributes('heading', attrs)
          return true
        },
      changeIndent:
        (delta) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              const cur = node.attrs.indentLeft || 0
              const next = Math.max(0, +(cur + delta).toFixed(2))
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indentLeft: next || null })
            }
          })
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },
})

// ---------------- Kiểu dấu đầu dòng / kiểu số cho danh sách (Tin 8 – Bài 8a) ----------------
export const BULLET_STYLES = {
  disc: { css: 'disc', glyph: '●', name: 'Chấm tròn' },
  circle: { css: 'circle', glyph: '○', name: 'Vòng tròn' },
  square: { css: 'square', glyph: '■', name: 'Ô vuông' },
  check: { css: '"✓  "', glyph: '✓', name: 'Dấu tích' },
  arrow: { css: '"➢  "', glyph: '➢', name: 'Mũi tên' },
  dash: { css: '"–  "', glyph: '–', name: 'Gạch ngang' },
  star: { css: '"★  "', glyph: '★', name: 'Ngôi sao' },
}
export const NUMBER_STYLES = {
  decimal: { css: 'decimal', sample: '1. 2. 3.', name: 'Số' },
  'lower-alpha': { css: 'lower-alpha', sample: 'a. b. c.', name: 'Chữ thường' },
  'upper-alpha': { css: 'upper-alpha', sample: 'A. B. C.', name: 'Chữ hoa' },
  'lower-roman': { css: 'lower-roman', sample: 'i. ii. iii.', name: 'La Mã thường' },
  'upper-roman': { css: 'upper-roman', sample: 'I. II. III.', name: 'La Mã hoa' },
}

export const ListStyle = Extension.create({
  name: 'listStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-list-style'),
            renderHTML: (attrs) => {
              const s = attrs.listStyle
              const def = BULLET_STYLES[s] || NUMBER_STYLES[s]
              return def ? { 'data-list-style': s, style: `list-style-type: ${def.css}` } : {}
            },
          },
        },
      },
    ]
  },
})

// ---------------- Ảnh: cách bố trí chữ quanh ảnh (Tin 8 – Bài 8a) ----------------
import Image from '@tiptap/extension-image'
import { Node, mergeAttributes } from '@tiptap/core'

// wrap: inline | left | right (chữ bao quanh) | topBottom (trên và dưới) | behind (sau chữ) | front (trước chữ)
// posX/posY: vị trí (px) so với góc trên-trái của đoạn chứa ảnh — dùng cho “sau chữ” / “trước chữ”
export const FREE_WRAPS = ['behind', 'front']
const num = (v) => (v == null || v === '' || Number.isNaN(+v) ? null : +v)
export const WrapImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      wrap: {
        default: 'inline',
        parseHTML: (el) => el.getAttribute('data-wrap') || 'inline',
        renderHTML: (attrs) => (attrs.wrap && attrs.wrap !== 'inline' ? { 'data-wrap': attrs.wrap } : {}),
      },
      posX: { default: null, parseHTML: (el) => num(el.getAttribute('data-x')), renderHTML: (a) => (a.posX == null ? {} : { 'data-x': a.posX }) },
      posY: { default: null, parseHTML: (el) => num(el.getAttribute('data-y')), renderHTML: (a) => (a.posY == null ? {} : { 'data-y': a.posY }) },
    }
  },
  addNodeView() {
    const parentFactory = this.parent?.()
    if (!parentFactory) return null
    return (props) => {
      const nv = parentFactory(props)
      let node = props.node
      const apply = (n) => {
        node = n
        const wrap = n.attrs.wrap || 'inline'
        nv.dom.dataset.wrap = wrap
        const free = FREE_WRAPS.includes(wrap)
        nv.dom.style.left = free ? `${n.attrs.posX || 0}px` : ''
        nv.dom.style.top = free ? `${n.attrs.posY || 0}px` : ''
        // nút kích thước đổi thuộc tính width/height: cập nhật lại ảnh đang hiển thị
        const img = nv.dom.querySelector('img')
        if (img && n.attrs.width) {
          img.style.width = `${n.attrs.width}px`
          img.style.height = n.attrs.height ? `${n.attrs.height}px` : 'auto'
        }
      }
      apply(props.node)
      const update = nv.update.bind(nv)
      nv.update = (n, d, i) => {
        const ok = update(n, d, i)
        if (ok) apply(n)
        return ok
      }
      // kéo ảnh “sau chữ” / “trước chữ” đi tự do
      nv.dom.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !FREE_WRAPS.includes(node.attrs.wrap) || e.target.closest('[data-resize-handle]')) return
        if (!props.editor.isEditable) return
        e.preventDefault()
        const pos = props.getPos()
        if (typeof pos !== 'number') return
        props.editor.commands.setNodeSelection(pos)
        const zoom = parseFloat(getComputedStyle(nv.dom.closest('.page-wrap') || document.body).zoom) || 1
        const x0 = node.attrs.posX || 0
        const y0 = node.attrs.posY || 0
        const sx = e.clientX
        const sy = e.clientY
        let moved = false
        const mm = (ev) => {
          const dx = (ev.clientX - sx) / zoom
          const dy = (ev.clientY - sy) / zoom
          if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return
          moved = true
          nv.dom.style.left = `${Math.round(x0 + dx)}px`
          nv.dom.style.top = `${Math.round(y0 + dy)}px`
        }
        const mu = () => {
          document.removeEventListener('mousemove', mm)
          document.removeEventListener('mouseup', mu)
          if (!moved) return
          const p = props.getPos()
          if (typeof p !== 'number') return
          const attrs = { ...node.attrs, posX: parseInt(nv.dom.style.left, 10) || 0, posY: parseInt(nv.dom.style.top, 10) || 0 }
          const { state, view } = props.editor
          const tr = state.tr.setNodeMarkup(p, undefined, attrs)
          view.dispatch(tr)
          props.editor.commands.setNodeSelection(p)
        }
        document.addEventListener('mousemove', mm)
        document.addEventListener('mouseup', mu)
      })
      return nv
    }
  },
})

// ---------------- Số trang trong đầu trang / chân trang (Tin 8 – Bài 9a) ----------------
export const PageNumber = Node.create({
  name: 'pageNumber',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { kind: { default: 'current', parseHTML: (el) => el.getAttribute('data-page-number') || 'current', renderHTML: () => ({}) } }
  },
  parseHTML() {
    return [{ tag: 'span[data-page-number]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    // chữ số hiển thị bằng CSS (::after) để mỗi trang tự thay đúng số của mình
    return ['span', mergeAttributes(HTMLAttributes, { 'data-page-number': node.attrs.kind, class: 'page-num', contenteditable: 'false' })]
  },
  renderText: ({ node }) => (node.attrs.kind === 'total' ? '#' : '1'),
  addCommands() {
    return {
      insertPageNumber:
        (kind = 'current') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { kind } }),
    }
  },
})

// ---------------- Ngắt trang (Ctrl+Enter) ----------------
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },
  renderHTML() {
    return ['div', { 'data-page-break': '', class: 'page-break', contenteditable: 'false' }]
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name }, { type: 'paragraph' }]).run(),
    }
  },
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() }
  },
})
