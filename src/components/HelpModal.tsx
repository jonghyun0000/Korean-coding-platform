import { Emo } from '../ui/emoji'

interface Row {
  code: string
  desc: string
  /** 실제 코딩(영어)에서 쓰는 짝 단어 */
  en?: string
}

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: '기본 명령',
    rows: [
      { code: '출력("안녕")', desc: '화면에 글자 보여주기', en: 'print' },
      { code: '이름 = "민준"', desc: '변수(상자)에 값 넣기' },
      { code: '# 설명', desc: '주석 — 컴퓨터가 읽지 않는 메모' },
    ],
  },
  {
    title: '조건과 반복',
    rows: [
      { code: '만약 나이 >= 10 이면 … 끝', desc: '조건이 맞을 때만 실행', en: 'if … then … end' },
      { code: '아니면 만약 … 이면 / 아니면', desc: '다른 조건 / 나머지 경우', en: 'elif / else' },
      { code: '반복 i = 1 부터 5 … 끝', desc: '5번 반복하기', en: 'for i = 1 to 5' },
      { code: '동안 i < 10 … 끝', desc: '조건이 참인 동안 반복', en: 'while' },
      { code: '그리고 · 또는 · 아니다', desc: '조건 이어 붙이기', en: 'and · or · not' },
      { code: '참 · 거짓', desc: '맞다 / 틀리다', en: 'true · false' },
    ],
  },
  {
    title: '함수와 리스트',
    rows: [
      { code: '함수 더하기(a, b) … 반환 a + b … 끝', desc: '나만의 명령 만들기', en: 'def … return … end' },
      { code: '숫자들 = [1, 2, 3]', desc: '리스트 만들기 (첫 칸은 0번!)' },
      { code: '숫자들[0] · 길이(숫자들) · 추가(숫자들, 4)', desc: '칸 읽기 · 길이 · 값 넣기', en: 'len · append' },
      { code: '무작위(1, 10)', desc: '1~10 중 아무 숫자', en: 'random' },
    ],
  },
  {
    title: '캐릭터(거북이) 명령',
    rows: [
      { code: '캐릭터.앞으로(100) / 캐릭터.뒤로(50)', desc: '선을 그으며 이동', en: 'turtle.forward / back' },
      { code: '캐릭터.오른쪽(90) / 캐릭터.왼쪽(90)', desc: '제자리에서 돌기', en: 'right / left' },
      { code: '캐릭터.색깔("빨강") / 캐릭터.굵기(5)', desc: '펜 색과 굵기', en: 'color / width' },
      { code: '캐릭터.펜올리기() / 캐릭터.펜내리기()', desc: '안 그리고 이동 / 다시 그리기', en: 'penup / pendown' },
      { code: '캐릭터.말하기("안녕!")', desc: '말풍선 보여주기', en: 'say' },
    ],
  },
]

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="한글랭 도움말"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-jua flex items-center gap-2 text-2xl text-slate-800">
            <Emo name="open_book" size={26} /> 한글랭 명령 모음
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-jua rounded-xl bg-slate-100 px-4 py-1.5 text-slate-600 transition hover:bg-slate-200"
          >
            닫기 ✕
          </button>
        </div>

        <p className="mb-4 rounded-2xl bg-sky-50 px-4 py-2.5 text-[14.5px] leading-relaxed text-sky-900">
          <Emo name="light_bulb" size={16} /> <b>실제 코딩과 이어져요!</b> 파란 배지가 실제 코딩(영어)에서 쓰는 단어예요.
          에디터에서 단어에 마우스를 올려도 알려주고, <b>영어 단어로 코드를 써도 똑같이 실행돼요.</b>{' '}
          <code className="font-code text-[13px] text-pink-700">if age &gt;= 10 then</code> 처럼요!
        </p>

        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="font-jua mb-2 text-lg text-indigo-700">{section.title}</h3>
              <div className="overflow-hidden rounded-2xl border-2 border-slate-100">
                {section.rows.map((row, i) => (
                  <div key={i} className={`flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:gap-4 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                    <code className="font-code text-[14px] text-pink-700 sm:w-[45%]">{row.code}</code>
                    <span className="flex-1 text-[14.5px] text-slate-600">{row.desc}</span>
                    {row.en && (
                      <code className="font-code self-start whitespace-nowrap rounded-lg bg-sky-100 px-2 py-0.5 text-[12.5px] text-sky-800 sm:self-center">
                        {row.en}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
