import { useEffect, useRef, useState } from 'react'
import type { AskRequest } from '../lang/interpreter'
import { Emo } from '../ui/emoji'

interface Props {
  ask: AskRequest
  /** 질문 전까지 나온 출력 (무슨 상황인지 보여 주기 위해) */
  outputs: string[]
  onAnswer: (value: string) => void
  onCancel: () => void
}

/** 입력( ) / 숫자입력( ) 을 만났을 때 아이에게 물어보는 창 */
export function AskDialog({ ask, outputs, onAnswer, onCancel }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const recent = outputs.slice(-4)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const submit = () => {
    if (value.trim() === '') {
      inputRef.current?.focus()
      return
    }
    onAnswer(value)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="프로그램의 질문"
    >
      <div className="w-full max-w-md rounded-3xl border-4 border-amber-200 bg-white p-6 shadow-2xl">
        {recent.length > 0 && (
          <div className="font-code mb-3 max-h-28 overflow-y-auto rounded-2xl bg-slate-100 px-3 py-2 text-[13.5px] leading-relaxed text-slate-600">
            {recent.map((line, i) => (
              <p key={i} className="truncate">{line}</p>
            ))}
          </div>
        )}

        <p className="font-jua flex items-start gap-2 text-[19px] leading-relaxed text-slate-800">
          <Emo name="speech_balloon" size={24} className="mt-0.5 shrink-0" />
          <span>{ask.question}</span>
        </p>

        {ask.retry && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[14px] text-amber-900">
            <Emo name="thinking_face" size={16} className="mt-0.5 shrink-0" />
            <span>{ask.retry}</span>
          </p>
        )}

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          inputMode={ask.kind === 'number' ? 'decimal' : 'text'}
          placeholder={ask.kind === 'number' ? '숫자를 적어 주세요' : '여기에 적어 주세요'}
          aria-label={ask.question}
          className="font-code mt-4 w-full rounded-2xl border-2 border-slate-300 px-4 py-3 text-[17px] text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            className="font-jua min-h-[44px] flex-1 rounded-2xl bg-emerald-500 px-5 py-2.5 text-lg text-white shadow-md transition hover:bg-emerald-600 active:scale-95"
          >
            답하기
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="font-jua min-h-[44px] rounded-2xl bg-slate-100 px-4 py-2.5 text-[15px] text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            그만하기
          </button>
        </div>
        <p className="mt-2 text-center text-[12.5px] text-slate-500">엔터를 눌러도 답할 수 있어요</p>
      </div>
    </div>
  )
}
