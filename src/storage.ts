// localStorage 자동 저장 (로그인 없이 마지막 작업 유지)
// 서버로 보내는 것은 아무것도 없습니다 — 모두 이 브라우저 안에만 남습니다.

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

// ---- 배우는 사람 정보 (선택) ----

export interface Learner {
  name: string
  group: string // 학년/반
}

export function loadLearner(): Learner {
  const raw = safeGet('learner')
  if (!raw) return { name: '', group: '' }
  try {
    const v = JSON.parse(raw) as Partial<Learner>
    return { name: v.name ?? '', group: v.group ?? '' }
  } catch {
    return { name: '', group: '' }
  }
}

export function saveLearner(learner: Learner) {
  safeSet('learner', JSON.stringify(learner))
}

// ---- 미션별 진도 ----

export interface MissionProgress {
  /** 처음 완료한 시각 (ISO) */
  completedAt?: string
  /** 실행 횟수 */
  runs?: number
  /** 퀴즈에서 고른 번호와 정답 여부 */
  quizPicked?: number
  quizCorrect?: boolean
}

export type ProgressMap = Record<string, MissionProgress>

export function loadProgress(): ProgressMap {
  const raw = safeGet('progress')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as ProgressMap
  } catch {
    return {}
  }
}

export function saveProgress(progress: ProgressMap) {
  safeSet('progress', JSON.stringify(progress))
}

/** 한 미션의 진도를 조금만 고쳐서 저장하고, 새 진도를 돌려준다 */
export function updateProgress(missionId: string, patch: MissionProgress): ProgressMap {
  const all = loadProgress()
  all[missionId] = { ...all[missionId], ...patch }
  saveProgress(all)
  return all
}

// ---- 내보내기 / 가져오기 (기기를 바꿀 때) ----

export interface Snapshot {
  app: 'hangul-coding'
  version: 1
  savedAt: string
  learner: Learner
  badges: string[]
  progress: ProgressMap
  codes: Record<string, string>
  lastMission: string | null
}

/** 저장된 모든 것을 하나의 객체로 (파일로 저장하거나 복사해 두기 위해) */
export function exportSnapshot(missionIds: string[], savedAt: string): Snapshot {
  const codes: Record<string, string> = {}
  for (const id of missionIds) {
    const c = loadCode(id)
    if (c != null) codes[id] = c
  }
  return {
    app: 'hangul-coding',
    version: 1,
    savedAt,
    learner: loadLearner(),
    badges: [...loadBadges()],
    progress: loadProgress(),
    codes,
    lastMission: loadLastMission(),
  }
}

/** 내보낸 내용을 되돌려 놓는다. 형식이 맞지 않으면 false */
export function importSnapshot(json: string): boolean {
  try {
    const data = JSON.parse(json) as Partial<Snapshot>
    if (data.app !== 'hangul-coding' || typeof data.version !== 'number') return false
    if (data.learner) saveLearner({ name: data.learner.name ?? '', group: data.learner.group ?? '' })
    if (Array.isArray(data.badges)) saveBadges(new Set(data.badges))
    if (data.progress && typeof data.progress === 'object') saveProgress(data.progress)
    if (data.codes && typeof data.codes === 'object') {
      for (const [id, code] of Object.entries(data.codes)) {
        if (typeof code === 'string') saveCode(id, code)
      }
    }
    if (typeof data.lastMission === 'string') saveLastMission(data.lastMission)
    return true
  } catch {
    return false
  }
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
