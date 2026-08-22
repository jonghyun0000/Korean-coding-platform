// localStorage 자동 저장 (로그인 없이 마지막 작업 유지)

const PREFIX = 'hangul-coding:'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    // 시크릿 모드 등에서 실패해도 앱은 계속 동작
  }
}

export function loadCode(missionId: string): string | null {
  return safeGet(`code:${missionId}`)
}

export function saveCode(missionId: string, code: string) {
  safeSet(`code:${missionId}`, code)
}

export function loadLastMission(): string | null {
  return safeGet('last-mission')
}

export function saveLastMission(id: string) {
  safeSet('last-mission', id)
}

export function loadBadges(): Set<string> {
  const raw = safeGet('badges')
  if (!raw) return new Set()
  try {
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function saveBadges(badges: Set<string>) {
  safeSet('badges', JSON.stringify([...badges]))
}
