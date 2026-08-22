/* 한글랭 엔진 스모크 테스트: npm run smoke */
import { runProgram } from '../src/lang/run'
import type { Effect } from '../src/lang/interpreter'

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

function expectOutput(name: string, src: string, expected: string[]) {
  const r = runProgram(src)
  if (!r.ok) {
    ok(name, false, `에러 발생: ${r.message} (줄 ${r.line})`)
    return
  }
  const got = prints(r.effects)
  ok(name, JSON.stringify(got) === JSON.stringify(expected), `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(got)}`)
}

function expectError(name: string, src: string, msgPart: string, line?: number) {
  const r = runProgram(src)
  if (r.ok) {
    ok(name, false, '에러가 나야 하는데 성공함')
    return
  }
  const lineOk = line === undefined || r.line === line
  ok(name, r.message.includes(msgPart) && lineOk, `실제 메시지: "${r.message}" (줄 ${r.line})`)
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
expectOutput('문자열 붙이기', `출력("한글" + "코딩")`, ['한글코딩'])
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
  ok('모든 거북이 명령 동작', r.ok && r.effects.length === 7, r.ok ? undefined : r.message)
}

console.log('\n[3] 친절한 에러 (문법)')
expectError('끝 빠짐', `만약 1 > 0 이면\n    출력("hi")`, "'끝'을 안 적은", 1)
expectError('이면 빠짐', `만약 나이 > 10\n    출력("hi")\n끝`, "'이면'이 필요해요", 1)
expectError('부터 빠짐', `반복 i = 1\n    출력(i)\n끝`, "'부터'가 필요해요", 1)
expectError('따옴표 안 닫음', `출력("안녕`, '닫지 않았어요', 1)
expectError('괄호 안 닫음', `출력(1 + 2`, "')'를 닫지 않았어요", 1)
expectError('짝 없는 끝', `출력(1)\n끝`, "'끝'이 하나 더 있어요", 2)
expectError('이상한 기호', `출력(1) @`, '쓸 수 없어요', 1)

console.log('\n[4] 친절한 에러 (실행)')
expectError('없는 변수', `출력(점수)`, "'점수'(이)라는 이름을 아직 안 만들었어요", 1)
expectError('0으로 나누기', `출력(10 / 0)`, '0으로 나눌 수는 없어요', 1)
expectError('숫자+글자', `출력("나이" + 10)`, '숫자랑 글자를 같이 더하려고 했어요', 1)
expectError('모르는 색', `캐릭터.색깔("무지개")`, '모르는 색깔이에요', 1)
expectError('모르는 캐릭터 명령', `캐릭터.점프(10)`, "'점프'(이)라는 명령을 몰라요", 1)
expectError('리스트 범위 밖', `숫자들 = [1, 2]\n출력(숫자들[5])`, '5번 칸이 없어요', 2)
expectError('무한 루프 방지', `동안 참\n    x = 1\n끝`, '멈추지 않아요')
expectError('무한 재귀 방지', `함수 f()\n    f()\n끝\nf()`, '자기 자신을 너무 많이 불러서')
expectError('함수 아닌 것 부르기', `x = 5\nx(3)`, '함수가 아니라서', 2)
expectError('인자 개수 다름', `함수 더하기(a, b)\n    반환 a + b\n끝\n출력(더하기(1))`, '2개 필요해요', 4)
expectError('조건에 숫자', `만약 3 이면\n    출력(1)\n끝`, '참이나 거짓이 와야 해요', 1)
expectError('캐릭터 이름 뺏기', `캐릭터 = 5`, '거북이 친구가 이미 쓰고 있어요', 1)
expectError('반환 밖에서 사용', `반환 3`, "함수 안에서만", 1)

console.log('\n[5] 영어 키워드 호환 (실제 코딩 브리지)')
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
  if (r.ok) {
    const moves = r.effects.filter((e) => e.kind === 'move')
    const turns = r.effects.filter((e) => e.kind === 'turn')
    ok('turtle.forward/right로 정사각형', moves.length === 4 && turns.length === 4 && r.effects.some((e) => e.kind === 'say'))
  } else {
    ok('turtle.forward/right로 정사각형', false, r.message)
  }
}
expectError('영어 코드도 친절한 에러', `if age >= 10 then\n    print("hi")`, "'끝'을 안 적은", 1)

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`)
process.exit(fail > 0 ? 1 : 0)
