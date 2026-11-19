// Windows XP 式のデフラグ。
//
// 0. 最初に全体を分析する（先頭から順に確認）。
// 1. 断片化したファイルを、まるごと入る最初の空き領域へ移す。
// 2. 連続したファイルを、手前にある入る空き領域へ詰める（後ろに大きな空きができる）。
//    1 と 2 を、何も動かなくなるまで最大 3 回繰り返す。
// 3. それでもまるごと入らないファイルは、大きい空き領域から使って断片の数を減らす。
//
// 前から完全に詰めるわけではないので、終わっても空きの隙間が残る。

import { copyDisk, posOf, fragOf, freeRun, freeRuns, applyStep } from '../disk.js'

const SCAN_CHUNK = 4

export function planXP(disk, files) {
  const D = copyDisk(disk)
  const steps = []
  const push = s => { steps.push(s); applyStep(D, s) }

  for (let i = 0; i < D.length; i += SCAN_CHUNK) {
    const cells = []
    for (let j = i; j < Math.min(i + SCAN_CHUNK, D.length); j++) cells.push(j)
    push({ type: 'check', cells })
  }

  const movable = files.map((_, f) => f).filter(f => !files[f].locked && files[f].size > 0)
  const start = f => Math.min(...posOf(D, f))
  const moveFileTo = (f, dest) => {
    posOf(D, f).forEach((from, k) => {
      if (from !== dest[k]) push({ type: 'moves', moves: [{ from, to: dest[k] }] })
    })
  }
  const range = (s, len) => Array.from({ length: len }, (_, k) => s + k)

  for (let pass = 0; pass < 3; pass++) {
    const before = steps.length

    // 1. 断片化したファイルをまとめる
    movable.filter(f => fragOf(D, f) > 1).sort((a, b) => start(a) - start(b)).forEach(f => {
      const s = freeRun(D, files[f].size)
      if (s >= 0) moveFileTo(f, range(s, files[f].size))
    })

    // 2. 連続したファイルを手前へ詰める
    movable.filter(f => fragOf(D, f) === 1).sort((a, b) => start(a) - start(b)).forEach(f => {
      const st = start(f), s = freeRun(D, files[f].size, st)
      if (s >= 0 && s < st) moveFileTo(f, range(s, files[f].size))
    })

    if (steps.length === before) break
  }

  // 3. まるごと入らないファイルは、断片の数を減らすだけにする
  movable.filter(f => fragOf(D, f) > 1).forEach(f => {
    const size = files[f].size, cur = fragOf(D, f)
    const pick = []
    let total = 0
    for (const r of freeRuns(D).sort((a, b) => b.len - a.len)) {
      if (total >= size) break
      pick.push(r); total += r.len
    }
    if (total < size || pick.length >= cur) return
    const dest = []
    pick.sort((a, b) => a.s - b.s).forEach(r => {
      for (let j = 0; j < r.len && dest.length < size; j++) dest.push(r.s + j)
    })
    moveFileTo(f, dest)
  })

  return { steps }
}
