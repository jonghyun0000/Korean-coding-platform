import { MISSIONS } from '../missions/missions'
import { MissionSelect } from './MissionSelect'
import { Emo } from '../ui/emoji'

interface Props {
  missionId: string
  completed: Set<string>
  running: boolean
  onSelectMission: (id: string) => void
  onRun: () => void
  onStop: () => void
  onFinishNow: () => void
  onClear: () => void
  onHelp: () => void
}

export function TopBar({
  missionId, completed, running,
  onSelectMission, onRun, onStop, onFinishNow, onClear, onHelp,
}: Props) {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b-4 border-indigo-200 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-3 py-2 sm:px-4">
      <div className="flex items-center gap-2">
        <Emo name="turtle" size={30} />
        <h1 className="font-jua text-xl text-white drop-shadow-sm sm:text-2xl">한글코딩 놀이터</h1>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="font-jua hidden items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-[15px] text-white sm:flex">
          <Emo name="sports_medal" size={17} /> {completed.size}/{MISSIONS.length}
        </span>

        <MissionSelect missionId={missionId} completed={completed} onSelect={onSelectMission} />

        {running ? (
          <>
            <button
              type="button"
              onClick={onFinishNow}
              className="font-jua flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[15px] text-indigo-700 shadow-md transition hover:bg-indigo-50 active:scale-95"
              title="기다리지 않고 그림을 바로 완성해요"
            >
              <Emo name="high_voltage" size={17} /> 바로 완성
            </button>
            <button
              type="button"
              onClick={onStop}
              className="font-jua flex min-h-[40px] items-center gap-1.5 rounded-xl bg-rose-500 px-5 py-2 text-lg text-white shadow-md transition hover:bg-rose-600 active:scale-95"
            >
              <Emo name="stop" size={19} /> 멈추기
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRun}
              className="font-jua flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-400 px-5 py-2 text-lg text-emerald-950 shadow-md ring-2 ring-emerald-200 transition hover:bg-emerald-300 active:scale-95 sm:px-6"
            >
              <Emo name="play" size={19} /> 실행하기
            </button>
            <kbd className="font-code hidden rounded-md bg-white/25 px-1.5 py-1 text-[11px] leading-none text-white lg:inline-block">
              Ctrl+Enter
            </kbd>
          </span>
        )}

        <button
          type="button"
          onClick={onClear}
          className="font-jua flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-[15px] text-white shadow-md transition hover:bg-white/30 active:scale-95"
          title="그림판과 출력 창만 지워요. 코드는 그대로 남아요."
        >
          <Emo name="broom" size={17} /> 그림 지우기
        </button>

        <button
          type="button"
          onClick={onHelp}
          aria-label="한글랭 명령 모음 열기"
          className="font-jua flex min-h-[40px] items-center rounded-xl bg-white/20 px-3 py-2 text-[15px] text-white shadow-md transition hover:bg-white/30 active:scale-95"
          title="한글랭 명령 모음"
        >
          <Emo name="open_book" size={19} />
        </button>
      </div>
    </header>
  )
}
