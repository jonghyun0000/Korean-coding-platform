/**
 * 한글랭 ↔ 실제 코딩(영어) 단어 짝.
 * - 영어 단어로도 코드를 쓸 수 있다 (렉서가 한글 단어로 바꿔서 처리)
 * - 에디터에서 단어에 마우스를 올리면 짝이 되는 단어를 보여준다
 */

/** 영어 → 한글 (코드에 쓸 수 있는 모든 영어 단어) */
export const EN_TO_KO: Record<string, string> = {
  // 키워드
  if: '만약',
  then: '이면',
  else: '아니면',
  end: '끝',
  for: '반복',
  repeat: '반복',
  to: '부터',
  while: '동안',
  def: '함수',
  function: '함수',
  return: '반환',
  and: '그리고',
  or: '또는',
  not: '아니다',
  true: '참',
  True: '참',
  false: '거짓',
  False: '거짓',
  // 내장 함수
  print: '출력',
  len: '길이',
  append: '추가',
  random: '무작위',
  round: '반올림',
  // 거북이
  turtle: '캐릭터',
  forward: '앞으로',
  back: '뒤로',
  backward: '뒤로',
  right: '오른쪽',
  left: '왼쪽',
  color: '색깔',
  penup: '펜올리기',
  pendown: '펜내리기',
  width: '굵기',
  pensize: '굵기',
  say: '말하기',
}
// 'elif'는 '아니면 만약' 두 단어로 풀리므로 렉서에서 따로 처리한다.

/** 한글 → 대표 영어 단어 (호버 툴팁용) */
export const KO_TO_EN: Record<string, string> = {
  '만약': 'if',
  '이면': 'then',
  '아니면': 'else',
  '끝': 'end',
  '반복': 'for',
  '부터': 'to',
  '동안': 'while',
  '함수': 'def',
  '반환': 'return',
  '그리고': 'and',
  '또는': 'or',
  '아니다': 'not',
  '참': 'true',
  '거짓': 'false',
  '출력': 'print',
  '길이': 'len',
  '추가': 'append',
  '무작위': 'random',
  '반올림': 'round',
  '캐릭터': 'turtle',
  '앞으로': 'forward',
  '뒤로': 'back',
  '오른쪽': 'right',
  '왼쪽': 'left',
  '색깔': 'color',
  '펜올리기': 'penup',
  '펜내리기': 'pendown',
  '굵기': 'width',
  '말하기': 'say',
}
