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
