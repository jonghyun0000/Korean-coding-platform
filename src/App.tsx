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

  const editorRef = useRef<CodeEditorHandle>(null)
  const playerRef = useRef<TurtlePlayer | null>(null)
  if (!playerRef.current) playerRef.current = new TurtlePlayer()
  const player = playerRef.current

  const nextItemId = useRef(1)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mission = getMission(missionId)

  useEffect(() => {
    player.speed = speed
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
      return
    }

    if (result.effects.length === 0) {
      pushItem('info', '실행은 됐지만 보여줄 게 없어요. 출력( )이나 캐릭터 명령을 써 보세요!')
      return
    }

    setRunning(true)
    player.play(result.effects, {
      onPrint: (text) => pushItem('print', text),
      onLine: (line) => editorRef.current?.setRunningLine(line),
      onDone: () => {
        setRunning(false)
        const m = getMission(missionId)
        if (m.check({ code, effects: result.effects })) {
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
        }
      },
    })
  }, [missionId, player, pushItem])

  const handleStop = useCallback(() => {
    player.stop()
    setRunning(false)
    editorRef.current?.setRunningLine(null)
    pushItem('info', '멈췄어요')
  }, [player, pushItem])

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
    saveTimer.current = setTimeout(() => storage.saveCode(missionId, code), 300)
  }, [missionId])

  const handleSelectMission = useCallback((id: string) => {
    const editor = editorRef.current
    if (editor) {
      // 전환 직전 코드 즉시 저장
      if (saveTimer.current) clearTimeout(saveTimer.current)
      storage.saveCode(missionId, editor.getCode())
    }
    setMissionId(id)
    storage.saveLastMission(id)
    const next = getMission(id)
    editor?.setCode(storage.loadCode(id) ?? next.starterCode)
    player.stop()
    player.reset()
    setRunning(false)
    setItems([])
  }, [missionId, player])

  const loadCode = useCallback((code: string) => {
    editorRef.current?.setCode(code)
    storage.saveCode(missionId, code)
    editorRef.current?.focus()
  }, [missionId])

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <TopBar
        missionId={missionId}
        completed={completed}
        running={running}
        onSelectMission={handleSelectMission}
        onRun={handleRun}
        onStop={handleStop}
        onClear={handleClear}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 sm:p-3 lg:flex-row lg:overflow-hidden">
        {/* 좌측: 미션 + 코드 에디터 (~45%) */}
        <section className="flex flex-col gap-2 lg:min-h-0 lg:w-[45%]">
          <LessonPanel
            key={mission.id}
            mission={mission}
            completed={completed.has(mission.id)}
            onLoadCode={loadCode}
          />
          <div className="h-[320px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm lg:h-auto lg:min-h-0 lg:flex-1">
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
          <div className="h-[300px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-[7] lg:shrink">
            <CanvasPane player={player} speed={speed} onSpeedChange={setSpeed} />
          </div>
          <div className="h-[170px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-[3] lg:shrink">
            <ConsolePane items={items} />
          </div>
        </section>
      </main>

      {celebration && <Confetti key={celebration} badge={celebration} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
