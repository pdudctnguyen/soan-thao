// Chế độ trình chiếu toàn màn hình.
import { W, H } from './model.js'
import { renderSlide } from './render.js'
import { animGroups, hideAnimated, playGroup, finishAll, playTransition } from './anim.js'

export function startShow(deck, startIndex, { onExit } = {}) {
  const box = document.getElementById('show')
  box.innerHTML = '<div class="show-stage" id="showStage"></div><div class="show-ctrl"><button data-sc="prev" title="Trang trước">◀</button><span id="showNum"></span><button data-sc="next" title="Tiếp">▶</button><button data-sc="exit" title="Thoát (Esc)">✕</button></div>'
  box.classList.remove('hidden')
  const stage = box.querySelector('#showStage')
  let idx = -1
  let step = 0
  let groups = []
  let cur = null
  let busy = null
  let advTimer = null
  let ended = false

  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H)
    stage.style.transform = `translate(-50%, -50%) scale(${s})`
  }
  fit()
  try { document.documentElement.requestFullscreen?.().catch(() => {}) } catch { /* không hỗ trợ */ }

  function go(i, { showAll = false, transition = true } = {}) {
    clearTimeout(advTimer)
    const slide = deck.slides[i]
    const el = renderSlide(deck, slide, i, { show: true })
    el.classList.add('show-slide')
    stage.appendChild(el)
    const old = cur
    cur = el
    idx = i
    groups = animGroups(slide)
    step = 0
    ended = false
    box.querySelector('#showNum').textContent = `${i + 1}/${deck.slides.length}`
    if (showAll) {
      step = groups.length
    } else {
      hideAnimated(el, slide)
    }
    const t = transition && !showAll ? playTransition(stage, old, el, slide.transition) : (old?.remove(), Promise.resolve())
    busy = t.then(() => {
      busy = null
      if (!showAll && groups[0]?.auto) return playNext()
    }).then(() => scheduleAdvance())
  }
  function scheduleAdvance() {
    const adv = deck.slides[idx]?.transition?.adv
    if (!adv) return
    clearTimeout(advTimer)
    advTimer = setTimeout(async () => {
      while (step < groups.length) await playNext()
      next()
    }, adv * 1000)
  }
  function playNext() {
    const g = groups[step++]
    const p = playGroup(cur, g)
    busy = p.then(() => { busy = null })
    return busy
  }
  function next() {
    if (busy) {
      finishAll(stage)
      return
    }
    if (ended) return exit()
    if (step < groups.length) return playNext()
    if (idx < deck.slides.length - 1) return go(idx + 1)
    endScreen()
  }
  function prev() {
    if (ended) {
      ended = false
      return go(idx, { showAll: true, transition: false })
    }
    if (idx > 0) go(idx - 1, { showAll: true, transition: false })
  }
  function endScreen() {
    clearTimeout(advTimer)
    ended = true
    stage.innerHTML = '<div class="show-end">Kết thúc trình chiếu. Bấm chuột hoặc Esc để thoát.</div>'
    cur = null
  }
  function exit() {
    clearTimeout(advTimer)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', fit)
    box.classList.add('hidden')
    box.innerHTML = ''
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    onExit?.(idx)
  }
  function onKey(e) {
    const k = e.key
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) next()
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) prev()
    else if (k === 'Escape') exit()
    else if (k === 'Home') go(0, { transition: false })
    else if (k === 'End') go(deck.slides.length - 1, { transition: false, showAll: true })
    else return
    e.preventDefault()
    e.stopPropagation()
  }
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', fit)
  document.addEventListener('fullscreenchange', function fc() {
    if (!document.fullscreenElement && !box.classList.contains('hidden')) fit()
    if (box.classList.contains('hidden')) document.removeEventListener('fullscreenchange', fc)
  })
  box.onclick = (e) => {
    const c = e.target.closest('[data-sc]')
    if (c) {
      e.stopPropagation()
      return { prev, next, exit }[c.dataset.sc]()
    }
    // liên kết
    const a = e.target.closest('a[href]')
    const lk = e.target.closest('[data-link]')
    const href = a?.getAttribute('href')
    const link = href ? (/^#slide=(\d+)$/.test(href) ? { slide: +href.split('=')[1] } : { url: href }) : lk ? JSON.parse(lk.dataset.link) : null
    if (link) {
      e.preventDefault()
      if (link.slide && link.slide >= 1 && link.slide <= deck.slides.length) return go(link.slide - 1)
      if (link.url) return window.open(/^[a-z]+:/i.test(link.url) ? link.url : `https://${link.url}`, '_blank', 'noopener')
      return
    }
    next()
  }
  box.oncontextmenu = (e) => {
    e.preventDefault()
    prev()
  }
  box.focus()
  go(startIndex)
}

// Xem trước hiệu ứng ngay trên trang đang soạn
export async function previewAnims(root, slide) {
  const groups = animGroups(slide)
  hideAnimated(root, slide)
  for (const g of groups) await playGroup(root, g)
  for (const a of root.getAnimations({ subtree: true })) a.cancel()
  for (const el of root.querySelectorAll('.obj')) el.style.visibility = ''
}
export async function previewTransition(holder, deck, slide, index) {
  const el = renderSlide(deck, slide, index)
  el.classList.add('preview-slide')
  const blank = document.createElement('div')
  blank.className = 'slide preview-slide'
  blank.style.cssText = `width:${W}px;height:${H}px;background:#000`
  const host = document.createElement('div')
  host.className = 'preview-box'
  holder.querySelector('.slide.edit').appendChild(host)
  host.append(blank, el)
  await playTransition(host, blank, el, slide.transition)
  host.remove()
}
