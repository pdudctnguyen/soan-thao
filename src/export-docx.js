import {
  AlignmentType, Document, HeadingLevel, ImageRun, LevelFormat, Packer, PageOrientation, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType, BorderStyle, convertMillimetersToTwip,
  Header, Footer, PageNumber, PageBreak, HorizontalPositionAlign, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
  TextWrappingType, TextWrappingSide,
} from 'docx'
import { BULLET_STYLES, NUMBER_STYLES } from './extensions.js'
import { PAGE_SIZES } from './page.js'

const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }
const HEADINGS = [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3]
const cmToTwip = (cm) => convertMillimetersToTwip(cm * 10)
const NUM_FORMAT = {
  decimal: LevelFormat.DECIMAL, 'lower-alpha': LevelFormat.LOWER_LETTER, 'upper-alpha': LevelFormat.UPPER_LETTER,
  'lower-roman': LevelFormat.LOWER_ROMAN, 'upper-roman': LevelFormat.UPPER_ROMAN,
}

export async function exportDocx(json, page, defaults, hf = {}) {
  let listInstance = 0
  const ctx = { defaults }

  async function inline(nodes = []) {
    const runs = []
    for (const n of nodes) {
      if (n.type === 'text') runs.push(new TextRun(runProps(n.text, n.marks, defaults)))
      else if (n.type === 'hardBreak') runs.push(new TextRun({ break: 1 }))
      else if (n.type === 'pageNumber') runs.push(new TextRun({ ...runProps('', [], defaults), text: undefined, children: [n.attrs?.kind === 'total' ? PageNumber.TOTAL_PAGES : PageNumber.CURRENT] }))
      else if (n.type === 'image') {
        const img = await imageRun(n.attrs, page)
        if (img) runs.push(img)
      }
    }
    return runs
  }

  async function paragraph(node, extra = {}) {
    const a = node.attrs || {}
    return new Paragraph({
      children: await inline(node.content),
      alignment: ALIGN[a.textAlign] || undefined,
      heading: node.type === 'heading' ? HEADINGS[a.level] : undefined,
      indent: {
        left: a.indentLeft ? cmToTwip(a.indentLeft) : extra.indentLeft,
        firstLine: a.indentFirst ? cmToTwip(a.indentFirst) : undefined,
      },
      spacing: {
        line: a.lineHeight ? Math.round(parseFloat(a.lineHeight) * 240) : undefined,
        before: a.spaceBefore ? a.spaceBefore * 20 : undefined,
        after: a.spaceAfter != null ? a.spaceAfter * 20 : 0,
      },
      numbering: extra.numbering,
    })
  }

  async function block(node, out, list) {
    switch (node.type) {
      case 'paragraph':
      case 'heading':
        out.push(await paragraph(node, list ? { numbering: list } : {}))
        break
      case 'bulletList':
      case 'orderedList': {
        const level = list ? Math.min(list.level + 1, 8) : 0
        const kind = node.type === 'bulletList' ? 'bullet' : 'ordered'
        const style = node.attrs?.listStyle || (kind === 'bullet' ? ['disc', 'circle', 'square'][level % 3] : 'decimal')
        const ref = `${kind}-${style}`
        const instance = kind === 'ordered' && level === 0 ? ++listInstance : list?.instance ?? 0
        for (const item of node.content || []) {
          for (const child of item.content || []) {
            if (child.type === 'paragraph') out.push(await paragraph(child, { numbering: { reference: ref, level, instance } }))
            else await block(child, out, { reference: ref, level, instance })
          }
        }
        break
      }
      case 'table':
        out.push(await table(node))
        out.push(new Paragraph({}))
        break
      case 'pageBreak':
        out.push(new Paragraph({ children: [new PageBreak()] }))
        break
      case 'horizontalRule':
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } } }))
        break
      case 'blockquote':
        for (const c of node.content || []) out.push(await paragraph(c, { indentLeft: cmToTwip(1) }))
        break
      default:
        if (node.content) for (const c of node.content) await block(c, out, list)
    }
  }

  async function table(node) {
    const rows = []
    for (const row of node.content || []) {
      const cells = []
      for (const cell of row.content || []) {
        const children = []
        for (const c of cell.content || []) await block(c, children)
        if (!children.length) children.push(new Paragraph({}))
        cells.push(
          new TableCell({
            children,
            columnSpan: cell.attrs?.colspan > 1 ? cell.attrs.colspan : undefined,
            rowSpan: cell.attrs?.rowspan > 1 ? cell.attrs.rowspan : undefined,
            shading: cell.type === 'tableHeader' ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined,
          }),
        )
      }
      rows.push(new TableRow({ children: cells }))
    }
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
  }

  const children = []
  for (const n of json.content || []) await block(n, children)
  async function hfChildren(doc) {
    const out = []
    for (const n of doc?.content || []) await block(n, out)
    return out
  }
  const headers = {}
  const footers = {}
  if (hf.header) headers.default = new Header({ children: await hfChildren(hf.header) })
  if (hf.footer) footers.default = new Footer({ children: await hfChildren(hf.footer) })
  if (page.titlePage) {
    headers.first = new Header({ children: [new Paragraph({})] })
    footers.first = new Footer({ children: [new Paragraph({})] })
  }

  const size = PAGE_SIZES[page.size] || PAGE_SIZES.A4
  const landscape = page.orientation === 'landscape'
  const doc = new Document({
    styles: {
      default: { document: { run: { font: defaults.fontFamily, size: defaults.fontSize * 2 }, paragraph: { spacing: { after: 0 } } } },
    },
    numbering: {
      config: [
        ...Object.entries(BULLET_STYLES).map(([k, v]) => ({
          reference: `bullet-${k}`,
          levels: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((level) => ({
            level, format: LevelFormat.BULLET, text: v.glyph, alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        })),
        ...Object.keys(NUMBER_STYLES).map((k) => ({
          reference: `ordered-${k}`,
          levels: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((level) => ({
            level, format: NUM_FORMAT[k], text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        })),
      ],
    },
    sections: [
      {
        properties: {
          page: {
            // docx tự đảo chiều rộng/cao khi chọn LANDSCAPE, nên luôn truyền kích thước khổ đứng
            size: { width: cmToTwip(size.w), height: cmToTwip(size.h), orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: {
              top: cmToTwip(page.margins.top), bottom: cmToTwip(page.margins.bottom), left: cmToTwip(page.margins.left), right: cmToTwip(page.margins.right),
              header: cmToTwip(1.25), footer: cmToTwip(1.25),
            },
          },
          titlePage: !!page.titlePage,
        },
        headers,
        footers,
        children,
      },
    ],
  })
  void ctx
  return Packer.toBlob(doc)
}

function runProps(text, marks = [], defaults) {
  const p = { text }
  for (const m of marks) {
    if (m.type === 'bold') p.bold = true
    if (m.type === 'italic') p.italics = true
    if (m.type === 'underline') p.underline = {}
    if (m.type === 'strike') p.strike = true
    if (m.type === 'subscript') p.subScript = true
    if (m.type === 'superscript') p.superScript = true
    if (m.type === 'highlight') p.shading = { type: ShadingType.CLEAR, fill: hex(m.attrs?.color || '#ffff00'), color: 'auto' }
    if (m.type === 'textStyle') {
      const a = m.attrs || {}
      if (a.color) p.color = hex(a.color)
      if (a.fontSize) p.size = Math.round(parseFloat(a.fontSize) * 2)
      if (a.fontFamily) p.font = a.fontFamily.replace(/["']/g, '').split(',')[0].trim()
    }
  }
  return p
}

function hex(css) {
  if (!css) return undefined
  const m = css.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/)
  if (m) return [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('')
  let h = css.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return h.slice(0, 6)
}

async function imageRun(attrs, page) {
  try {
    const src = attrs.src
    const res = await fetch(src)
    const buf = new Uint8Array(await res.arrayBuffer())
    const type = res.headers.get('content-type') || src.slice(5, src.indexOf(';'))
    const kind = type.includes('png') ? 'png' : type.includes('gif') ? 'gif' : type.includes('bmp') ? 'bmp' : 'jpg'
    const natural = await naturalSize(src)
    let w = attrs.width ? parseFloat(attrs.width) : natural.w
    let h = attrs.height ? parseFloat(attrs.height) : (natural.h * w) / natural.w
    // không cho ảnh rộng hơn vùng soạn thảo
    const size = PAGE_SIZES[page.size] || PAGE_SIZES.A4
    const pageW = page.orientation === 'landscape' ? size.h : size.w
    const maxPx = ((pageW - page.margins.left - page.margins.right) / 2.54) * 96
    if (w > maxPx) {
      h = (h * maxPx) / w
      w = maxPx
    }
    const opts = { type: kind, data: buf, transformation: { width: Math.round(w), height: Math.round(h) } }
    if (attrs.wrap === 'left' || attrs.wrap === 'right') {
      opts.floating = {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, align: attrs.wrap === 'left' ? HorizontalPositionAlign.LEFT : HorizontalPositionAlign.RIGHT },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
        wrap: { type: TextWrappingType.SQUARE, side: TextWrappingSide.BOTH_SIDES },
        margins: { left: 114300, right: 114300, top: 36000, bottom: 36000 },
      }
    } else if (attrs.wrap === 'topBottom') {
      opts.floating = {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, align: HorizontalPositionAlign.CENTER },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
        wrap: { type: TextWrappingType.TOP_AND_BOTTOM },
        margins: { top: 54000, bottom: 54000 },
      }
    } else if (attrs.wrap === 'behind' || attrs.wrap === 'front') {
      const EMU = 9525 // 1 px (96 dpi)
      opts.floating = {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: Math.round((attrs.posX || 0) * EMU) },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round((attrs.posY || 0) * EMU) },
        wrap: { type: TextWrappingType.NONE },
        behindDocument: attrs.wrap === 'behind',
        allowOverlap: true,
      }
    }
    return new ImageRun(opts)
  } catch (e) {
    console.warn('Không xuất được ảnh', e)
    return null
  }
}

function naturalSize(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 300, h: img.naturalHeight || 200 })
    img.onerror = () => resolve({ w: 300, h: 200 })
    img.src = src
  })
}
