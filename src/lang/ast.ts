// 한글랭 AST 노드 정의. line은 1부터 시작하는 소스 줄 번호.

export type Stmt =
  | AssignStmt
  | ExprStmt
  | IfStmt
  | RangeForStmt
  | WhileStmt
  | FuncDefStmt
  | ReturnStmt

export type Expr =
  | NumLit
  | StrLit
  | BoolLit
  | ListLit
  | Ident
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MethodCallExpr
  | IndexExpr

export interface AssignStmt {
  kind: 'assign'
  target: Ident | IndexExpr
  value: Expr
  line: number
}

export interface ExprStmt {
  kind: 'exprStmt'
  expr: Expr
  line: number
}

export interface IfStmt {
  kind: 'if'
  branches: { cond: Expr; body: Stmt[] }[]
  elseBody: Stmt[] | null
  line: number
}

export interface RangeForStmt {
  kind: 'rangeFor'
  varName: string
  start: Expr
  end: Expr
  body: Stmt[]
  line: number
}

export interface WhileStmt {
  kind: 'while'
  cond: Expr
  body: Stmt[]
  line: number
}

export interface FuncDefStmt {
  kind: 'funcDef'
  name: string
  params: string[]
  body: Stmt[]
  line: number
}

export interface ReturnStmt {
  kind: 'return'
  value: Expr | null
  line: number
}

export interface NumLit {
  kind: 'num'
  value: number
  line: number
}

export interface StrLit {
  kind: 'str'
  value: string
  line: number
}

export interface BoolLit {
  kind: 'bool'
  value: boolean
  line: number
}

export interface ListLit {
  kind: 'list'
  items: Expr[]
  line: number
}

export interface Ident {
  kind: 'ident'
  /** 처리에 쓰는 이름 (영어로 썼으면 한글로 정규화된 이름) */
  name: string
  /** 아이가 실제로 친 글자 — 에러 메시지에 그대로 보여 준다 */
  raw: string
  line: number
}

export interface BinaryExpr {
  kind: 'binary'
  op: string // + - * / % == != < <= > >= 그리고 또는
  left: Expr
  right: Expr
  line: number
}

export interface UnaryExpr {
  kind: 'unary'
  op: '-' | '아니다'
  operand: Expr
  line: number
}

export interface CallExpr {
  kind: 'call'
  callee: Expr
  args: Expr[]
  line: number
}

export interface MethodCallExpr {
  kind: 'method'
  obj: Expr
  name: string
  args: Expr[]
  line: number
}

export interface IndexExpr {
  kind: 'index'
  obj: Expr
  index: Expr
  line: number
}
