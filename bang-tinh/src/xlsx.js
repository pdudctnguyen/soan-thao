// Đọc / ghi tệp .xlsx bằng ExcelJS (MIT).
import ExcelJS from 'exceljs/dist/exceljs.min.js'
import { key, colName, parseRange, rangeStr, COLS, ROWS } from './addr.js'
import { isFormula, isError, errorText } from './engine.js'
import { excelNumFmt, parseExcelNumFmt } from './format.js'

const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6)
const hexOf = (c) => (c?.argb ? '#' + c.argb.slice(-6).toLowerCase() : undefined)
const pxToChars = (px) => Math.max(2, +(px / 7).toFixed(2))
const charsToPx = (ch) => Math.round(ch * 7 + 5)

export async function exportXlsx(wb, engine, { chartImage } = {}) {
  const book = new ExcelJS.Workbook()
  book.creator = 'Bảng tính – phần mềm thực hành Tin học'
  engine.reset()
  for (const sh of wb.sheets) {
    const ws = book.addWorksheet(sh.name, {
      pageSetup: { orientation: wb.page.orientation, paperSize: { A4: 9, A5: 11, Letter: 1 }[wb.page.size] || 9, fitToPage: wb.page.fit !== false, fitToWidth: 1, fitToHeight: 0, showGridLines: !!wb.page.grid },
    })
    for (let c = 0; c < COLS; c++) if (sh.colW[c]) ws.getColumn(c + 1).width = pxToChars(sh.colW[c])
    for (const [k, cell] of Object.entries(sh.cells)) {
      const [r, c] = k.split(',').map(Number)
      const xc = ws.getCell(r + 1, c + 1)
      if (cell.v !== undefined && cell.v !== '') {
        if (isFormula(cell.v)) {
          const res = engine.value(sh.name, r, c)
          xc.value = { formula: cell.v.slice(1), result: isError(res) ? { error: errorText(res) } : res ?? undefined }
        } else {
          const raw = String(cell.v)
          if (raw[0] === "'") xc.value = raw.slice(1)
          else {
            const v = engine.value(sh.name, r, c)
            xc.value = v
          }
        }
      }
      const s = cell.s || {}
      const font = {}
      if (s.b) font.bold = true
      if (s.i) font.italic = true
      if (s.u) font.underline = true
      if (s.color) font.color = { argb: argb(s.color) }
      if (s.size) font.size = s.size
      if (s.font) font.name = s.font
      // luôn ghi tên phông và cỡ chữ, nếu không một số phần mềm sẽ dùng phông khác
      if (Object.keys(font).length) xc.font = { name: 'Calibri', size: 11, ...font }
      if (s.fill) xc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(s.fill) } }
      if (s.align || s.valign || s.wrap) xc.alignment = { horizontal: s.align, vertical: s.valign === 'middle' ? 'middle' : s.valign, wrapText: !!s.wrap }
      const thin = { style: 'thin', color: { argb: 'FF000000' } }
      if (s.bt || s.bb || s.bl || s.br) xc.border = { top: s.bt ? thin : undefined, bottom: s.bb ? thin : undefined, left: s.bl ? thin : undefined, right: s.br ? thin : undefined }
      const code = excelNumFmt(s.nf)
      if (code) xc.numFmt = code
    }
    for (const m of sh.merges) ws.mergeCells(m.r1 + 1, m.c1 + 1, m.r2 + 1, m.c2 + 1)
    if (sh.filter) ws.autoFilter = { from: { row: sh.filter.r1 + 1, column: sh.filter.c1 + 1 }, to: { row: sh.filter.r2 + 1, column: sh.filter.c2 + 1 } }
    for (const d of sh.dv) {
      const rule = { allowBlank: true, showErrorMessage: true, errorStyle: 'stop', errorTitle: d.title || 'Nhập sai', error: d.message || 'Giá trị không hợp lệ' }
      if (d.type === 'list') {
        Object.assign(rule, { type: 'list', formulae: [d.list.startsWith('=') ? d.list.slice(1) : `"${d.list.split(/[,;]/).map((x) => x.trim()).join(',')}"`] })
      } else {
        const between = d.op === 'between' || d.op === 'notBetween'
        Object.assign(rule, { type: d.type, operator: d.op || 'between', formulae: between ? [d.min, d.max] : [d.min] })
      }
      ws.dataValidations.add(d.range.replace(':', ':'), rule)
    }
    // biểu đồ: lưu thành ảnh (ExcelJS chưa ghi được biểu đồ thật)
    for (const ch of sh.charts) {
      const img = chartImage?.(ch.id)
      if (!img) continue
      const id = book.addImage({ base64: img, extension: 'png' })
      ws.addImage(id, { tl: { col: ch.x / 80, row: ch.y / 22 }, ext: { width: ch.w, height: ch.h } })
    }
  }
  book.views = [{ activeTab: wb.active }]
  const buf = await book.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export async function importXlsx(arrayBuffer) {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(arrayBuffer)
  const out = { sheets: [], active: 0, page: { orientation: 'portrait', size: 'A4', grid: false, fit: true } }
  book.eachSheet((ws) => {
    const sh = { name: ws.name.slice(0, 31), cells: {}, colW: {}, merges: [], filter: null, charts: [], dv: [] }
    if (ws.pageSetup?.orientation && !out.sheets.length) out.page.orientation = ws.pageSetup.orientation
    ws.columns?.forEach((col, i) => { if (col.width && i < COLS) sh.colW[i] = charsToPx(col.width) })
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      if (rn > ROWS) return
      row.eachCell({ includeEmpty: false }, (xc, cn) => {
        if (cn > COLS) return
        const cell = {}
        const v = xc.value
        if (v && typeof v === 'object' && 'formula' in v) cell.v = '=' + v.formula
        else if (v && typeof v === 'object' && 'sharedFormula' in v) cell.v = '=' + (xc.formula || '')
        else if (v && typeof v === 'object' && 'richText' in v) cell.v = v.richText.map((t) => t.text).join('')
        else if (v && typeof v === 'object' && 'text' in v) cell.v = v.text
        else if (v instanceof Date) cell.v = `'${v.toLocaleDateString('vi-VN')}`
        else if (v !== null && v !== undefined) cell.v = String(v)
        const s = {}
        if (xc.font?.bold) s.b = true
        if (xc.font?.italic) s.i = true
        if (xc.font?.underline) s.u = true
        const fc = hexOf(xc.font?.color)
        if (fc && fc !== '#000000') s.color = fc
        if (xc.font?.size && xc.font.size !== 11) s.size = xc.font.size
        if (xc.font?.name && xc.font.name !== 'Calibri') s.font = xc.font.name
        if (xc.fill?.type === 'pattern' && xc.fill.fgColor?.argb) s.fill = hexOf(xc.fill.fgColor)
        if (xc.alignment?.horizontal && ['left', 'center', 'right'].includes(xc.alignment.horizontal)) s.align = xc.alignment.horizontal
        if (xc.alignment?.vertical && xc.alignment.vertical !== 'bottom') s.valign = xc.alignment.vertical === 'middle' ? 'middle' : 'top'
        if (xc.alignment?.wrapText) s.wrap = true
        if (xc.border?.top) s.bt = true
        if (xc.border?.bottom) s.bb = true
        if (xc.border?.left) s.bl = true
        if (xc.border?.right) s.br = true
        const nf = parseExcelNumFmt(xc.numFmt)
        if (nf) s.nf = nf
        if (Object.keys(s).length) cell.s = s
        if (cell.v !== undefined || cell.s) sh.cells[key(rn - 1, cn - 1)] = cell
      })
    })
    for (const m of ws.model.merges || []) {
      const rg = parseRange(m)
      if (rg) sh.merges.push(rg)
    }
    const af = ws.autoFilter
    if (af) {
      const rg = typeof af === 'string' ? parseRange(af) : af.from && parseRange(`${colName((af.from.column || 1) - 1)}${af.from.row}:${colName((af.to.column || 1) - 1)}${af.to.row}`)
      if (rg) sh.filter = { ...rg, crit: {} }
    }
    const dvs = ws.dataValidations?.model || {}
    for (const [ref, rule] of Object.entries(dvs)) {
      const range = ref.split(' ')[0]
      if (!parseRange(range)) continue
      const d = { range: rangeStr(parseRange(range)), type: rule.type, op: rule.operator || 'between', title: rule.errorTitle || '', message: rule.error || '' }
      if (rule.type === 'list') {
        const f = String(rule.formulae?.[0] ?? '')
        d.list = f.startsWith('"') ? f.slice(1, -1) : '=' + f
      } else {
        d.min = String(rule.formulae?.[0] ?? '')
        d.max = String(rule.formulae?.[1] ?? '')
      }
      if (['list', 'whole', 'decimal', 'textLength'].includes(d.type)) sh.dv.push(d)
    }
    out.sheets.push(sh)
  })
  if (!out.sheets.length) throw new Error('Tệp không có trang tính')
  return out
}
