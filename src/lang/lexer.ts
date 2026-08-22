import { KidError } from './errors'
import { EN_TO_KO } from './aliases'

export type TokenType = 'number' | 'string' | 'ident' | 'keyword' | 'op' | 'newline' | 'eof'

export interface Token {
  type: TokenType
  value: string
  line: number
}

export const KEYWORDS = new Set([
  '만약', '이면', '아니면', '끝',
  '반복', '부터', '동안',
  '함수', '반환',
  '그리고', '또는', '아니다',
  '참', '거짓',
])

const IDENT_START = /[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]/
const IDENT_PART = /[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]/

// 한글 입력기에서 자주 섞여 들어오는 특수 따옴표들
const SMART_QUOTES = new Set(['“', '”', '‘', '’', '＂', '＇'])

const TWO_CHAR_OPS = ['==', '!=', '<=', '>=']
const ONE_CHAR_OPS = new Set(['=', '+', '-', '*', '/', '%', '<', '>', '(', ')', '[', ']', ',', '.'])

export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let bracketDepth = 0 // 괄호/대괄호 안에서는 줄바꿈을 무시 (여러 줄 리스트 허용)

  const push = (type: TokenType, value: string) => tokens.push({ type, value, line })

  while (i < src.length) {
    const ch = src[i]

    // 공백
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++
      continue
    }

    // 주석: # 부터 줄 끝까지
    if (ch === '#') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }

    // 줄바꿈
    if (ch === '\n') {
      if (bracketDepth === 0 && tokens.length > 0 && tokens[tokens.length - 1].type !== 'newline') {
        push('newline', '\n')
      }
      line++
      i++
      continue
    }

    // 문자열
    if (ch === '"' || ch === "'") {
      const quote = ch
      const startLine = line
      i++
      let str = ''
      let closed = false
      while (i < src.length) {
        const c = src[i]
        if (c === '\\' && i + 1 < src.length) {
          const next = src[i + 1]
          if (next === 'n') str += '\n'
          else if (next === 't') str += '\t'
          else str += next
          i += 2
          continue
        }
        if (c === quote) {
          closed = true
          i++
          break
        }
        if (c === '\n') break
        str += c
        i++
      }
      if (!closed) {
        throw new KidError(`따옴표(${quote})를 열었는데 닫지 않았어요. 글자 끝에 ${quote} 를 붙여 주세요.`, startLine)
      }
      tokens.push({ type: 'string', value: str, line: startLine })
      continue
    }

    if (SMART_QUOTES.has(ch)) {
      throw new KidError('따옴표 모양이 조금 달라요. 키보드의 " (쌍따옴표)를 사용해 주세요.', line)
    }

    // 숫자
    if (ch >= '0' && ch <= '9') {
      let num = ''
      while (i < src.length && src[i] >= '0' && src[i] <= '9') {
        num += src[i]
        i++
      }
      if (src[i] === '.' && src[i + 1] >= '0' && src[i + 1] <= '9') {
        num += '.'
        i++
        while (i < src.length && src[i] >= '0' && src[i] <= '9') {
          num += src[i]
          i++
        }
      }
      push('number', num)
      continue
    }

    // 이름 (변수/키워드) — 영어 단어는 짝이 되는 한글 단어로 바꿔서 처리
    if (IDENT_START.test(ch)) {
      let word = ''
      while (i < src.length && IDENT_PART.test(src[i])) {
        word += src[i]
        i++
      }
      if (word === 'elif') {
        push('keyword', '아니면')
        push('keyword', '만약')
        continue
      }
      const normalized = EN_TO_KO[word] ?? word
      push(KEYWORDS.has(normalized) ? 'keyword' : 'ident', normalized)
      continue
    }

    // 두 글자 연산자
    const two = src.slice(i, i + 2)
    if (TWO_CHAR_OPS.includes(two)) {
      push('op', two)
      i += 2
      continue
    }

    // 한 글자 연산자
    if (ONE_CHAR_OPS.has(ch)) {
      if (ch === '(' || ch === '[') bracketDepth++
      if (ch === ')' || ch === ']') bracketDepth = Math.max(0, bracketDepth - 1)
      push('op', ch)
      i++
      continue
    }

    throw new KidError(`'${ch}' 글자는 코드에 쓸 수 없어요. 오타가 아닌지 확인해 보세요.`, line)
  }

  if (tokens.length > 0 && tokens[tokens.length - 1].type !== 'newline') {
    push('newline', '\n')
  }
  push('eof', '')
  return tokens
}
