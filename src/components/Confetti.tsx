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

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 미션 완료 축하: 색종이 + 뱃지 토스트 (움직임을 줄이는 설정이면 토스트만) */
export function Confetti({ badge }: { badge: string }) {
  const reduced = useMemo(prefersReducedMotion, [])
  const pieces = useMemo<Piece[]>(
    () =>
      reduced
        ? []
        : Array.from({ length: 50 }, (_, i) => ({
          left: Math.random() * 100,
          delay: Math.random() * 0.6,
          duration: 2 + Math.random() * 1.4,
          color: COLORS[i % COLORS.length],
          emoji: i % 5 === 0 ? PIECE_EMOJIS[Math.floor(Math.random() * PIECE_EMOJIS.length)] : null,
          size: 8 + Math.random() * 8,
          drift: -60 + Math.random() * 120,
        })),
    [reduced],
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
      {/* 코드와 그림을 가리지 않도록 아래쪽에 띄운다 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className={`rounded-3xl border-4 border-amber-300 bg-white px-8 py-5 text-center shadow-2xl ${reduced ? '' : 'badge-pop'}`}>
          <Emo name="sports_medal" size={44} />
          <p className="font-jua mt-1 text-2xl text-slate-800">미션 완료!</p>
          <p className="font-jua mt-1 text-lg text-amber-700">{badge} 획득</p>
        </div>
      </div>
    </div>
  )
}
