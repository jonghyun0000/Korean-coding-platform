import { KidError } from './errors'
import { tokenize, type Token } from './lexer'
import type {
  Stmt, Expr, Ident, IndexExpr,
} from './ast'

export function parse(src: string): Stmt[] {
  return new Parser(tokenize(src)).parseProgram()
}

/** '만약나이 >= 10 이면' 처럼 키워드와 이름을 붙여 쓴 경우를 잡기 위한 짝 */
const GLUED_HINTS: [string, string][] = [['만약', '이면'], ['반복', '부터']]

class Parser {
  private tokens: Token[]
  private pos = 0
  /** 지금 파싱 중인 문장의 첫 토큰 (에러 문구를 정확히 만들기 위해) */
  private stmtStart: Token | null = null

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]
  }

  private prev(): Token | null {
    return this.pos > 0 ? this.tokens[this.pos - 1] : null
  }

  private next(): Token {
    const t = this.tokens[this.pos]
    if (t.type !== 'eof') this.pos++
    return t
  }

  private check(type: Token['type'], value?: string): boolean {
    const t = this.peek()
    return t.type === type && (value === undefined || t.value === value)
  }

  private match(type: Token['type'], value?: string): boolean {
    if (this.check(type, value)) {
      this.next()
      return true
    }
    return false
  }

  private skipNewlines() {
    while (this.match('newline')) { /* skip */ }
  }

  /**
   * 문장 끝(줄바꿈)을 기대한다. 남은 토큰이 있으면 그 모양을 보고
   * 아이가 실제로 저지른 실수를 구체적으로 짚어 준다.
   */
  private expectNewline(context: string) {
    if (this.match('newline') || this.check('eof')) return

    const t = this.peek()
    const prev = this.prev()
    const start = this.stmtStart

    // 닫는 괄호가 하나 더
    if (t.type === 'op' && (t.value === ')' || t.value === ']')) {
      throw new KidError(`닫는 괄호 '${t.value}'가 하나 더 있어요. 여는 괄호와 짝이 맞는지 세어 보세요.`, t.line)
    }

    // 만약나이 >= 10 이면  →  키워드와 이름을 붙여 씀
    if (t.type === 'keyword' && start && start.type === 'ident') {
      for (const [kw, tail] of GLUED_HINTS) {
        if (t.value === tail && start.value.startsWith(kw) && start.value.length > kw.length) {
          throw new KidError(
            `'${kw}' 뒤에는 한 칸 띄어 주세요. 예: ${kw} ${start.raw.slice(kw.length)} …`,
            start.line,
          )
        }
      }
    }

    // 출력 "안녕"  →  괄호를 빼먹음
    if (prev && prev.type === 'ident' && (t.type === 'string' || t.type === 'number')) {
      throw new KidError(`'${prev.raw}' 뒤에는 괄호가 필요해요. 예: ${prev.raw}("안녕")`, t.line)
    }

    throw new KidError(`${context} 다음에는 줄을 바꿔 주세요. 한 줄에는 명령을 하나만 써요.`, t.line)
  }

  private unexpected(t: Token): never {
    if (t.type === 'eof') {
      throw new KidError('코드가 갑자기 끝났어요. 빠진 부분이 없는지 확인해 보세요.', this.lastLine())
    }
    if (t.type === 'newline') {
      throw new KidError('줄이 갑자기 끝났어요. 빠진 부분이 없는지 확인해 보세요.', t.line)
    }
    throw new KidError(`'${t.raw}' 부분을 이해하지 못했어요. 앞뒤를 다시 확인해 보세요.`, t.line)
  }

  private lastLine(): number {
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      if (this.tokens[i].type !== 'eof') return this.tokens[i].line
    }
    return 1
  }

  /**
   * 괄호/대괄호가 닫히지 않았을 때의 에러.
   * 줄이 넘어갔으면 진짜 '닫는 괄호 빠짐'이므로 여는 줄을 가리킨다.
   */
  private unclosed(openTok: Token, close: ')' | ']'): KidError {
    const open = close === ')' ? '(' : '['
    const cur = this.peek()
    const sameLine = cur.line === openTok.line && cur.type !== 'newline' && cur.type !== 'eof'
    if (sameLine) {
      return new KidError(
        `괄호 '${open}'를 닫지 않았어요. 값 사이에는 쉼표(,)를 써 주세요.`,
        openTok.line,
      )
    }
    return new KidError(
      `${openTok.line}번째 줄에서 연 괄호 '${open}'를 닫지 않았어요. 그 줄 끝에 '${close}'를 붙여 주세요.`,
      openTok.line,
    )
  }

  /** end = 5 처럼 예약된 말을 변수 이름으로 쓴 경우를 블록 판정보다 먼저 잡는다 */
  private checkReservedAssign() {
    const t = this.peek()
    if (t.type !== 'keyword') return
    const nxt = this.peek(1)
    if (nxt.type === 'op' && nxt.value === '=') {
      throw new KidError(
        `'${t.raw}'은(는) 한글랭에서 '${t.value}'와 같은 뜻으로 쓰는 말이라 변수 이름으로 쓸 수 없어요. 다른 이름을 지어 주세요.`,
        t.line,
      )
    }
  }

  parseProgram(): Stmt[] {
    const body: Stmt[] = []
    this.skipNewlines()
    while (!this.check('eof')) {
      this.checkReservedAssign()
      // 블록 밖에서 만난 '끝' — 짝이 없는 끝
      if (this.check('keyword', '끝')) {
        throw new KidError("'끝'이 하나 더 있어요. 만약/반복/동안/함수와 짝이 맞는지 확인해 보세요.", this.peek().line)
      }
      if (this.check('keyword', '아니면')) {
        throw new KidError("'아니면'은 '만약' 블록 안에서만 쓸 수 있어요.", this.peek().line)
      }
      body.push(this.parseStatement())
      this.skipNewlines()
    }
    return body
  }

  /** endWords 중 하나를 만날 때까지 문장을 모은다. 못 만나면 '끝 빠짐' 에러. */
  private parseBlock(endWords: string[], openLine: number, openWhat: string): Stmt[] {
    const body: Stmt[] = []
    this.skipNewlines()
    while (true) {
      if (this.check('eof')) {
        throw new KidError(
          `코드가 끝나기 전에 '끝'을 안 적은 곳이 있어요. ${openLine}번째 줄에서 시작한 '${openWhat}' 부분을 확인해 보세요.`,
          openLine,
        )
      }
      this.checkReservedAssign()
      const t = this.peek()
      if (t.type === 'keyword' && endWords.includes(t.value)) return body
      body.push(this.parseStatement())
      this.skipNewlines()
    }
  }

  private parseStatement(): Stmt {
    const t = this.peek()
    this.stmtStart = t

    if (t.type === 'keyword') {
      this.checkReservedAssign()
      switch (t.value) {
        case '만약': return this.parseIf()
        case '반복': return this.parseRangeFor()
        case '동안': return this.parseWhile()
        case '함수': return this.parseFuncDef()
        case '반환': return this.parseReturn()
        case '이면':
          throw new KidError("'이면'은 '만약' 뒤에 조건과 함께 써요. 예: 만약 나이 >= 10 이면", t.line)
        case '부터':
          throw new KidError("'부터'는 반복문에서 써요. 예: 반복 i = 1 부터 5", t.line)
      }
    }

    // 대입문 또는 표현식 문장
    const expr = this.parseExpression()
    if (this.check('op', '=')) {
      const eq = this.next()
      if (expr.kind !== 'ident' && expr.kind !== 'index') {
        throw new KidError('여기에는 값을 넣을 수 없어요. = 왼쪽에는 변수 이름이 와야 해요.', eq.line)
      }
      if (expr.kind === 'ident' && expr.name === '캐릭터') {
        throw new KidError("'캐릭터'라는 이름은 거북이 친구가 이미 쓰고 있어요. 다른 이름을 골라 주세요.", eq.line)
      }
      const value = this.parseExpression()
      this.expectNewline('명령')
      return { kind: 'assign', target: expr as Ident | IndexExpr, value, line: expr.line }
    }
    this.expectNewline('명령')
    return { kind: 'exprStmt', expr, line: expr.line }
  }

  /** 조건 자리에 =(하나)를 쓴 흔한 실수를 잡는다 */
  private checkAssignInCondition() {
    if (this.check('op', '=')) {
      throw new KidError(
        '같은지 물어볼 때는 = 하나가 아니라 == 두 개를 써요. 예: 만약 추측 == 정답 이면',
        this.peek().line,
      )
    }
  }

  private parseIf(): Stmt {
    const start = this.next() // 만약
    const branches: { cond: Expr; body: Stmt[] }[] = []

    const cond = this.parseExpression()
    this.checkAssignInCondition()
    if (!this.match('keyword', '이면')) {
      throw new KidError("'만약' 뒤에는 조건과 '이면'이 필요해요. 예: 만약 나이 >= 10 이면", start.line)
    }
    this.expectNewline("'이면'")
    branches.push({ cond, body: this.parseBlock(['아니면', '끝'], start.line, '만약') })

    let elseBody: Stmt[] | null = null
    while (this.check('keyword', '아니면')) {
      const elseTok = this.next()
      if (this.match('keyword', '만약')) {
        // 아니면 만약 (else if)
        const c = this.parseExpression()
        this.checkAssignInCondition()
        if (!this.match('keyword', '이면')) {
          throw new KidError("'아니면 만약' 뒤에는 조건과 '이면'이 필요해요.", elseTok.line)
        }
        this.expectNewline("'이면'")
        branches.push({ cond: c, body: this.parseBlock(['아니면', '끝'], start.line, '만약') })
      } else {
        this.expectNewline("'아니면'")
        elseBody = this.parseBlock(['끝'], start.line, '만약')
        break
      }
    }

    this.next() // 끝
    this.expectNewline("'끝'")
    return { kind: 'if', branches, elseBody, line: start.line }
  }

  private parseRangeFor(): Stmt {
    const start = this.next() // 반복
    const nameTok = this.peek()
    if (nameTok.type !== 'ident') {
      throw new KidError("반복은 이렇게 써요: 반복 i = 1 부터 5", start.line)
    }
    this.next()
    if (!this.match('op', '=')) {
      throw new KidError("반복은 이렇게 써요: 반복 i = 1 부터 5", start.line)
    }
    const startExpr = this.parseExpression()
    if (!this.match('keyword', '부터')) {
      throw new KidError("반복에는 '부터'가 필요해요. 예: 반복 i = 1 부터 5", start.line)
    }
    const endExpr = this.parseExpression()
    this.expectNewline('반복')
    const body = this.parseBlock(['끝'], start.line, '반복')
    this.next() // 끝
    this.expectNewline("'끝'")
    return { kind: 'rangeFor', varName: nameTok.value, start: startExpr, end: endExpr, body, line: start.line }
  }

  private parseWhile(): Stmt {
    const start = this.next() // 동안
    const cond = this.parseExpression()
    this.checkAssignInCondition()
    this.expectNewline('동안')
    const body = this.parseBlock(['끝'], start.line, '동안')
    this.next() // 끝
    this.expectNewline("'끝'")
    return { kind: 'while', cond, body, line: start.line }
  }

  private parseFuncDef(): Stmt {
    const start = this.next() // 함수
    const nameTok = this.peek()
    if (nameTok.type !== 'ident') {
      throw new KidError('함수에는 이름이 필요해요. 예: 함수 더하기(a, b)', start.line)
    }
    this.next()
    if (!this.check('op', '(')) {
      throw new KidError(`함수 이름 뒤에는 괄호가 필요해요. 예: 함수 ${nameTok.raw}(a, b)`, start.line)
    }
    const openTok = this.next() // (
    const params: string[] = []
    if (!this.check('op', ')')) {
      while (true) {
        const p = this.peek()
        if (p.type !== 'ident') {
          if (p.type === 'newline' || p.type === 'eof') throw this.unclosed(openTok, ')')
          throw new KidError('함수 괄호 안에는 이름만 쓸 수 있어요. 예: 함수 더하기(a, b)', p.line)
        }
        this.next()
        params.push(p.value)
        if (this.match('op', ',')) continue
        break
      }
    }
    if (!this.match('op', ')')) {
      throw this.unclosed(openTok, ')')
    }
    this.expectNewline('함수')
    const body = this.parseBlock(['끝'], start.line, '함수')
    this.next() // 끝
    this.expectNewline("'끝'")
    return { kind: 'funcDef', name: nameTok.value, params, body, line: start.line }
  }

  private parseReturn(): Stmt {
    const start = this.next() // 반환
    let value: Expr | null = null
    if (!this.check('newline') && !this.check('eof')) {
      value = this.parseExpression()
    }
    this.expectNewline('반환')
    return { kind: 'return', value, line: start.line }
  }

  // ---- 표현식 (우선순위 낮은 것부터) ----

  private parseExpression(): Expr {
    return this.parseOr()
  }

  private parseOr(): Expr {
    let left = this.parseAnd()
    while (this.check('keyword', '또는')) {
      const t = this.next()
      const right = this.parseAnd()
      left = { kind: 'binary', op: '또는', left, right, line: t.line }
    }
    return left
  }

  private parseAnd(): Expr {
    let left = this.parseNot()
    while (this.check('keyword', '그리고')) {
      const t = this.next()
      const right = this.parseNot()
      left = { kind: 'binary', op: '그리고', left, right, line: t.line }
    }
    return left
  }

  private parseNot(): Expr {
    if (this.check('keyword', '아니다')) {
      const t = this.next()
      const operand = this.parseNot()
      return { kind: 'unary', op: '아니다', operand, line: t.line }
    }
    return this.parseComparison()
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive()
    while (this.check('op', '==') || this.check('op', '!=') || this.check('op', '<')
      || this.check('op', '<=') || this.check('op', '>') || this.check('op', '>=')) {
      const t = this.next()
      const right = this.parseAdditive()
      left = { kind: 'binary', op: t.value, left, right, line: t.line }
    }
    return left
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative()
    while (this.check('op', '+') || this.check('op', '-')) {
      const t = this.next()
      const right = this.parseMultiplicative()
      left = { kind: 'binary', op: t.value, left, right, line: t.line }
    }
    return left
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary()
    while (this.check('op', '*') || this.check('op', '/') || this.check('op', '%')) {
      const t = this.next()
      const right = this.parseUnary()
      left = { kind: 'binary', op: t.value, left, right, line: t.line }
    }
    return left
  }

  private parseUnary(): Expr {
    if (this.check('op', '-')) {
      const t = this.next()
      const operand = this.parseUnary()
      return { kind: 'unary', op: '-', operand, line: t.line }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary()
    while (true) {
      if (this.check('op', '(')) {
        const openTok = this.next()
        const args = this.parseArgs(openTok)
        expr = { kind: 'call', callee: expr, args, line: openTok.line }
      } else if (this.check('op', '[')) {
        const openTok = this.next()
        const index = this.parseExpression()
        if (!this.match('op', ']')) {
          throw this.unclosed(openTok, ']')
        }
        expr = { kind: 'index', obj: expr, index, line: openTok.line }
      } else if (this.check('op', '.')) {
        const t = this.next()
        const nameTok = this.peek()
        if (nameTok.type !== 'ident' && nameTok.type !== 'keyword') {
          throw new KidError("점(.) 뒤에는 명령 이름이 필요해요. 예: 캐릭터.앞으로(100)", t.line)
        }
        this.next()
        if (!this.check('op', '(')) {
          throw new KidError(`명령 뒤에는 괄호가 필요해요. 예: 캐릭터.${nameTok.raw}(100)`, nameTok.line)
        }
        const openTok = this.next()
        const args = this.parseArgs(openTok)
        expr = { kind: 'method', obj: expr, name: nameTok.value, args, line: t.line }
      } else {
        return expr
      }
    }
  }

  /** 여는 괄호를 이미 소비한 상태에서 인자 목록 + 닫는 괄호 */
  private parseArgs(openTok: Token): Expr[] {
    const args: Expr[] = []
    if (this.match('op', ')')) return args
    while (true) {
      if (this.check('newline') || this.check('eof')) throw this.unclosed(openTok, ')')
      args.push(this.parseExpression())
      if (this.match('op', ',')) continue
      if (this.match('op', ')')) return args
      throw this.unclosed(openTok, ')')
    }
  }

  private parsePrimary(): Expr {
    const t = this.peek()

    if (t.type === 'number') {
      this.next()
      return { kind: 'num', value: parseFloat(t.value), line: t.line }
    }
    if (t.type === 'string') {
      this.next()
      return { kind: 'str', value: t.value, line: t.line }
    }
    if (t.type === 'keyword' && (t.value === '참' || t.value === '거짓')) {
      this.next()
      return { kind: 'bool', value: t.value === '참', line: t.line }
    }
    if (t.type === 'ident') {
      this.next()
      return { kind: 'ident', name: t.value, raw: t.raw, line: t.line }
    }
    if (t.type === 'op' && t.value === '(') {
      const openTok = this.next()
      const expr = this.parseExpression()
      if (!this.match('op', ')')) {
        throw this.unclosed(openTok, ')')
      }
      return expr
    }
    if (t.type === 'op' && t.value === '[') {
      const openTok = this.next()
      const items: Expr[] = []
      if (!this.match('op', ']')) {
        while (true) {
          if (this.check('newline') || this.check('eof')) throw this.unclosed(openTok, ']')
          items.push(this.parseExpression())
          if (this.match('op', ',')) continue
          if (this.match('op', ']')) break
          throw this.unclosed(openTok, ']')
        }
      }
      return { kind: 'list', items, line: openTok.line }
    }

    this.unexpected(t)
  }
}
