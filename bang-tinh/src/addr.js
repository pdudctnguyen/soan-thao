// Địa chỉ ô (A1, $B$3, 'Chi tiêu'!C2…) và dịch chuyển công thức khi sao chép / chèn / xoá hàng cột.

export const ROWS = 100
export const COLS = 26

export function colName(c) {
  // c bắt đầu từ 0
  let s = ''
  c += 1
  while (c > 0) {
    const m = (c - 1) % 26
    s = String.fromCharCode(65 + m) + s
    c = Math.floor((c - 1) / 26)
  }
  return s
}
export function colIndex(name) {
  let n = 0
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
export const key = (r, c) => `${r},${c}`
export const addr = (r, c) => `${colName(c)}${r + 1}`

export function parseAddr(a) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a.trim())
  if (!m) return null
  return { r: +m[2] - 1, c: colIndex(m[1]) }
}
export function parseRange(s) {
  const [a, b] = s.split(':')
  const p = parseAddr(a)
  const q = b ? parseAddr(b) : p
  if (!p || !q) return null
  return norm({ r1: p.r, c1: p.c, r2: q.r, c2: q.c })
}
export function norm(rg) {
  return { r1: Math.min(rg.r1, rg.r2), c1: Math.min(rg.c1, rg.c2), r2: Math.max(rg.r1, rg.r2), c2: Math.max(rg.c1, rg.c2) }
}
export const rangeStr = (rg) => (rg.r1 === rg.r2 && rg.c1 === rg.c2 ? addr(rg.r1, rg.c1) : `${addr(rg.r1, rg.c1)}:${addr(rg.r2, rg.c2)}`)
export const inRange = (rg, r, c) => r >= rg.r1 && r <= rg.r2 && c >= rg.c1 && c <= rg.c2

export function quoteSheet(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`
}

// Tách công thức thành các mảnh: chuỗi "..." giữ nguyên; tham chiếu ô được nhận ra để biến đổi.
// Tham chiếu: (sheet!)?$?COL$?ROW — không theo sau bởi "(" (để không nhầm tên hàm như LOG10)
const REF_RE = /((?:'(?:[^']|'')+'|[A-Za-z_À-ỹ][\w.À-ỹ]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(])/g

function mapRefs(formula, fn) {
  let out = ''
  let i = 0
  // bỏ qua phần trong dấu ngoặc kép
  const parts = formula.split(/("(?:[^"]|"")*")/)
  for (const part of parts) {
    if (part.startsWith('"')) {
      out += part
      continue
    }
    let lastSheet = null
    out += part.replace(REF_RE, (m, sheet, dc, col, dr, row, offset, str) => {
      // tránh bắt nhầm phần đuôi của một từ dài hơn (vd: "ABCD1")
      const prev = str[offset - 1]
      if (!sheet && prev && /[\w$]/.test(prev)) return m
      const own = sheet ? sheet.slice(0, -1).replace(/^'(.*)'$/, '$1').replace(/''/g, "'") : null
      // vế sau của vùng 'Trang'!A1:B3 thuộc cùng trang với vế trước
      const implicit = !own && prev === ':' ? lastSheet : null
      lastSheet = own || implicit
      const res = fn({ sheet: own || implicit, implicit: !!implicit, absC: !!dc, absR: !!dr, c: colIndex(col), r: +row - 1 })
      if (res === null) return '#REF!'
      const sh = res.sheet && !res.implicit ? `${quoteSheet(res.sheet)}!` : ''
      return `${sh}${res.absC ? '$' : ''}${colName(res.c)}${res.absR ? '$' : ''}${res.r + 1}`
    })
    i++
  }
  return out
}

// Sao chép công thức sang ô lệch (dr, dc): tham chiếu tương đối dịch theo, tuyệt đối ($) giữ nguyên
export function shiftFormula(formula, dr, dc) {
  return mapRefs(formula, (ref) => {
    const r = ref.absR ? ref.r : ref.r + dr
    const c = ref.absC ? ref.c : ref.c + dc
    if (r < 0 || c < 0) return null
    return { ...ref, r, c }
  })
}

// Chèn (count > 0) hoặc xoá (count < 0) hàng/cột tại vị trí `at` trên trang `target`.
// Công thức nằm ở trang `home`. Tham chiếu tới vùng bị xoá thành #REF!
export function adjustFormula(formula, home, target, axis, at, count) {
  return mapRefs(formula, (ref) => {
    const sheet = ref.sheet || home
    if (sheet !== target) return ref
    const v = axis === 'row' ? ref.r : ref.c
    let nv = v
    if (count > 0 && v >= at) nv = v + count
    if (count < 0) {
      const del = -count
      if (v >= at && v < at + del) return null
      if (v >= at + del) nv = v - del
    }
    return axis === 'row' ? { ...ref, r: nv } : { ...ref, c: nv }
  })
}

// Đổi tên trang tính trong công thức
export function renameSheetInFormula(formula, oldName, newName) {
  return mapRefs(formula, (ref) => (ref.sheet === oldName ? { ...ref, sheet: newName } : ref))
}

// Có tham chiếu tuyệt đối ($) không — dùng khi chấm bài địa chỉ tuyệt đối
export function hasAbsoluteRef(formula) {
  let found = false
  mapRefs(formula, (ref) => {
    if (ref.absR || ref.absC) found = true
    return ref
  })
  return found
}

// Liệt kê các tham chiếu (để tô màu khi sửa công thức)
export function listRefs(formula) {
  const refs = []
  mapRefs(formula, (ref) => {
    refs.push(ref)
    return ref
  })
  return refs
}

// Viết hoa tên hàm và địa chỉ ô như Excel: =sum(a1:a3) → =SUM(A1:A3)
export function normalizeFormula(formula) {
  const parts = formula.split(/("(?:[^"]|"")*")/)
  const fixed = parts.map((p) => (p.startsWith('"') ? p : p.replace(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g, (m, name) => `${name.toUpperCase()}(`))).join('')
  return mapRefs(fixed, (ref) => ref)
}
