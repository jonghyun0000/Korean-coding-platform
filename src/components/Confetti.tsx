import { useMemo } from 'react'
import { EMOJI, Emo, type EmojiName } from '../ui/emoji'

const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
const PIECE_EMOJIS: EmojiName[] = ['party_popper', 'star', 'confetti_ball', 'sparkles', 'sports_medal']

interface Piece {
  left: number
  delay: number
  duration: number
  color: string
  emoji: EmojiName | null
  size: number
  drift: number
}

/** 미션 완료 축하: 색종이 + 뱃지 토스트 */
export function Confetti({ badge }: { badge: string }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2 + Math.random() * 1.4,
        color: COLORS[i % COLORS.length],
        emoji: i % 5 === 0 ? PIECE_EMOJIS[Math.floor(Math.random() * PIECE_EMOJIS.length)] : null,
        size: 8 + Math.random() * 8,
        drift: -60 + Math.random() * 120,
      })),
    [],
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
            ...(p.emoji
              ? {}
              : { width: p.size, height: p.size * 0.6, backgroundColor: p.color, borderRadius: 3 }),
          }}
        >
          {p.emoji && (
            <img src={EMOJI[p.emoji]} width={p.size + 12} height={p.size + 12} alt="" draggable={false} />
          )}
        </span>
      ))}
      <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="badge-pop rounded-3xl border-4 border-amber-300 bg-white px-8 py-6 text-center shadow-2xl">
          <Emo name="sports_medal" size={52} />
          <p className="font-jua mt-2 text-2xl text-slate-800">미션 완료!</p>
          <p className="font-jua mt-1 text-lg text-amber-600">{badge} 획득</p>
        </div>
      </div>
    </div>
  )
}
