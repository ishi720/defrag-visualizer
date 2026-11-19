// 画面の状態と操作をまとめた Alpine.js コンポーネント。
// デフラグの並べ方は algorithms/ が「手順の一覧」を作り、ここではそれを 1 つずつ再生するだけ。

import {
  N, NAMES, COLORS, isLocked, countFragments, countHoles,
  copyDisk, fragmentedDisk, randomLocks, applyStep
} from './disk.js'
import { plan98 } from './algorithms/win98.js'
import { planXP } from './algorithms/xp.js'
import { fly } from './animation.js'

const PLANNERS = { '98': plan98, xp: planXP }

export default () => ({
  N, NAMES, COLORS,

  mode: '98',
  disk: [],
  files: [],
  initial: null,  // 最後に断片化したときの配置（初期状態）
  speed: 5,
  anim: true,

  running: false,
  steps: [],      // 再生中の手順。空なら次の開始時に作り直す
  si: 0,          // 次に再生する手順の番号
  moved: 0,
  checked: 0,

  ov: {},         // アニメーション中だけ表示を上書きするマス
  marks: {},      // 枠の表示（rd/wr/ck/sk/drag/over/no）
  gen: 0,         // 停止したら増やして、走っている非同期処理を打ち切る
  timer: null,
  from: -1,
  over: -1,

  init() { this.fragment() },

  // ---------- 表示 ----------
  get view() { return this.disk.map((v, i) => (i in this.ov ? this.ov[i] : v)) },
  get frag() { return countFragments(this.disk, this.files) },
  get holes() { return countHoles(this.disk) },
  get lockedCount() { return this.disk.filter(v => this.isLk(v)).length },
  isLk(v) { return isLocked(this.files, v) },
  cellClass(i, v) { return [this.marks[i] || '', v ? (this.isLk(v) ? 'lk' : 'has') : ''].join(' ') },
  cellStyle(v) { return v ? `background:${COLORS[v.f]}` : '' },
  cellEl(i) { return this.$refs.grid.querySelector(`[data-i="${i}"]`) },
  delay() { return (11 - this.speed) * 45 },

  // ---------- ディスクの準備 ----------
  load({ disk, files }) {
    this.stop()
    this.disk = disk; this.files = files
    this.resetPlan(); this.moved = 0; this.checked = 0
  },
  // 断片化した直後の配置を覚えておき、「初期状態に戻す」でそこへ戻す
  fragment() {
    const d = fragmentedDisk()
    this.initial = { disk: copyDisk(d.disk), files: d.files.map(f => ({ ...f })) }
    this.load(d)
  },
  restore() {
    if (!this.initial) return
    this.load({ disk: copyDisk(this.initial.disk), files: this.initial.files.map(f => ({ ...f })) })
  },
  randomLock() { this.stop(); randomLocks(this.files); this.resetPlan() },
  resetPlan() { this.steps = []; this.si = 0 },
  setMode(m) {
    if (this.mode === m) return
    this.stop(); this.resetPlan()
    this.mode = m
  },

  // ---------- 再生 ----------
  toggleRun() {
    if (this.running) { this.stop(); return }
    if (!this.steps.length) {
      this.steps = PLANNERS[this.mode](this.disk, this.files).steps
      this.si = 0; this.moved = 0; this.checked = 0
    }
    this.running = true
    this.play()
  },
  stop() {
    this.gen++
    this.running = false
    clearTimeout(this.timer)
    if (this.$refs.layer) this.$refs.layer.innerHTML = ''
    this.ov = {}; this.marks = {}
  },
  wait(ms) { return new Promise(r => { this.timer = setTimeout(r, ms) }) },

  async play() {
    const g = this.gen
    while (g === this.gen) {
      if (this.si >= this.steps.length) { this.stop(); this.resetPlan(); return }
      const step = this.steps[this.si]

      if (step.type === 'check') {
        this.marks = Object.fromEntries(step.cells.map(i => [i, step.skip ? 'sk' : 'ck']))
        this.checked += step.cells.length
        this.si++
        await this.wait(step.skip ? Math.max(60, this.delay()) : Math.max(15, this.delay() / 4))
        continue
      }

      // 移動
      const vals = step.moves.map(m => this.disk[m.from])
      const m = {}
      step.moves.forEach(({ from, to }) => { m[from] = 'rd'; m[to] = 'wr' })
      this.marks = m
      this.checked += step.checks || 0
      applyStep(this.disk, step)
      this.moved += step.moves.length

      if (this.anim) {
        const hide = {}
        step.moves.forEach(({ from, to }) => { hide[from] = null; hide[to] = null })
        this.ov = hide
        await this.$nextTick()
        await Promise.all(step.moves.map(({ from, to }, i) => this.flyCell(from, to, vals[i], Math.max(160, this.delay() * 3))))
        if (g !== this.gen) return
        this.ov = {}
      }
      this.si++
      await this.wait(this.delay())
    }
  },
  flyCell(from, to, v, duration) {
    return fly({
      layer: this.$refs.layer, container: this.$refs.wrap,
      fromEl: this.cellEl(from), toEl: this.cellEl(to),
      color: COLORS[v.f], label: NAMES[v.f], duration
    })
  },

  // ---------- ドラッグ ----------
  idxAt(x, y) {
    const el = document.elementFromPoint(x, y)
    const c = el && el.closest ? el.closest('.c') : null
    return c ? +c.dataset.i : -1
  },
  down(e) {
    const i = this.idxAt(e.clientX, e.clientY)
    if (i < 0 || !this.disk[i] || this.isLk(this.disk[i])) return
    if (this.running) this.stop()
    this.from = i; this.over = -1
    this.marks = { [i]: 'drag' }
    this.$refs.grid.setPointerCapture(e.pointerId)
    e.preventDefault()
  },
  move(e) {
    if (this.from < 0) return
    const i = this.idxAt(e.clientX, e.clientY)
    if (i === this.over) return
    this.over = i
    const m = { [this.from]: 'drag' }
    if (i >= 0 && i !== this.from) m[i] = this.isLk(this.disk[i]) ? 'no' : 'over'
    this.marks = m
  },
  async up() {
    if (this.from < 0) return
    const f = this.from, o = this.over
    this.from = -1; this.over = -1; this.marks = {}
    if (o < 0 || o === f || this.isLk(this.disk[o])) return

    const a = this.disk[f], b = this.disk[o]
    this.disk[o] = a; this.disk[f] = b
    this.resetPlan()

    // 押し出されたデータは元の場所へ飛んで戻る
    if (b && this.anim) {
      const g = this.gen
      this.ov = { [f]: null }
      await this.$nextTick()
      await this.flyCell(o, f, b, 250)
      if (g === this.gen) this.ov = {}
    }
  }
})
