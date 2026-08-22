import { KidError } from './errors'
import { tokenize, type Token } from './lexer'
import type {
  Stmt, Expr, Ident, IndexExpr,
} from './ast'

export function parse(src: string): Stmt[] {
  return new Parser(tokenize(src)).parseProgram()
}

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]
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

  private expectNewline(context: string) {
    if (!this.match('newline') && !this.check('eof')) {
      throw new KidError(`${context} 다음에는 줄을 바꿔 주세요.`, this.peek().line)
    }
  }

  private unexpected(t: Token): never {
    if (t.type === 'eof') {
      throw new KidError('코드가 갑자기 끝났어요. 빠진 부분이 없는지 확인해 보세요.', this.lastLine())
    }
    if (t.type === 'newline') {
      throw new KidError('줄이 갑자기 끝났어요. 빠진 부분이 없는지 확인해 보세요.', t.line)
    }
    throw new KidError(`'${t.value}' 부분을 이해하지 못했어요. 앞뒤를 다시 확인해 보세요.`, t.line)
  }

  private lastLine(): number {
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      if (this.tokens[i].type !== 'eof') return this.tokens[i].line
    }
    return 1
  }

  parseProgram(): Stmt[] {
    const body: Stmt[] = []
    this.skipNewlines()
    while (!this.check('eof')) {
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
      const t = this.peek()
      if (t.type === 'keyword' && endWords.includes(t.value)) return body
      body.push(this.parseStatement())
      this.skipNewlines()
    }
  }

  private parseStatement(): Stmt {
    const t = this.peek()

    if (t.type === 'keyword') {
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

  private parseIf(): Stmt {
    const start = this.next() // 만약
    const branches: { cond: Expr; body: Stmt[] }[] = []

    const cond = this.parseExpression()
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
    if (!this.match('op', '(')) {
      throw new KidError(`함수 이름 뒤에는 괄호가 필요해요. 예: 함수 ${nameTok.value}(a, b)`, start.line)
    }
    const params: string[] = []
    if (!this.check('op', ')')) {
      while (true) {
        const p = this.peek()
        if (p.type !== 'ident') {
          throw new KidError('함수 괄호 안에는 이름만 쓸 수 있어요. 예: 함수 더하기(a, b)', p.line)
        }
        this.next()
        params.push(p.value)
        if (this.match('op', ',')) continue
        break
      }
    }
    if (!this.match('op', ')')) {
      throw new KidError("괄호 ')'를 닫지 않았어요.", this.peek().line)
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
        const t = this.next()
        const args = this.parseArgs()
        expr = { kind: 'call', callee: expr, args, line: t.line }
      } else if (this.check('op', '[')) {
        const t = this.next()
        const index = this.parseExpression()
        if (!this.match('op', ']')) {
          throw new KidError("대괄호 ']'를 닫지 않았어요.", t.line)
        }
        expr = { kind: 'index', obj: expr, index, line: t.line }
      } else if (this.check('op', '.')) {
        const t = this.next()
        const nameTok = this.peek()
        if (nameTok.type !== 'ident' && nameTok.type !== 'keyword') {
          throw new KidError("점(.) 뒤에는 명령 이름이 필요해요. 예: 캐릭터.앞으로(100)", t.line)
        }
        this.next()
        if (!this.match('op', '(')) {
          throw new KidError(`명령 뒤에는 괄호가 필요해요. 예: 캐릭터.${nameTok.value}(100)`, nameTok.line)
        }
        const args = this.parseArgs()
        expr = { kind: 'method', obj: expr, name: nameTok.value, args, line: t.line }
      } else {
        return expr
      }
    }
  }

  /** 여는 괄호를 이미 소비한 상태에서 인자 목록 + 닫는 괄호 */
  private parseArgs(): Expr[] {
    const args: Expr[] = []
    if (this.match('op', ')')) return args
    while (true) {
      args.push(this.parseExpression())
      if (this.match('op', ',')) continue
      if (this.match('op', ')')) return args
      throw new KidError("괄호 ')'를 닫지 않았어요. 값 사이에는 쉼표(,)를 써 주세요.", this.peek().line)
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
      return { kind: 'ident', name: t.value, line: t.line }
    }
    if (t.type === 'op' && t.value === '(') {
      this.next()
      const expr = this.parseExpression()
      if (!this.match('op', ')')) {
        throw new KidError("괄호 ')'를 닫지 않았어요.", t.line)
      }
      return expr
    }
    if (t.type === 'op' && t.value === '[') {
      this.next()
      const items: Expr[] = []
      if (!this.match('op', ']')) {
        while (true) {
          items.push(this.parseExpression())
          if (this.match('op', ',')) continue
          if (this.match('op', ']')) break
          throw new KidError("대괄호 ']'를 닫지 않았어요. 값 사이에는 쉼표(,)를 써 주세요.", this.peek().line)
        }
      }
      return { kind: 'list', items, line: t.line }
    }

    this.unexpected(t)
  }
}
