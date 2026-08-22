// 3D 입체 이모지 (Microsoft Fluent Emoji, MIT 라이선스) — 시스템 이모티콘 대신 사용
import turtle from '../assets/emoji/turtle.png'
import waving_hand from '../assets/emoji/waving_hand.png'
import raising_hand from '../assets/emoji/raising_hand.png'
import direct_hit from '../assets/emoji/direct_hit.png'
import blue_square from '../assets/emoji/blue_square.png'
import star from '../assets/emoji/star.png'
import puzzle_piece from '../assets/emoji/puzzle_piece.png'
import rainbow from '../assets/emoji/rainbow.png'
import artist_palette from '../assets/emoji/artist_palette.png'
import sports_medal from '../assets/emoji/sports_medal.png'
import check from '../assets/emoji/check.png'
import party_popper from '../assets/emoji/party_popper.png'
import broom from '../assets/emoji/broom.png'
import open_book from '../assets/emoji/open_book.png'
import speech_balloon from '../assets/emoji/speech_balloon.png'
import framed_picture from '../assets/emoji/framed_picture.png'
import thinking_face from '../assets/emoji/thinking_face.png'
import light_bulb from '../assets/emoji/light_bulb.png'
import walking from '../assets/emoji/walking.png'
import high_voltage from '../assets/emoji/high_voltage.png'
import abc from '../assets/emoji/abc.png'
import sparkles from '../assets/emoji/sparkles.png'
import confetti_ball from '../assets/emoji/confetti_ball.png'
import play from '../assets/emoji/play.png'
import stop from '../assets/emoji/stop.png'
import graduation_cap from '../assets/emoji/graduation_cap.png'
import rocket from '../assets/emoji/rocket.png'
import brain from '../assets/emoji/brain.png'
import warning from '../assets/emoji/warning.png'
import footprints from '../assets/emoji/footprints.png'
import memo from '../assets/emoji/memo.png'

export const EMOJI = {
  turtle, waving_hand, raising_hand, direct_hit, blue_square, star,
  puzzle_piece, rainbow, artist_palette, sports_medal, check, party_popper,
  broom, open_book, speech_balloon, framed_picture, thinking_face, light_bulb,
  walking, high_voltage, abc, sparkles, confetti_ball, play, stop,
  graduation_cap, rocket, brain, warning, footprints, memo,
} as const

export type EmojiName = keyof typeof EMOJI

interface EmoProps {
  name: EmojiName
  /** px 크기 (기본 20) */
  size?: number
  className?: string
}

/** 인라인 3D 이모지 이미지 */
export function Emo({ name, size = 20, className = '' }: EmoProps) {
  return (
    <img
      src={EMOJI[name]}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={`inline-block select-none align-[-0.18em] ${className}`}
    />
  )
}
