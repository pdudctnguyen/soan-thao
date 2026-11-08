// Kích thước khổ giấy (cm, chiều đứng)
export const PAGE_SIZES = {
  A4: { w: 21, h: 29.7, name: 'A4 (21 × 29,7 cm)' },
  A5: { w: 14.8, h: 21, name: 'A5 (14,8 × 21 cm)' },
  Letter: { w: 21.59, h: 27.94, name: 'Letter (21,6 × 27,9 cm)' },
}

export const DEFAULT_PAGE = { size: 'A4', orientation: 'portrait', margins: { top: 2, bottom: 2, left: 3, right: 2 } }

// Hiển thị trang giấy: đặt kích thước và lề bằng CSS; vẽ vạch ngắt trang giả lập.
export function applyPage(el, page) {
  const s = PAGE_SIZES[page.size] || PAGE_SIZES.A4
  const landscape = page.orientation === 'landscape'
  const w = landscape ? s.h : s.w
  const h = landscape ? s.w : s.h
  el.style.setProperty('--page-w', `${w}cm`)
  el.style.setProperty('--page-h', `${h}cm`)
  el.style.setProperty('--m-top', `${page.margins.top}cm`)
  el.style.setProperty('--m-bottom', `${page.margins.bottom}cm`)
  el.style.setProperty('--m-left', `${page.margins.left}cm`)
  el.style.setProperty('--m-right', `${page.margins.right}cm`)
  // khi in: dùng đúng khổ giấy và lề đã chọn
  let tag = document.getElementById('pageStyle')
  if (!tag) {
    tag = document.createElement('style')
    tag.id = 'pageStyle'
    document.head.appendChild(tag)
  }
  const m = page.margins
  tag.textContent = `@page { size: ${w}cm ${h}cm; margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm; }`
}
