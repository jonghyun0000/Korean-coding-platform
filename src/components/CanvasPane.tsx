import { useEffect, useRef } from 'react'
import type { TurtlePlayer } from '../turtle/player'
import { Emo, type EmojiName } from '../ui/emoji'

interface Props {
  player: TurtlePlayer
  speed: number
  onSpeedChange: (speed: number) => void
}

const SPEEDS: { label: string; emoji: EmojiName; value: number }[] = [
  { label: '천천히', emoji: 'turtle', value: 0.5 },
  { label: '보통', emoji: 'walking', value: 1 },
  { label: '빠르게', emoji: 'high_voltage', value: 2.5 },
]

export function CanvasPane({ player, speed, onSpeedChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    player.attach(canvas)
    const observer = new ResizeObserver(() => player.resize())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [player])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-sky-200 bg-white">
      <div className="flex items-center gap-2 border-b-2 border-sky-100 bg-sky-50 px-4 py-1.5">
        <Emo name="framed_picture" size={16} />
        <span className="font-jua text-sm text-sky-800">그림판</span>
        <div className="ml-auto flex gap-1" role="group" aria-label="거북이 속도">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onSpeedChange(s.value)}
              className={`font-jua flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] transition active:scale-95 ${
                speed === s.value
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100'
              }`}
            >
              <Emo name={s.emoji} size={14} /> {s.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="거북이 그림판" />
      </div>
    </div>
  )
}
