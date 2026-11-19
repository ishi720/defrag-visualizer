// Windows 95・98 式のデフラグ。
//
// 1. よく使う（起動回数の多い）ファイルから順に、先頭から隙間なく並べた「理想の並び」を決める。
//    使用中のファイルは今の場所に固定し、ほかのファイルはそこを避けて詰める。
// 2. 先頭から 1 マスずつ確認し、ずれていれば正しいデータを持ってくる。
//    行き先に別のデータがあるときは、先にそれを後ろの空き領域へ退避させる。
//
// 返す手順（steps）の形:
//   { type: 'check', cells: [i], skip?: true }   確認だけ（skip は使用中で飛ばしたマス）
//   { type: 'moves', moves: [{ from, to }, ...] } 移動。複数あるときは同時に動く（入れ替え）

import { copyDisk, isLocked, same, applyStep } from '../disk.js'

/** 起動回数の多い順に並べたファイル番号 */
export const usageOrder = files =>
  files.map((_, i) => i).sort((a, b) => files[b].uses - files[a].uses)

/** 理想の並び */
export function buildTarget(disk, files) {
  const t = Array(disk.length).fill(null)
  disk.forEach((v, i) => { if (isLocked(files, v)) t[i] = { f: v.f, k: v.k } })
  let p = 0
  usageOrder(files).forEach(f => {
    if (files[f].locked) return
    for (let k = 0; k < files[f].size; k++) {
      while (p < t.length && t[p]) p++
      t[p++] = { f, k }
    }
  })
  return t
}

export function plan98(disk, files) {
  const D = copyDisk(disk)
  const target = buildTarget(disk, files)
  const steps = []
  const push = s => { steps.push(s); applyStep(D, s) }

  // 動かせるファイルの最後のマスまで確認すれば十分。
  // それより後ろには、使用中のマスと空きマスしか残らない。
  const last = target.reduce((m, v, i) => (v && !isLocked(files, v) ? i : m), -1)

  for (let p = 0; p <= last; p++) {
    const want = target[p]
    if (isLocked(files, want)) { push({ type: 'check', cells: [p], skip: true }); continue }
    if (same(D[p], want)) { push({ type: 'check', cells: [p] }); continue }

    const src = D.findIndex(v => same(v, want))
    const occ = D[p]
    if (!occ) { push({ type: 'moves', moves: [{ from: src, to: p }], checks: 1 }); continue }

    // 退避先：理想の並びで使わない空きマスを優先し、なければ後ろの空きマス
    let dst = D.findIndex((v, i) => !v && i > p && i !== src && !target[i])
    if (dst < 0) dst = D.findIndex((v, i) => !v && i > p && i !== src)

    if (dst >= 0) {
      push({ type: 'moves', moves: [{ from: p, to: dst }], checks: 1 })
      push({ type: 'moves', moves: [{ from: src, to: p }] })
    } else {
      // 空き領域がないときは入れ替える
      push({ type: 'moves', moves: [{ from: p, to: src }, { from: src, to: p }], checks: 1 })
    }
  }
  return { steps, target }
}
