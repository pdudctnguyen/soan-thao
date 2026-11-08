// Biểu đồ nổi trên trang tính (Chart.js). Kéo để di chuyển, kéo góc để đổi kích thước.
import { Chart, BarController, LineController, PieController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Legend, Title, Tooltip } from 'chart.js'
import { parseRange } from './addr.js'

Chart.register(BarController, LineController, PieController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Legend, Title, Tooltip)

export const PALETTE = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e', '#636363', '#997300']

export const chartDefaults = () => ({ type: 'column', w: 420, h: 260, legend: true, labels: false, title: '' })

// Nhãn dữ liệu (không cần thêm thư viện)
const DataLabels = {
  id: 'simpleLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts?.show) return
    const { ctx } = chart
    ctx.save()
    ctx.font = '11px Calibri, Arial'
    ctx.fillStyle = '#333'
    ctx.textAlign = 'center'
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i)
      if (meta.hidden) return
      meta.data.forEach((el, j) => {
        const v = ds.data[j]
        if (v === null || v === undefined) return
        const p = el.tooltipPosition()
        let x = p.x
        let y = p.y - 6
        if (chart.config.type === 'bar' && chart.options.indexAxis === 'y') { ctx.textAlign = 'left'; x = p.x + 4; y = p.y + 4 }
        ctx.fillText(String(+(+v).toFixed(2)), x, y)
      })
    })
    ctx.restore()
  },
}
Chart.register(DataLabels)

// Đọc dữ liệu từ vùng: hàng đầu là tên chuỗi (nếu là chữ), cột đầu là nhãn (nếu là chữ)
export function chartData(ch, api) {
  const rg = parseRange(ch.range)
  if (!rg) return { labels: [], series: [] }
  const isText = (r, c) => typeof api.value(r, c) === 'string'
  let headerRow = false
  for (let c = rg.c1 + 1; c <= rg.c2; c++) if (isText(rg.r1, c)) headerRow = true
  if (rg.c1 === rg.c2 && isText(rg.r1, rg.c1)) headerRow = true
  let labelCol = false
  for (let r = rg.r1 + (headerRow ? 1 : 0); r <= rg.r2; r++) if (isText(r, rg.c1)) labelCol = true
  const r0 = rg.r1 + (headerRow ? 1 : 0)
  const c0 = rg.c1 + (labelCol ? 1 : 0)
  const labels = []
  for (let r = r0; r <= rg.r2; r++) labels.push(labelCol ? api.display(r, rg.c1) : String(r - r0 + 1))
  const series = []
  for (let c = c0; c <= rg.c2; c++) {
    const data = []
    for (let r = r0; r <= rg.r2; r++) {
      const v = api.value(r, c)
      data.push(typeof v === 'number' ? v : null)
    }
    series.push({ name: headerRow ? api.display(rg.r1, c) : `Chuỗi ${c - c0 + 1}`, data })
  }
  return { labels, series }
}

function config(ch, api) {
  const { labels, series } = chartData(ch, api)
  const pie = ch.type === 'pie'
  const type = ch.type === 'column' || ch.type === 'bar' ? 'bar' : ch.type
  const datasets = (pie ? series.slice(0, 1) : series).map((s, i) => ({
    label: s.name,
    data: s.data,
    backgroundColor: pie ? labels.map((_, j) => PALETTE[j % PALETTE.length]) : PALETTE[i % PALETTE.length],
    borderColor: pie ? '#fff' : PALETTE[i % PALETTE.length],
    borderWidth: ch.type === 'line' ? 2 : 1,
    tension: 0,
  }))
  return {
    type,
    data: { labels, datasets },
    options: {
      animation: false,
      responsive: false,
      maintainAspectRatio: false,
      indexAxis: ch.type === 'bar' ? 'y' : 'x',
      plugins: {
        title: { display: !!ch.title, text: ch.title, font: { size: 15, family: 'Calibri, Arial' }, color: '#333' },
        legend: { display: ch.legend !== false, position: pie ? 'right' : 'bottom' },
        simpleLabels: { show: !!ch.labels },
        tooltip: { enabled: true },
      },
      scales: pie ? {} : { y: { beginAtZero: true }, x: { beginAtZero: true } },
    },
  }
}

const instances = new Map()

export function renderCharts(holder, sheet, api) {
  const ids = new Set(sheet.charts.map((c) => c.id))
  for (const [id, inst] of instances) {
    if (!ids.has(id) || !holder.contains(inst.canvas)) {
      inst.destroy()
      instances.delete(id)
    }
  }
  $$(holder, '.chart-box').forEach((el) => { if (!ids.has(el.dataset.id)) el.remove() })
  for (const ch of sheet.charts) {
    let box = holder.querySelector(`.chart-box[data-id="${ch.id}"]`)
    if (!box) {
      box = document.createElement('div')
      box.className = 'chart-box'
      box.dataset.id = ch.id
      box.innerHTML = '<canvas></canvas><span class="chart-resize" title="Kéo để đổi kích thước"></span>'
      holder.appendChild(box)
      wire(box, ch.id)
    }
    box._sheet = sheet // luôn trỏ tới trang tính mới nhất (sau hoàn tác, đối tượng có thể đổi)
    box._api = api
    box.style.left = `${ch.x}px`
    box.style.top = `${ch.y}px`
    box.style.width = `${ch.w}px`
    box.style.height = `${ch.h}px`
    box.classList.toggle('selected', api.selected === ch.id)
    const canvas = box.querySelector('canvas')
    canvas.width = ch.w * 2
    canvas.height = ch.h * 2
    canvas.style.width = `${ch.w}px`
    canvas.style.height = `${ch.h}px`
    const cfg = config(ch, api)
    let inst = instances.get(ch.id)
    if (inst && inst.config.type !== cfg.type) { inst.destroy(); inst = null }
    if (!inst) {
      inst = new Chart(canvas, { ...cfg, options: { ...cfg.options, devicePixelRatio: 2 } })
      instances.set(ch.id, inst)
    } else {
      inst.data = cfg.data
      inst.options = { ...cfg.options, devicePixelRatio: 2 }
      inst.resize(ch.w, ch.h)
      inst.update('none')
    }
  }
}

function wire(box, id) {
  box.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const sheet = box._sheet
    const api = box._api
    const ch = sheet.charts.find((c) => c.id === id)
    if (!ch) return
    api.onSelect(id)
    const resize = e.target.classList.contains('chart-resize')
    const z = api.zoom()
    const start = { x: e.clientX, y: e.clientY, cx: ch.x, cy: ch.y, w: ch.w, h: ch.h }
    let moved = false
    const onMove = (ev) => {
      const dx = (ev.clientX - start.x) / z
      const dy = (ev.clientY - start.y) / z
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return
      if (!moved) { api.onBeforeChange(); moved = true }
      if (resize) { ch.w = Math.max(200, Math.round(start.w + dx)); ch.h = Math.max(140, Math.round(start.h + dy)) }
      else { ch.x = Math.max(0, Math.round(start.cx + dx)); ch.y = Math.max(0, Math.round(start.cy + dy)) }
      box.style.left = `${ch.x}px`
      box.style.top = `${ch.y}px`
      if (resize) {
        box.style.width = `${ch.w}px`
        box.style.height = `${ch.h}px`
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (moved) {
        api.onChange()
        const inst = instances.get(id)
        if (inst && resize) {
          const canvas = box.querySelector('canvas')
          canvas.style.width = `${ch.w}px`
          canvas.style.height = `${ch.h}px`
          inst.resize(ch.w, ch.h)
        }
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  })
}

function $$(root, sel) {
  return [...root.querySelectorAll(sel)]
}
