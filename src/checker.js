// Chấm bài: đọc tài liệu dạng JSON của trình soạn thảo, so với từng yêu cầu của đề.

// ---------- Trải phẳng tài liệu ----------
export function analyze(json) {
  const blocks = [] // mỗi đoạn: { text, chars:[{c, marks}], attrs, list, listDepth, listStyle, inTable }
  const tables = []
  const imageList = []

  function walk(node, ctx) {
    if (!node) return
    if (node.type === 'image') imageList.push(node.attrs || {})
    if (node.type === 'paragraph' || node.type === 'heading') {
      const chars = []
      for (const child of node.content || []) {
        if (child.type === 'text') {
          const marks = markMap(child.marks)
          for (const c of child.text) chars.push({ c, marks })
        } else if (child.type === 'image') {
          imageList.push(child.attrs || {})
          chars.push({ c: '￼', marks: {} })
        } else if (child.type === 'pageNumber') {
          chars.push({ c: '\uE000', marks: {}, pageNumber: child.attrs?.kind || 'current' })
        } else if (child.type === 'hardBreak') {
          chars.push({ c: '\n', marks: {} })
        }
      }
      blocks.push({ type: node.type, text: chars.map((x) => x.c).join(''), chars, attrs: node.attrs || {}, list: ctx.list, listDepth: ctx.listDepth || 0, listStyle: ctx.listStyle, inTable: ctx.inTable })
      return
    }
    if (node.type === 'table') {
      const rows = node.content || []
      let cols = 0
      let merged = false
      const cells = []
      for (const row of rows) {
        let w = 0
        const rowText = []
        for (const cell of row.content || []) {
          const cs = cell.attrs?.colspan || 1
          const rs = cell.attrs?.rowspan || 1
          if (cs > 1 || rs > 1) merged = true
          w += cs
          rowText.push(plainText(cell).trim())
        }
        cols = Math.max(cols, w)
        cells.push(rowText)
      }
      tables.push({ rows: rows.length, cols, merged, cells })
      for (const row of rows) for (const cell of row.content || []) walk(cell, { ...ctx, inTable: true })
      return
    }
    const next = { ...ctx }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      next.list = node.type === 'bulletList' ? 'bullet' : 'ordered'
      next.listDepth = (ctx.listDepth || 0) + 1
      next.listStyle = node.attrs?.listStyle || (next.list === 'bullet' ? ['disc', 'circle', 'square'][(next.listDepth - 1) % 3] : 'decimal')
    }
    for (const child of node.content || []) walk(child, next)
  }
  walk(json, { list: null, inTable: false })
  const fullText = blocks.map((b) => b.text).join('\n')
  return { blocks, tables, images: imageList.length, imageList, fullText }
}

function plainText(node) {
  if (node.type === 'text') return node.text
  return (node.content || []).map(plainText).join(node.type === 'tableCell' || node.type === 'tableHeader' ? ' ' : '')
}

// Chữ chưa đặt phông/cỡ thì mang phông/cỡ mặc định của văn bản (giống Word)
export const DEFAULT_RUN = { fontFamily: 'Times New Roman', fontSize: '14pt' }

function markMap(marks = []) {
  const m = { ...DEFAULT_RUN }
  for (const mark of marks) {
    if (mark.type === 'textStyle') {
      if (mark.attrs?.color) m.color = mark.attrs.color
      if (mark.attrs?.fontSize) m.fontSize = mark.attrs.fontSize
      if (mark.attrs?.fontFamily) m.fontFamily = mark.attrs.fontFamily
    } else if (mark.type === 'highlight') {
      m.highlight = mark.attrs?.color || '#ffff00'
    } else {
      m[mark.type] = true // bold, italic, underline, strike
    }
  }
  return m
}

// ---------- Màu: so theo nhóm màu để học sinh chọn sắc nào gần đúng cũng được ----------
export function colorFamily(css) {
  const rgb = toRgb(css)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < 0.12) return l < 0.25 ? 'đen' : l > 0.85 ? 'trắng' : 'xám'
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360) % 360
  if (h < 15 || h >= 335) return 'đỏ'
  if (h < 40) return 'cam'
  if (h < 70) return 'vàng'
  if (h < 165) return 'xanh lá'
  if (h < 255) return 'xanh dương'
  if (h < 290) return 'tím'
  return 'hồng'
}

function toRgb(css) {
  if (!css) return null
  css = css.trim().toLowerCase()
  let m = css.match(/^#([0-9a-f]{3})$/)
  if (m) return m[1].split('').map((x) => parseInt(x + x, 16))
  m = css.match(/^#([0-9a-f]{6})/)
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
  m = css.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/)
  if (m) return [+m[1], +m[2], +m[3]]
  const named = { red: '#ff0000', blue: '#0000ff', green: '#008000', black: '#000000', yellow: '#ffff00', orange: '#ffa500', purple: '#800080' }
  return named[css] ? toRgb(named[css]) : null
}

// ---------- Tiện ích tìm chữ ----------
const norm = (s) => s.normalize('NFC').replace(/\uE000/g, '')

function locate(info, text) {
  // trả về {block, start} của lần xuất hiện đầu tiên
  const t = norm(text)
  for (const block of info.blocks) {
    const i = norm(block.text).indexOf(t)
    if (i !== -1) return { block, start: i, len: t.length }
  }
  return null
}

function countOf(hay, needle) {
  let n = 0
  let i = hay.indexOf(needle)
  while (i !== -1) {
    n++
    i = hay.indexOf(needle, i + needle.length)
  }
  return n
}

function cmpNum(a, b, tol = 0.01) {
  return a != null && Math.abs(parseFloat(a) - parseFloat(b)) <= tol
}

// ---------- Chấm một yêu cầu ----------
// Trả về { ok, hint } — hint là gợi ý khi chưa đạt.
export function checkStep(check, info, page, extra) {
  const c = check
  switch (c.type) {
    case 'contains': {
      const ok = norm(info.fullText).includes(norm(c.text))
      return { ok, hint: ok ? '' : `Chưa thấy dòng chữ “${c.text}”. Kiểm tra lỗi gõ dấu.` }
    }
    case 'notContains': {
      const ok = !norm(info.fullText).includes(norm(c.text))
      return { ok, hint: ok ? '' : `Vẫn còn “${c.text}”.` }
    }
    case 'count': {
      const n = countOf(norm(info.fullText), norm(c.text))
      const ok = n === c.n
      return { ok, hint: ok ? '' : `“${c.text}” đang xuất hiện ${n} lần, cần ${c.n} lần.` }
    }
    case 'order': {
      const full = norm(info.fullText)
      const ids = c.texts.map((t) => full.indexOf(norm(t)))
      if (ids.some((i) => i === -1)) return { ok: false, hint: 'Có câu bị mất hoặc gõ sai.' }
      const ok = ids.every((v, i) => i === 0 || v > ids[i - 1])
      return { ok, hint: ok ? '' : 'Thứ tự các câu chưa đúng.' }
    }
    case 'format': {
      const loc = locate(info, c.text)
      if (!loc) return { ok: false, hint: `Không tìm thấy “${c.text}”.` }
      const chars = loc.block.chars.slice(loc.start, loc.start + loc.len).filter((x) => x.c.trim())
      const problems = []
      for (const key of ['bold', 'italic', 'underline']) {
        if (c[key] === undefined) continue
        if (!chars.every((x) => !!x.marks[key] === c[key])) problems.push({ bold: 'in đậm', italic: 'in nghiêng', underline: 'gạch chân' }[key] + (c[key] ? '' : ' (phải bỏ)'))
      }
      if (c.color && !chars.every((x) => colorFamily(x.marks.color) === c.color)) problems.push(`màu ${c.color}`)
      if (c.fontSize && !chars.every((x) => cmpNum(x.marks.fontSize, c.fontSize, 0.5))) problems.push(`cỡ chữ ${c.fontSize}`)
      if (c.fontFamily && !chars.every((x) => (x.marks.fontFamily || '').replace(/["']/g, '').toLowerCase().startsWith(c.fontFamily.toLowerCase()))) problems.push(`phông ${c.fontFamily}`)
      if (c.highlight && !chars.every((x) => x.marks.highlight)) problems.push('tô màu nền')
      return { ok: !problems.length, hint: problems.length ? `“${short(c.text)}” chưa đúng: ${problems.join(', ')}.` : '' }
    }
    case 'align': {
      const loc = locate(info, c.text)
      if (!loc) return { ok: false, hint: `Không tìm thấy “${c.text}”.` }
      const v = loc.block.attrs.textAlign || 'left'
      const ok = v === c.value
      const name = { left: 'căn trái', center: 'căn giữa', right: 'căn phải', justify: 'căn đều hai bên' }
      return { ok, hint: ok ? '' : `Đoạn “${short(c.text)}” cần ${name[c.value]}.` }
    }
    case 'para': {
      const loc = locate(info, c.text)
      if (!loc) return { ok: false, hint: `Không tìm thấy “${c.text}”.` }
      const a = loc.block.attrs
      const problems = []
      if (c.lineHeight && !cmpNum(a.lineHeight, c.lineHeight, 0.05)) problems.push(`giãn dòng ${c.lineHeight}`)
      if (c.indentFirst && !cmpNum(a.indentFirst, c.indentFirst, 0.15)) problems.push(`thụt dòng đầu ${c.indentFirst} cm`)
      if (c.indentLeft && !cmpNum(a.indentLeft, c.indentLeft, 0.15)) problems.push(`thụt lề trái ${c.indentLeft} cm`)
      if (c.spaceAfter && !cmpNum(a.spaceAfter, c.spaceAfter, 0.5)) problems.push(`cách đoạn sau ${c.spaceAfter} pt`)
      if (c.spaceBefore && !cmpNum(a.spaceBefore, c.spaceBefore, 0.5)) problems.push(`cách đoạn trước ${c.spaceBefore} pt`)
      return { ok: !problems.length, hint: problems.length ? `Đoạn “${short(c.text)}” chưa đúng: ${problems.join(', ')}.` : '' }
    }
    case 'list': {
      const texts = c.texts || [c.text]
      for (const t of texts) {
        const loc = locate(info, t)
        if (!loc) return { ok: false, hint: `Không tìm thấy “${t}”.` }
        if (loc.block.list !== c.kind) return { ok: false, hint: `“${short(t)}” chưa nằm trong danh sách ${c.kind === 'bullet' ? 'dấu đầu dòng' : 'đánh số'}.` }
        if (c.level && loc.block.listDepth !== c.level) return { ok: false, hint: `“${short(t)}” cần ở mức ${c.level} (đang ở mức ${loc.block.listDepth}). Dùng Tab / Shift+Tab hoặc nút thụt lề.` }
        if (c.style && loc.block.listStyle !== c.style) return { ok: false, hint: `“${short(t)}” chưa đúng kiểu ${c.styleName || c.style}.` }
        if (c.notStyle && loc.block.listStyle === c.notStyle) return { ok: false, hint: `Hãy đổi kiểu cho danh sách có “${short(t)}”.` }
      }
      return { ok: true, hint: '' }
    }
    case 'table': {
      if (!info.tables.length) return { ok: false, hint: 'Chưa có bảng nào.' }
      const t = info.tables.find((t) => (!c.rows || t.rows === c.rows) && (!c.cols || t.cols === c.cols)) || info.tables[0]
      const problems = []
      if (c.rows && t.rows !== c.rows) problems.push(`bảng đang có ${t.rows} hàng, cần ${c.rows}`)
      if (c.cols && t.cols !== c.cols) problems.push(`bảng đang có ${t.cols} cột, cần ${c.cols}`)
      if (c.merged && !t.merged) problems.push('chưa gộp ô')
      if (c.filled && t.cells.flat().some((x) => !x)) problems.push('còn ô trống')
      if (c.cellText) {
        const all = t.cells.flat().map(norm)
        for (const s of c.cellText) if (!all.some((x) => x.includes(norm(s)))) problems.push(`thiếu “${s}” trong bảng`)
      }
      return { ok: !problems.length, hint: problems.join('; ') }
    }
    case 'image': {
      if (info.images < (c.min || 1)) return { ok: false, hint: 'Chưa chèn hình ảnh.' }
      if (c.wrap) {
        const ok = info.imageList.some((a) => (c.wrap === 'any' ? a.wrap && a.wrap !== 'inline' : a.wrap === c.wrap))
        return { ok, hint: ok ? '' : 'Chọn ảnh → tab Ảnh → “Chữ bao quanh”.' }
      }
      if (c.maxWidth) {
        const ok = info.imageList.some((a) => a.width && a.width <= c.maxWidth)
        return { ok, hint: ok ? '' : 'Ảnh còn to quá, hãy thu nhỏ lại.' }
      }
      return { ok: true, hint: '' }
    }
    case 'header':
    case 'footer': {
      const name = c.type === 'header' ? 'Đầu trang' : 'Chân trang'
      const hf = extra?.[c.type]
      if (!hf) return { ok: false, hint: `${name} đang trống.` }
      const sub = analyze(hf)
      if (c.text && !norm(sub.fullText).includes(norm(c.text))) return { ok: false, hint: `${name} chưa có “${c.text}”.` }
      const pn = sub.blocks.find((b) => b.chars.some((x) => x.pageNumber === 'current'))
      if (c.pageNumber && !pn) return { ok: false, hint: `${name} chưa có số trang (Chèn → Số trang).` }
      if (c.align) {
        const b = c.pageNumber ? pn : c.text ? sub.blocks.find((b) => norm(b.text).includes(norm(c.text))) : sub.blocks[0]
        const name2 = { left: 'bên trái', center: 'ở giữa', right: 'bên phải' }[c.align]
        if ((b?.attrs.textAlign || 'left') !== c.align) return { ok: false, hint: `${c.pageNumber ? 'Số trang' : `“${c.text}”`} trong ${name.toLowerCase()} cần ${name2}.` }
      }
      if (c.format) {
        const r = checkStep({ type: 'format', text: c.text, ...c.format }, sub, page)
        if (!r.ok) return { ok: false, hint: `${name}: ${r.hint}` }
      }
      return { ok: true, hint: '' }
    }
    // ---------- kiểu chấm mềm cho bài vận dụng ----------
    case 'minParagraphs': {
      const n = info.blocks.filter((b) => !b.inTable && b.text.replace(/\uFFFC/g, '').trim().length >= (c.minChars || 1)).length
      return { ok: n >= c.n, hint: n >= c.n ? '' : `Văn bản mới có ${n} đoạn/dòng có chữ, cần ít nhất ${c.n}.` }
    }
    case 'minWords': {
      const n = info.fullText.replace(/\uFFFC/g, ' ').trim().split(/\s+/).filter(Boolean).length
      return { ok: n >= c.n, hint: n >= c.n ? '' : `Văn bản mới có ${n} từ, cần ít nhất ${c.n} từ.` }
    }
    case 'anyFormat': {
      const ok = info.blocks.some((b) => b.chars.some((x) => {
        if (!x.c.trim()) return false
        const m = x.marks
        if (c.bold && !m.bold) return false
        if (c.italic && !m.italic) return false
        if (c.underline && !m.underline) return false
        if (c.color && !(m.color && colorFamily(m.color) !== 'đen')) return false
        if (c.fontSizeMin && !(parseFloat(m.fontSize) >= c.fontSizeMin)) return false
        if (c.highlight && !m.highlight) return false
        return true
      }))
      const what = [c.bold && 'in đậm', c.italic && 'in nghiêng', c.underline && 'gạch chân', c.color && 'có màu', c.fontSizeMin && `cỡ từ ${c.fontSizeMin} trở lên`, c.highlight && 'tô màu nền'].filter(Boolean).join(', ')
      return { ok, hint: ok ? '' : `Chưa có chữ nào ${what}.` }
    }
    case 'anyAlign': {
      const ok = info.blocks.some((b) => b.text.trim() && (b.attrs.textAlign || 'left') === c.value)
      const name = { left: 'căn trái', center: 'căn giữa', right: 'căn phải', justify: 'căn đều hai bên' }[c.value]
      return { ok, hint: ok ? '' : `Chưa có đoạn nào ${name}.` }
    }
    case 'anyPara': {
      const ok = info.blocks.some((b) => b.text.trim() && (!c.indentFirst || b.attrs.indentFirst > 0) && (!c.lineHeightMin || parseFloat(b.attrs.lineHeight) >= c.lineHeightMin))
      return { ok, hint: ok ? '' : c.indentFirst ? 'Chưa có đoạn nào thụt dòng đầu.' : `Chưa có đoạn nào giãn dòng từ ${c.lineHeightMin} trở lên.` }
    }
    case 'tableMin': {
      const t = info.tables.find((t) => t.rows >= (c.rows || 1) && t.cols >= (c.cols || 1))
      if (!t) return { ok: false, hint: `Cần một bảng ít nhất ${c.rows || 1} hàng × ${c.cols || 1} cột.` }
      if (c.filled && t.cells.flat().filter((x) => !x).length > (c.allowEmpty || 0)) return { ok: false, hint: 'Bảng còn nhiều ô trống.' }
      if (c.merged && !t.merged) return { ok: false, hint: 'Bảng chưa có ô nào được gộp.' }
      return { ok: true, hint: '' }
    }
    case 'anyList': {
      const items = info.blocks.filter((b) => b.list && (!c.kind || b.list === c.kind) && (!c.level || b.listDepth >= c.level))
      const n = c.minItems || 2
      const what = c.kind === 'ordered' ? 'đánh số' : c.kind === 'bullet' ? 'dấu đầu dòng' : 'liệt kê'
      return { ok: items.length >= n, hint: items.length >= n ? '' : `Cần danh sách ${what}${c.level ? ` có mức ${c.level}` : ''} với ít nhất ${n} mục.` }
    }
    case 'titlePage': {
      const ok = !!page.titlePage === c.value
      return { ok, hint: ok ? '' : 'Bật “Trang đầu khác” trong tab Đầu trang & Chân trang.' }
    }
    case 'page': {
      const problems = []
      if (c.orientation && page.orientation !== c.orientation) problems.push(`hướng trang ${c.orientation === 'landscape' ? 'nằm ngang' : 'đứng'}`)
      if (c.size && page.size !== c.size) problems.push(`khổ giấy ${c.size}`)
      for (const k of ['top', 'bottom', 'left', 'right']) {
        if (c[k] != null && !cmpNum(page.margins[k], c[k], 0.05)) problems.push(`lề ${{ top: 'trên', bottom: 'dưới', left: 'trái', right: 'phải' }[k]} ${c[k]} cm`)
      }
      return { ok: !problems.length, hint: problems.length ? `Cần chỉnh: ${problems.join(', ')} (tab Bố cục).` : '' }
    }
    default:
      return { ok: false, hint: `Loại yêu cầu lạ: ${c.type}` }
  }
}

function short(s) {
  return s.length > 30 ? s.slice(0, 28) + '…' : s
}

export function checkExercise(ex, json, page, extra = {}) {
  const info = analyze(json)
  return ex.steps.map((s) => checkStep(s.check, info, page, extra))
}
