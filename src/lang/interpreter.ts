import { KidError } from './errors'
import { resolveColor, COLOR_NAMES_HINT } from './colors'
import type { Stmt, Expr } from './ast'

// ---- 값 ----

export interface KidFunction {
  kind: 'function'
  name: string
  params: string[]
  body: Stmt[]
  closure: Env
}

export interface TurtleValue {
  kind: 'turtle'
}

export type Value = number | string | boolean | Value[] | KidFunction | TurtleValue | null

function isList(v: Value): v is Value[] {
  return Array.isArray(v)
}

function isTurtle(v: Value): v is TurtleValue {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && v.kind === 'turtle'
}

function isFunction(v: Value): v is KidFunction {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && v.kind === 'function'
}

/** 값을 아이에게 보여줄 문자열로 */
export function toDisplay(v: Value): string {
  if (v === null) return '없음'
  if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10)
  if (typeof v === 'boolean') return v ? '참' : '거짓'
  if (typeof v === 'string') return v
  if (isList(v)) return '[' + v.map(toDisplay).join(', ') + ']'
  if (isTurtle(v)) return '캐릭터'
  return `함수 ${v.name}`
}

function typeName(v: Value): string {
  if (v === null) return '없음'
  if (typeof v === 'number') return '숫자'
  if (typeof v === 'boolean') return '참/거짓'
  if (typeof v === 'string') return '글자'
  if (isList(v)) return '리스트'
  if (isTurtle(v)) return '캐릭터'
  return '함수'
}

// ---- 실행 결과로 쌓이는 효과 목록 ----

export type Effect =
  | { kind: 'print'; text: string; line: number }
  | { kind: 'move'; dist: number; line: number }
  | { kind: 'turn'; angle: number; line: number } // +: 오른쪽(시계방향)
  | { kind: 'color'; color: string; line: number }
  | { kind: 'pen'; down: boolean; line: number }
  | { kind: 'width'; width: number; line: number }
  | { kind: 'say'; text: string; line: number }

export interface RunResult {
  effects: Effect[]
}

// ---- 환경 (스코프) ----

class Env {
  private vars = new Map<string, Value>()
  private parent: Env | null

  constructor(parent: Env | null = null) {
    this.parent = parent
  }

  get(name: string, line: number): Value {
    let env: Env | null = this
    while (env) {
      if (env.vars.has(name)) return env.vars.get(name)!
      env = env.parent
    }
    throw new KidError(`'${name}'(이)라는 이름을 아직 안 만들었어요. 먼저 값을 정해 주세요. 예: ${name} = 10`, line)
  }

  /** 이미 있는 변수면 그 스코프에, 없으면 현재 스코프에 저장 */
  set(name: string, value: Value) {
    let env: Env | null = this
    while (env) {
      if (env.vars.has(name)) {
        env.vars.set(name, value)
        return
      }
      env = env.parent
    }
    this.vars.set(name, value)
  }

  declare(name: string, value: Value) {
    this.vars.set(name, value)
  }
}

// ---- 안전 한계 (무한루프/폭주 방지) ----

const MAX_STEPS = 200_000
const MAX_DRAW_EFFECTS = 5_000
const MAX_PRINTS = 1_000
const MAX_CALL_DEPTH = 200

class ReturnSignal {
  constructor(public value: Value) {}
}

// ---- 인터프리터 ----

export function run(program: Stmt[]): RunResult {
  const interp = new Interpreter()
  return interp.run(program)
}

class Interpreter {
  private effects: Effect[] = []
  private steps = 0
  private drawCount = 0
  private printCount = 0
  private callDepth = 0
  private globals = new Env()

  run(program: Stmt[]): RunResult {
    this.globals.declare('캐릭터', { kind: 'turtle' })
    this.execBlock(program, this.globals)
    return { effects: this.effects }
  }

  private tick(line: number) {
    this.steps++
    if (this.steps > MAX_STEPS) {
      throw new KidError(
        "코드가 멈추지 않아요! 반복이 끝없이 계속되는 것 같아요. '동안'의 조건이 언젠가 거짓이 되는지 확인해 보세요.",
        line,
      )
    }
  }

  private execBlock(stmts: Stmt[], env: Env) {
    for (const stmt of stmts) {
      this.execStmt(stmt, env)
    }
  }

  private execStmt(stmt: Stmt, env: Env) {
    this.tick(stmt.line)
    switch (stmt.kind) {
      case 'assign': {
        const value = this.evalExpr(stmt.value, env)
        if (stmt.target.kind === 'ident') {
          env.set(stmt.target.name, value)
        } else {
          const obj = this.evalExpr(stmt.target.obj, env)
          if (!isList(obj)) {
            throw new KidError(`${typeName(obj)}에는 [번호]로 값을 넣을 수 없어요. 리스트에만 넣을 수 있어요.`, stmt.line)
          }
          const idx = this.evalIndex(stmt.target.index, obj, env, stmt.line)
          obj[idx] = value
        }
        return
      }
      case 'exprStmt':
        this.evalExpr(stmt.expr, env)
        return
      case 'if': {
        for (const branch of stmt.branches) {
          if (this.evalCondition(branch.cond, env)) {
            this.execBlock(branch.body, env)
            return
          }
        }
        if (stmt.elseBody) this.execBlock(stmt.elseBody, env)
        return
      }
      case 'rangeFor': {
        const start = this.needNumber(this.evalExpr(stmt.start, env), stmt.line, "반복의 시작 값")
        const end = this.needNumber(this.evalExpr(stmt.end, env), stmt.line, "반복의 끝 값")
        for (let v = start; v <= end; v++) {
          this.tick(stmt.line)
          env.set(stmt.varName, v)
          this.execBlock(stmt.body, env)
        }
        return
      }
      case 'while': {
        while (this.evalCondition(stmt.cond, env)) {
          this.tick(stmt.line)
          this.execBlock(stmt.body, env)
        }
        return
      }
      case 'funcDef':
        env.set(stmt.name, {
          kind: 'function',
          name: stmt.name,
          params: stmt.params,
          body: stmt.body,
          closure: env,
        })
        return
      case 'return': {
        if (this.callDepth === 0) {
          throw new KidError("'반환'은 함수 안에서만 쓸 수 있어요.", stmt.line)
        }
        const value = stmt.value ? this.evalExpr(stmt.value, env) : null
        throw new ReturnSignal(value)
      }
    }
  }

  private evalCondition(expr: Expr, env: Env): boolean {
    const v = this.evalExpr(expr, env)
    if (typeof v !== 'boolean') {
      throw new KidError(
        `조건 자리에는 참이나 거짓이 와야 해요. 지금은 ${typeName(v)}(${toDisplay(v)})이/가 있어요. 예: 나이 >= 10`,
        expr.line,
      )
    }
    return v
  }

  private needNumber(v: Value, line: number, what: string): number {
    if (typeof v !== 'number') {
      throw new KidError(`${what}에는 숫자가 필요해요. 지금은 ${typeName(v)}이/가 있어요.`, line)
    }
    return v
  }

  private evalIndex(indexExpr: Expr, list: Value[], env: Env, line: number): number {
    const idx = this.evalExpr(indexExpr, env)
    if (typeof idx !== 'number' || !Number.isInteger(idx)) {
      throw new KidError('리스트의 칸 번호는 0, 1, 2 같은 숫자여야 해요.', line)
    }
    if (idx < 0 || idx >= list.length) {
      throw new KidError(
        `리스트에 ${idx}번 칸이 없어요. 칸은 0번부터 ${list.length - 1}번까지 있어요. (칸 수: ${list.length}개)`,
        line,
      )
    }
    return idx
  }

  private evalExpr(expr: Expr, env: Env): Value {
    switch (expr.kind) {
      case 'num': return expr.value
      case 'str': return expr.value
      case 'bool': return expr.value
      case 'list': return expr.items.map((item) => this.evalExpr(item, env))
      case 'ident': return env.get(expr.name, expr.line)
      case 'unary': {
        if (expr.op === '-') {
          const v = this.evalExpr(expr.operand, env)
          if (typeof v !== 'number') {
            throw new KidError(`빼기 기호(-)는 숫자 앞에만 쓸 수 있어요. 지금은 ${typeName(v)}이/가 있어요.`, expr.line)
          }
          return -v
        }
        // 아니다
        const v = this.evalExpr(expr.operand, env)
        if (typeof v !== 'boolean') {
          throw new KidError(`'아니다' 뒤에는 참이나 거짓이 와야 해요. 지금은 ${typeName(v)}이/가 있어요.`, expr.line)
        }
        return !v
      }
      case 'binary': return this.evalBinary(expr.op, expr.left, expr.right, env, expr.line)
      case 'index': {
        const obj = this.evalExpr(expr.obj, env)
        if (isList(obj)) {
          return obj[this.evalIndex(expr.index, obj, env, expr.line)]
        }
        if (typeof obj === 'string') {
          const chars = Array.from(obj)
          const idx = this.evalExpr(expr.index, env)
          if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= chars.length) {
            throw new KidError(`글자에서 ${toDisplay(idx)}번 칸을 찾을 수 없어요. 칸은 0번부터 ${chars.length - 1}번까지 있어요.`, expr.line)
          }
          return chars[idx]
        }
        throw new KidError(`${typeName(obj)}에는 [번호]를 쓸 수 없어요. 리스트나 글자에만 쓸 수 있어요.`, expr.line)
      }
      case 'call': return this.evalCall(expr.callee, expr.args, env, expr.line)
      case 'method': return this.evalMethod(expr, env)
    }
  }

  private evalBinary(op: string, leftExpr: Expr, rightExpr: Expr, env: Env, line: number): Value {
    // 그리고/또는은 왼쪽부터 차례로 (short-circuit)
    if (op === '그리고' || op === '또는') {
      const left = this.evalExpr(leftExpr, env)
      if (typeof left !== 'boolean') {
        throw new KidError(`'${op}' 양쪽에는 참이나 거짓이 와야 해요.`, line)
      }
      if (op === '그리고' && !left) return false
      if (op === '또는' && left) return true
      const right = this.evalExpr(rightExpr, env)
      if (typeof right !== 'boolean') {
        throw new KidError(`'${op}' 양쪽에는 참이나 거짓이 와야 해요.`, line)
      }
      return right
    }

    const left = this.evalExpr(leftExpr, env)
    const right = this.evalExpr(rightExpr, env)

    switch (op) {
      case '+': {
        if (typeof left === 'number' && typeof right === 'number') return left + right
        if (typeof left === 'string' && typeof right === 'string') return left + right
        if (isList(left) && isList(right)) return [...left, ...right]
        if ((typeof left === 'string' && typeof right === 'number') || (typeof left === 'number' && typeof right === 'string')) {
          throw new KidError(
            '숫자랑 글자를 같이 더하려고 했어요. 둘 다 숫자거나 둘 다 글자여야 해요. 출력에서는 쉼표로 나란히 쓸 수 있어요: 출력("나이:", 나이)',
            line,
          )
        }
        throw new KidError(`${typeName(left)}와(과) ${typeName(right)}은(는) 더할 수 없어요.`, line)
      }
      case '-': case '*': case '/': case '%': {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new KidError(
            `'${op}' 계산은 숫자끼리만 할 수 있어요. 지금은 ${typeName(left)}와(과) ${typeName(right)}이/가 있어요.`,
            line,
          )
        }
        if (op === '-') return left - right
        if (op === '*') return left * right
        if (right === 0) {
          throw new KidError('0으로 나눌 수는 없어요!', line)
        }
        return op === '/' ? left / right : left % right
      }
      case '==': return valuesEqual(left, right)
      case '!=': return !valuesEqual(left, right)
      case '<': case '<=': case '>': case '>=': {
        if (typeof left === 'number' && typeof right === 'number') {
          if (op === '<') return left < right
          if (op === '<=') return left <= right
          if (op === '>') return left > right
          return left >= right
        }
        if (typeof left === 'string' && typeof right === 'string') {
          if (op === '<') return left < right
          if (op === '<=') return left <= right
          if (op === '>') return left > right
          return left >= right
        }
        throw new KidError(
          `크기 비교(${op})는 숫자끼리(또는 글자끼리)만 할 수 있어요. 지금은 ${typeName(left)}와(과) ${typeName(right)}이/가 있어요.`,
          line,
        )
      }
    }
    throw new KidError(`'${op}' 계산을 할 수 없어요.`, line)
  }

  private evalCall(calleeExpr: Expr, argExprs: Expr[], env: Env, line: number): Value {
    // 내장 함수
    if (calleeExpr.kind === 'ident') {
      const builtin = BUILTINS[calleeExpr.name]
      if (builtin) {
        const args = argExprs.map((a) => this.evalExpr(a, env))
        return builtin(this, args, line)
      }
    }

    const callee = this.evalExpr(calleeExpr, env)
    if (!isFunction(callee)) {
      const name = calleeExpr.kind === 'ident' ? `'${calleeExpr.name}'` : `${typeName(callee)}`
      throw new KidError(`${name}은(는) 함수가 아니라서 부를 수 없어요.`, line)
    }
    if (argExprs.length !== callee.params.length) {
      throw new KidError(
        `함수 '${callee.name}'에는 값이 ${callee.params.length}개 필요해요. 지금은 ${argExprs.length}개를 줬어요.`,
        line,
      )
    }
    const args = argExprs.map((a) => this.evalExpr(a, env))

    this.callDepth++
    if (this.callDepth > MAX_CALL_DEPTH) {
      this.callDepth--
      throw new KidError(`함수 '${callee.name}'이(가) 자기 자신을 너무 많이 불러서 멈췄어요. 멈추는 조건이 있는지 확인해 보세요.`, line)
    }
    try {
      const funcEnv = new Env(callee.closure)
      callee.params.forEach((p, i) => funcEnv.declare(p, args[i]))
      this.execBlock(callee.body, funcEnv)
      return null
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value
      throw e
    } finally {
      this.callDepth--
    }
  }

  private evalMethod(expr: Extract<Expr, { kind: 'method' }>, env: Env): Value {
    const obj = this.evalExpr(expr.obj, env)
    if (!isTurtle(obj)) {
      throw new KidError(`${typeName(obj)}에는 점(.) 명령을 쓸 수 없어요. 점 명령은 캐릭터에게만 쓸 수 있어요.`, expr.line)
    }
    const args = expr.args.map((a) => this.evalExpr(a, env))
    const line = expr.line

    const needOneNumber = (methodName: string, example: string): number => {
      if (args.length !== 1 || typeof args[0] !== 'number') {
        throw new KidError(`캐릭터.${methodName}( )에는 숫자 1개가 필요해요. 예: 캐릭터.${methodName}(${example})`, line)
      }
      return args[0]
    }
    const needNoArgs = (methodName: string) => {
      if (args.length !== 0) {
        throw new KidError(`캐릭터.${methodName}( )는 괄호를 비워 두고 써요. 예: 캐릭터.${methodName}()`, line)
      }
    }

    switch (expr.name) {
      case '앞으로':
        this.pushDraw({ kind: 'move', dist: needOneNumber('앞으로', '100'), line })
        return null
      case '뒤로':
        this.pushDraw({ kind: 'move', dist: -needOneNumber('뒤로', '50'), line })
        return null
      case '오른쪽':
        this.pushDraw({ kind: 'turn', angle: needOneNumber('오른쪽', '90'), line })
        return null
      case '왼쪽':
        this.pushDraw({ kind: 'turn', angle: -needOneNumber('왼쪽', '90'), line })
        return null
      case '색깔': {
        if (args.length !== 1 || typeof args[0] !== 'string') {
          throw new KidError('캐릭터.색깔( )에는 색 이름을 따옴표와 함께 써 주세요. 예: 캐릭터.색깔("빨강")', line)
        }
        const css = resolveColor(args[0])
        if (!css) {
          throw new KidError(`'${args[0]}'은(는) 모르는 색깔이에요. 이런 색을 쓸 수 있어요: ${COLOR_NAMES_HINT}`, line)
        }
        this.pushDraw({ kind: 'color', color: css, line })
        return null
      }
      case '펜올리기':
        needNoArgs('펜올리기')
        this.pushDraw({ kind: 'pen', down: false, line })
        return null
      case '펜내리기':
        needNoArgs('펜내리기')
        this.pushDraw({ kind: 'pen', down: true, line })
        return null
      case '굵기': {
        const w = needOneNumber('굵기', '5')
        this.pushDraw({ kind: 'width', width: Math.max(1, Math.min(40, w)), line })
        return null
      }
      case '말하기': {
        if (args.length !== 1) {
          throw new KidError('캐릭터.말하기( )에는 보여줄 말 1개가 필요해요. 예: 캐릭터.말하기("안녕!")', line)
        }
        this.pushDraw({ kind: 'say', text: toDisplay(args[0]), line })
        return null
      }
      default:
        throw new KidError(
          `캐릭터는 '${expr.name}'(이)라는 명령을 몰라요. 캐릭터가 아는 명령: 앞으로, 뒤로, 오른쪽, 왼쪽, 색깔, 펜올리기, 펜내리기, 굵기, 말하기`,
          line,
        )
    }
  }

  private pushDraw(effect: Effect) {
    this.drawCount++
    if (this.drawCount > MAX_DRAW_EFFECTS) {
      throw new KidError('그리기 명령이 너무 많아요! 반복 횟수를 조금 줄여 볼까요?', effect.line)
    }
    this.effects.push(effect)
  }

  pushPrint(text: string, line: number) {
    this.printCount++
    if (this.printCount > MAX_PRINTS) {
      throw new KidError('출력이 너무 많아요! 반복 횟수를 조금 줄여 볼까요?', line)
    }
    this.effects.push({ kind: 'print', text, line })
  }
}

function valuesEqual(a: Value, b: Value): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => valuesEqual(v, b[i]))
  }
  return a === b
}

// ---- 내장 함수 ----

type Builtin = (interp: Interpreter, args: Value[], line: number) => Value

const BUILTINS: Record<string, Builtin> = {
  '출력': (interp, args, line) => {
    interp.pushPrint(args.map(toDisplay).join(' '), line)
    return null
  },
  '길이': (_interp, args, line) => {
    if (args.length !== 1) {
      throw new KidError('길이( )에는 리스트나 글자 1개를 넣어 주세요. 예: 길이(숫자들)', line)
    }
    const v = args[0]
    if (isList(v)) return v.length
    if (typeof v === 'string') return Array.from(v).length
    throw new KidError(`길이( )는 리스트나 글자에만 쓸 수 있어요. 지금은 ${typeName(v)}을(를) 넣었어요.`, line)
  },
  '추가': (_interp, args, line) => {
    if (args.length !== 2 || !isList(args[0])) {
      throw new KidError('추가( )는 이렇게 써요: 추가(리스트, 넣을값)', line)
    }
    args[0].push(args[1])
    return null
  },
  '무작위': (_interp, args, line) => {
    if (args.length !== 2 || typeof args[0] !== 'number' || typeof args[1] !== 'number') {
      throw new KidError('무작위( )에는 숫자 2개가 필요해요. 예: 무작위(1, 10)', line)
    }
    const lo = Math.ceil(Math.min(args[0], args[1]))
    const hi = Math.floor(Math.max(args[0], args[1]))
    return lo + Math.floor(Math.random() * (hi - lo + 1))
  },
  '반올림': (_interp, args, line) => {
    if (args.length !== 1 || typeof args[0] !== 'number') {
      throw new KidError('반올림( )에는 숫자 1개가 필요해요. 예: 반올림(3.7)', line)
    }
    return Math.round(args[0])
  },
}

export const BUILTIN_NAMES = Object.keys(BUILTINS)
