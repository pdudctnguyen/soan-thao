// Kho ảnh: ảnh lưu trong IndexedDB (dung lượng lớn), bài trình chiếu chỉ giữ mã 'idb:<id>'.
// Nhờ vậy localStorage (chỉ ~5 MB cho cả phòng máy) không bị đầy khi nhiều em chèn ảnh.
const DB = 'trinh-chieu'
const STORE = 'img'
const cache = new Map()
let dbp = null

function db() {
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbp
}
function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve) => {
        if (!d) return resolve(null)
        try {
          const t = d.transaction(STORE, mode)
          const r = fn(t.objectStore(STORE))
          t.oncomplete = () => resolve(r?.result ?? null)
          t.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

async function hash(s) {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
    return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return (h >>> 0).toString(16) + s.length.toString(16)
  }
}

// Lưu ảnh, trả về giá trị dùng cho obj.src ('idb:…', hoặc chính dataURL nếu trình duyệt chặn IndexedDB)
export async function putImage(dataUrl) {
  const id = await hash(dataUrl)
  cache.set(id, dataUrl)
  const ok = await tx('readwrite', (s) => s.put(dataUrl, id))
  return ok === null && !(await db()) ? dataUrl : `idb:${id}`
}
export function imageUrl(src) {
  if (!src) return ''
  if (src.startsWith('idb:')) return cache.get(src.slice(4)) || ''
  return src
}
export async function preload(ids) {
  const need = [...ids].filter((id) => !cache.has(id))
  await Promise.all(
    need.map((id) =>
      tx('readonly', (s) => s.get(id)).then((v) => {
        if (v) cache.set(id, v)
      }),
    ),
  )
}
// Dọn ảnh không còn bài nào dùng
export async function gc(keepIds) {
  const keys = await tx('readonly', (s) => s.getAllKeys())
  if (!keys) return
  const del = keys.filter((k) => !keepIds.has(k))
  if (del.length) await tx('readwrite', (s) => del.forEach((k) => s.delete(k)))
}

// Thu nhỏ ảnh trước khi lưu (tối đa 1600 điểm ảnh cạnh dài)
export function fileToDataUrl(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = reject
    r.onload = () => {
      const url = String(r.result)
      if (/svg|gif/.test(file.type)) return resolve(url)
      const img = new Image()
      img.onerror = () => resolve(url)
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
        if (k === 1 && file.size < 600_000) return resolve(url)
        const c = document.createElement('canvas')
        c.width = Math.round(img.naturalWidth * k)
        c.height = Math.round(img.naturalHeight * k)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        const png = file.type === 'image/png'
        resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86))
      }
      img.src = url
    }
    r.readAsDataURL(file)
  })
}
export function imageSize(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 })
    img.onerror = () => resolve({ w: 400, h: 300 })
    img.src = url
  })
}
