// Xuất .pptx: pptxgenjs dựng chữ, ảnh, hình; sau đó chèn thêm XML cho hiệu ứng chuyển trang,
// hiệu ứng đối tượng, trường ngày giờ / số trang, viền ảnh — và gói kèm bản gốc (wepp/deck.json)
// để mở lại đúng 100% bằng phần mềm này.
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import { theme, decoFor, paragraphs, isBody, isEmptyDoc, hfItems, HF_POS } from './model.js'
import { imageUrl } from './imgstore.js'
import { animGroups } from './anim.js'
import { BULLET_STYLES } from '../../src/extensions.js'

const IN = (px) => +(px / 96).toFixed(4)
const hex = (c) => (c || '#000000').replace('#', '').toUpperCase().slice(0, 6)
const BULLET_CODE = { disc: '2022', circle: '25CB', square: '25A0', check: '2713', arrow: '27A2', dash: '2013', star: '2605' }
const NUM_STYLE = { decimal: 'arabicPeriod', 'lower-alpha': 'alphaLcPeriod', 'upper-alpha': 'alphaUcPeriod', 'lower-roman': 'romanLcPeriod', 'upper-roman': 'romanUcPeriod' }
const SPD = (dur) => (dur <= 0.75 ? 'fast' : dur <= 1.5 ? 'med' : 'slow')

function variant(layout) {
  return layout === 'title' ? 'title' : layout === 'blank' ? 'blank' : 'content'
}

async function rasterIfSvg(url, w, h) {
  if (!/^data:image\/svg/.test(url)) return url
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const k = 2
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w * k))
      c.height = Math.max(1, Math.round(h * k))
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function textRuns(o, deck, slide, linkSlide) {
  const paras = paragraphs(o, deck, slide)
  const runs = []
  paras.forEach((p, pi) => {
    const last = pi === paras.length - 1
    const para = {
      align: p.align,
      indentLevel: p.level || undefined,
      paraSpaceBefore: isBody(o.ph) && pi > 0 ? (p.level ? 5 : 10) : undefined,
    }
    if (p.list === 'bullet') para.bullet = BULLET_CODE[p.listStyle] ? { characterCode: BULLET_CODE[p.listStyle] } : true
    else if (p.list === 'number') para.bullet = { type: 'number', style: NUM_STYLE[p.listStyle] || 'arabicPeriod' }
    else if (isBody(o.ph)) para.bullet = false
    const items = p.runs.length ? p.runs : [{ text: '', b: false, i: false, u: false, s: false, font: null, size: null, color: null }]
    items.forEach((r, ri) => {
      const opt = { align: p.align }
      if (ri === 0) Object.assign(opt, para)
      if (r.font) opt.fontFace = r.font
      if (r.size) opt.fontSize = r.size
      if (r.color) opt.color = hex(r.color)
      if (r.b) opt.bold = true
      if (r.i) opt.italic = true
      if (r.u) opt.underline = { style: 'sng' }
      if (r.s) opt.strike = 'sngStrike'
      if (r.br && ri > 0) opt.softBreakBefore = true
      if (r.link) {
        const m = /^#slide=(\d+)$/.exec(r.link)
        if (m && linkSlide(+m[1])) opt.hyperlink = { slide: +m[1] }
        else if (!m) opt.hyperlink = { url: r.link }
      }
      if (ri === items.length - 1 && !last) opt.breakLine = true
      runs.push({ text: r.text, options: opt })
    })
  })
  return runs
}

export async function exportPptx(deck, { title = 'Bài trình chiếu' } = {}) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = title
  pptx.author = 'Học sinh'
  const th = theme(deck)
  for (const v of ['title', 'content', 'blank']) {
    pptx.defineSlideMaster({
      title: `wepp-${v}`,
      background: { color: hex(th.bg) },
      objects: decoFor(th, v === 'title' ? 'title' : v === 'blank' ? 'blank' : 'titleContent').map((d) => ({
        text: {
          text: '',
          options: {
            shape: d.shape, x: IN(d.x), y: IN(d.y), w: IN(d.w), h: IN(d.h),
            fill: d.fill ? { color: hex(d.fill) } : undefined,
            line: d.line ? { color: hex(d.line.color), width: d.line.w } : undefined,
          },
        },
      })),
    })
  }

  const n = deck.slides.length
  const linkSlide = (k) => k >= 1 && k <= n
  const meta = [] // theo từng trang: tên đối tượng → thông tin cần xử lý sau
  for (const [si, slide] of deck.slides.entries()) {
    const s = pptx.addSlide({ masterName: `wepp-${variant(slide.layout)}` })
    if (slide.bg) s.background = { color: hex(slide.bg) }
    const m = { names: [], borders: {}, fields: {} }
    meta.push(m)
    for (const [k, o] of slide.objs.entries()) {
      const name = `wepp-${k}`
      const base = { x: IN(o.x), y: IN(o.y), w: IN(o.w), h: IN(o.h), objectName: name }
      const lk = o.link?.url ? { url: o.link.url } : o.link?.slide && linkSlide(o.link.slide) ? { slide: o.link.slide } : undefined
      if (o.kind === 'image') {
        const url = await rasterIfSvg(imageUrl(o.src), o.w, o.h)
        if (!url) continue
        s.addImage({ ...base, data: url, hyperlink: lk })
        if (o.border) m.borders[name] = o.border
        m.names.push({ name, o })
        continue
      }
      if (o.ph && isEmptyDoc(o.doc) && !o.fill && !o.line) continue
      const opts = {
        ...base,
        valign: o.valign || (o.kind === 'shape' ? 'middle' : 'top'),
        margin: [7.2, 7.2, 3.6, 3.6],
        fit: 'none',
        hyperlink: lk,
      }
      if (o.kind === 'shape') opts.shape = o.shape || 'rect'
      if (o.fill) opts.fill = { color: hex(o.fill) }
      if (o.line) opts.line = { color: hex(o.line.color), width: o.line.w }
      const runs = isEmptyDoc(o.doc) ? '' : textRuns(o, deck, slide, linkSlide)
      s.addText(runs, opts)
      m.names.push({ name, o })
    }
    for (const it of hfItems(deck, slide, si)) {
      const p = HF_POS[it.key]
      const name = `wepp-hf-${it.key}`
      s.addText(it.text, { x: IN(p.x), y: IN(p.y), w: IN(p.w), h: IN(p.h), align: p.align, valign: 'middle', fontFace: th.body.font, fontSize: 12, color: hex(th.body.color), objectName: name, margin: [7.2, 7.2, 3.6, 3.6] })
      if (it.key === 'num') m.fields[name] = 'slidenum'
      if (it.key === 'date' && slide.hf.dateAuto !== false) m.fields[name] = 'datetime1'
    }
  }

  const buf = await pptx.write({ outputType: 'arraybuffer' })
  const zip = await JSZip.loadAsync(buf)
  for (const [si, slide] of deck.slides.entries()) {
    const path = `ppt/slides/slide${si + 1}.xml`
    let xml = await zip.file(path).async('string')
    xml = patchSlide(xml, slide, meta[si])
    zip.file(path, xml)
  }
  // gói kèm bản gốc
  const full = JSON.parse(JSON.stringify(deck))
  for (const s of full.slides) for (const o of s.objs) if (o.kind === 'image') o.src = imageUrl(o.src)
  zip.file('wepp/deck.json', JSON.stringify(full))
  let ct = await zip.file('[Content_Types].xml').async('string')
  if (!ct.includes('Extension="json"')) ct = ct.replace('<Default Extension="xml"', '<Default Extension="json" ContentType="application/json"/><Default Extension="xml"')
  zip.file('[Content_Types].xml', ct)
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' })
}

// id số của đối tượng theo tên
function spIds(xml) {
  const map = {}
  for (const mt of xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]+)"/g)) map[mt[2]] = +mt[1]
  return map
}

function patchSlide(xml, slide, m) {
  const ids = spIds(xml)
  // viền ảnh
  for (const [name, b] of Object.entries(m.borders)) {
    const re = new RegExp(`(<p:pic>(?:(?!</p:pic>).)*?name="${name}"(?:(?!</p:pic>).)*?)</p:spPr>`, 's')
    xml = xml.replace(re, `$1<a:ln w="${Math.round(b.w * 12700)}"><a:solidFill><a:srgbClr val="${hex(b.color)}"/></a:solidFill></a:ln></p:spPr>`)
  }
  // trường tự cập nhật: ngày giờ, số trang
  for (const [name, type] of Object.entries(m.fields)) {
    const re = new RegExp(`(name="${name}"(?:(?!</p:sp>).)*?)<a:r>(<a:rPr[^>]*?(?:/>|>.*?</a:rPr>))<a:t>(.*?)</a:t></a:r>`, 's')
    const guid = type === 'slidenum' ? '{F7021451-1387-4CA6-816F-3879F97B5CBC}' : '{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}'
    xml = xml.replace(re, `$1<a:fld id="${guid}" type="${type}">$2<a:t>$3</a:t></a:fld>`)
  }
  let extra = ''
  // hiệu ứng chuyển trang
  const tr = slide.transition
  if (tr && tr.type && tr.type !== 'none') {
    const dir = tr.dir || 'u'
    const el = {
      fade: '<p:fade/>',
      push: `<p:push dir="${dir}"/>`,
      wipe: `<p:wipe dir="${dir}"/>`,
      split: '<p:split orient="vert" dir="out"/>',
      cover: `<p:cover dir="${dir}"/>`,
      zoom: '<p:zoom/>',
      dissolve: '<p:dissolve/>',
      random: '<p:random/>',
    }[tr.type] || '<p:fade/>'
    extra += `<p:transition spd="${SPD(tr.dur ?? 1)}"${tr.adv ? ` advTm="${Math.round(tr.adv * 1000)}"` : ''}>${el}</p:transition>`
  } else if (tr?.adv) {
    extra += `<p:transition advTm="${Math.round(tr.adv * 1000)}"/>`
  }
  // hiệu ứng đối tượng
  const timing = timingXml(slide, m, ids)
  if (timing) extra += timing
  if (extra) xml = xml.replace('<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>', `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${extra}`)
  return xml
}

const PRESET = { appear: [1, 0], fade: [10, 0], fly: [2, 4], wipe: [22, 4], zoom: [53, 16] }
function timingXml(slide, m, ids) {
  const groups = animGroups(slide)
  if (!groups.length) return ''
  const nameOf = new Map(m.names.map((x) => [x.o.id, x.name]))
  let id = 3
  const bld = []
  const tgt = (sp) => `<p:tgtEl><p:spTgt spid="${sp}"/></p:tgtEl>`
  const effect = (it, o, sp) => {
    const [preset, sub] = PRESET[it.type] || PRESET.fade
    const isText = o.kind !== 'image'
    const grp = isText ? ' grpId="0"' : ''
    if (isText && !bld.some((b) => b.sp === sp)) bld.push({ sp, bg: !!o.fill })
    const node = it.start === 'click' ? 'clickEffect' : it.start === 'after' ? 'afterEffect' : 'withEffect'
    const d = Math.round(it.dur)
    const headId = id++
    const set = `<p:set><p:cBhvr><p:cTn id="${id++}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt(sp)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`
    const anim = (attr, from, to, fromNum) =>
      `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${id++}" dur="${d}" fill="hold"/>${tgt(sp)}<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val>${fromNum ? `<p:fltVal val="${from}"/>` : `<p:strVal val="${from}"/>`}</p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`
    const fx = (filter) => `<p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${id++}" dur="${d}"/>${tgt(sp)}</p:cBhvr></p:animEffect>`
    const head = `<p:par><p:cTn id="${headId}" presetID="${preset}" presetClass="entr" presetSubtype="${sub}" fill="hold"${grp} nodeType="${node}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>`
    let body = set
    if (it.type === 'fade') body += fx('fade')
    if (it.type === 'wipe') body += fx('wipe(up)')
    if (it.type === 'fly') body += anim('ppt_x', '#ppt_x', '#ppt_x') + anim('ppt_y', '1+#ppt_h/2', '#ppt_y')
    if (it.type === 'zoom') body += anim('ppt_w', '0', '#ppt_w', true) + anim('ppt_h', '0', '#ppt_h', true) + fx('fade')
    return head + body + '</p:childTnLst></p:cTn></p:par>'
  }
  let seq = ''
  for (const g of groups) {
    const items = g.items.map((it) => ({ it, o: slide.objs.find((x) => x.id === it.id) })).filter((x) => x.o && ids[nameOf.get(x.o.id)])
    if (!items.length) continue
    const outerCond = g.auto ? '<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>' : '<p:cond delay="indefinite"/>'
    let inner = ''
    // gom theo thời điểm bắt đầu trong nhóm
    const byDelay = new Map()
    for (const x of items) {
      const k = Math.round(x.it.delay)
      if (!byDelay.has(k)) byDelay.set(k, [])
      byDelay.get(k).push(x)
    }
    const outerId = id++
    for (const [delay, xs] of [...byDelay.entries()].sort((a, b) => a[0] - b[0])) {
      const pid = id++
      inner += `<p:par><p:cTn id="${pid}" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>${xs.map((x) => effect(x.it, x.o, ids[nameOf.get(x.o.id)])).join('')}</p:childTnLst></p:cTn></p:par>`
    }
    seq += `<p:par><p:cTn id="${outerId}" fill="hold"><p:stCondLst>${outerCond}</p:stCondLst><p:childTnLst>${inner}</p:childTnLst></p:cTn></p:par>`
  }
  if (!seq) return ''
  const bldLst = bld.length ? `<p:bldLst>${bld.map((b) => `<p:bldP spid="${b.sp}" grpId="0"${b.bg ? ' animBg="1"' : ''}/>`).join('')}</p:bldLst>` : ''
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${seq}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${bldLst}</p:timing>`
}

// Mở lại tệp .pptx do phần mềm này lưu
export async function importPptx(buf) {
  const zip = await JSZip.loadAsync(buf)
  const f = zip.file('wepp/deck.json')
  if (!f) return null
  return JSON.parse(await f.async('string'))
}

export { BULLET_STYLES }
