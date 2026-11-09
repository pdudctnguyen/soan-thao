// Chấm bài trình chiếu: đọc mô hình bài (deck), so với từng yêu cầu của đề.
import { colorFamily } from '../../src/checker.js'
import { LAYOUTS, TRANSITIONS, ANIMS, DIRS, paragraphs, objText, isBody, isEmptyDoc } from './model.js'

const norm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
const words = (s) => norm(s).split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const short = (s) => (s.length > 28 ? `${s.slice(0, 26)}…` : s)
const PH_NAME = { title: 'tiêu đề', subtitle: 'phụ đề', body: 'nội dung', textbox: 'hộp văn bản', any: 'khung chữ' }

function slidesOf(deck, which) {
  if (which === 'any' || which == null) return deck.slides.map((s, i) => ({ s, i }))
  if (which === 'last') return deck.slides.length ? [{ s: deck.slides.at(-1), i: deck.slides.length - 1 }] : []
  const s = deck.slides[which - 1]
  return s ? [{ s, i: which - 1 }] : []
}
const where = (which) => (which === 'any' || which == null ? 'trong bài' : which === 'last' ? 'ở trang cuối' : `ở trang ${which}`)
function phMatch(o, ph = 'any') {
  if (o.kind === 'image') return false
  if (ph === 'any') return true
  if (ph === 'body') return isBody(o.ph)
  if (ph === 'textbox') return o.kind === 'text' && !o.ph
  if (ph === 'shape') return o.kind === 'shape'
  return o.ph === ph
}
// màu vàng cam (#FFC000 — Office gọi là “Cam”) chấp nhận là cam hoặc vàng
function colorIs(css, want) {
  const fam = colorFamily(css)
  if (fam === want) return true
  const m = /^#?([0-9a-f]{6})$/i.exec(String(css || '').trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]
  const isOrangeGold = r > 200 && b < 80 && g >= 120 && g <= 205
  return isOrangeGold && (want === 'cam' || want === 'vàng')
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function runsMatch(runs, c) {
  const probs = []
  const real = runs.filter((r) => r.text.trim())
  if (!real.length) return ['chưa có chữ']
  if (c.font && !real.every((r) => norm(r.font).startsWith(norm(c.font)))) probs.push(`phông ${c.font}`)
  if (c.notFont && real.some((r) => norm(r.font) === norm(c.notFont))) probs.push(`phông khác ${c.notFont}`)
  if (c.fonts && !real.every((r) => c.fonts.some((f) => norm(r.font).startsWith(norm(f))))) probs.push(`phông ${c.fonts.join(' / ')}`)
  if (c.size && !real.every((r) => Math.abs(r.size - c.size) < 0.6)) probs.push(`cỡ chữ ${c.size}`)
  if (c.sizeMin && !real.every((r) => r.size >= c.sizeMin - 0.4)) probs.push(`cỡ chữ từ ${c.sizeMin} trở lên`)
  if (c.color && !real.every((r) => colorIs(r.color, c.color))) probs.push(`màu ${c.color}`)
  if (c.b && !real.every((r) => r.b)) probs.push('in đậm')
  if (c.i && !real.every((r) => r.i)) probs.push('in nghiêng')
  if (c.u && !real.every((r) => r.u)) probs.push('gạch chân')
  return probs
}

function checkStep(c, deck) {
  const n = deck.slides.length
  switch (c.type) {
    case 'slides': {
      const ok = n >= (c.min || 1) && (!c.max || n <= c.max)
      return { ok, hint: c.max === c.min ? `Bài cần đúng ${c.min} trang (đang có ${n}).` : `Bài cần ít nhất ${c.min} trang chiếu (đang có ${n}).` }
    }
    case 'layout': {
      const [x] = slidesOf(deck, c.slide)
      if (!x) return { ok: false, hint: `Chưa có trang ${c.slide}.` }
      const ok = x.s.layout === c.layout
      return { ok, hint: `Trang ${c.slide} cần bố cục “${LAYOUTS[c.layout].name}” (Trang chủ → Bố cục).` }
    }
    case 'text': {
      const ph = c.ph || 'any'
      const sl = slidesOf(deck, c.slide)
      if (!sl.length) return { ok: false, hint: `Chưa có trang ${c.slide}.` }
      for (const { s } of sl) {
        const objs = s.objs.filter((o) => phMatch(o, ph))
        const txt = objs.map(objText).join('\n')
        const paras = objs.flatMap((o) => paragraphs(o, deck, s)).filter((p) => p.text.trim())
        const ok = (!c.contains || [].concat(c.contains).every((t) => norm(txt).includes(norm(t))))
          && (!c.minWords || words(txt) >= c.minWords)
          && (!c.minParas || paras.length >= c.minParas)
          && (c.contains || c.minWords || c.minParas || txt.trim())
        if (ok) return { ok: true }
      }
      const what = PH_NAME[ph] || 'khung chữ'
      if (c.contains) return { ok: false, hint: `Chưa thấy “${[].concat(c.contains).join('”, “')}” trong ${what} ${where(c.slide)}.` }
      if (c.minParas) return { ok: false, hint: `${what[0].toUpperCase() + what.slice(1)} ${where(c.slide)} cần ít nhất ${c.minParas} dòng.` }
      if (c.minWords) return { ok: false, hint: `${what[0].toUpperCase() + what.slice(1)} ${where(c.slide)} cần ít nhất ${c.minWords} từ.` }
      return { ok: false, hint: `Hãy gõ ${what} ${where(c.slide)}.` }
    }
    case 'fmt': {
      const sl = slidesOf(deck, c.slide)
      let runs = []
      for (const { s } of sl) {
        for (const o of s.objs) {
          if (o.kind === 'image') continue
          const paras = paragraphs(o, deck, s)
          if (c.find) runs.push(...paras.filter((p) => norm(p.text).includes(norm(c.find))).flatMap((p) => p.runs))
          else if (phMatch(o, c.ph || 'any')) runs.push(...paras.flatMap((p) => p.runs))
        }
      }
      const label = c.find ? `“${short(c.find)}”` : `${PH_NAME[c.ph] || 'chữ'} ${where(c.slide)}`
      if (!runs.filter((r) => r.text.trim()).length) return { ok: false, hint: c.find ? `Không tìm thấy “${short(c.find)}” ${where(c.slide)}.` : `Chưa có ${label}.` }
      const probs = runsMatch(runs, c)
      return { ok: !probs.length, hint: `${label[0].toUpperCase() + label.slice(1)} chưa đúng: cần ${probs.join(', ')}.` }
    }
    case 'list': {
      const sl = slidesOf(deck, c.slide)
      let best = null
      for (const { s } of sl) {
        for (const o of s.objs.filter((x) => phMatch(x, c.ph || 'any'))) {
          const paras = paragraphs(o, deck, s).filter((p) => p.text.trim())
          const items = paras.filter((p) => p.list)
          const r = {
            count: items.length,
            level2: items.some((p) => p.level >= 1),
            styled: items.some((p) => p.listStyle && p.listStyle !== 'disc'),
            numbered: items.some((p) => p.list === 'number'),
          }
          const ok = r.count >= (c.minItems || 1) && (!c.level2 || r.level2) && (!c.styled || r.styled) && (!c.numbered || r.numbered)
          if (ok) return { ok: true }
          if (!best || r.count > best.count) best = r
        }
      }
      if (!best || best.count < (c.minItems || 1)) return { ok: false, hint: `${where(c.slide)[0].toUpperCase() + where(c.slide).slice(1)} cần ít nhất ${c.minItems || 1} dòng có gạch đầu dòng.` }
      if (c.level2 && !best.level2) return { ok: false, hint: 'Cần có dòng cấp 2 (đặt con trỏ vào dòng đó rồi bấm phím Tab).' }
      if (c.styled && !best.styled) return { ok: false, hint: 'Hãy đổi kí hiệu gạch đầu dòng (mũi tên ▾ cạnh nút gạch đầu dòng).' }
      if (c.numbered) return { ok: false, hint: 'Cần đánh số thứ tự cho các dòng (nút 1. ≡).' }
      return { ok: false, hint: 'Danh sách chưa đúng yêu cầu.' }
    }
    case 'image': {
      const sl = slidesOf(deck, c.slide)
      const imgs = sl.flatMap(({ s }) => s.objs.filter((o) => o.kind === 'image').map((o) => ({ o, s })))
      const min = c.min || 1
      if (imgs.length < min) return { ok: false, hint: `${where(c.slide)[0].toUpperCase() + where(c.slide).slice(1)} cần có ${min > 1 ? `ít nhất ${min} ảnh` : 'ảnh'} (Chèn → Ảnh từ máy tính).` }
      if (c.border && !imgs.some(({ o }) => o.border)) return { ok: false, hint: 'Ảnh chưa có viền (chọn ảnh → Định dạng → Viền ảnh).' }
      if (c.behind) {
        const ok = imgs.some(({ o, s }) => s.objs.some((t) => phMatch(t, c.behind) && !isEmptyDoc(t.doc) && overlap(o, t) && s.objs.indexOf(o) < s.objs.indexOf(t)))
        const covering = imgs.some(({ o, s }) => s.objs.some((t) => phMatch(t, c.behind) && overlap(o, t)))
        return { ok, hint: covering ? 'Ảnh đang che chữ: chọn ảnh → Sắp xếp → Đưa xuống dưới cùng (Send to Back).' : 'Hãy kéo ảnh sao cho nằm dưới (sau) phần chữ.' }
      }
      return { ok: true }
    }
    case 'shape': {
      const sl = slidesOf(deck, c.slide)
      const shapes = sl.flatMap(({ s }) => s.objs.filter((o) => o.kind === 'shape' && (!c.shape || o.shape === c.shape)))
      if (!shapes.length) return { ok: false, hint: `${where(c.slide)[0].toUpperCase() + where(c.slide).slice(1)} cần có hình ${c.shape === 'ellipse' ? 'bầu dục (Oval)' : ''} (Chèn → Hình dạng).` }
      if (c.link && !shapes.some((o) => o.link)) return { ok: false, hint: 'Hình chưa được gắn liên kết (chọn hình → Chèn → Liên kết).' }
      if (c.text && !shapes.some((o) => norm(objText(o)).includes(norm(c.text)))) return { ok: false, hint: `Hãy gõ chữ “${c.text}” vào trong hình (nháy đúp vào hình).` }
      return { ok: true }
    }
    case 'link': {
      const sl = slidesOf(deck, c.slide)
      for (const { s } of sl) {
        for (const o of s.objs) {
          if (o.link && c.on !== 'text') return { ok: true }
          if (c.on !== 'object' && o.kind !== 'image' && paragraphs(o, deck, s).some((p) => p.runs.some((r) => r.link))) return { ok: true }
        }
      }
      return { ok: false, hint: `Chưa có liên kết ${where(c.slide)} (chọn hình hoặc bôi đen chữ → Chèn → Liên kết).` }
    }
    case 'trans': {
      const has = (s) => s.transition?.type && s.transition.type !== 'none'
      if (c.slide === 'all') {
        const missing = deck.slides.map((s, i) => (has(s) ? null : i + 1)).filter(Boolean)
        if (missing.length) return { ok: false, hint: `Trang ${missing.join(', ')} chưa có hiệu ứng chuyển trang (có thể bấm “Áp dụng cho tất cả trang”).` }
        if (c.same && new Set(deck.slides.map((s) => s.transition.type)).size > 1) return { ok: false, hint: 'Các trang cần dùng cùng một hiệu ứng chuyển trang (chọn hiệu ứng rồi bấm “Áp dụng cho tất cả trang”).' }
        return { ok: true }
      }
      if (c.minSlides) {
        const k = deck.slides.filter(has).length
        if (k < c.minSlides) return { ok: false, hint: `Cần ít nhất ${c.minSlides} trang có hiệu ứng chuyển trang (đang có ${k}).` }
        if (c.distinct && new Set(deck.slides.filter(has).map((s) => s.transition.type)).size < c.distinct) return { ok: false, hint: `Hãy dùng ít nhất ${c.distinct} kiểu hiệu ứng chuyển trang khác nhau.` }
        return { ok: true }
      }
      const [x] = slidesOf(deck, c.slide)
      if (!x) return { ok: false, hint: `Chưa có trang ${c.slide}.` }
      const tr = x.s.transition
      if (!has(x.s)) return { ok: false, hint: `Trang ${c.slide} chưa có hiệu ứng chuyển trang (chọn trang ${c.slide} → tab Chuyển trang).` }
      if (c.kind && tr.type !== c.kind) return { ok: false, hint: `Trang ${c.slide} cần hiệu ứng “${TRANSITIONS[c.kind].name}”.` }
      if (c.dir && tr.dir !== c.dir) return { ok: false, hint: `Chọn Tuỳ chọn hiệu ứng → “${DIRS[c.dir]}” cho trang ${c.slide}.` }
      if (c.durMin && (tr.dur ?? 1) < c.durMin) return { ok: false, hint: `Đặt Thời gian của hiệu ứng trang ${c.slide} từ ${c.durMin} giây trở lên.` }
      return { ok: true }
    }
    case 'anim': {
      const sl = slidesOf(deck, c.slide)
      const t = c.target || 'any'
      const objs = sl.flatMap(({ s }) => s.objs.filter((o) => (t === 'any' ? true : t === 'image' ? o.kind === 'image' : phMatch(o, t))))
      const withA = objs.filter((o) => o.anim && o.anim.type !== 'none')
      const name = { any: 'đối tượng', image: 'ảnh', title: 'tiêu đề', body: 'khung nội dung', shape: 'hình', subtitle: 'phụ đề' }[t]
      if (withA.length < (c.min || 1)) return { ok: false, hint: `${name[0].toUpperCase() + name.slice(1)} ${where(c.slide)} chưa có hiệu ứng (chọn ${name} → tab Hiệu ứng).` }
      if (c.kind && !withA.some((o) => o.anim.type === c.kind)) return { ok: false, hint: `Cần hiệu ứng “${ANIMS[c.kind].name}” cho ${name} ${where(c.slide)}.` }
      if (c.start && !withA.some((o) => o.anim.start === c.start)) return { ok: false, hint: `Mục Bắt đầu của hiệu ứng cần chọn “${{ click: 'Khi bấm chuột', with: 'Cùng lúc với hiệu ứng trước', after: 'Sau hiệu ứng trước' }[c.start]}”.` }
      return { ok: true }
    }
    case 'hf': {
      const list = deck.slides.map((s, i) => ({ s, i }))
      const nonTitle = list.filter(({ s }) => s.layout !== 'title')
      const titles = list.filter(({ s }) => s.layout === 'title')
      const shows = (s, key) => {
        const hf = s.hf
        if (!hf || (hf.notOnTitle && s.layout === 'title')) return false
        if (key === 'num') return !!hf.num
        if (key === 'date') return !!hf.date
        if (key === 'footer') return !!hf.footer && !!hf.footerText
        return false
      }
      const key = c.num ? 'num' : c.date ? 'date' : 'footer'
      const label = { num: 'số trang', date: 'ngày giờ', footer: 'chân trang' }[key]
      if (!nonTitle.length) return { ok: false, hint: `Bài cần thêm các trang nội dung có hiện ${label}.` }
      const miss = nonTitle.filter(({ s }) => !shows(s, key)).map(({ i }) => i + 1)
      if (miss.length) return { ok: false, hint: `Trang ${miss.join(', ')} chưa hiện ${label} (Chèn → Đầu trang & chân trang → Áp dụng cho tất cả).` }
      if (c.footer && typeof c.footer === 'string' && !nonTitle.every(({ s }) => norm(s.hf.footerText).includes(norm(c.footer)))) return { ok: false, hint: `Nội dung chân trang cần có “${c.footer}”.` }
      if (c.dateAuto && !nonTitle.every(({ s }) => s.hf.dateAuto !== false)) return { ok: false, hint: 'Ngày giờ cần chọn “Tự động cập nhật”.' }
      if (c.notOnTitle && titles.some(({ s }) => shows(s, key))) return { ok: false, hint: `Trang tiêu đề không được hiện ${label} (đánh dấu “Không hiện trên trang tiêu đề”).` }
      return { ok: true }
    }
    case 'theme': {
      const ok = deck.theme && deck.theme !== 'office'
      return { ok, hint: 'Hãy chọn một bản mẫu (tab Thiết kế → Bản mẫu).' }
    }
    case 'bg': {
      const set = deck.slides.filter((s) => s.bg)
      if (c.all) {
        const ok = set.length === n && new Set(set.map((s) => s.bg)).size === 1
        return { ok, hint: set.length ? 'Tất cả các trang cần cùng một màu nền (Màu nền → Áp dụng cho tất cả trang).' : 'Hãy đổi màu nền (tab Thiết kế → Màu nền).' }
      }
      return { ok: set.length > 0, hint: 'Hãy đổi màu nền cho trang (tab Thiết kế → Màu nền).' }
    }
    case 'anyFormat': {
      // có định dạng chữ khác mặc định (màu / cỡ / phông / đậm / nghiêng)
      const ok = deck.slides.some((s) => s.objs.some((o) => o.kind !== 'image' && paragraphs(o, deck, s).some((p) => p.runs.some((r) => r.text.trim() && (r.explicit.color || r.explicit.size || r.explicit.font || r.b || r.i || r.u)))))
      return { ok, hint: 'Hãy định dạng chữ (phông, cỡ, màu, in đậm…) cho đẹp hơn.' }
    }
    default:
      return { ok: false, hint: 'Yêu cầu chưa được hỗ trợ.' }
  }
}

export function checkExercise(ex, deck) {
  return ex.steps.map((s) => {
    try {
      const r = checkStep(s.check, deck)
      return { ok: !!r.ok, hint: r.ok ? '' : r.hint }
    } catch (err) {
      console.error(err)
      return { ok: false, hint: 'Không kiểm tra được yêu cầu này.' }
    }
  })
}
