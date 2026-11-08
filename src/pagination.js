// Chia trang thật: đo chiều cao từng khối (đoạn, bảng, danh sách…) rồi chèn khoảng trống
// trước khối bị tràn để đẩy nó sang trang sau. Mỗi trang vẽ một tờ giấy riêng, có đầu trang/chân trang.
// Giới hạn: một khối cao hơn cả trang (bảng rất dài, đoạn rất dài) không bị cắt đôi.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { PAGE_SIZES } from './page.js'

export const PX_PER_CM = 96 / 2.54
export const PAGE_GAP = 24 // khoảng xám giữa hai tờ (px)
const HF_DISTANCE = 1.25 // cm: khoảng cách từ mép giấy tới đầu trang/chân trang (giống Word)

const key = new PluginKey('pagination')

export const Pagination = Extension.create({
  name: 'pagination',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => ({ breaks: [] }),
          apply(tr, value) {
            const meta = tr.getMeta(key)
            if (meta) return meta
            if (!tr.docChanged) return value
            return { breaks: value.breaks.map((b) => ({ ...b, pos: tr.mapping.map(b.pos, -1) })) }
          },
        },
        props: {
          decorations(state) {
            const { breaks } = key.getState(state)
            return DecorationSet.create(
              state.doc,
              breaks.map((b) =>
                Decoration.widget(
                  b.pos,
                  () => {
                    const d = document.createElement('div')
                    d.className = 'page-spacer'
                    d.style.height = `${b.h}px`
                    d.contentEditable = 'false'
                    return d
                  },
                  { side: -1, key: `pb-${b.pos}-${Math.round(b.h)}`, ignoreSelection: true },
                ),
              ),
            )
          },
        },
      }),
    ]
  },
})

export function geometry(page) {
  const s = PAGE_SIZES[page.size] || PAGE_SIZES.A4
  const land = page.orientation === 'landscape'
  const m = page.margins
  const H = (land ? s.w : s.h) * PX_PER_CM
  return {
    W: (land ? s.h : s.w) * PX_PER_CM,
    H,
    top: m.top * PX_PER_CM,
    bottom: m.bottom * PX_PER_CM,
    left: m.left * PX_PER_CM,
    right: m.right * PX_PER_CM,
    contentH: H - (m.top + m.bottom) * PX_PER_CM,
    hf: HF_DISTANCE * PX_PER_CM,
  }
}

// Tính lại vị trí ngắt trang. Trả về số trang.
export function repaginate(editor, page, gap = PAGE_GAP) {
  const { view, state } = editor
  const g = geometry(page)
  const root = view.dom
  const rootRect = root.getBoundingClientRect()
  const scale = root.offsetHeight ? rootRect.height / root.offsetHeight : 1
  const current = key.getState(state).breaks
  const spacerBefore = (pos) => current.filter((b) => b.pos <= pos).reduce((a, b) => a + b.h, 0)

  const items = []
  state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) return
    const r = dom.getBoundingClientRect()
    const cs = getComputedStyle(dom)
    const sp = spacerBefore(offset)
    items.push({
      pos: offset,
      forced: node.type.name === 'pageBreak',
      top: (r.top - rootRect.top) / scale - sp - (parseFloat(cs.marginTop) || 0),
      bottom: (r.bottom - rootRect.top) / scale - sp + (parseFloat(cs.marginBottom) || 0),
    })
  })

  // Toạ độ "hiển thị": trang k bắt đầu vùng chữ tại k * (H + gap).
  const stride = g.H + gap
  const breaks = []
  let shift = 0 // tổng chiều cao khoảng trống đã chèn phía trên
  let k = 0 // trang hiện tại
  let forceNext = false
  for (const it of items) {
    let vTop = it.top + shift
    let vBottom = it.bottom + shift
    const pageTop = k * stride
    if (forceNext || (vBottom > pageTop + g.contentH + 0.5 && vTop > pageTop + 0.5)) {
      const h = (k + 1) * stride - vTop
      breaks.push({ pos: it.pos, h })
      shift += h
      vTop += h
      vBottom += h
      k++
    }
    // khối cao hơn một trang thì tràn tiếp: trang hiện tại là trang chứa đáy khối
    if (vBottom > k * stride + g.contentH + 0.5) k = Math.floor(vBottom / stride)
    forceNext = it.forced
  }
  const pages = k + 1

  const same = breaks.length === current.length && breaks.every((b, i) => b.pos === current[i].pos && Math.abs(b.h - current[i].h) < 1)
  if (!same) view.dispatch(state.tr.setMeta(key, { breaks }).setMeta('addToHistory', false))
  return pages
}
