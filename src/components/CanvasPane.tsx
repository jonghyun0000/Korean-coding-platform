import { useEffect, useRef } from 'react'
import type { TurtlePlayer } from '../turtle/player'
import { Emo, type EmojiName } from '../ui/emoji'

interface Props {
  player: TurtlePlayer
  speed: number
  onSpeedChange: (speed: number) => void
  onSaveImage: () => void
}

const SPEEDS: { label: string; emoji: EmojiName; value: number }[] = [
  { label: '천천히', emoji: 'turtle', value: 0.5 },
  { label: '보통', emoji: 'walking', value: 1 },
  { label: '빠르게', emoji: 'high_voltage', value: 2.5 },
]

export function CanvasPane({ player, speed, onSpeedChange, onSaveImage }: Props) {
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
      <div className="flex items-center gap-2 border-b-2 border-sky-100 bg-sky-50 px-3 py-1.5 sm:px-4">
        <Emo name="framed_picture" size={16} />
        <span className="font-jua text-sm text-sky-900">그림판</span>
        <button
          type="button"
          onClick={onSaveImage}
          title="지금 그림을 파일로 저장해요"
          className="font-jua ml-auto flex min-h-[40px] items-center gap-1 rounded-lg bg-white px-3 py-2 text-[13.5px] text-sky-800 ring-1 ring-sky-300 transition hover:bg-sky-100 active:scale-95"
        >
          <Emo name="framed_picture" size={14} /> 그림 저장
        </button>
        <div className="flex gap-1" role="group" aria-label="거북이 속도">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onSpeedChange(s.value)}
              aria-pressed={speed === s.value}
              className={`font-jua flex min-h-[40px] items-center gap-1 rounded-lg px-3 py-2 text-[13.5px] transition active:scale-95 ${
                speed === s.value
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white text-sky-800 ring-1 ring-sky-300 hover:bg-sky-100'
              }`}
            >
              <Emo name={s.emoji} size={14} /> {s.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="거북이가 그림을 그리는 그림판"
        />
      </div>
    </div>
  )
}
