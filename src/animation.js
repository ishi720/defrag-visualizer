// データが元のマスから行き先のマスへ、弧を描いて飛んでいくアニメーション。
// Alpine.js には位置移動のアニメーションを書く仕組みがないので、Web Animations API で直接動かす。

export function fly({ layer, container, fromEl, toEl, color, label, duration }) {
  const w = container.getBoundingClientRect()
  const a = fromEl.getBoundingClientRect()
  const b = toEl.getBoundingClientRect()
  const x1 = a.left - w.left, y1 = a.top - w.top
  const x2 = b.left - w.left, y2 = b.top - w.top

  const el = document.createElement('div')
  el.className = 'fly'
  el.style.width = el.style.height = a.width + 'px'
  el.style.background = color
  el.textContent = label
  layer.appendChild(el)

  // 途中で少し浮き上がる
  const mx = (x1 + x2) / 2
  const my = Math.min(y1, y2) - Math.min(40, Math.abs(x2 - x1) / 4 + Math.abs(y2 - y1) / 4 + 8)

  const an = el.animate([
    { transform: `translate(${x1}px, ${y1}px) scale(1)` },
    { transform: `translate(${mx}px, ${my}px) scale(1.35)`, offset: 0.5 },
    { transform: `translate(${x2}px, ${y2}px) scale(1)` }
  ], { duration, easing: 'ease-in-out', fill: 'forwards' })

  return an.finished.catch(() => {}).then(() => el.remove())
}
