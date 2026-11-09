// Hiệu ứng: gom nhóm theo lần bấm chuột, và chạy hiệu ứng trên trang (Web Animations API).
import { TRANSITIONS, H } from './model.js'

// Mỗi nhóm = những gì xảy ra sau một lần bấm chuột. auto: nhóm đầu tự chạy khi vào trang.
export function animGroups(slide) {
  const list = slide.objs.filter((o) => o.anim && o.anim.type && o.anim.type !== 'none').sort((a, b) => a.anim.order - b.anim.order)
  const groups = []
  let g = null
  let lastStart = 0
  let lastEnd = 0
  for (const o of list) {
    const start = o.anim.start || 'click'
    const dur = Math.max(0.1, o.anim.dur ?? 0.5) * 1000
    if (start === 'click' || !g) {
      g = { auto: start !== 'click', items: [] }
      groups.push(g)
      lastStart = 0
      lastEnd = 0
    }
    const delay = start === 'after' ? lastEnd : start === 'with' ? lastStart : 0
    g.items.push({ id: o.id, type: o.anim.type, start, delay, dur })
    lastStart = delay
    lastEnd = Math.max(lastEnd, delay + dur)
  }
  return groups
}

// số hiển thị cạnh đối tượng (giống PowerPoint): 0 cho nhóm tự chạy, 1, 2, … cho các lần bấm
export function animBadges(slide) {
  const out = {}
  const groups = animGroups(slide)
  let n = 0
  for (const g of groups) {
    const num = g.auto ? 0 : ++n
    for (const it of g.items) out[it.id] = num
  }
  return out
}

function keyframes(type, el) {
  switch (type) {
    case 'appear':
      return { kf: [{ visibility: 'hidden' }, { visibility: 'visible' }], dur: 1 }
    case 'fly': {
      const top = parseFloat(el.style.top) || 0
      return { kf: [{ visibility: 'visible', transform: `translateY(${H - top + 20}px)` }, { visibility: 'visible', transform: 'translateY(0)' }], easing: 'cubic-bezier(.2,.7,.3,1)' }
    }
    case 'wipe':
      return { kf: [{ visibility: 'visible', clipPath: 'inset(100% 0 0 0)' }, { visibility: 'visible', clipPath: 'inset(0 0 0 0)' }] }
    case 'zoom':
      return { kf: [{ visibility: 'visible', opacity: 0, transform: 'scale(0.2)' }, { visibility: 'visible', opacity: 1, transform: 'scale(1)' }] }
    default:
      return { kf: [{ visibility: 'visible', opacity: 0 }, { visibility: 'visible', opacity: 1 }] }
  }
}

export function hideAnimated(root, slide) {
  for (const g of animGroups(slide)) for (const it of g.items) {
    const el = root.querySelector(`.obj[data-id="${it.id}"]`)
    if (el) el.style.visibility = 'hidden'
  }
}
// chạy một nhóm; trả về Promise khi xong
export function playGroup(root, g, speed = 1) {
  const anims = []
  for (const it of g.items) {
    const el = root.querySelector(`.obj[data-id="${it.id}"]`)
    if (!el) continue
    const { kf, dur, easing } = keyframes(it.type, el)
    el.style.visibility = ''
    anims.push(el.animate(kf, { duration: (dur ?? it.dur) / speed, delay: it.delay / speed, fill: 'both', easing: easing || 'ease-out' }))
  }
  return Promise.all(anims.map((a) => a.finished.catch(() => {})))
}
export function finishAll(root) {
  for (const a of root.getAnimations({ subtree: true })) a.finish()
}

// ---------------- Chuyển trang ----------------
const RANDOM = ['fade', 'push', 'wipe', 'split', 'cover', 'zoom']
export function playTransition(box, oldEl, newEl, tr) {
  if (!tr || !tr.type || tr.type === 'none') {
    oldEl?.remove()
    return Promise.resolve()
  }
  let type = tr.type
  if (type === 'random') type = RANDOM[Math.floor(Math.random() * RANDOM.length)]
  const dir = tr.dir || 'u'
  const dur = Math.max(0.1, tr.dur ?? 1) * 1000
  const off = { u: ['0, 100%', '0, -100%'], d: ['0, -100%', '0, 100%'], l: ['100%, 0', '-100%, 0'], r: ['-100%, 0', '100%, 0'] }[dir]
  const clip = { u: 'inset(100% 0 0 0)', d: 'inset(0 0 100% 0)', l: 'inset(0 0 0 100%)', r: 'inset(0 100% 0 0)' }[dir]
  const opt = { duration: dur, easing: 'ease-in-out', fill: 'both' }
  const runs = []
  if (type === 'fade') runs.push(newEl.animate([{ opacity: 0 }, { opacity: 1 }], opt))
  else if (type === 'dissolve') runs.push(newEl.animate([{ opacity: 0 }, { opacity: 1 }], { ...opt, easing: 'steps(7, end)' }))
  else if (type === 'push') {
    runs.push(newEl.animate([{ transform: `translate(${off[0]})` }, { transform: 'translate(0, 0)' }], opt))
    if (oldEl) runs.push(oldEl.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${off[1]})` }], opt))
  } else if (type === 'cover') runs.push(newEl.animate([{ transform: `translate(${off[0]})` }, { transform: 'translate(0, 0)' }], opt))
  else if (type === 'wipe') runs.push(newEl.animate([{ clipPath: clip }, { clipPath: 'inset(0 0 0 0)' }], opt))
  else if (type === 'split') runs.push(newEl.animate([{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }], opt))
  else if (type === 'zoom') runs.push(newEl.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], opt))
  return Promise.all(runs.map((a) => a.finished.catch(() => {}))).then(() => {
    oldEl?.remove()
    for (const a of newEl.getAnimations()) a.cancel()
  })
}
export const transitionName = (t) => TRANSITIONS[t]?.name || ''
