import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from './components/TopBar'
import { LessonPanel } from './components/LessonPanel'
import { CanvasPane } from './components/CanvasPane'
import { ConsolePane, type ConsoleItem } from './components/ConsolePane'
import { Confetti } from './components/Confetti'
import { HelpModal } from './components/HelpModal'
import { CodeEditor, type CodeEditorHandle } from './editor/CodeEditor'
import { TurtlePlayer } from './turtle/player'
import { runProgram } from './lang/run'
import { getMission, MISSIONS } from './missions/missions'
import * as storage from './storage'

// 공용 PC용: 주소 끝에 ?reset=1 을 붙여 열면 저장된 내용을 모두 지우고 새로 시작한다.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reset') === '1') {
  storage.clearAll()
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
}

const isNarrowScreen = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches

export default function App() {
  const [missionId, setMissionId] = useState(() => {
    const last = storage.loadLastMission()
    return last && MISSIONS.some((m) => m.id === last) ? last : MISSIONS[0].id
  })
  const [completed, setCompleted] = useState<Set<string>>(() => storage.loadBadges())
  const [items, setItems] = useState<ConsoleItem[]>([])
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [celebration, setCelebration] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const editorRef = useRef<CodeEditorHandle>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const consoleWrapRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<TurtlePlayer | null>(null)
  if (!playerRef.current) playerRef.current = new TurtlePlayer()
  const player = playerRef.current

  const nextItemId = useRef(1)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 저장·판정에 쓰는 '지금 미션' — 미션을 바꾸는 순간 바로 갱신해서 코드가 섞이지 않게 한다 */
  const missionIdRef = useRef(missionId)

  const mission = getMission(missionId)

  useEffect(() => {
    player.setSpeed(speed)
  }, [player, speed])

  const pushItem = useCallback((kind: ConsoleItem['kind'], text: string) => {
    setItems((prev) => [...prev, { id: nextItemId.current++, kind, text }])
  }, [])

  const initialCode = useRef(storage.loadCode(missionId) ?? mission.starterCode).current

  // ---- 실행 ----

  const handleRun = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const code = editor.getCode()
    const runningMissionId = missionIdRef.current

    player.stop()
    player.reset()
    setItems([])
    editor.setError(null)
    editor.setRunningLine(null)

    const result = runProgram(code)
    if (!result.ok) {
      const lineText = result.line != null ? `${result.line}번째 줄: ` : ''
      pushItem('error', `${lineText}${result.message}`)
      editor.setError(result.line, result.message)
      if (isNarrowScreen()) consoleWrapRef.current?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (result.effects.length === 0) {
      pushItem('info', '실행 완료! 이번엔 화면에 보여줄 게 없었어요. 상자에 값만 넣었거나 함수를 만들기만 했다면 정상이에요.')
      if (isNarrowScreen()) consoleWrapRef.current?.scrollIntoView({ block: 'nearest' })
      return
    }

    setRunning(true)
    if (isNarrowScreen()) canvasWrapRef.current?.scrollIntoView({ block: 'nearest' })
    player.play(result.effects, {
      onPrint: (text) => pushItem('print', text),
      onLine: (line) => editorRef.current?.setRunningLine(line),
      onDone: () => {
        setRunning(false)
        const m = getMission(runningMissionId)
        const passed = m.check({ code, effects: result.effects, starterCode: m.starterCode })
        if (passed) {
          setCompleted((prev) => {
            if (prev.has(m.id)) return prev
            const next = new Set(prev)
            next.add(m.id)
            storage.saveBadges(next)
            // 처음 완료했을 때만 축하
            setCelebration(m.badge)
            if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
            celebrationTimer.current = setTimeout(() => setCelebration(null), 3200)
            return next
          })
          pushItem('success', `참 잘했어요! 미션 ${m.order} 완료!`)
          setAnnouncement(`미션 ${m.order} 완료. ${m.badge}를 받았어요.`)
        } else {
          pushItem('info', `잘 실행됐어요! 미션을 끝내려면 이걸 해 보세요 → ${m.goal}`)
        }
      },
    })
  }, [player, pushItem])

  const handleStop = useCallback(() => {
    player.stop()
    setRunning(false)
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
    setItems([])
    editorRef.current?.setError(null)
    editorRef.current?.setRunningLine(null)
  }, [player])

  // ---- 코드 저장 / 미션 전환 ----

  const handleCodeChange = useCallback((code: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // 저장 시점의 미션이 아니라 '지금' 미션에 저장한다
    saveTimer.current = setTimeout(() => storage.saveCode(missionIdRef.current, code), 300)
  }, [])

  const handleSelectMission = useCallback((id: string) => {
    const editor = editorRef.current
    // 전환 직전 코드 즉시 저장 (예약된 저장은 취소)
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
    setItems([])
  }, [player])

  const loadCode = useCallback((code: string) => {
    editorRef.current?.setCode(code)
    storage.saveCode(missionIdRef.current, code)
    editorRef.current?.focus()
  }, [])

  /** 이 브라우저에 저장된 내용을 모두 지우고 미션 1부터 다시 (공용 PC 정리용) */
  const handleResetAll = useCallback(() => {
    const ok = window.confirm(
      '이 브라우저에 저장된 코드와 뱃지를 모두 지우고 미션 1부터 다시 시작할까요?\n(다른 사람이 이어서 쓸 때 사용해요. 되돌릴 수 없어요.)',
    )
    if (!ok) return
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    storage.clearAll()
    const first = MISSIONS[0]
    missionIdRef.current = first.id
    setMissionId(first.id)
    setCompleted(new Set())
    setItems([])
    setHelpOpen(false)
    player.stop()
    player.reset()
    setRunning(false)
    editorRef.current?.setCode(first.starterCode)
    setAnnouncement('저장된 내용을 모두 지웠어요. 미션 1부터 다시 시작해요.')
  }, [player])

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <TopBar
        missionId={missionId}
        completed={completed}
        running={running}
        onSelectMission={handleSelectMission}
        onRun={handleRun}
        onStop={handleStop}
        onFinishNow={handleFinishNow}
        onClear={handleClear}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 sm:p-3 lg:flex-row lg:overflow-hidden">
        {/* 좌측: 미션 교재 + 코드 에디터 (~45%) */}
        <section className="flex flex-col gap-2 lg:min-h-0 lg:w-[45%]">
          <div className="lg:flex lg:min-h-0 lg:max-h-[55%] lg:flex-col">
            <LessonPanel
              key={mission.id}
              mission={mission}
              completed={completed.has(mission.id)}
              onLoadCode={loadCode}
            />
          </div>
          <div className="h-[320px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm lg:h-auto lg:min-h-[240px] lg:flex-1">
            <CodeEditor
              ref={editorRef}
              initialCode={initialCode}
              onChange={handleCodeChange}
              onRun={handleRun}
            />
          </div>
        </section>

        {/* 우측: 그림판(위) + 출력 창(아래) */}
        <section className="flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:gap-3">
          <div ref={canvasWrapRef} className="h-[360px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-[7] lg:shrink">
            <CanvasPane player={player} speed={speed} onSpeedChange={setSpeed} />
          </div>
          <div ref={consoleWrapRef} className="h-[190px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-[3] lg:shrink">
            <ConsolePane items={items} />
          </div>
        </section>
      </main>

      {/* 화면 낭독기용 알림 */}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {celebration && <Confetti key={celebration} badge={celebration} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} onResetAll={handleResetAll} />}
    </div>
  )
}
