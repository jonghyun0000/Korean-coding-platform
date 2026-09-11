import { test } from 'node:test'
import assert from 'node:assert/strict'
import { experimentCode } from '../src/missions/experiments'
import { runProgram } from '../src/lang/run'

for (let n = 3; n <= 10; n++) {
  test(`${n}각형은 ${n}번 이동하고 360도를 회전한다`, () => {
    const result = runProgram(experimentCode('polygon', n))
    assert.equal(result.ok, true)
    if (result.ok !== true) return
    assert.equal(result.effects.filter(e => e.kind === 'move').length, n)
    const turn = result.effects.filter(e => e.kind === 'turn').reduce((sum, e) => sum + e.angle, 0)
    assert.ok(Math.abs(turn - 360) < 0.00001)
  })
  test(`1부터 ${n}까지의 누적 합을 출력한다`, () => {
    const result = runProgram(experimentCode('count', n))
    assert.equal(result.ok, true)
    if (result.ok !== true) return
    const lines = result.effects.filter(e => e.kind === 'print')
    assert.equal(lines.length, n)
    assert.equal(lines.at(-1)?.text, `${n} 까지 더하면 ${n * (n + 1) / 2}`)
  })
}
