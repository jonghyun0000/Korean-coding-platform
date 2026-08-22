import { useEffect, useRef } from 'react'
import { Emo } from '../ui/emoji'

export interface ConsoleItem {
  id: number
  kind: 'print' | 'error' | 'success' | 'info'
  text: string
}

export function ConsolePane({ items }: { items: ConsoleItem[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [items])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-800">
      <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-1.5">
        <Emo name="speech_balloon" size={15} />
        <span className="font-jua text-sm text-slate-300">출력 창</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 font-code text-[15px] leading-relaxed">
        {items.length === 0 && (
          <>
            <p className="flex items-start gap-1.5 py-1 text-slate-500">
              <Emo name="play" size={15} className="mt-1 shrink-0 opacity-60" />
              <span>실행하기를 누르면 결과가 여기에 나와요</span>
            </p>
            <p className="flex items-start gap-1.5 py-1 text-slate-500">
              <Emo name="light_bulb" size={15} className="mt-1 shrink-0 opacity-60" />
              <span>코드의 단어에 마우스를 올려 보세요 — 실제 코딩에서 쓰는 영어 단어를 알려줘요. 영어로 써도 돼요! (만약 = if)</span>
            </p>
          </>
        )}
        {items.map((item) => {
          if (item.kind === 'error') {
            return (
              <div key={item.id} className="my-1.5 flex items-start gap-2 rounded-xl border-2 border-amber-500/60 bg-amber-100 px-3 py-2 text-amber-900">
                <Emo name="thinking_face" size={19} className="mt-0.5 shrink-0" />
                <span>{item.text}</span>
              </div>
            )
          }
          if (item.kind === 'success') {
            return (
              <div key={item.id} className="my-1.5 flex items-start gap-2 rounded-xl border-2 border-emerald-500/60 bg-emerald-100 px-3 py-2 text-emerald-900">
                <Emo name="party_popper" size={19} className="mt-0.5 shrink-0" />
                <span>{item.text}</span>
              </div>
            )
          }
          if (item.kind === 'info') {
            return (
              <p key={item.id} className="py-0.5 text-slate-400">{item.text}</p>
            )
          }
          return (
            <p key={item.id} className="whitespace-pre-wrap py-0.5 text-slate-100">{item.text}</p>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
