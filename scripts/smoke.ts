/* 한글랭 엔진 + 미션 판정 스모크 테스트: npm run smoke */
import { runProgram } from '../src/lang/run'
import type { Effect } from '../src/lang/interpreter'
import { MISSIONS } from '../src/missions/missions'
import { KO_TO_EN } from '../src/lang/aliases'

let pass = 0
let fail = 0

function prints(effects: Effect[]): string[] {
  return effects.filter((e) => e.kind === 'print').map((e) => (e as { text: string }).text)
}

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** 질문(입력)이 나오면 준비한 답을 차례로 주면서 끝까지 실행한다 */
function runAll(src: string, answers: string[] = []) {
  const given: string[] = []
  let randoms: number[] = []
  let cursor = 0
  for (let i = 0; i <= answers.length + 5; i++) {
    const r = runProgram(src, { answers: given, randoms })
    if (r.ok !== 'ask') return r
    randoms = r.randoms
    if (r.ask.retry) given.pop() // 숫자가 아니어서 되돌려진 답은 버린다
    const next = answers[cursor++]
    if (next === undefined) return r // 준비한 답이 모자람
    given.push(next)
  }
  return runProgram(src, { answers: given, randoms })
}

function why(r: ReturnType<typeof runProgram>): string {
  if (r.ok === false) return `에러: ${r.message} (줄 ${r.line})`
  if (r.ok === 'ask') return `답을 더 물어봄: ${r.ask.question}`
  return '성공'
}

function expectOutput(name: string, src: string, expected: string[], answers: string[] = []) {
  const r = runAll(src, answers)
  if (r.ok !== true) {
    ok(name, false, why(r))
    return
  }
  const got = prints(r.effects)
  ok(name, JSON.stringify(got) === JSON.stringify(expected), `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(got)}`)
}

function expectError(name: string, src: string, msgPart: string, line?: number) {
  const r = runProgram(src)
  if (r.ok !== false) {
    ok(name, false, '에러가 나야 하는데 성공함')
    return
  }
  const lineOk = line === undefined || r.line === line
  ok(name, r.message.includes(msgPart) && lineOk, `실제 메시지: "${r.message}" (줄 ${r.line})`)
}

/** 에러 메시지에 특정 낱말이 들어가면 안 될 때 */
function expectErrorWithout(name: string, src: string, msgPart: string, forbidden: string, line?: number) {
  const r = runProgram(src)
  if (r.ok !== false) {
    ok(name, false, '에러가 나야 하는데 성공함')
    return
  }
  const lineOk = line === undefined || r.line === line
  ok(name, r.message.includes(msgPart) && !r.message.includes(forbidden) && lineOk,
    `실제 메시지: "${r.message}" (줄 ${r.line})`)
}

console.log('\n[1] 기본 문법')
expectOutput('출력과 변수', `이름 = "민준"\n나이 = 10\n출력("안녕하세요")\n출력("나이:", 나이)\n출력(이름, "님은", 나이 + 1, "살이 돼요")`,
  ['안녕하세요', '나이: 10', '민준 님은 11 살이 돼요'])
expectOutput('조건문', `나이 = 12\n만약 나이 >= 10 이면\n    출력("고학년")\n아니면\n    출력("저학년")\n끝`, ['고학년'])
expectOutput('아니면 만약', `점수 = 85\n만약 점수 >= 90 이면\n    출력("참 잘했어요")\n아니면 만약 점수 >= 80 이면\n    출력("잘했어요")\n아니면\n    출력("힘내요")\n끝`, ['잘했어요'])
expectOutput('범위 반복', `합 = 0\n반복 i = 1 부터 5\n    합 = 합 + i\n끝\n출력(합)`, ['15'])
expectOutput('동안 반복', `i = 0\n동안 i < 3\n    i = i + 1\n    출력(i)\n끝`, ['1', '2', '3'])
expectOutput('함수와 반환', `함수 더하기(a, b)\n    반환 a + b\n끝\n출력(더하기(3, 4))`, ['7'])
expectOutput('재귀 함수', `함수 팩토리얼(n)\n    만약 n <= 1 이면\n        반환 1\n    끝\n    반환 n * 팩토리얼(n - 1)\n끝\n출력(팩토리얼(5))`, ['120'])
expectOutput('리스트', `숫자들 = [1, 2, 3]\n출력(숫자들[0])\n출력(길이(숫자들))\n추가(숫자들, 9)\n출력(숫자들)`, ['1', '3', '[1, 2, 3, 9]'])
expectOutput('리스트 칸 바꾸기', `색들 = ["빨강", "파랑"]\n색들[1] = "노랑"\n출력(색들[1])`, ['노랑'])
expectOutput('논리 연산', `출력(참 그리고 거짓)\n출력(참 또는 거짓)\n출력(아니다 거짓)`, ['거짓', '참', '참'])
expectOutput('나머지/음수', `출력(7 % 3)\n출력(-5 + 2)`, ['1', '-3'])
expectOutput('단항 마이너스 우선순위', `출력(-2 * 3)\n출력(10 - -2)`, ['-6', '12'])
expectOutput('문자열 붙이기', `출력("한글" + "코딩")`, ['한글코딩'])
expectOutput('한글 글자 길이/인덱스', `말 = "안녕하세요"\n출력(길이(말))\n출력(말[0])`, ['5', '안'])
expectOutput('빈 블록 허용', `반복 i = 1 부터 3\n    # 주석만 있는 블록\n끝\n출력("통과")`, ['통과'])

console.log('\n[2] 거북이 그래픽')
{
  const r = runProgram(`반복 i = 1 부터 4\n    캐릭터.앞으로(100)\n    캐릭터.오른쪽(90)\n끝`)
  if (r.ok) {
    const moves = r.effects.filter((e) => e.kind === 'move')
    const turns = r.effects.filter((e) => e.kind === 'turn')
    ok('정사각형: 이동 4번 + 회전 4번', moves.length === 4 && turns.length === 4)
    ok('정사각형: 회전 각도 90', turns.every((t) => (t as { angle: number }).angle === 90))
  } else {
    ok('정사각형 실행', false, r.message)
  }
}
{
  const r = runProgram(`캐릭터.색깔("노랑")\n캐릭터.펜올리기()\n캐릭터.뒤로(30)\n캐릭터.펜내리기()\n캐릭터.왼쪽(45)\n캐릭터.굵기(5)\n캐릭터.말하기("안녕!")`)
  ok('모든 거북이 명령 동작', r.ok === true && r.effects.length === 7)
}
ok('영어 색 이름', runProgram(`turtle.color("red")\nturtle.forward(10)`).ok === true)

console.log('\n[3] 친절한 에러 (문법)')
expectError('끝 빠짐', `만약 1 > 0 이면\n    출력("hi")`, "'끝'을 안 적은", 1)
expectError('이면 빠짐', `만약 나이 > 10\n    출력("hi")\n끝`, "'이면'이 필요해요", 1)
expectError('부터 빠짐', `반복 i = 1\n    출력(i)\n끝`, "'부터'가 필요해요", 1)
expectError('따옴표 안 닫음', `출력("안녕`, '닫지 않았어요', 1)
expectError('짝 없는 끝', `출력(1)\n끝`, "'끝'이 하나 더 있어요", 2)
expectError('이상한 기호', `출력(1) @`, '쓸 수 없어요', 1)
// 괄호 누락은 '연 줄'을 가리켜야 하고, 엉뚱한 쉼표 안내가 붙으면 안 된다
expectErrorWithout('괄호 누락: 여는 줄을 가리킴', `캐릭터.앞으로(100\n캐릭터.오른쪽(90)`, "1번째 줄에서 연 괄호", '쉼표', 1)
expectErrorWithout('괄호 누락: 끝 줄 앞에서도 여는 줄', `반복 i = 1 부터 2\n    출력(i\n끝`, "2번째 줄에서 연 괄호", '쉼표', 2)
expectError('같은 줄 쉼표 누락은 쉼표 안내 유지', `출력(1 2)`, '쉼표', 1)
expectError('조건에 = 하나', `x = 1\n만약 x = 3 이면\n출력(1)\n끝`, '== 두 개', 2)
expectError('출력 괄호 빠짐', `출력 "안녕"`, '뒤에는 괄호가 필요해요', 1)
expectError('키워드 붙여쓰기', `만약나이 >= 10 이면\n출력(1)\n끝`, '한 칸 띄어', 1)
expectError('닫는 괄호 초과', `출력(1))`, '하나 더 있어요', 1)
expectError('예약어를 변수로 (end)', `end = 5`, '변수 이름으로 쓸 수 없어요', 1)
expectError('예약어를 변수로 (블록 안)', `반복 i = 1 부터 2\nend = 5\n끝`, '변수 이름으로 쓸 수 없어요', 2)

console.log('\n[4] 친절한 에러 (실행)')
expectError('없는 변수', `출력(점수)`, "'점수'(이)라는 이름을 아직 안 만들었어요", 1)
expectError('영어로 쓴 이름 그대로 안내', `출력(myScore)`, "'myScore'", 1)
expectError('0으로 나누기', `출력(10 / 0)`, '0으로 나눌 수는 없어요', 1)
expectError('숫자+글자', `출력("나이" + 10)`, '숫자랑 글자를 같이 더하려고 했어요', 1)
expectError('모르는 색', `캐릭터.색깔("무지개")`, '모르는 색깔이에요', 1)
expectError('모르는 캐릭터 명령', `캐릭터.점프(10)`, "'점프'(이)라는 명령을 몰라요", 1)
expectError('리스트 범위 밖', `숫자들 = [1, 2]\n출력(숫자들[5])`, '5번 칸이 없어요', 2)
expectError('빈 리스트', `a = []\n출력(a[0])`, '비어 있어서', 2)
expectError('무한 루프 방지', `동안 참\n    x = 1\n끝`, '멈추지 않아요', 1)
expectError('무한 재귀 방지', `함수 f()\n    f()\n끝\nf()`, '자기 자신을 너무 많이 불러서')
expectError('함수 아닌 것 부르기', `x = 5\nx(3)`, '함수가 아니라서', 2)
expectError('인자 개수 다름', `함수 더하기(a, b)\n    반환 a + b\n끝\n출력(더하기(1))`, '2개 필요해요', 4)
expectError('조건에 숫자', `만약 3 이면\n    출력(1)\n끝`, '참이나 거짓이 와야 해요', 1)
expectError('캐릭터 이름 뺏기', `캐릭터 = 5`, '거북이 친구가 이미 쓰고 있어요', 1)
expectError('반환 밖에서 사용', `반환 3`, '함수 안에서만', 1)
expectError('안 만든 함수 호출', `그리기()`, '함수를 아직 안 만들었어요', 1)
expectError('아직 없는 기능(멈춤)', `멈춤()`, '아직 없어요', 1)
expectError('리스트 폭발 방지', `a = [1]\n반복 i = 1 부터 30\n    a = a + a\n끝`, '너무 커졌어요')

console.log('\n[5] 영어 키워드 호환 (영어 단어 브리지)')
expectOutput('if/then/else/end', `age = 12\nif age >= 10 then\n    print("senior")\nelse\n    print("junior")\nend`, ['senior'])
expectOutput('elif', `score = 85\nif score >= 90 then\n    print("A")\nelif score >= 80 then\n    print("B")\nelse\n    print("C")\nend`, ['B'])
expectOutput('for/to', `sum = 0\nfor i = 1 to 5\n    sum = sum + i\nend\nprint(sum)`, ['15'])
expectOutput('while', `i = 0\nwhile i < 3\n    i = i + 1\nend\nprint(i)`, ['3'])
expectOutput('def/return', `def add(a, b)\n    return a + b\nend\nprint(add(2, 3))`, ['5'])
expectOutput('and/or/not/true/false', `print(true and not false)\nprint(false or true)`, ['참', '참'])
expectOutput('len/append/random 범위', `nums = [1, 2]\nappend(nums, 3)\nprint(len(nums))\nr = random(1, 1)\nprint(r)`, ['3', '1'])
expectOutput('한글+영어 섞어 쓰기', `나이 = 11\nif 나이 >= 10 이면\n    출력("고학년")\nend`, ['고학년'])
{
  const r = runProgram(`turtle.color("빨강")\nfor i = 1 to 4\n    turtle.forward(100)\n    turtle.right(90)\nend\nturtle.say("done!")`)
  if (r.ok === true) {
    const moves = r.effects.filter((e) => e.kind === 'move')
    const turns = r.effects.filter((e) => e.kind === 'turn')
    ok('turtle.forward/right로 정사각형', moves.length === 4 && turns.length === 4 && r.effects.some((e) => e.kind === 'say'))
  } else {
    ok('turtle.forward/right로 정사각형', false, why(r))
  }
}
expectError('영어 코드도 친절한 에러', `if age >= 10 then\n    print("hi")`, "'끝'을 안 적은", 1)

console.log('\n[6] 의미론·성능')
expectOutput('함수 안 반복 변수는 바깥을 안 건드림', `i = 100\n함수 f()\n    반복 i = 1 부터 3\n    끝\n끝\nf()\n출력(i)`, ['100'])
expectOutput('함수 안에서 전역 변수 바꾸기는 그대로', `수 = 0\n함수 f()\n    수 = 수 + 1\n끝\nf()\nf()\n출력(수)`, ['2'])
expectOutput('함수를 아래에 정의해도 호출 가능', `출력(더하기(1, 2))\n함수 더하기(a, b)\n    반환 a + b\n끝`, ['3'])
expectOutput('큰 반복도 정상 실행', `합 = 0\n반복 i = 1 부터 100000\n    합 = 합 + i\n끝\n출력(합)`, ['5000050000'])
expectErrorWithout('범위 반복 초과는 동안을 탓하지 않음', `반복 i = 1 부터 3000000\n    x = i\n끝`, '반복', '동안', 1)
expectOutput('리스트 == 비교', `출력([1, 2] == [1, 2])\n출력([1] == [2])`, ['참', '거짓'])

console.log('\n[7] 미션 판정 (교재 데이터 기반)')
{
  const toEnglish = (code: string) => {
    let out = code
    // 긴 낱말부터 바꿔야 '숫자입력'이 '숫자input' 처럼 반쪽만 바뀌지 않는다
    const pairs = Object.entries(KO_TO_EN).sort((a, b) => b[0].length - a[0].length)
    for (const [ko, en] of pairs) out = out.replaceAll(ko, en)
    return out
  }
  // 물어보는 미션에는 답을 미리 준비해 둔다 (숫자 맞히기는 1~25를 차례로 넣어 본다)
  const NUMBERS = Array.from({ length: 25 }, (_, i) => String(i + 1))
  const ANSWERS: Record<string, string[]> = {
    'ask-input': ['민준', '10'],
    'condition': ['7'],
    'while-guess': NUMBERS,
  }
  const passes = (m: (typeof MISSIONS)[number], code: string): boolean => {
    const r = runAll(code, ANSWERS[m.id] ?? [])
    if (r.ok !== true) return false
    return m.check({ code, effects: r.effects, starterCode: m.starterCode })
  }

  for (const m of MISSIONS) {
    const codedSteps = m.lesson.steps.filter((s) => s.code)
    const lastStep = codedSteps[codedSteps.length - 1].code!
    ok(`미션 ${m.order}: 시작 코드만 실행하면 미완료`, !passes(m, m.starterCode))
    ok(`미션 ${m.order}: 모든 따라하기 단계가 실행됨`,
      codedSteps.every((s) => runAll(s.code!, ANSWERS[m.id] ?? []).ok === true))
    ok(`미션 ${m.order}: 마지막 단계로 완료`, passes(m, lastStep))
    ok(`미션 ${m.order}: 예시 코드로 완료`, passes(m, m.exampleCode))
    ok(`미션 ${m.order}: 영어로 쓴 예시도 완료`, passes(m, toEnglish(m.exampleCode)))
  }

  // 주석으로 우회할 수 없어야 한다
  const square = MISSIONS.find((m) => m.id === 'square')!
  ok('주석에 반복만 써서는 통과 불가', !passes(square,
    '# 반복 부터\n' + '캐릭터.앞으로(10)\n캐릭터.오른쪽(90)\n'.repeat(4)))
  const condition = MISSIONS.find((m) => m.id === 'condition')!
  ok('주석에 만약만 써서는 통과 불가', !passes(condition, '# 만약 이면\n출력(1)'))
  const fn = MISSIONS.find((m) => m.id === 'function')!
  ok('주석에 함수만 써서는 통과 불가', !passes(fn,
    '# 함수\n' + '캐릭터.앞으로(10)\n'.repeat(9)))

  // 교재 힌트에 적힌 코드가 실제로 돌아가야 한다
  ok('힌트: 반복 속 만약', runProgram(
    '반복 i = 1 부터 4\n    만약 i % 2 == 0 이면\n        캐릭터.색깔("빨강")\n    아니면\n        캐릭터.색깔("파랑")\n    끝\n    캐릭터.앞으로(100)\n    캐릭터.오른쪽(90)\n끝').ok === true)
  ok('힌트: 그리고 조건', runProgram(
    '나이 = 10\n만약 나이 >= 8 그리고 나이 <= 13 이면\n    출력("초등학생이에요")\n끝').ok === true)
  ok('힌트: 반환 함수', runProgram(
    '함수 더하기(a, b)\n    반환 a + b\n끝\n출력(더하기(3, 4))').ok === true)
  ok('힌트: 추가/길이', runProgram(
    '색깔들 = ["빨강"]\n추가(색깔들, "보라")\n출력("칸 수:", 길이(색깔들))').ok === true)
  ok('힌트: 무작위 정답', runProgram(
    '정답 = 무작위(1, 10)\n추측 = 5\n만약 추측 == 정답 이면\n    출력("맞았어요")\n아니면\n    출력("아니에요")\n끝').ok === true)
}

console.log('\n[8] 물어보기(입력)')
expectOutput('입력으로 받은 답 쓰기', `이름 = 입력("이름이 뭐예요?")\n출력("안녕", 이름)`, ['이름이 뭐예요? ▸ 민준', '안녕 민준'], ['민준'])
expectOutput('숫자입력은 계산에 쓸 수 있음', `나이 = 숫자입력("몇 살?")\n출력(나이 + 1)`, ['몇 살? ▸ 10', '11'], ['10'])
expectOutput('영어 input 도 동작', `name = input("name?")\nprint(name)`, ['name? ▸ Minjun', 'Minjun'], ['Minjun'])
expectOutput('여러 번 물어보기', `가 = 숫자입력("첫 수?")\n나 = 숫자입력("둘째 수?")\n출력(가 + 나)`, ['첫 수? ▸ 3', '둘째 수? ▸ 4', '7'], ['3', '4'])
{
  // 숫자가 아닌 답을 주면 다시 물어본다
  const r1 = runProgram(`나이 = 숫자입력("몇 살?")\n출력(나이)`, { answers: ['열살'] })
  ok('숫자입력에 글자를 주면 다시 물어봄', r1.ok === 'ask' && !!r1.ask.retry)
  const r2 = runAll(`나이 = 숫자입력("몇 살?")\n출력(나이)`, ['열살', '10'])
  ok('다시 물어본 뒤 숫자를 주면 진행', r2.ok === true && prints(r2.effects).includes('10'))
}
{
  // 무작위는 다시 실행해도 같은 값이 나와야 (질문 재생 중 그림이 바뀌지 않도록)
  const first = runProgram(`정답 = 무작위(1, 1000)\n이름 = 입력("이름?")\n출력(정답)`)
  ok('질문 전 무작위 값이 기록됨', first.ok === 'ask' && first.randoms.length === 1)
  if (first.ok === 'ask') {
    const second = runProgram(`정답 = 무작위(1, 1000)\n이름 = 입력("이름?")\n출력(정답)`, { answers: ['민준'], randoms: first.randoms })
    ok('다시 실행해도 같은 무작위 값', second.ok === true && prints(second.effects).includes(String(first.randoms[0])))
  } else {
    ok('다시 실행해도 같은 무작위 값', false)
  }
}
expectError('입력에 인자를 두 개 주면 안내', `입력("가", "나")`, '물어볼 말 하나만', 1)

console.log('\n[9] 새 거북이 명령')
{
  const r = runProgram(`캐릭터.집으로()\n캐릭터.이동(50, 80)\n캐릭터.방향(90)\n캐릭터.원(30)\n캐릭터.점찍기(10)\n캐릭터.채우기시작()\n캐릭터.앞으로(10)\n캐릭터.채우기끝()\n캐릭터.글쓰기("안녕")\n캐릭터.숨기기()\n캐릭터.보이기()\n캐릭터.지우기()`)
  const kinds = r.ok === true ? r.effects.map((e) => e.kind) : []
  ok('새 명령 12개가 모두 효과를 만듦',
    kinds.join(',') === 'goto,heading,goto,heading,circle,dot,fill,move,fill,write,visible,visible,clear', kinds.join(','))
}
{
  const r = runProgram(`turtle.home()\nturtle.goto(10, 20)\nturtle.circle(30)\nturtle.dot(5)\nturtle.write("hi")\nturtle.begin_fill()\nturtle.end_fill()\nturtle.hideturtle()`)
  ok('영어 이름으로도 새 명령 사용 가능', r.ok === true && r.effects.length === 9,
    r.ok === true ? r.effects.map((e) => e.kind).join(',') : why(r))
}
expectError('원의 반지름은 0보다 커야', `캐릭터.원(0)`, '0보다 큰', 1)
expectError('이동은 숫자 두 개', `캐릭터.이동(10)`, '숫자 2개', 1)
{
  // 이동(x, y)의 y는 수학처럼 위쪽이 +
  const r = runProgram(`캐릭터.이동(0, 100)`)
  const g = r.ok === true ? (r.effects[0] as { x: number; y: number }) : null
  ok('이동(0, 100)은 위쪽 100', !!g && g.x === 0 && g.y === 100)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`)
process.exit(fail > 0 ? 1 : 0)
