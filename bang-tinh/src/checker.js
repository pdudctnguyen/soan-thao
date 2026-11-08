// Chấm bài bảng tính: so trạng thái bảng tính (giá trị, công thức, định dạng, biểu đồ…) với yêu cầu của đề.
import { parseRange, parseAddr, colIndex, colName, key, rangeStr, hasAbsoluteRef, inRange } from './addr.js'
import { isFormula, isError, errorText } from './engine.js'
import { colorFamily } from '../../src/checker.js'
import { displayValue } from './format.js'

const close = (a, b, tol = 0.01) => typeof a === 'number' && Math.abs(a - b) <= tol
const same = (v, expect, tol) => (typeof expect === 'number' ? close(v, expect, tol) : String(v ?? '').trim().toLowerCase() === String(expect).trim().toLowerCase())
const show = (v) => (isError(v) ? errorText(v) : v === null || v === undefined || v === '' ? '(trống)' : typeof v === 'number' ? String(+v.toFixed(4)) : `“${v}”`)

function cellsOf(c) {
  const rg = parseRange(c.range || c.cell)
  const out = []
  for (let r = rg.r1; r <= rg.r2; r++) for (let cc = rg.c1; cc <= rg.c2; cc++) out.push({ r, c: cc, a: `${colName(cc)}${r + 1}` })
  return out
}

export function checkStep(c, wb, engine, ctx) {
  const sh = c.sheet ? wb.sheets.find((s) => s.name.toLowerCase() === c.sheet.toLowerCase()) : wb.sheets[c.sheetIndex ?? 0]
  if (!sh) return { ok: false, hint: `Chưa có trang tính “${c.sheet}”.` }
  const raw = (r, cc) => sh.cells[key(r, cc)]?.v
  const val = (r, cc) => engine.value(sh.name, r, cc)
  const st = (r, cc) => sh.cells[key(r, cc)]?.s || {}

  switch (c.type) {
    case 'value': {
      // một ô, hoặc cả vùng với danh sách giá trị mong đợi
      const list = cellsOf(c)
      const exp = Array.isArray(c.equals) ? c.equals : list.map(() => c.equals)
      for (let i = 0; i < list.length; i++) {
        const { r, c: cc, a } = list[i]
        if (exp[i] === undefined) continue
        const v = val(r, cc)
        if (!same(v, exp[i], c.tol)) return { ok: false, hint: `Ô ${a} đang là ${show(v)}, cần ${show(exp[i])}.` }
      }
      return { ok: true }
    }
    case 'formula': {
      for (const { r, c: cc, a } of cellsOf(c)) {
        const f = raw(r, cc)
        if (!isFormula(f)) return { ok: false, hint: f ? `Ô ${a} đang gõ số trực tiếp, hãy dùng công thức (bắt đầu bằng dấu =).` : `Ô ${a} còn trống.` }
        const up = f.toUpperCase().replace(/\s/g, '')
        if (c.func) {
          const fns = Array.isArray(c.func) ? c.func : [c.func]
          if (!fns.some((fn) => up.includes(`${fn.toUpperCase()}(`))) return { ok: false, hint: `Ô ${a} cần dùng hàm ${fns.join(' hoặc ')}.` }
        }
        if (c.noFunc && /[A-Z]+\(/.test(up)) return { ok: false, hint: `Ô ${a}: bài này hãy tự viết công thức bằng phép toán, chưa dùng hàm.` }
        if (c.abs && !hasAbsoluteRef(f)) return { ok: false, hint: `Ô ${a} cần địa chỉ tuyệt đối (có dấu $, nhấn F4) để sao chép không bị lệch.` }
        if (c.refs) for (const ref of c.refs) if (!up.includes(ref.toUpperCase())) return { ok: false, hint: `Công thức ở ${a} cần tham chiếu tới ${ref}.` }
        const v = val(r, cc)
        if (isError(v)) return { ok: false, hint: `Ô ${a} đang báo lỗi ${errorText(v)}.` }
      }
      if (c.equals !== undefined) return checkStep({ ...c, type: 'value' }, wb, engine, ctx)
      return { ok: true }
    }
    case 'style': {
      const names = { b: 'in đậm', i: 'in nghiêng', u: 'gạch chân', wrap: 'xuống dòng trong ô' }
      for (const { r, c: cc, a } of cellsOf(c)) {
        const s = st(r, cc)
        for (const k of ['b', 'i', 'u', 'wrap']) if (c[k] !== undefined && !!s[k] !== c[k]) return { ok: false, hint: `Ô ${a} chưa ${names[k]}.` }
        if (c.fill && (c.fill === 'any' ? !s.fill : colorFamily(s.fill) !== c.fill)) return { ok: false, hint: `Ô ${a} chưa tô nền${c.fill === 'any' ? '' : ` màu ${c.fill}`}.` }
        if (c.color && colorFamily(s.color || '#000') !== c.color) return { ok: false, hint: `Chữ ở ô ${a} chưa có màu ${c.color}.` }
        if (c.align && (s.align || 'general') !== c.align) return { ok: false, hint: `Ô ${a} cần căn ${{ left: 'trái', center: 'giữa', right: 'phải' }[c.align]}.` }
        if (c.size && (s.size || 11) < c.size) return { ok: false, hint: `Ô ${a} cần cỡ chữ ${c.size} trở lên.` }
        if (c.nf) {
          const nf = s.nf || { kind: 'general' }
          if (c.nf.kind && nf.kind !== c.nf.kind) return { ok: false, hint: `Ô ${a} cần định dạng ${{ number: 'Số', percent: 'Phần trăm', currency: 'Tiền', general: 'Chung' }[c.nf.kind]}.` }
          if (c.nf.dec !== undefined && (nf.dec ?? (nf.kind === 'general' ? -1 : 2)) !== c.nf.dec) return { ok: false, hint: `Ô ${a} cần hiển thị ${c.nf.dec} chữ số thập phân (đang hiện “${displayValue(val(r, cc), s.nf)}”).` }
        }
      }
      return { ok: true }
    }
    case 'border': {
      const rg = parseRange(c.range)
      const has = (r, cc, side) => {
        const s = st(r, cc)
        const nb = { bt: [r - 1, cc, 'bb'], bb: [r + 1, cc, 'bt'], bl: [r, cc - 1, 'br'], br: [r, cc + 1, 'bl'] }[side]
        return !!s[side] || !!st(nb[0], nb[1])[nb[2]]
      }
      for (let r = rg.r1; r <= rg.r2; r++) {
        for (let cc = rg.c1; cc <= rg.c2; cc++) {
          const need = c.kind === 'all' ? ['bt', 'bb', 'bl', 'br'] : [r === rg.r1 && 'bt', r === rg.r2 && 'bb', cc === rg.c1 && 'bl', cc === rg.c2 && 'br'].filter(Boolean)
          for (const side of need) if (!has(r, cc, side)) return { ok: false, hint: `Vùng ${c.range} chưa kẻ đủ ${c.kind === 'all' ? 'tất cả đường viền' : 'viền ngoài'} (thiếu ở ô ${colName(cc)}${r + 1}).` }
        }
      }
      return { ok: true }
    }
    case 'merge': {
      const rg = parseRange(c.range)
      const ok = sh.merges.some((m) => m.r1 === rg.r1 && m.c1 === rg.c1 && m.r2 === rg.r2 && m.c2 === rg.c2)
      return { ok, hint: ok ? '' : `Chưa gộp vùng ${c.range} (chọn vùng → Gộp & căn giữa).` }
    }
    case 'colWidth': {
      const ci = colIndex(c.col)
      const w = sh.colW[ci] || 80
      return { ok: w >= c.min, hint: `Cột ${c.col} còn hẹp (${w} điểm ảnh). Kéo mép phải tiêu đề cột hoặc nháy đúp để vừa chữ.` }
    }
    case 'sheetName': {
      const ok = wb.sheets.some((s) => s.name.trim().toLowerCase() === c.name.toLowerCase())
      return { ok, hint: ok ? '' : `Chưa có trang tính tên “${c.name}” (nháy đúp vào tên trang tính để đổi).` }
    }
    case 'sheetCount': {
      const ok = wb.sheets.length >= c.min
      return { ok, hint: ok ? '' : `Bảng tính cần ít nhất ${c.min} trang tính (bấm ＋ ở góc dưới).` }
    }
    case 'sorted': {
      // vùng dữ liệu (không gồm tiêu đề) được sắp theo cột col
      const rg = parseRange(c.range)
      const cc = colIndex(c.col)
      let prev = null
      for (let r = rg.r1; r <= rg.r2; r++) {
        const v = val(r, cc)
        if (prev !== null) {
          const d = typeof v === 'number' && typeof prev === 'number' ? v - prev : String(v).localeCompare(String(prev), 'vi')
          if (c.desc ? d > 0 : d < 0) return { ok: false, hint: `Cột ${c.col} chưa sắp xếp ${c.desc ? 'giảm dần' : 'tăng dần'} (xem hàng ${r + 1}).` }
        }
        prev = v
      }
      if (c.keepRow) {
        // kiểm tra dữ liệu cùng hàng vẫn đi cùng nhau
        for (const [a, b] of c.keepRow) {
          let found = false
          for (let r = rg.r1; r <= rg.r2; r++) if (same(val(r, colIndex(a[0])), a[1]) && same(val(r, colIndex(b[0])), b[1])) found = true
          if (!found) return { ok: false, hint: 'Dữ liệu các cột bị lệch hàng. Hãy chọn cả bảng khi sắp xếp.' }
        }
      }
      return { ok: true }
    }
    case 'filter': {
      if (!sh.filter) return { ok: false, hint: 'Chưa bật Lọc (tab Dữ liệu → Lọc).' }
      const hidden = ctx.hiddenRows(sh)
      const f = sh.filter
      const visible = []
      for (let r = f.r1 + 1; r <= f.r2; r++) if (!hidden.has(r)) visible.push(r)
      if (c.col !== undefined) {
        const cc = colIndex(c.col)
        for (const r of visible) {
          const v = val(r, cc)
          if (c.equals !== undefined && !same(v, c.equals)) return { ok: false, hint: `Còn hiện hàng ${r + 1} có cột ${c.col} là ${show(v)}.` }
          if (c.gte !== undefined && !(typeof v === 'number' && v >= c.gte)) return { ok: false, hint: `Còn hiện hàng ${r + 1} có cột ${c.col} là ${show(v)} (cần ≥ ${c.gte}).` }
        }
      }
      if (c.count !== undefined && visible.length !== c.count) return { ok: false, hint: `Đang hiện ${visible.length} hàng dữ liệu, cần ${c.count} hàng.` }
      return { ok: true }
    }
    case 'chart': {
      const list = sh.charts
      if (!list.length) return { ok: false, hint: 'Chưa có biểu đồ (chọn vùng dữ liệu → tab Chèn → chọn kiểu biểu đồ).' }
      const ch = list.find((x) => !c.chartType || x.type === c.chartType)
      if (!ch) return { ok: false, hint: `Cần biểu đồ kiểu ${{ column: 'cột', bar: 'thanh', line: 'đường', pie: 'tròn' }[c.chartType]}.` }
      if (c.titleIncludes && !(ch.title || '').toLowerCase().includes(c.titleIncludes.toLowerCase())) return { ok: false, hint: `Tiêu đề biểu đồ cần có “${c.titleIncludes}”.` }
      if (c.covers) {
        const rg = parseRange(ch.range)
        const need = parseRange(c.covers)
        if (!rg || need.r1 < rg.r1 || need.r2 > rg.r2 || need.c1 < rg.c1 || need.c2 > rg.c2) return { ok: false, hint: `Vùng dữ liệu biểu đồ (${ch.range}) cần bao gồm ${c.covers}.` }
      }
      if (c.legend !== undefined && (ch.legend !== false) !== c.legend) return { ok: false, hint: c.legend ? 'Hãy bật Chú thích cho biểu đồ.' : 'Hãy tắt Chú thích.' }
      if (c.labels && !ch.labels) return { ok: false, hint: 'Hãy bật Nhãn dữ liệu cho biểu đồ.' }
      return { ok: true }
    }
    case 'dv': {
      for (const { r, c: cc, a } of cellsOf(c)) {
        const d = [...sh.dv].reverse().find((x) => { const rg = parseRange(x.range); return rg && inRange(rg, r, cc) })
        if (!d) return { ok: false, hint: `Ô ${a} chưa có xác thực dữ liệu (tab Dữ liệu → Xác thực dữ liệu).` }
        if (c.dvType && d.type !== c.dvType) return { ok: false, hint: `Ô ${a}: kiểu xác thực cần là “${{ list: 'Danh sách', whole: 'Số nguyên', decimal: 'Số thập phân', textLength: 'Độ dài văn bản' }[c.dvType]}”.` }
        if (c.listHas) {
          const items = (d.list || '').split(/[,;]/).map((x) => x.trim().toLowerCase())
          const fromRange = (d.list || '').startsWith('=')
          if (!fromRange) for (const v of c.listHas) if (!items.includes(v.toLowerCase())) return { ok: false, hint: `Danh sách ở ô ${a} cần có “${v}”.` }
        }
        if (c.min !== undefined && parseFloat(d.min) !== c.min) return { ok: false, hint: `Giá trị nhỏ nhất cho ô ${a} cần là ${c.min}.` }
        if (c.max !== undefined && parseFloat(d.max) !== c.max) return { ok: false, hint: `Giá trị lớn nhất cho ô ${a} cần là ${c.max}.` }
        if (c.message && !d.message) return { ok: false, hint: 'Hãy nhập thông báo lỗi cho học sinh nhập sai.' }
      }
      return { ok: true }
    }
    case 'page': {
      const ok = wb.page.orientation === c.orientation
      return { ok, hint: ok ? '' : `Hướng giấy in cần là ${c.orientation === 'landscape' ? 'ngang' : 'đứng'} (tab Bố cục trang).` }
    }
    case 'filled': {
      for (const { r, c: cc, a } of cellsOf(c)) if (raw(r, cc) === undefined || raw(r, cc) === '') return { ok: false, hint: `Ô ${a} còn trống.` }
      return { ok: true }
    }
    default:
      return { ok: false, hint: `Loại yêu cầu lạ: ${c.type}` }
  }
}

export function checkExercise(ex, wb, engine, ctx) {
  return ex.steps.map((s) => {
    try {
      const r = checkStep(s.check, wb, engine, ctx)
      return { ok: !!r.ok, hint: r.ok ? '' : r.hint }
    } catch (err) {
      console.error(err)
      return { ok: false, hint: 'Không kiểm tra được yêu cầu này.' }
    }
  })
}

void parseAddr
void rangeStr
