import type { Mission } from '../missions/missions'
import { Emo, type EmojiName } from '../ui/emoji'

/** 지금 아이가 어떤 상황인지 */
export type RunState = 'idle' | 'running' | 'error' | 'incomplete' | 'done'

interface Props {
  mission: Mission
  state: RunState
  /** 방금 받은 뱃지 이름 (완료 직후에만) */
  badge: string | null
  nextMission: Mission | null
  onGoNext: () => void
  onOpenSteps: () => void
  onOpenChallenge: () => void
  onRun: () => void
  onOpenProgress: () => void
}

/**
 * "다음에 무엇을 해야 하는지"를 항상 알려 주는 띠.
 * 화면 맨 위에 늘 있어서, 아이가 길을 잃지 않게 한다.
 */
export function NextStepBar({
  mission, state, badge, nextMission,
  onGoNext, onOpenSteps, onOpenChallenge, onRun, onOpenProgress,
}: Props) {
  let tone = 'bg-indigo-50 border-indigo-200 text-indigo-950'
  let icon: EmojiName = 'footprints'
  let title = ''
  let detail: React.ReactNode = null
  let actions: React.ReactNode = null

  if (state === 'running') {
    tone = 'bg-sky-50 border-sky-200 text-sky-950'
    icon = 'turtle'
    title = '거북이가 그리는 중이에요…'
    detail = <>다 그릴 때까지 기다리거나, 위의 <b>[바로 완성]</b> 을 눌러 바로 끝낼 수 있어요.</>
  } else if (state === 'error') {
    tone = 'bg-amber-50 border-amber-300 text-amber-950'
    icon = 'thinking_face'
    title = '고칠 곳이 있어요 — 괜찮아요, 프로그래머는 다 이래요!'
    detail = <>코드에 <b>빨간 줄</b>이 그어진 곳을 보세요. 아래 <b>출력 창</b>에 무엇이 잘못됐는지 한글로 적혀 있어요.</>
    actions = (
      <BarButton onClick={onRun} tone="amber">고쳤어요, 다시 실행</BarButton>
    )
  } else if (state === 'done') {
    tone = 'bg-emerald-50 border-emerald-300 text-emerald-950'
    icon = 'party_popper'
    title = badge ? `미션 ${mission.order} 완료! ${badge}를 받았어요` : `미션 ${mission.order} 완료!`
    detail = nextMission
      ? <>다음은 <b>미션 {nextMission.order}. {nextMission.title}</b> 예요.</>
      : <>12차시를 모두 마쳤어요! 정말 대단해요. 이제 나만의 작품을 더 만들어 볼까요?</>
    actions = nextMission ? (
      <>
        <BarButton onClick={onOpenChallenge} tone="ghost">더 해 보기 (도전)</BarButton>
        <BarButton onClick={onGoNext} tone="emerald">다음 미션으로 →</BarButton>
      </>
    ) : (
      <BarButton onClick={onOpenProgress} tone="emerald">내 진도 보기</BarButton>
    )
  } else if (state === 'incomplete') {
    tone = 'bg-amber-50 border-amber-300 text-amber-950'
    icon = 'direct_hit'
    title = '잘 실행됐어요! 미션 목표만 채우면 끝이에요'
    detail = <>목표: <b>{mission.goal}</b></>
    actions = (
      <>
        <BarButton onClick={onOpenSteps} tone="ghost">따라하기 다시 보기</BarButton>
        <BarButton onClick={onRun} tone="amber">다시 실행</BarButton>
      </>
    )
  } else {
    // idle — 처음 왔을 때
    icon = 'footprints'
    title = `이제 할 일: 미션 ${mission.order} — ${mission.title}`
    detail = (
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Step n={1} text="배우기 읽기" />
        <span className="text-indigo-400">→</span>
        <Step n={2} text="따라하기에서 [넣기]" />
        <span className="text-indigo-400">→</span>
        <Step n={3} text="[실행하기] 누르기" />
      </span>
    )
    actions = (
      <>
        <BarButton onClick={onOpenSteps} tone="ghost">따라하기 열기</BarButton>
        <BarButton onClick={onRun} tone="indigo">실행하기</BarButton>
      </>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 px-3 py-2 sm:px-4 ${tone}`}>
      <Emo name={icon} size={26} className="shrink-0" />
      <div className="min-w-[200px] flex-1">
        <p className="font-jua text-[16px] leading-tight sm:text-[17px]">{title}</p>
        {detail && <div className="mt-0.5 text-[14px] leading-relaxed opacity-90">{detail}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-jua inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[12px] text-white">
        {n}
      </span>
      {text}
    </span>
  )
}

function BarButton({
  children, onClick, tone,
}: { children: React.ReactNode; onClick: () => void; tone: 'indigo' | 'emerald' | 'amber' | 'ghost' }) {
  const styles = {
    indigo: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
    ghost: 'bg-white text-slate-700 ring-2 ring-slate-300 hover:bg-slate-50',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-jua min-h-[40px] rounded-xl px-4 py-2 text-[14.5px] transition active:scale-95 ${styles}`}
    >
      {children}
    </button>
  )
}
