import { TextSelection } from '@tiptap/pm/state'

// Tìm mọi vị trí khớp trong tài liệu (không vượt qua ranh giới đoạn, giống Word cơ bản).
export function findAll(doc, query, matchCase = false) {
  const results = []
  if (!query) return results
  const q = matchCase ? query : query.toLocaleLowerCase('vi')
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ''
    const map = []
    node.forEach((child, offset) => {
      const start = pos + 1 + offset
      if (child.isText) {
        for (let i = 0; i < child.text.length; i++) {
          text += child.text[i]
          map.push(start + i)
        }
      } else {
        text += '￼'
        map.push(start)
      }
    })
    const hay = matchCase ? text : text.toLocaleLowerCase('vi')
    let idx = hay.indexOf(q)
    while (idx !== -1) {
      results.push({ from: map[idx], to: map[idx + q.length - 1] + 1 })
      idx = hay.indexOf(q, idx + q.length)
    }
    return false
  })
  return results
}

export function findNext(editor, query, matchCase) {
  const matches = findAll(editor.state.doc, query, matchCase)
  if (!matches.length) return { count: 0, index: -1 }
  const after = editor.state.selection.to
  let i = matches.findIndex((m) => m.from >= after)
  if (i === -1) i = 0 // quay vòng lại đầu tài liệu
  select(editor, matches[i])
  return { count: matches.length, index: i }
}

export function replaceCurrent(editor, query, replacement, matchCase) {
  const { from, to } = editor.state.selection
  const selected = editor.state.doc.textBetween(from, to)
  const same = matchCase ? selected === query : selected.toLocaleLowerCase('vi') === query.toLocaleLowerCase('vi')
  if (from !== to && same) {
    editor.chain().focus().insertContentAt({ from, to }, replacement ? { type: 'text', text: replacement, marks: marksAt(editor, from) } : '').run()
  }
  return findNext(editor, query, matchCase)
}

export function replaceAll(editor, query, replacement, matchCase) {
  const matches = findAll(editor.state.doc, query, matchCase)
  if (!matches.length) return 0
  const { state, view } = editor
  const tr = state.tr
  for (let i = matches.length - 1; i >= 0; i--) {
    const { from, to } = matches[i]
    const marks = state.doc.resolve(from + 1).marks()
    if (replacement) tr.replaceWith(from, to, state.schema.text(replacement, marks))
    else tr.delete(from, to)
  }
  view.dispatch(tr)
  return matches.length
}

function marksAt(editor, pos) {
  return editor.state.doc
    .resolve(pos + 1)
    .marks()
    .map((m) => m.toJSON())
}

function select(editor, { from, to }) {
  const { state, view } = editor
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView())
  view.focus()
}
