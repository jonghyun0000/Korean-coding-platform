import { useEffect, useRef, useState } from 'react'
import { MISSIONS, getMission } from '../missions/missions'
import { Emo } from '../ui/emoji'

interface Props {
  missionId: string
  completed: Set<string>
  onSelect: (id: string) => void
}

/** 3D 이모지가 보이는 커스텀 미션 선택 드롭다운 */
export function MissionSelect({ missionId, completed, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = getMission(missionId)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="font-jua flex max-w-[52vw] items-center gap-2 rounded-xl bg-white px-3 py-2 text-[15px] text-slate-800 shadow-md transition hover:bg-slate-50 sm:max-w-[340px]"
      >
        <Emo name={current.emoji} size={18} />
        <span className="truncate">미션 {current.order}. {current.title}</span>
        <span className={`ml-auto shrink-0 text-[11px] text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="미션 선택"
          className="absolute right-0 top-full z-30 mt-1.5 max-h-[70vh] w-[320px] overflow-y-auto rounded-2xl border-2 border-indigo-100 bg-white p-1.5 shadow-xl"
        >
          {MISSIONS.map((m) => {
            const done = completed.has(m.id)
            const active = m.id === missionId
            return (
              <li key={m.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(m.id)
                    setOpen(false)
                  }}
                  className={`font-jua flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[14.5px] transition ${
                    active ? 'bg-indigo-100 text-indigo-900' : 'text-slate-700 hover:bg-indigo-50'
                  }`}
                >
                  <Emo name={m.emoji} size={20} />
                  <span className="flex-1 truncate">미션 {m.order}. {m.title}</span>
                  {done && <Emo name="check" size={16} className="shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
