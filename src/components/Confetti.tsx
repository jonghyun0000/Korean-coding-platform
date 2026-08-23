import { useMemo } from 'react'
import { EMOJI, type EmojiName } from '../ui/emoji'

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

/**
 * 미션 완료 축하 색종이.
 * 글자나 카드는 띄우지 않는다 — 아이가 자기 결과(출력 창·그림판)를 가리지 않도록,
 * 완료 안내는 화면 위쪽 '다음 할 일' 띠에서 보여 준다.
 */
export function Confetti() {
  const reduced = useMemo(prefersReducedMotion, [])
  const pieces = useMemo<Piece[]>(
    () =>
      reduced
        ? []
        : Array.from({ length: 44 }, (_, i) => ({
          left: Math.random() * 100,
          delay: Math.random() * 0.5,
          duration: 1.8 + Math.random() * 1.2,
          color: COLORS[i % COLORS.length],
          emoji: i % 5 === 0 ? PIECE_EMOJIS[Math.floor(Math.random() * PIECE_EMOJIS.length)] : null,
          size: 8 + Math.random() * 8,
          drift: -60 + Math.random() * 120,
        })),
    [reduced],
  )

  if (reduced) return null

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
    </div>
  )
}
