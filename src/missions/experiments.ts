export type Experiment = 'polygon' | 'count'

export function experimentCode(kind: Experiment, value: number): string {
  const n = Math.max(3, Math.min(10, Math.round(Number.isFinite(value) ? value : 4)))
  if (kind === 'count') return `# 숫자를 바꾸고 합계가 어떻게 달라지는지 살펴보세요\n합계 = 0\n반복 i = 1 부터 ${n}\n    합계 = 합계 + i\n    출력(i, "까지 더하면", 합계)\n끝`
  return `# 한 바퀴는 360도! 변이 늘면 한 번에 도는 각도는 작아져요\n변 = ${n}\n캐릭터.색깔("보라")\n캐릭터.굵기(4)\n반복 i = 1 부터 변\n    캐릭터.앞으로(80)\n    캐릭터.오른쪽(360 / 변)\n끝`
}
