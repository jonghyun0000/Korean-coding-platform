import { useEffect, useRef, useState } from 'react'
import { MISSIONS } from '../missions/missions'
import { Emo } from '../ui/emoji'
import * as storage from '../storage'

interface Props {
  completed: Set<string>
  progress: storage.ProgressMap
  onClose: () => void
  onImported: () => void
}

function formatDate(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 내 진도 — 어디까지 했는지 보고, 다른 기기로 옮기고, 인쇄할 수 있는 창 */
export function ProgressModal({ completed, progress, onClose, onImported }: Props) {
  const [learner, setLearner] = useState<storage.Learner>(() => storage.loadLearner())
  const [notice, setNotice] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const updateLearner = (patch: Partial<storage.Learner>) => {
    const next = { ...learner, ...patch }
    setLearner(next)
    storage.saveLearner(next)
  }

  const doneCount = MISSIONS.filter((m) => completed.has(m.id)).length

  const asText = () => {
    const head = `한글코딩 놀이터 진도표\n이름: ${learner.name || '(안 적음)'}   학년/반: ${learner.group || '(안 적음)'}\n완료: ${doneCount}/${MISSIONS.length}\n`
    const rows = MISSIONS.map((m) => {
      const p = progress[m.id] ?? {}
      const mark = completed.has(m.id) ? '완료' : '아직'
      const quiz = p.quizPicked === undefined ? '-' : (p.quizCorrect ? '맞힘' : '틀림')
      return `${String(m.order).padStart(2)}. ${m.title}  [${mark}]  퀴즈:${quiz}  ${formatDate(p.completedAt)}`
    })
    return head + '\n' + rows.join('\n')
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(asText())
      setNotice('진도표를 복사했어요! 붙여넣기로 선생님께 보내 보세요.')
    } catch {
      setNotice('복사가 안 됐어요. 아래 표를 직접 보고 적어 주세요.')
    }
  }

  const saveFile = () => {
    const snap = storage.exportSnapshot(MISSIONS.map((m) => m.id), new Date().toISOString())
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = (learner.name || '한글코딩').replace(/[\\/:*?"<>|]/g, '')
    a.href = url
    a.download = `${safeName}-진도.json`
    a.click()
    URL.revokeObjectURL(url)
    setNotice('파일로 저장했어요. 다른 컴퓨터에서 [불러오기]로 이어서 할 수 있어요.')
  }

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const okLoad = storage.importSnapshot(String(reader.result))
      if (okLoad) {
        setLearner(storage.loadLearner())
        setNotice('불러왔어요! 코드와 뱃지가 돌아왔습니다.')
        onImported()
      } else {
        setNotice('이 파일은 한글코딩 진도 파일이 아닌 것 같아요.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 print:static print:bg-white print:p-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="내 진도"
    >
      <div
        className="print-area max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-jua flex items-center gap-2 text-2xl text-slate-800">
            <Emo name="sports_medal" size={26} /> 내 진도 ({doneCount}/{MISSIONS.length})
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="font-jua min-h-[40px] rounded-xl bg-slate-100 px-4 py-2 text-slate-700 transition hover:bg-slate-200 print:hidden"
          >
            닫기 ✕
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="font-jua mb-1 block text-[13.5px] text-slate-600">이름</span>
            <input
              value={learner.name}
              onChange={(e) => updateLearner({ name: e.target.value })}
              placeholder="이름을 적어 두면 진도표에 나와요"
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-[15px] outline-none focus:border-indigo-500"
            />
          </label>
          <label className="sm:w-40">
            <span className="font-jua mb-1 block text-[13.5px] text-slate-600">학년 / 반</span>
            <input
              value={learner.group}
              onChange={(e) => updateLearner({ group: e.target.value })}
              placeholder="예: 5-2"
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-[15px] outline-none focus:border-indigo-500"
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border-2 border-slate-100">
          {MISSIONS.map((m, i) => {
            const p = progress[m.id] ?? {}
            const done = completed.has(m.id)
            return (
              <div key={m.id} className={`flex items-center gap-2 px-3 py-2 text-[14px] ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <Emo name={m.emoji} size={18} />
                <span className="w-6 shrink-0 text-right text-slate-500">{m.order}</span>
                <span className="flex-1 truncate text-slate-800">{m.title}</span>
                <span className="w-16 shrink-0 text-center">
                  {done
                    ? <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[12.5px] text-emerald-800">완료</span>
                    : <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[12.5px] text-slate-500">아직</span>}
                </span>
                <span className="w-14 shrink-0 text-center text-[12.5px] text-slate-600">
                  {p.quizPicked === undefined ? '퀴즈 -' : (p.quizCorrect ? '퀴즈 ○' : '퀴즈 ✗')}
                </span>
                <span className="hidden w-32 shrink-0 text-right text-[12.5px] text-slate-500 sm:block">
                  {formatDate(p.completedAt)}
                </span>
              </div>
            )
          })}
        </div>

        {notice && (
          <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-[14px] text-sky-900 print:hidden">{notice}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={copyText}
            className="font-jua min-h-[40px] rounded-xl bg-indigo-600 px-4 py-2 text-[14px] text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            글로 복사하기
          </button>
          <button
            type="button"
            onClick={saveFile}
            className="font-jua min-h-[40px] rounded-xl bg-white px-4 py-2 text-[14px] text-indigo-800 ring-2 ring-indigo-300 transition hover:bg-indigo-50 active:scale-95"
          >
            파일로 저장
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="font-jua min-h-[40px] rounded-xl bg-white px-4 py-2 text-[14px] text-indigo-800 ring-2 ring-indigo-300 transition hover:bg-indigo-50 active:scale-95"
          >
            파일 불러오기
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="font-jua min-h-[40px] rounded-xl bg-white px-4 py-2 text-[14px] text-slate-700 ring-2 ring-slate-300 transition hover:bg-slate-50 active:scale-95"
          >
            인쇄하기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) loadFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          진도와 코드는 이 브라우저에만 저장돼요. 다른 컴퓨터에서 이어 하려면 [파일로 저장] 한 뒤,
          그 컴퓨터에서 [파일 불러오기] 를 하세요.
        </p>
      </div>
    </div>
  )
}
