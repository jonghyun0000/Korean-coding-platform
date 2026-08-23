import { useState } from 'react'
import type { Mission } from '../missions/missions'
import { Emo, type EmojiName } from '../ui/emoji'
import * as storage from '../storage'

interface Props {
  mission: Mission
  completed: boolean
  onLoadCode: (code: string) => void
}

type Tab = 'learn' | 'steps' | 'quiz' | 'challenge'

const TABS: { id: Tab; label: string; emoji: EmojiName }[] = [
  { id: 'learn', label: '배우기', emoji: 'graduation_cap' },
  { id: 'steps', label: '따라하기', emoji: 'footprints' },
  { id: 'quiz', label: '퀴즈', emoji: 'brain' },
  { id: 'challenge', label: '도전', emoji: 'rocket' },
]

/** 교재식 미션 패널: 개념 배우기 → 따라하기 → 퀴즈 → 도전 */
export function LessonPanel({ mission, completed, onLoadCode }: Props) {
  // 좁은 화면에서는 기본으로 접어 두어 코드와 그림판이 먼저 보이게 한다
  const [open, setOpen] = useState(() =>
    storage.loadLessonOpen(typeof window === 'undefined' || window.innerWidth >= 1024),
  )
  const [tab, setTab] = useState<Tab>('learn')

  const toggle = () => {
    const next = !open
    setOpen(next)
    storage.saveLessonOpen(next)
  }

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border-2 border-indigo-200 bg-indigo-50">
      {/* 헤더 */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full shrink-0 items-center gap-2 px-4 py-2.5 text-left"
      >
        <Emo name={mission.emoji} size={22} />
        <span className="font-jua flex-1 truncate text-[17px] text-indigo-900">
          미션 {mission.order}. {mission.title}
        </span>
        {completed && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-sm text-emerald-800">
            <Emo name="sports_medal" size={14} /> 완료
          </span>
        )}
        <span className="font-jua shrink-0 rounded-lg bg-white/70 px-2 py-1 text-[13px] text-indigo-700">
          {open ? '접기 ▲' : '펼치기 ▼'}
        </span>
      </button>

      {open && (
        <div className="flex min-h-0 flex-col px-3 pb-3">
          {/* 한 줄 소개 + 목표 */}
          <p className="shrink-0 px-1 pb-2 text-[15px] leading-relaxed text-slate-700">{mission.description}</p>
          <p className="mb-2 flex shrink-0 items-start gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 text-[14.5px] text-amber-900">
            <Emo name="direct_hit" size={17} className="mt-0.5 shrink-0" />
            <span>{mission.goal}</span>
          </p>

          {/* 탭 바 */}
          <div className="mb-2 flex shrink-0 gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`font-jua flex items-center gap-1 rounded-t-xl px-3 py-2.5 text-[14px] transition ${
                  tab === t.id
                    ? 'bg-white text-indigo-800 shadow-sm'
                    : 'bg-indigo-100/60 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <Emo name={t.emoji} size={15} /> {t.label}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="max-h-[34vh] min-h-0 overflow-y-auto rounded-xl rounded-tl-none bg-white p-3 lg:max-h-none lg:flex-1">
            {tab === 'learn' && <LearnTab mission={mission} />}
            {tab === 'steps' && <StepsTab mission={mission} onLoadCode={onLoadCode} />}
            {tab === 'quiz' && <QuizTab key={mission.id} mission={mission} />}
            {tab === 'challenge' && <ChallengeTab mission={mission} onLoadCode={onLoadCode} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- 배우기 ----

function LearnTab({ mission }: { mission: Mission }) {
  const { analogy, points, mistakes, summary } = mission.lesson
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-[15px] leading-relaxed text-sky-950">
        {analogy}
      </p>

      <div>
        <h4 className="font-jua mb-1 flex items-center gap-1.5 text-[15.5px] text-indigo-800">
          <Emo name="check" size={15} /> 꼭 기억해요
        </h4>
        <ul className="space-y-1">
          {points.map((p, i) => (
            <li key={i} className="flex gap-1.5 text-[14.5px] leading-relaxed text-slate-700">
              <span className="shrink-0 text-indigo-500">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      {mistakes.length > 0 && (
        <div>
          <h4 className="font-jua mb-1 flex items-center gap-1.5 text-[15.5px] text-indigo-800">
            <Emo name="warning" size={15} /> 자주 하는 실수
          </h4>
          <div className="space-y-1.5">
            {mistakes.map((m, i) => {
              const isCode = m.isCode !== false
              return (
                <div key={i} className="rounded-xl border border-slate-200 px-3 py-2 text-[14px]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {isCode ? (
                      <code className="font-code rounded bg-rose-50 px-1.5 py-0.5 text-rose-800 line-through decoration-rose-400">
                        {m.bad}
                      </code>
                    ) : (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-800">✗ {m.bad}</span>
                    )}
                    <span className="text-slate-500">→</span>
                    {isCode ? (
                      <code className="font-code rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{m.good}</code>
                    ) : (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">✓ {m.good}</span>
                    )}
                  </div>
                  <p className="mt-1 text-slate-600">{m.why}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="font-jua flex items-start gap-1.5 rounded-xl bg-indigo-100 px-3 py-2 text-[15px] text-indigo-900">
        <Emo name="light_bulb" size={17} className="mt-0.5 shrink-0" />
        <span>한 줄 정리: {summary}</span>
      </p>
    </div>
  )
}

// ---- 따라하기 ----

function StepsTab({ mission, onLoadCode }: { mission: Mission; onLoadCode: (code: string) => void }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[14px] text-slate-600">
        단계마다 [넣기]를 눌러 코드를 에디터에 넣고, 실행해서 결과를 확인해 보세요!
      </p>
      {mission.lesson.steps.map((step, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-2.5">
          <div className="flex items-start gap-2">
            <span className="font-jua flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[13px] text-white">
              {i + 1}
            </span>
            <p className="flex-1 text-[14.5px] leading-relaxed text-slate-700">{step.text}</p>
            {step.code && (
              <button
                type="button"
                onClick={() => onLoadCode(step.code!)}
                className="font-jua min-h-[40px] shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-[14px] text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
              >
                넣기
              </button>
            )}
          </div>
          {step.code && (
            <pre className="font-code mt-2 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-[14px] leading-relaxed text-slate-800">
              {step.code.trimEnd()}
            </pre>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onLoadCode(mission.starterCode)}
          className="font-jua min-h-[40px] rounded-xl bg-white px-4 py-2 text-[14px] text-indigo-800 shadow-sm ring-2 ring-indigo-300 transition hover:bg-indigo-50 active:scale-95"
        >
          빈 종이에서 시작하기 (지금 코드가 바뀌어요)
        </button>
      </div>
    </div>
  )
}

// ---- 퀴즈 ----

function QuizTab({ mission }: { mission: Mission }) {
  const quiz = mission.lesson.quiz
  const [picked, setPicked] = useState<number | null>(null)
  const correct = picked !== null && picked === quiz.answer
  const wrongNote = picked !== null && !correct ? quiz.wrongExplain?.[picked] : undefined

  return (
    <div className="space-y-2.5">
      <p className="flex items-start gap-1.5 text-[15px] font-medium leading-relaxed text-slate-800">
        <Emo name="brain" size={18} className="mt-0.5 shrink-0" />
        <span>{quiz.question}</span>
      </p>
      <div className="space-y-1.5">
        {quiz.choices.map((choice, i) => {
          let style = 'bg-slate-50 text-slate-800 ring-1 ring-slate-300 hover:bg-indigo-50'
          if (picked !== null) {
            if (i === quiz.answer && correct) style = 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-500'
            else if (i === picked && !correct) style = 'bg-rose-100 text-rose-900 ring-2 ring-rose-400'
            else style = 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPicked(i)}
              className={`font-code block w-full rounded-xl px-3 py-3 text-left text-[14.5px] transition active:scale-[0.99] ${style}`}
            >
              {['①', '②', '③', '④'][i]} {choice}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        correct ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[14.5px] text-emerald-900">
            <Emo name="party_popper" size={17} className="mt-0.5 shrink-0" />
            <span>딩동댕! {quiz.explain}</span>
          </p>
        ) : (
          <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[14.5px] text-amber-900">
            <Emo name="thinking_face" size={17} className="mt-0.5 shrink-0" />
            <span>{wrongNote || '음, 다시 한번 생각해 볼까요? 배우기 탭을 보고 와도 좋아요!'}</span>
          </p>
        )
      )}
    </div>
  )
}

// ---- 도전 ----

function ChallengeTab({ mission, onLoadCode }: { mission: Mission; onLoadCode: (code: string) => void }) {
  const [shownHints, setShownHints] = useState<Set<number>>(new Set())

  return (
    <div className="space-y-2.5">
      <p className="text-[14px] text-slate-600">
        미션을 다 했다면 도전! 힌트 없이 먼저 해 보고, 막히면 힌트를 열어 보세요.
      </p>
      {mission.lesson.challenges.map((challenge, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-2.5">
          <div className="flex items-start gap-2">
            <Emo name="rocket" size={17} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-[14.5px] leading-relaxed text-slate-700">{challenge.text}</p>
            <button
              type="button"
              aria-expanded={shownHints.has(i)}
              onClick={() => setShownHints((prev) => {
                const next = new Set(prev)
                if (next.has(i)) next.delete(i)
                else next.add(i)
                return next
              })}
              className="font-jua min-h-[40px] shrink-0 rounded-lg bg-amber-100 px-3 py-2 text-[13.5px] text-amber-900 transition hover:bg-amber-200 active:scale-95"
            >
              힌트 {shownHints.has(i) ? '닫기' : '보기'}
            </button>
          </div>
          {shownHints.has(i) && (
            <p className="mt-2 flex items-start gap-1.5 whitespace-pre-line rounded-lg bg-amber-50 px-3 py-2 text-[14px] text-amber-900">
              <Emo name="light_bulb" size={15} className="mt-0.5 shrink-0" />
              <span>{challenge.hint}</span>
            </p>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onLoadCode(mission.starterCode)}
        className="font-jua min-h-[40px] rounded-xl bg-white px-4 py-2 text-[14px] text-indigo-800 shadow-sm ring-2 ring-indigo-300 transition hover:bg-indigo-50 active:scale-95"
      >
        빈 종이에서 도전하기 (지금 코드가 바뀌어요)
      </button>
    </div>
  )
}
