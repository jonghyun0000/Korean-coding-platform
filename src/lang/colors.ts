/** 한글 색깔 이름 → CSS 색상. 아이들이 부르는 여러 이름을 함께 등록. */
export const COLOR_MAP: Record<string, string> = {
  '빨강': '#ef4444', '빨간색': '#ef4444', 'red': '#ef4444',
  '주황': '#f97316', '주황색': '#f97316', 'orange': '#f97316',
  '노랑': '#fbbf24', '노란색': '#fbbf24', 'yellow': '#fbbf24',
  '초록': '#22c55e', '초록색': '#22c55e', '녹색': '#22c55e', 'green': '#22c55e',
  '연두': '#84cc16', '연두색': '#84cc16', 'lime': '#84cc16',
  '파랑': '#3b82f6', '파란색': '#3b82f6', 'blue': '#3b82f6',
  '하늘': '#38bdf8', '하늘색': '#38bdf8', 'skyblue': '#38bdf8',
  '남색': '#3730a3', 'navy': '#3730a3',
  '보라': '#a855f7', '보라색': '#a855f7', 'purple': '#a855f7', 'violet': '#a855f7',
  '분홍': '#ec4899', '분홍색': '#ec4899', '핑크': '#ec4899', 'pink': '#ec4899',
  '자주': '#be185d', '자주색': '#be185d',
  '갈색': '#92400e', 'brown': '#92400e',
  '검정': '#1f2937', '검정색': '#1f2937', '검은색': '#1f2937', 'black': '#1f2937',
  '하양': '#f8fafc', '하얀색': '#f8fafc', '흰색': '#f8fafc', 'white': '#f8fafc',
  '회색': '#9ca3af', 'gray': '#9ca3af', 'grey': '#9ca3af',
  '금색': '#d4a017', 'gold': '#d4a017',
  '은색': '#cbd5e1', 'silver': '#cbd5e1',
}

export const COLOR_NAMES_HINT =
  '빨강, 주황, 노랑, 초록, 연두, 파랑, 하늘, 남색, 보라, 분홍, 갈색, 검정, 하양, 회색 (영어 이름도 돼요: red, blue, green…)'

/** 색 이름을 CSS 색상으로. 모르는 색이면 null. (#hex도 허용) */
export function resolveColor(name: string): string | null {
  const key = name.trim()
  const mapped = COLOR_MAP[key] ?? COLOR_MAP[key.toLowerCase()]
  if (mapped) return mapped
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(key)) return key
  return null
}
