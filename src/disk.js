// ディスクのデータ構造と、画面に依存しない共通処理。
//
// disk  : 長さ N の配列。各マス（クラスタ）は null（空き）か { f, k }。
//         f = ファイル番号、k = そのファイルの何番目のクラスタか（0 始まり）
// files : [{ size, locked, uses }]
//         size = クラスタ数、locked = 使用中で動かせない、uses = 起動回数（95・98式の並び順に使う）

export const N = 160
export const NAMES = 'ABCDEFGH'
export const COLORS = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#BA7517', '#639922', '#888780']
const FILE_COUNT = 8

export const rand = n => Math.floor(Math.random() * n)
const shuffle = a => a.sort(() => Math.random() - 0.5)

export const same = (a, b) => !!(a && b && a.f === b.f && a.k === b.k)
export const copyDisk = D => D.map(v => (v ? { f: v.f, k: v.k } : null))
export const isLocked = (files, v) => !!(v && files[v.f] && files[v.f].locked)

/** ファイル f の各クラスタの位置（k 番目 → マス番号） */
export function posOf(D, f) {
  const p = []
  D.forEach((v, i) => { if (v && v.f === f) p[v.k] = i })
  return p
}

/** ファイル f がいくつの断片に分かれているか */
export function fragOf(D, f) {
  const p = posOf(D, f)
  let n = p.length ? 1 : 0
  for (let k = 1; k < p.length; k++) if (p[k] !== p[k - 1] + 1) n++
  return n
}

export const countFragments = (D, files) => files.reduce((s, _, f) => s + fragOf(D, f), 0)

/** 空きマスがいくつの塊に分かれているか */
export function countHoles(D) {
  let n = 0
  for (let i = 0; i < D.length; i++) if (!D[i] && (i === 0 || D[i - 1])) n++
  return n
}

/** 長さ len 以上の連続した空き領域の先頭。before を指定するとそれより手前だけを探す */
export function freeRun(D, len, before) {
  let s = -1
  for (let i = 0; i < D.length; i++) {
    if (D[i]) { s = -1; continue }
    if (s < 0) s = i
    if (before != null && s >= before) return -1
    if (i - s + 1 >= len) return s
  }
  return -1
}

/** 連続した空き領域の一覧 */
export function freeRuns(D) {
  const r = []
  let st = -1
  for (let i = 0; i <= D.length; i++) {
    if (i < D.length && !D[i]) { if (st < 0) st = i }
    else if (st >= 0) { r.push({ s: st, len: i - st }); st = -1 }
  }
  return r
}

/** 手順の 1 ステップをディスクに適用する（同時移動・入れ替えにも対応） */
export function applyStep(D, step) {
  if (step.type !== 'moves') return
  const vals = step.moves.map(m => D[m.from])
  step.moves.forEach(m => { D[m.from] = null })
  step.moves.forEach((m, i) => { D[m.to] = vals[i] })
}

const newFile = size => ({ size, locked: false, uses: 1 + rand(50) })

/**
 * 長く使ったディスクを再現する。
 * ファイルが少しずつ大きくなる間に一時ファイルが隙間へ書き込まれ、最後に一時ファイルが消えて穴が残る。
 * 書き込み位置もときどきランダムに飛ぶので、ファイルはディスク全体に散らばる。
 */
export function fragmentedDisk() {
  const D = Array(N).fill(null)
  const sizes = Array(FILE_COUNT).fill(0)
  const target = sizes.map(() => 6 + rand(6))
  const TEMP = -1
  let ptr = 0

  const alloc = v => {
    for (let j = 0; j < N; j++) {
      const i = (ptr + j) % N
      if (!D[i]) { D[i] = v; ptr = (i + 1) % N; return true }
    }
    return false
  }
  const freeTemps = n => {
    const t = []
    D.forEach((v, i) => { if (v && v.f === TEMP) t.push(i) })
    shuffle(t).slice(0, n).forEach(i => { D[i] = null })
  }

  for (let g = 0; g < 3000; g++) {
    const rem = sizes.map((_, i) => i).filter(i => sizes[i] < target[i])
    if (!rem.length) break
    const f = rem[rand(rem.length)]
    if (Math.random() < 0.35) ptr = rand(N)
    const n = Math.min(1 + rand(2), target[f] - sizes[f])
    for (let j = 0; j < n; j++) {
      if (!alloc({ f, k: sizes[f] })) { freeTemps(8); j--; continue }
      sizes[f]++
    }
    if (Math.random() < 0.85) {
      const t = 1 + rand(4)
      for (let j = 0; j < t; j++) if (!alloc({ f: TEMP, k: 0 })) { freeTemps(8); break }
    }
    if (Math.random() < 0.15) freeTemps(1 + rand(4))
  }

  const files = sizes.map(newFile)
  const disk = D.map(v => (v && v.f === TEMP ? null : v))
  randomLocks(files)
  return { disk, files }
}

/** 1〜2 個のファイルを使用中にする。使用中にしたファイル番号を返す */
export function randomLocks(files) {
  files.forEach(f => { f.locked = false })
  const idx = shuffle([...files.keys()]).slice(0, 1 + rand(2))
  idx.forEach(i => { files[i].locked = true })
  return idx
}
