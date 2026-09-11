import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from './components/TopBar'
import { NextStepBar, type RunState } from './components/NextStepBar'
import { LessonPanel, type Tab } from './components/LessonPanel'
import { CanvasPane } from './components/CanvasPane'
import { ConsolePane, type ConsoleItem } from './components/ConsolePane'
import { Confetti } from './components/Confetti'
import { HelpModal } from './components/HelpModal'
import { AskDialog } from './components/AskDialog'
import { ProgressModal } from './components/ProgressModal'
import { TeacherModal } from './components/TeacherModal'
import { CodeEditor, type CodeEditorHandle } from './editor/CodeEditor'
import { TurtlePlayer } from './turtle/player'
import { runProgram } from './lang/run'
import type { AskRequest, Effect } from './lang/interpreter'
import { getMission, MISSIONS } from './missions/missions'
import { Emo } from './ui/emoji'
import * as storage from './storage'
import { ExperimentLab } from './components/ExperimentLab'

// 공용 PC용: 주소 끝에 ?reset=1 을 붙여 열면 저장된 내용을 모두 지우고 새로 시작한다.
// 교사용: ?teacher=1 을 붙이면 정답·지도안이 담긴 교사용 자료 버튼이 나타난다.
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const TEACHER_MODE = urlParams?.get('teacher') === '1'
if (typeof window !== 'undefined' && urlParams?.get('reset') === '1') {
  storage.clearAll()
  const keep = TEACHER_MODE ? '?teacher=1' : ''
  window.history.replaceState(null, '', window.location.pathname + keep + window.location.hash)
}

/** 한 번 실행할 때 물어볼 수 있는 최대 질문 수 (끝없이 묻는 것을 막는다) */
const MAX_QUESTIONS = 40

const isNarrowScreen = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches

const printTextsOf = (effects: Effect[]) =>
  effects.filter((e) => e.kind === 'print').map((e) => (e as Extract<Effect, { kind: 'print' }>).text)

export default function App() {
  const [missionId, setMissionId] = useState(() => {
    const last = storage.loadLastMission()
    return last && MISSIONS.some((m) => m.id === last) ? last : MISSIONS[0].id
  })
  const [completed, setCompleted] = useState<Set<string>>(() => storage.loadBadges())
  const [progress, setProgress] = useState<storage.ProgressMap>(() => storage.loadProgress())
  const [items, setItems] = useState<ConsoleItem[]>([])
  const [running, setRunning] = useState(false)
  const [runState, setRunState] = useState<RunState>('idle')
  const [justBadge, setJustBadge] = useState<string | null>(null)
  const [speed, setSpeed] = useState(1)
  const [confettiKey, setConfettiKey] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [teacherOpen, setTeacherOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [asking, setAsking] = useState<{ ask: AskRequest; outputs: string[] } | null>(null)
  // 교재 패널 상태 (다음 할 일 띠에서 원하는 탭을 열 수 있도록 여기서 관리)
  const [lessonTab, setLessonTab] = useState<Tab>('learn')
  const [lessonOpen, setLessonOpen] = useState(() =>
    storage.loadLessonOpen(typeof window === 'undefined' || window.innerWidth >= 1024))

  const editorRef = useRef<CodeEditorHandle>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const consoleWrapRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<TurtlePlayer | null>(null)
  if (!playerRef.current) playerRef.current = new TurtlePlayer()
  const player = playerRef.current

  const nextItemId = useRef(1)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 저장·판정에 쓰는 '지금 미션' — 미션을 바꾸는 순간 바로 갱신해서 코드가 섞이지 않게 한다 */
  const missionIdRef = useRef(missionId)
  /** 질문 창의 답을 기다리는 곳 */
  const answerResolverRef = useRef<((v: string | null) => void) | null>(null)
  const busyRef = useRef(false)

  const mission = getMission(missionId)
  const missionIndex = MISSIONS.findIndex((m) => m.id === missionId)
  const nextMission = missionIndex >= 0 && missionIndex < MISSIONS.length - 1 ? MISSIONS[missionIndex + 1] : null

  useEffect(() => {
    player.setSpeed(speed)
  }, [player, speed])

  const pushItem = useCallback((kind: ConsoleItem['kind'], text: string) => {
    setItems((prev) => [...prev, { id: nextItemId.current++, kind, text }])
  }, [])

  const initialCode = useRef(storage.loadCode(missionId) ?? mission.starterCode).current

  const setLessonOpenPersist = useCallback((open: boolean) => {
    setLessonOpen(open)
    storage.saveLessonOpen(open)
  }, [])

  const openTab = useCallback((tab: Tab) => {
    setLessonTab(tab)
    setLessonOpenPersist(true)
  }, [setLessonOpenPersist])

  // ---- 물어보기(입력) ----

  const askUser = useCallback((ask: AskRequest, effects: Effect[]) =>
    new Promise<string | null>((resolve) => {
      answerResolverRef.current = resolve
      setAsking({ ask, outputs: printTextsOf(effects) })
    }), [])

  const finishAsk = useCallback((value: string | null) => {
    setAsking(null)
    const resolve = answerResolverRef.current
    answerResolverRef.current = null
    resolve?.(value)
  }, [])

  // ---- 실행 ----

  const handleRun = useCallback(async () => {
    const editor = editorRef.current
    if (!editor || busyRef.current) return
    busyRef.current = true
    try {
      const code = editor.getCode()
      const runningMissionId = missionIdRef.current

      player.stop()
      player.reset()
      setItems([])
      setJustBadge(null)
      editor.setError(null)
      editor.setRunningLine(null)

      // 질문( 입력 )이 나오면 답을 받고 처음부터 다시 실행한다.
      // 효과는 마지막 실행 결과만 그려지므로 아이에게는 한 번 실행한 것처럼 보인다.
      const answers: string[] = []
      let randoms: number[] = []
      let result = runProgram(code, { answers, randoms })
      let questions = 0

      while (result.ok === 'ask') {
        if (questions++ >= MAX_QUESTIONS) {
          pushItem('error', `질문이 너무 많아요(${MAX_QUESTIONS}번). 반복 안에서 계속 물어보고 있지 않은지 확인해 보세요.`)
          setRunState('error')
          return
        }
        randoms = result.randoms
        if (result.ask.retry) answers.pop() // 숫자가 아니어서 돌려보낸 답은 버린다
        const answer = await askUser(result.ask, result.effects)
        if (answer === null) {
          pushItem('info', '질문에 답하지 않고 그만두었어요.')
          setRunState('idle')
          return
        }
        answers.push(answer)
        result = runProgram(code, { answers, randoms })
      }

      if (result.ok === false) {
        const lineText = result.line != null ? `${result.line}번째 줄: ` : ''
        pushItem('error', `${lineText}${result.message}`)
        editor.setError(result.line, result.message)
        setRunState('error')
        if (isNarrowScreen()) consoleWrapRef.current?.scrollIntoView({ block: 'nearest' })
        return
      }

      const effects = result.effects
      setProgress(storage.updateProgress(runningMissionId, {
        runs: (storage.loadProgress()[runningMissionId]?.runs ?? 0) + 1,
      }))

      if (effects.length === 0) {
        pushItem('info', '실행 완료! 이번엔 화면에 보여줄 게 없었어요. 상자에 값만 넣었거나 함수를 만들기만 했다면 정상이에요.')
        setRunState('incomplete')
        if (isNarrowScreen()) consoleWrapRef.current?.scrollIntoView({ block: 'nearest' })
        return
      }

      setRunning(true)
      setRunState('running')
      if (isNarrowScreen()) canvasWrapRef.current?.scrollIntoView({ block: 'nearest' })
      player.play(effects, {
        onPrint: (text) => pushItem('print', text),
        onLine: (line) => editorRef.current?.setRunningLine(line),
        onDone: () => {
          setRunning(false)
          const m = getMission(runningMissionId)
          const passed = m.check({ code, effects, starterCode: m.starterCode })
          if (passed) {
            setRunState('done')
            setJustBadge(m.badge)
            setCompleted((prev) => {
              if (prev.has(m.id)) return prev
              const next = new Set(prev)
              next.add(m.id)
              storage.saveBadges(next)
              setProgress(storage.updateProgress(m.id, { completedAt: new Date().toISOString() }))
              // 색종이는 처음 완료했을 때만 (결과를 가리지 않도록 글자는 없음)
              setConfettiKey(Date.now())
              if (confettiTimer.current) clearTimeout(confettiTimer.current)
              confettiTimer.current = setTimeout(() => setConfettiKey(null), 3200)
              return next
            })
            pushItem('success', `참 잘했어요! 미션 ${m.order} 완료!`)
            setAnnouncement(`미션 ${m.order} 완료. ${m.badge}를 받았어요. 화면 위에서 다음 미션으로 갈 수 있어요.`)
          } else {
            setRunState('incomplete')
            pushItem('info', `잘 실행됐어요! 미션을 끝내려면 이걸 해 보세요 → ${m.goal}`)
          }
        },
      })
    } finally {
      busyRef.current = false
    }
  }, [player, pushItem, askUser])

  const handleStop = useCallback(() => {
    player.stop()
    setRunning(false)
    setRunState('idle')
    editorRef.current?.setRunningLine(null)
    pushItem('info', '멈췄어요')
  }, [player, pushItem])

  const handleFinishNow = useCallback(() => {
    player.finishNow()
  }, [player])

  const handleClear = useCallback(() => {
    player.stop()
    player.reset()
    setRunning(false)
    setRunState('idle')
    setJustBadge(null)
    setItems([])
    editorRef.current?.setError(null)
    editorRef.current?.setRunningLine(null)
  }, [player])

  /** 지금 그림판을 PNG 파일로 내려받기 */
  const handleSaveImage = useCallback(() => {
    const url = player.toPNG()
    if (!url) return
    const learner = storage.loadLearner()
    const who = learner.name ? `${learner.name}-` : ''
    const a = document.createElement('a')
    a.href = url
    a.download = `${who}${getMission(missionIdRef.current).id}-그림.png`
    a.click()
    pushItem('info', '그림을 파일로 저장했어요!')
  }, [player, pushItem])

  // ---- 코드 저장 / 미션 전환 ----

  const handleCodeChange = useCallback((code: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const id = missionIdRef.current
    saveTimer.current = setTimeout(() => storage.saveCode(id, code), 300)
  }, [])

  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const editor = editorRef.current
      if (editor) storage.saveCode(missionIdRef.current, editor.getCode())
    }
    const onHidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const handleSelectMission = useCallback((id: string) => {
    const editor = editorRef.current
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (editor) storage.saveCode(missionIdRef.current, editor.getCode())

    missionIdRef.current = id
    setMissionId(id)
    storage.saveLastMission(id)
    const next = getMission(id)
    editor?.setCode(storage.loadCode(id) ?? next.starterCode)
    player.stop()
    player.reset()
    setRunning(false)
    setRunState('idle')
    setJustBadge(null)
    setItems([])
    setLessonTab('learn')
  }, [player])

  const loadCode = useCallback((code: string) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    editorRef.current?.setCode(code)
    storage.saveCode(missionIdRef.current, code)
    editorRef.current?.focus()
  }, [])

  const handleQuizAnswer = useCallback((picked: number, correct: boolean) => {
    setProgress(storage.updateProgress(missionIdRef.current, { quizPicked: picked, quizCorrect: correct }))
  }, [])

  /** 이 브라우저에 저장된 내용을 모두 지우고 미션 1부터 다시 (공용 PC 정리용) */
  const handleResetAll = useCallback(() => {
    const okReset = window.confirm(
      '이 브라우저에 저장된 코드와 뱃지를 모두 지우고 미션 1부터 다시 시작할까요?\n(다른 사람이 이어서 쓸 때 사용해요. 되돌릴 수 없어요.)',
    )
    if (!okReset) return
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    storage.clearAll()
    const first = MISSIONS[0]
    missionIdRef.current = first.id
    setMissionId(first.id)
    setCompleted(new Set())
    setProgress({})
    setItems([])
    setHelpOpen(false)
    setProgressOpen(false)
    setRunState('idle')
    setJustBadge(null)
    setLessonTab('learn')
    player.stop()
    player.reset()
    setRunning(false)
    editorRef.current?.setCode(first.starterCode)
    setAnnouncement('저장된 내용을 모두 지웠어요. 미션 1부터 다시 시작해요.')
  }, [player])

  /** 진도 파일을 불러온 뒤 화면을 새 내용으로 맞춘다 */
  const handleImported = useCallback(() => {
    setCompleted(storage.loadBadges())
    setProgress(storage.loadProgress())
    const last = storage.loadLastMission()
    const id = last && MISSIONS.some((m) => m.id === last) ? last : missionIdRef.current
    missionIdRef.current = id
    setMissionId(id)
    setRunState('idle')
    setJustBadge(null)
    editorRef.current?.setCode(storage.loadCode(id) ?? getMission(id).starterCode)
  }, [])

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <TopBar
        missionId={missionId}
        completed={completed}
        running={running}
        teacherMode={TEACHER_MODE}
        onSelectMission={handleSelectMission}
        onRun={handleRun}
        onStop={handleStop}
        onFinishNow={handleFinishNow}
        onClear={handleClear}
        onHelp={() => setHelpOpen(true)}
        onProgress={() => setProgressOpen(true)}
        onTeacher={() => setTeacherOpen(true)}
      />

      {/* 지금 무엇을 해야 하는지 항상 알려 주는 띠 */}
      <NextStepBar
        mission={mission}
        state={runState}
        badge={justBadge}
        nextMission={nextMission}
        onGoNext={() => nextMission && handleSelectMission(nextMission.id)}
        onOpenSteps={() => openTab('steps')}
        onOpenChallenge={() => openTab('challenge')}
        onRun={handleRun}
        onOpenProgress={() => setProgressOpen(true)}
      />

      <ExperimentLab onLoad={(code) => {
        if (busyRef.current || running) { setAnnouncement('실행을 마친 뒤 예제를 넣어 주세요.'); return false }
        loadCode(code)
        setRunState('idle')
        setJustBadge(null)
        setAnnouncement('실험 코드를 넣었어요. 실행하기를 눌러 결과를 확인하세요.')
        return true
      }} />

      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 sm:p-3 lg:flex-row lg:overflow-hidden">
        {/* 좌측: 미션 교재 + 코드 에디터 (~45%) */}
        <section className="flex flex-col gap-2 lg:min-h-0 lg:w-[45%]">
          <div className="lg:flex lg:min-h-0 lg:max-h-[52%] lg:flex-col">
            <LessonPanel
              mission={mission}
              completed={completed.has(mission.id)}
              onLoadCode={loadCode}
              onQuizAnswer={handleQuizAnswer}
              tab={lessonTab}
              onTabChange={setLessonTab}
              open={lessonOpen}
              onOpenChange={setLessonOpenPersist}
            />
          </div>

          {/* 코드 쓰는 곳 — 무엇을 하는 칸인지 이름을 붙여 준다 */}
          <div className="flex h-[340px] flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm lg:h-auto lg:min-h-[240px] lg:flex-1">
            <div className="flex shrink-0 items-center gap-2 border-b-2 border-slate-100 bg-slate-50 px-3 py-1.5">
              <Emo name="memo" size={16} />
              <span className="font-jua text-sm text-slate-700">여기에 코드를 써요</span>
              {!running && (
                <button
                  type="button"
                  onClick={handleRun}
                  className="font-jua ml-auto flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[13.5px] text-white shadow-sm transition hover:bg-emerald-600 active:scale-95"
                >
                  <Emo name="play" size={15} /> 실행하기
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                ref={editorRef}
                initialCode={initialCode}
                onChange={handleCodeChange}
                onRun={handleRun}
              />
            </div>
          </div>
        </section>

        {/* 우측: 그림판(위) + 출력 창(아래) */}
        <section className="flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:gap-3">
          <div ref={canvasWrapRef} className="h-[360px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-[7] lg:shrink">
            <CanvasPane
              player={player}
              speed={speed}
              onSpeedChange={setSpeed}
              onSaveImage={handleSaveImage}
            />
          </div>
          <div ref={consoleWrapRef} className="h-[190px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-[3] lg:shrink">
            <ConsolePane items={items} />
          </div>
        </section>
      </main>

      {/* 화면 낭독기용 알림 */}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {asking && (
        <AskDialog
          ask={asking.ask}
          outputs={asking.outputs}
          onAnswer={(v) => finishAsk(v)}
          onCancel={() => finishAsk(null)}
        />
      )}
      {confettiKey !== null && <Confetti key={confettiKey} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} onResetAll={handleResetAll} />}
      {progressOpen && (
        <ProgressModal
          completed={completed}
          progress={progress}
          onClose={() => setProgressOpen(false)}
          onImported={handleImported}
        />
      )}
      {teacherOpen && TEACHER_MODE && (
        <TeacherModal onClose={() => setTeacherOpen(false)} onLoadCode={loadCode} />
      )}
    </div>
  )
}
