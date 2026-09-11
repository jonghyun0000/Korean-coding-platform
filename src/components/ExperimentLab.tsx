import { useRef, useState } from 'react'
import { experimentCode, type Experiment } from '../missions/experiments'
import { Emo } from '../ui/emoji'

export function ExperimentLab({ onLoad }: { onLoad: (code: string) => boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [kind, setKind] = useState<Experiment>('polygon')
  const [value, setValue] = useState(4)
  const [revealed, setRevealed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const code = experimentCode(kind, value)
  return <details ref={detailsRef} className="mx-2 mt-2 shrink-0 rounded-2xl border-2 border-violet-200 bg-white sm:mx-3">
    <summary className="cursor-pointer px-4 py-3 font-jua text-violet-800 focus-visible:outline-2">
      <Emo name="light_bulb" size={23} /> 예제 실험실 <span className="ml-2 text-xs font-sans text-slate-600">숫자 하나를 바꾸면 어떻게 될까요?</span>
    </summary>
    <div className="grid max-h-[55vh] gap-4 overflow-auto border-t border-violet-100 p-4 md:grid-cols-2">
      <div>
        <div className="flex gap-2 mb-4">
          {([['polygon', '도형 만들기'], ['count', '차곡차곡 더하기']] as const).map(([id, label]) =>
            <button key={id} aria-pressed={kind === id} onClick={() => { setKind(id); setRevealed(false) }} className={`rounded-xl px-3 py-2 text-sm font-bold ${kind === id ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>)}
        </div>
        <label htmlFor="experiment-value" className="block font-bold text-slate-800">{kind === 'polygon' ? '변의 수' : '몇까지 더할까요?'}: {value}</label>
        <input id="experiment-value" type="range" min="3" max="10" value={value} onChange={e => { setValue(Number(e.target.value)); setRevealed(false) }} className="my-3 w-full accent-violet-700" />
        <p className="text-sm text-slate-600 mb-3">{kind === 'polygon' ? '변이 많아지면 한 번에 도는 각도는 커질까요, 작아질까요?' : '1부터 이 숫자까지 모두 더하면 얼마일까요?'}</p>
        <button onClick={() => setRevealed(!revealed)} aria-expanded={revealed} className="text-sm font-bold text-violet-700 underline underline-offset-4">{revealed ? '설명 접기' : '생각한 뒤 설명 보기'}</button>
        {revealed && <p role="status" className="mt-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-900">{kind === 'polygon' ? `${value}번 돌면서 한 바퀴를 완성하려면, 한 번에 360 ÷ ${value} = ${Number((360 / value).toFixed(2))}도 돌아요.` : `1부터 ${value}까지의 합은 ${value * (value + 1) / 2}예요. 출력에서 합계가 쌓이는 과정을 확인해 보세요.`}</p>}
      </div>
      <div>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 font-code text-xs leading-6 text-violet-100">{code}</pre>
        {!confirming ? <button onClick={() => setConfirming(true)} className="mt-3 rounded-xl bg-violet-700 px-4 py-2.5 font-jua text-white">에디터에 넣고 실험하기</button> : <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
          <p role="status" className="text-sm text-violet-900">현재 코드를 이 예제로 바꿀까요? 실행 취소(Ctrl/Cmd+Z)로 되돌릴 수 있어요.</p>
          <div className="mt-3 flex gap-2">
            <button autoFocus onClick={() => setConfirming(false)} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm">취소</button>
            <button onClick={() => { if (onLoad(code) && detailsRef.current) { detailsRef.current.open = false; setConfirming(false) } }} className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white">코드 바꾸기</button>
          </div>
        </div>}
        <p className="mt-2 text-xs text-slate-500">현재 코드를 바꾸기 전에 확인해요. 넣은 뒤 실행하기를 눌러보세요.</p>
      </div>
    </div>
  </details>
}
