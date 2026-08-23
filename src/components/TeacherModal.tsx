import { useEffect, useRef, useState } from 'react'
import { MISSIONS } from '../missions/missions'
import { TEACHING, STANDARD_TEXT } from '../missions/teaching'
import { Emo } from '../ui/emoji'

interface Props {
  onClose: () => void
  onLoadCode: (code: string) => void
}

/**
 * 교사용 자료 창 — 주소 끝에 ?teacher=1 을 붙였을 때만 열립니다.
 * 정답 코드와 퀴즈 정답이 들어 있어 학생 화면에는 노출하지 않습니다.
 */
export function TeacherModal({ onClose, onLoadCode }: Props) {
  const [openId, setOpenId] = useState<string | null>(MISSIONS[0].id)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const usedStandards = [...new Set(MISSIONS.flatMap((m) => TEACHING[m.id]?.standards ?? []))].sort()
  const totalMinutes = MISSIONS.reduce((sum, m) => sum + (TEACHING[m.id]?.minutes ?? 0), 0)

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 print:static print:bg-white print:p-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="교사용 자료"
    >
      <div
        className="print-area max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-jua flex items-center gap-2 text-2xl text-slate-800">
            <Emo name="graduation_cap" size={26} /> 교사용 자료
          </h2>
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="font-jua min-h-[40px] rounded-xl bg-white px-4 py-2 text-[14px] text-slate-700 ring-2 ring-slate-300 transition hover:bg-slate-50"
            >
              인쇄하기
            </button>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="font-jua min-h-[40px] rounded-xl bg-slate-100 px-4 py-2 text-slate-700 transition hover:bg-slate-200"
            >
              닫기 ✕
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl bg-indigo-50 px-4 py-3 text-[14px] leading-relaxed text-indigo-950">
          <p>
            <b>전체 {MISSIONS.length}차시 · 약 {Math.round(totalMinutes / 60)}시간</b> (차시당 {TEACHING[MISSIONS[0].id]?.minutes ?? 40}분 기준).
            학생 화면에서는 이 창이 열리지 않습니다 — 주소 끝에 <code className="font-code">?teacher=1</code> 을 붙였을 때만 보입니다.
          </p>
          <p className="mt-2">
            <b>관련 성취기준</b> (2022 개정 교육과정 실과 5~6학년군 · 디지털 사회와 인공지능)
          </p>
          <ul className="mt-1 space-y-0.5">
            {usedStandards.map((code) => (
              <li key={code} className="text-[13.5px]">
                <b>[{code}]</b> {STANDARD_TEXT[code]}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-indigo-700">
            ※ 성취기준 번호와 문구는 학교 교육과정 문서와 한 번 대조해 확인하고 사용해 주세요.
          </p>
        </div>

        <div className="space-y-2">
          {MISSIONS.map((m) => {
            const t = TEACHING[m.id]
            const open = openId === m.id
            return (
              <div key={m.id} className="overflow-hidden rounded-2xl border-2 border-slate-200 print:break-inside-avoid">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : m.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 bg-slate-50 px-4 py-2.5 text-left"
                >
                  <Emo name={m.emoji} size={20} />
                  <span className="font-jua flex-1 text-[16px] text-slate-800">
                    {m.order}차시. {m.title}
                  </span>
                  {t && (
                    <span className="font-code hidden shrink-0 rounded-lg bg-white px-2 py-0.5 text-[12px] text-slate-600 sm:inline">
                      {t.standards.map((c) => `[${c}]`).join(' ')} · {t.minutes}분
                    </span>
                  )}
                  <span className="shrink-0 text-slate-400 print:hidden">{open ? '▲' : '▼'}</span>
                </button>

                {(open || false) && t && (
                  <div className="space-y-3 px-4 py-3 text-[14px] leading-relaxed">
                    <div>
                      <h4 className="font-jua text-[15px] text-indigo-800">학습 목표</h4>
                      <p className="text-slate-700">{m.goal}</p>
                    </div>

                    <div>
                      <h4 className="font-jua text-[15px] text-indigo-800">지도 포인트</h4>
                      <ul className="space-y-0.5">
                        {t.focus.map((f, i) => (
                          <li key={i} className="flex gap-1.5 text-slate-700">
                            <span className="text-indigo-400">•</span><span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-jua text-[15px] text-amber-800">자주 막히는 곳</h4>
                      <ul className="space-y-0.5">
                        {t.watchFor.map((w, i) => (
                          <li key={i} className="flex gap-1.5 text-slate-700">
                            <span className="text-amber-500">!</span><span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {t.unplugged && (
                      <div>
                        <h4 className="font-jua text-[15px] text-emerald-800">언플러그드 활동</h4>
                        <p className="text-slate-700">{t.unplugged}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="font-jua text-[15px] text-indigo-800">퀴즈 정답</h4>
                      <p className="text-slate-700">
                        {m.lesson.quiz.question}
                        {' → '}
                        <b>{['①', '②', '③', '④'][m.lesson.quiz.answer]} {m.lesson.quiz.choices[m.lesson.quiz.answer]}</b>
                      </p>
                    </div>

                    <div>
                      <h4 className="font-jua text-[15px] text-indigo-800">예시 답안 코드</h4>
                      <pre className="font-code mt-1 overflow-x-auto rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-800">
                        {m.exampleCode}
                      </pre>
                      <button
                        type="button"
                        onClick={() => onLoadCode(m.exampleCode)}
                        className="font-jua mt-2 min-h-[36px] rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] text-white transition hover:bg-indigo-700 print:hidden"
                      >
                        에디터에 넣어 시연하기
                      </button>
                    </div>

                    <div>
                      <h4 className="font-jua text-[15px] text-indigo-800">평가 루브릭</h4>
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        {t.rubric.map((r, i) => (
                          <div key={i} className={`flex gap-2 px-3 py-1.5 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                            <span className="w-16 shrink-0 font-medium text-slate-700">{r.level}</span>
                            <span className="flex-1 text-slate-600">{r.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
          더 자세한 차시 계획·평가 계획·보호자 안내문은 저장소의 <code className="font-code">docs/교사용-지도안.md</code> 를 참고하세요.
        </p>
      </div>
    </div>
  )
}
