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

/** 교재 패널을 펼쳐 둘지 (미션을 바꿔도 유지) */
export function loadLessonOpen(fallback: boolean): boolean {
  const raw = safeGet('lesson-open')
  if (raw === null) return fallback
  return raw === '1'
}

export function saveLessonOpen(open: boolean) {
  safeSet('lesson-open', open ? '1' : '0')
}

/**
 * 이 브라우저에 저장된 한글코딩 자료를 모두 지운다.
 * 컴퓨터실처럼 여러 명이 같은 PC를 쓸 때 다음 사람을 위해 정리하는 용도.
 */
export function clearAll() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    // 저장소를 못 쓰는 환경이면 어차피 남는 것도 없다
  }
}
