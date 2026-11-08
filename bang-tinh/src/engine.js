// Tính công thức cho cả bảng tính. Dùng fast-formula-parser (MIT) và bổ sung các hàm nó còn thiếu.
import FormulaParser from 'fast-formula-parser'
import { key } from './addr.js'

const { FormulaError } = FormulaParser

export const isFormula = (raw) => typeof raw === 'string' && raw.length > 1 && raw[0] === '='

// Chữ người dùng gõ → giá trị: số, chữ, hoặc công thức
export function literal(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return raw
  const s = String(raw)
  if (s[0] === "'") return s.slice(1)
  const t = s.trim()
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return parseFloat(t)
  if (/^[-+]?(\d+\.?\d*|\.\d+)%$/.test(t)) return parseFloat(t) / 100
  if (/^(TRUE|FALSE)$/i.test(t)) return t.toUpperCase() === 'TRUE'
  return s
}

// ---------- các hàm bổ sung ----------
function flat(params, { numbersOnly = true, keepText = false } = {}) {
  const out = []
  for (const p of params) {
    if (p == null || p.omitted) continue
    const push = (v, fromRef) => {
      if (v instanceof FormulaError) throw v
      if (typeof v === 'number') out.push(v)
      else if (typeof v === 'boolean') { if (!fromRef || !numbersOnly) out.push(+v) }
      else if (typeof v === 'string') {
        if (keepText) out.push(v)
        else if (!fromRef && v.trim() !== '' && !isNaN(+v)) out.push(+v)
      }
    }
    if (Array.isArray(p.value)) for (const row of p.value) for (const v of Array.isArray(row) ? row : [row]) push(v, true)
    else push(p.value, p.isCellRef || p.isRangeRef)
  }
  return out
}
function cells(p) {
  if (Array.isArray(p.value)) return p.value.flat()
  return [p.value]
}
// Điều kiện kiểu Excel: ">5", "<>a", "=x", "a*" …
export function matchCriteria(value, crit) {
  let op = '='
  let target = crit
  if (typeof crit === 'string') {
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(crit)
    op = m[1] || '='
    target = m[2]
  }
  const tn = typeof target === 'number' ? target : target !== '' && !isNaN(+target) ? +target : null
  if (tn !== null && typeof value === 'number') {
    return { '=': value === tn, '<>': value !== tn, '<': value < tn, '>': value > tn, '<=': value <= tn, '>=': value >= tn }[op]
  }
  if (op === '<' || op === '>' || op === '<=' || op === '>=') return false
  const vs = value == null ? '' : String(value).toLowerCase()
  const ts = String(target).toLowerCase()
  const re = new RegExp('^' + ts.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 's')
  const eq = re.test(vs)
  return op === '<>' ? !eq : eq
}
function ifsPairs(params, start) {
  const pairs = []
  for (let i = start; i + 1 < params.length; i += 2) pairs.push([cells(params[i]), params[i + 1].value])
  return pairs
}
const sorted = (a) => [...a].sort((x, y) => x - y)

const EXTRA = {
  MAX: (...p) => { const n = flat(p); return n.length ? Math.max(...n) : 0 },
  MIN: (...p) => { const n = flat(p); return n.length ? Math.min(...n) : 0 },
  MAXA: (...p) => { const n = flat(p, { numbersOnly: false }); return n.length ? Math.max(...n) : 0 },
  MINA: (...p) => { const n = flat(p, { numbersOnly: false }); return n.length ? Math.min(...n) : 0 },
  MEDIAN: (...p) => {
    const n = sorted(flat(p))
    if (!n.length) return FormulaError.NUM
    const m = Math.floor(n.length / 2)
    return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2
  },
  LARGE: (arr, k) => { const n = sorted(flat([arr])).reverse(); return n[k.value - 1] ?? FormulaError.NUM },
  SMALL: (arr, k) => { const n = sorted(flat([arr])); return n[k.value - 1] ?? FormulaError.NUM },
  COUNTA: (...p) => p.reduce((a, x) => a + cells(x).filter((v) => v !== null && v !== undefined && v !== '').length, 0),
  COUNTBLANK: (p) => cells(p).filter((v) => v === null || v === undefined || v === '').length,
  COUNTIFS: (...p) => {
    const pairs = ifsPairs(p, 0)
    const n = pairs[0][0].length
    let count = 0
    for (let i = 0; i < n; i++) if (pairs.every(([r, c]) => matchCriteria(r[i], c))) count++
    return count
  },
  SUMIFS: (sumRange, ...p) => {
    const vals = cells(sumRange)
    const pairs = ifsPairs(p, 0)
    let sum = 0
    for (let i = 0; i < vals.length; i++) if (typeof vals[i] === 'number' && pairs.every(([r, c]) => matchCriteria(r[i], c))) sum += vals[i]
    return sum
  },
  RANK: (num, ref, order) => {
    const n = flat([ref])
    const v = num.value
    if (!n.includes(v)) return FormulaError.NA
    const asc = order && !order.omitted && order.value
    return 1 + n.filter((x) => (asc ? x < v : x > v)).length
  },
  UPPER: (t) => String(t.value ?? '').toUpperCase(),
  VALUE: (t) => { const n = +String(t.value).replace(/,/g, ''); return isNaN(n) ? FormulaError.VALUE : n },
  SUBSTITUTE: (t, a, b) => String(t.value ?? '').split(String(a.value)).join(String(b.value ?? '')),
  MATCH: (v, arr, type) => {
    const list = cells(arr)
    const mt = type && !type.omitted ? type.value : 1
    if (mt === 0) {
      const i = list.findIndex((x) => matchCriteria(x, typeof v.value === 'string' ? `=${v.value}` : v.value))
      return i === -1 ? FormulaError.NA : i + 1
    }
    let best = -1
    list.forEach((x, i) => { if (typeof x === 'number' && (mt > 0 ? x <= v.value : x >= v.value)) best = i })
    return best === -1 ? FormulaError.NA : best + 1
  },
}

// ---------- bộ tính ----------
// wb: { sheets: [{ name, cells: { 'r,c': { v } } }] }
export function createEngine(getWorkbook) {
  let memo = new Map()
  let visiting = new Set()

  const sheetByName = (name) => getWorkbook().sheets.find((s) => s.name.toLowerCase() === String(name).toLowerCase())

  function cellValue(sheetName, r, c) {
    const sh = sheetByName(sheetName)
    if (!sh) return FormulaError.REF
    const k = `${sh.name}!${key(r, c)}`
    if (memo.has(k)) return memo.get(k)
    const raw = sh.cells[key(r, c)]?.v
    if (!isFormula(raw)) {
      const v = literal(raw)
      memo.set(k, v)
      return v
    }
    if (visiting.has(k)) return new FormulaError('#CIRC!', 'Công thức tham chiếu vòng')
    visiting.add(k)
    const v = evaluate(raw.slice(1), sh.name, r, c)
    visiting.delete(k)
    memo.set(k, v)
    return v
  }

  // fast-formula-parser không cho gọi lồng nhau (công thức tham chiếu ô có công thức),
  // nên mỗi tầng lồng dùng một bộ phân tích riêng
  const parsers = []
  let depth = 0
  const parserAt = (d) => (parsers[d] ||= makeParser())
  const makeParser = () => new FormulaParser({
    functions: EXTRA,
    onCell: ({ sheet, row, col }) => {
      const v = cellValue(sheet, row - 1, col - 1)
      return v === undefined ? null : v
    },
    onRange: ({ sheet, from, to }) => {
      const out = []
      for (let r = from.row; r <= Math.min(to.row, 1000); r++) {
        const row = []
        for (let c = from.col; c <= Math.min(to.col, 200); c++) row.push(cellValue(sheet, r - 1, c - 1))
        out.push(row)
      }
      return out
    },
  })

  function evaluate(expr, sheet, r, c) {
    const pos = { sheet, row: r + 1, col: c + 1 }
    const tryParse = (e) => {
      depth++
      let v
      try {
        v = parserAt(depth).parse(e, pos)
      } finally {
        depth--
      }
      if (Array.isArray(v)) v = v[0]?.[0] ?? v[0]
      if (v === null || v === undefined) return 0
      return v
    }
    try {
      return tryParse(expr)
    } catch (err) {
      // máy Excel tiếng Việt hay dùng dấu ; ngăn cách đối số
      if (expr.includes(';')) {
        try {
          return tryParse(expr.replace(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ','))
        } catch { /* rơi xuống báo lỗi */ }
      }
      if (err instanceof FormulaError && /not implemented/.test(err.message || '')) return new FormulaError('#NAME?', err.message)
      if (err instanceof FormulaError && err.error) return err
      return new FormulaError('#NAME?', String(err?.message || err))
    }
  }

  return {
    // gọi trước mỗi lần vẽ lại
    reset() {
      memo = new Map()
      visiting = new Set()
    },
    value: (sheetName, r, c) => cellValue(sheetName, r, c),
    evaluate,
  }
}

export const isError = (v) => v instanceof FormulaError
export const errorText = (v) => (v instanceof FormulaError ? v.error || v._error || '#ERR' : '')
