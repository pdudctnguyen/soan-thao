// Hiển thị giá trị theo định dạng số, và đổi kiểu ô (style) thành CSS.
import { isError, errorText } from './engine.js'

// nf: { kind: 'general'|'number'|'currency'|'percent'|'text', dec, sep }
export function displayValue(v, nf = {}) {
  if (v === null || v === undefined) return ''
  if (isError(v)) return errorText(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v !== 'number') return String(v)
  const kind = nf.kind || 'general'
  if (kind === 'general') return general(v)
  const dec = nf.dec ?? (kind === 'currency' ? 0 : 2)
  const fmt = (x) => x.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: kind === 'currency' || !!nf.sep })
  if (kind === 'percent') return `${fmt(v * 100)}%`
  if (kind === 'currency') return `${fmt(v)} ₫`
  return fmt(v)
}

function general(v) {
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v)
  if (Math.abs(v) >= 1e11 || (Math.abs(v) < 1e-9 && v !== 0)) return v.toExponential(4).replace(/\.?0+e/, 'E').replace('e', 'E')
  return String(+v.toPrecision(10))
}

// Mã định dạng kiểu Excel (dùng khi xuất .xlsx)
export function excelNumFmt(nf = {}) {
  const kind = nf.kind || 'general'
  if (kind === 'general') return undefined
  const dec = nf.dec ?? (kind === 'currency' ? 0 : 2)
  const d = dec > 0 ? '.' + '0'.repeat(dec) : ''
  if (kind === 'percent') return `0${d}%`
  if (kind === 'currency') return `#,##0${d} "₫"`
  if (kind === 'text') return '@'
  return `${nf.sep ? '#,##0' : '0'}${d}`
}
export function parseExcelNumFmt(code) {
  if (!code || code === 'General') return undefined
  const dec = (/\.(0+)/.exec(code) || [, ''])[1].length
  if (code.includes('%')) return { kind: 'percent', dec }
  if (/₫|đ|VND|\$/.test(code)) return { kind: 'currency', dec }
  if (code === '@') return { kind: 'text' }
  if (/0/.test(code)) return { kind: 'number', dec, sep: code.includes(',') }
  return undefined
}

// s: { b, i, u, color, fill, size, font, align, valign, wrap, bt, br, bb, bl, nf }
export function cellCss(s = {}, value) {
  const css = []
  if (s.b) css.push('font-weight:700')
  if (s.i) css.push('font-style:italic')
  if (s.u) css.push('text-decoration:underline')
  if (s.color) css.push(`color:${s.color}`)
  if (s.fill) css.push(`background:${s.fill}`)
  if (s.size) css.push(`font-size:${s.size}pt`)
  if (s.font) css.push(`font-family:'${s.font}'`)
  const align = s.align || (typeof value === 'number' ? 'right' : isError(value) || typeof value === 'boolean' ? 'center' : 'left')
  css.push(`text-align:${align}`)
  css.push(`vertical-align:${s.valign || 'bottom'}`)
  if (s.wrap) css.push('white-space:pre-wrap;word-break:break-word')
  const line = '1px solid #000'
  if (s.bt) css.push(`border-top:${line}`)
  if (s.br) css.push(`border-right:${line}`)
  if (s.bb) css.push(`border-bottom:${line}`)
  if (s.bl) css.push(`border-left:${line}`)
  return css.join(';')
}
