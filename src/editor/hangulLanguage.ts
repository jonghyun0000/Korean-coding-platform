import {
  StreamLanguage, LanguageSupport, HighlightStyle, syntaxHighlighting,
  indentService, indentUnit, type StreamParser,
} from '@codemirror/language'
import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { KEYWORDS } from '../lang/lexer'
import { BUILTIN_NAMES } from '../lang/interpreter'
import { EN_TO_KO, KO_TO_EN, PYTHON_NOTE } from '../lang/aliases'
import { EMOJI } from '../ui/emoji'

const IDENT_RE = /^[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_][A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]*/
const BUILTINS = new Set(BUILTIN_NAMES)

const streamParser: StreamParser<unknown> = {
  name: 'hangul',
  token(stream): string | null {
    if (stream.eatSpace()) return null
    if (stream.match(/^#.*/)) return 'comment'
    if (stream.match(/^"([^"\\]|\\.)*"?/) || stream.match(/^'([^'\\]|\\.)*'?/)) return 'string'
    if (stream.match(/^\d+(\.\d+)?/)) return 'number'
    if (stream.match(IDENT_RE)) {
      const raw = stream.current()
      if (raw === 'elif') return 'keyword'
      const word = EN_TO_KO[raw] ?? raw
      if (word === '참' || word === '거짓') return 'atom'
      if (KEYWORDS.has(word)) return 'keyword'
      if (word === '캐릭터') return 'typeName'
      if (BUILTINS.has(word)) return 'builtin'
      return 'variableName'
    }
    if (stream.match(/^(==|!=|<=|>=|[+\-*/%<>=])/)) return 'operator'
    if (stream.match(/^[()[\],.]/)) return 'bracket'
    stream.next()
    return null
  },
  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['(', '[', '"', "'"] },
    // 이 말들을 치는 순간 줄을 한 단계 밖으로 다시 맞춰 준다
    indentOnInput: /^\s*(끝|아니면|end|else|elif)$/,
  },
}

/** 블록을 여는 줄인지 (다음 줄 들여쓰기 +1) */
function opensBlock(lineText: string): boolean {
  const t = lineText.replace(/#.*$/, '').trim()
  if (/(이면|아니면|then|else)$/.test(t)) return true
  if (/^(반복|동안|함수|for|repeat|while|def|function)(\s|\()/.test(t)) return true
  return false
}

/** 한 단계 밖으로 나가야 하는 줄인지 */
function closesBlock(lineText: string): boolean {
  return /^\s*(끝|아니면|end|else|elif)\b/.test(lineText) || /^\s*(끝|아니면|end|else|elif)\s*$/.test(lineText)
}

/**
 * 들여쓰기 계산.
 * Enter를 누르면 CodeMirror가 '여기서 줄이 나뉜다'(simulatedBreak)고 알려 주므로,
 * 커서 앞부분을 이전 줄, 뒷부분을 새 줄로 보고 계산한다.
 */
const hangulIndent = indentService.of((context, pos) => {
  const unit = context.unit || 4
  let prevText: string
  let currentText: string

  if (context.simulatedBreak != null) {
    prevText = context.lineAt(pos, -1).text
    currentText = context.lineAt(pos, 1).text
  } else {
    const line = context.lineAt(pos, 1)
    currentText = line.text
    prevText = line.from > 0 ? context.state.doc.lineAt(line.from - 1).text : ''
  }

  const prevIndent = /^\s*/.exec(prevText)![0].length
  let indent = prevIndent
  if (opensBlock(prevText)) indent += unit
  if (closesBlock(currentText)) indent = Math.max(0, indent - unit)
  return indent
})

export const hangulHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#6d28d9', fontWeight: 'bold' },
  { tag: tags.atom, color: '#0e7490', fontWeight: 'bold' },
  { tag: tags.string, color: '#15803d' },
  { tag: tags.number, color: '#c2410c' },
  // 시작 코드의 안내문이 주석이라 또렷하게 (기울임 없이)
  { tag: tags.comment, color: '#64748b' },
  { tag: tags.typeName, color: '#be185d', fontWeight: 'bold' },
  { tag: tags.standard(tags.variableName), color: '#1d4ed8' },
  { tag: tags.operator, color: '#475569' },
])

// ---- 한↔영 단어 짝 호버 툴팁 ----

const WORD_CHAR = /[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]/

/** 그 자리가 문자열 안이거나 주석 안인지 */
function inStringOrComment(text: string, offset: number): boolean {
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '#') return offset >= i
    if (ch === '"' || ch === "'") {
      const start = i
      const quote = ch
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      if (offset >= start && offset <= i) return true
      i++
      continue
    }
    i++
  }
  return false
}

const keywordHover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos)
  if (inStringOrComment(line.text, pos - line.from)) return null

  let start = pos
  let end = pos
  while (start > line.from && WORD_CHAR.test(view.state.doc.sliceString(start - 1, start))) start--
  while (end < line.to && WORD_CHAR.test(view.state.doc.sliceString(end, end + 1))) end++
  if (start === end) return null

  const word = view.state.doc.sliceString(start, end)
  // 아이가 직접 만든 이름이면 키워드 설명을 띄우지 않는다
  if (userDefinedNames(view.state).has(word)) return null

  let main: string | null = null
  let sub: string | null = null

  if (KO_TO_EN[word]) {
    const en = KO_TO_EN[word]
    main = `${word} = ${en}`
    sub = PYTHON_NOTE[word] ?? `영어로는 ${en} 이라고 써요. 그대로 써도 실행돼요!`
  } else if (word === 'elif') {
    main = 'elif = 아니면 만약'
    sub = '한글랭에서는 "아니면 만약" 이라고 써요'
  } else if (EN_TO_KO[word]) {
    const ko = EN_TO_KO[word]
    main = `${word} = ${ko}`
    sub = PYTHON_NOTE[ko] ?? `한글랭에서는 ${ko} 라고 써요`
  }
  if (!main) return null

  const title = main
  const desc = sub ?? ''
  return {
    pos: start,
    end,
    above: true,
    create() {
      const dom = document.createElement('div')
      dom.className = 'cm-word-bridge'
      const titleEl = document.createElement('div')
      titleEl.className = 'cm-word-bridge-title'
      const icon = document.createElement('img')
      icon.src = EMOJI.abc
      icon.width = 16
      icon.height = 16
      icon.alt = ''
      icon.style.verticalAlign = '-0.18em'
      icon.style.marginRight = '6px'
      titleEl.append(icon, document.createTextNode(title))
      const descEl = document.createElement('div')
      descEl.className = 'cm-word-bridge-desc'
      descEl.textContent = desc
      dom.append(titleEl, descEl)
      return { dom }
    },
  }
})

// ---- 자동완성 ----

const STATIC_COMPLETIONS: Completion[] = [
  snippetCompletion('출력(${})', { label: '출력', detail: '화면에 글자 보여주기', type: 'function' }),
  snippetCompletion('만약 ${조건} 이면\n    ${}\n끝', { label: '만약', detail: '조건에 따라 실행', type: 'keyword' }),
  snippetCompletion('만약 ${조건} 이면\n    ${}\n아니면\n    ${}\n끝', {
    label: '만약',
    displayLabel: '만약 ~ 아니면',
    detail: '조건 + 아니면',
    type: 'keyword',
  }),
  snippetCompletion('반복 i = 1 부터 5\n    ${}\n끝', { label: '반복', detail: '정해진 횟수만큼 반복', type: 'keyword' }),
  snippetCompletion('동안 ${조건}\n    ${}\n끝', { label: '동안', detail: '조건이 참인 동안 반복', type: 'keyword' }),
  snippetCompletion('함수 ${이름}(${})\n    ${}\n끝', { label: '함수', detail: '나만의 명령 만들기', type: 'keyword' }),
  snippetCompletion('캐릭터.앞으로(100)', { label: '캐릭터.앞으로', detail: '앞으로 이동하며 그리기', type: 'method' }),
  snippetCompletion('캐릭터.뒤로(50)', { label: '캐릭터.뒤로', detail: '뒤로 이동', type: 'method' }),
  snippetCompletion('캐릭터.오른쪽(90)', { label: '캐릭터.오른쪽', detail: '오른쪽으로 돌기', type: 'method' }),
  snippetCompletion('캐릭터.왼쪽(90)', { label: '캐릭터.왼쪽', detail: '왼쪽으로 돌기', type: 'method' }),
  snippetCompletion('캐릭터.색깔("${빨강}")', { label: '캐릭터.색깔', detail: '펜 색 바꾸기', type: 'method' }),
  snippetCompletion('캐릭터.펜올리기()', { label: '캐릭터.펜올리기', detail: '그리지 않고 이동', type: 'method' }),
  snippetCompletion('캐릭터.펜내리기()', { label: '캐릭터.펜내리기', detail: '다시 그리며 이동', type: 'method' }),
  snippetCompletion('캐릭터.굵기(5)', { label: '캐릭터.굵기', detail: '선 굵기 바꾸기', type: 'method' }),
  snippetCompletion('캐릭터.말하기("${안녕!}")', { label: '캐릭터.말하기', detail: '말풍선 보여주기', type: 'method' }),
  snippetCompletion('길이(${})', { label: '길이', detail: '리스트/글자의 길이', type: 'function' }),
  snippetCompletion('추가(${리스트}, ${값})', { label: '추가', detail: '리스트 끝에 값 넣기', type: 'function' }),
  snippetCompletion('무작위(1, 10)', { label: '무작위', detail: '두 수 사이 아무 숫자', type: 'function' }),
  snippetCompletion('입력("${이름이 뭐예요?}")', { label: '입력', detail: '물어보고 답을 글자로 받기', type: 'function' }),
  snippetCompletion('숫자입력("${몇 살이에요?}")', { label: '숫자입력', detail: '물어보고 답을 숫자로 받기', type: 'function' }),
  { label: '끝', type: 'keyword', detail: '블록 닫기 (end)' },
  { label: '이면', type: 'keyword', detail: '조건 뒤에 (then)' },
  { label: '아니면', type: 'keyword', detail: '조건이 거짓일 때 (else)' },
  { label: '부터', type: 'keyword', detail: '반복 범위 (to)' },
  { label: '그리고', type: 'keyword', detail: '둘 다 참일 때 (and)' },
  { label: '또는', type: 'keyword', detail: '하나라도 참일 때 (or)' },
  { label: '아니다', type: 'keyword', detail: '반대로 (not)' },
  { label: '참', type: 'keyword', detail: 'true' },
  { label: '거짓', type: 'keyword', detail: 'false' },
  { label: '반환', type: 'keyword', detail: '함수의 결과 돌려주기 (return)' },
  // 영어 단어로도 그대로 쓸 수 있어요
  snippetCompletion('print(${})', { label: 'print', detail: '= 출력', type: 'function' }),
  snippetCompletion('input("${이름이 뭐예요?}")', { label: 'input', detail: '= 입력', type: 'function' }),
  snippetCompletion('if ${조건} then\n    ${}\nend', { label: 'if', detail: '= 만약', type: 'keyword' }),
  snippetCompletion('for i = 1 to 5\n    ${}\nend', { label: 'for', detail: '= 반복', type: 'keyword' }),
  snippetCompletion('while ${조건}\n    ${}\nend', { label: 'while', detail: '= 동안', type: 'keyword' }),
  snippetCompletion('def ${이름}(${})\n    ${}\nend', { label: 'def', detail: '= 함수', type: 'keyword' }),
  snippetCompletion('turtle.forward(100)', { label: 'turtle.forward', detail: '= 캐릭터.앞으로', type: 'method' }),
  snippetCompletion('turtle.right(90)', { label: 'turtle.right', detail: '= 캐릭터.오른쪽', type: 'method' }),
  snippetCompletion('turtle.color("${red}")', { label: 'turtle.color', detail: '= 캐릭터.색깔', type: 'method' }),
]

/** 캐릭터. / turtle. 점을 찍으면 나오는 멤버 명령 목록 */
const TURTLE_MEMBERS: Completion[] = [
  snippetCompletion('앞으로(100)', { label: '앞으로', detail: 'forward', type: 'method', boost: 9, info: '앞으로 걸으며 선을 그려요. 괄호 안은 걸어갈 거리!' }),
  snippetCompletion('오른쪽(90)', { label: '오른쪽', detail: 'right', type: 'method', boost: 9, info: '제자리에서 오른쪽(시계방향)으로 돌아요. 괄호 안은 각도!' }),
  snippetCompletion('왼쪽(90)', { label: '왼쪽', detail: 'left', type: 'method', boost: 8, info: '제자리에서 왼쪽으로 돌아요.' }),
  snippetCompletion('뒤로(50)', { label: '뒤로', detail: 'back', type: 'method', boost: 8, info: '뒤로 걸어요. 바라보는 방향은 그대로!' }),
  snippetCompletion('색깔("${빨강}")', { label: '색깔', detail: 'color', type: 'method', boost: 7, info: '펜 색을 바꿔요. 빨강, 주황, 노랑, 초록, 파랑, 보라, 분홍, 검정… (red, blue 처럼 영어로도 돼요)' }),
  snippetCompletion('굵기(5)', { label: '굵기', detail: 'width', type: 'method', boost: 6, info: '선의 두께를 바꿔요. 1(얇게) ~ 40(두껍게)' }),
  snippetCompletion('말하기("${안녕!}")', { label: '말하기', detail: 'say', type: 'method', boost: 6, info: '거북이 머리 위에 말풍선을 띄워요.' }),
  snippetCompletion('펜올리기()', { label: '펜올리기', detail: 'penup', type: 'method', boost: 5, info: '펜을 들어요. 이동해도 선이 안 그려져요.' }),
  snippetCompletion('펜내리기()', { label: '펜내리기', detail: 'pendown', type: 'method', boost: 5, info: '펜을 다시 내려요. 이동하면 선이 그려져요.' }),
  snippetCompletion('원(${50})', { label: '원', detail: 'circle', type: 'method', boost: 8, info: '지금 자리를 가운데로 하는 동그라미를 그려요. 괄호 안은 반지름!' }),
  snippetCompletion('이동(${100}, ${50})', { label: '이동', detail: 'goto', type: 'method', boost: 7, info: '정해진 자리로 갑니다. 오른쪽이 x+, 위쪽이 y+ (수학이랑 같아요)' }),
  snippetCompletion('집으로()', { label: '집으로', detail: 'home', type: 'method', boost: 7, info: '가운데(0, 0)로 돌아가 위쪽을 봐요. 거북이를 잃어버렸을 때!' }),
  snippetCompletion('방향(${90})', { label: '방향', detail: 'setheading', type: 'method', boost: 5, info: '바라보는 방향을 정해요. 0=위, 90=오른쪽, 180=아래, 270=왼쪽' }),
  snippetCompletion('점찍기(${20})', { label: '점찍기', detail: 'dot', type: 'method', boost: 5, info: '지금 자리에 동그란 점을 찍어요.' }),
  snippetCompletion('채우기시작()', { label: '채우기시작', detail: 'begin_fill', type: 'method', boost: 5, info: '여기부터 그린 도형 안쪽을 색으로 채울 준비를 해요.' }),
  snippetCompletion('채우기끝()', { label: '채우기끝', detail: 'end_fill', type: 'method', boost: 5, info: '채우기시작() 이후에 그린 도형 안쪽을 색으로 채워요.' }),
  snippetCompletion('글쓰기("${안녕}")', { label: '글쓰기', detail: 'write', type: 'method', boost: 4, info: '그림판에 글자를 써요 (말풍선이 아니라 그림으로 남아요).' }),
  snippetCompletion('숨기기()', { label: '숨기기', detail: 'hideturtle', type: 'method', boost: 3, info: '거북이를 안 보이게 해요. 그림만 깔끔하게 보고 싶을 때!' }),
  snippetCompletion('보이기()', { label: '보이기', detail: 'showturtle', type: 'method', boost: 3, info: '거북이를 다시 보이게 해요.' }),
  snippetCompletion('지우기()', { label: '지우기', detail: 'clear', type: 'method', boost: 3, info: '그린 그림을 모두 지워요. 거북이는 그 자리에 있어요.' }),
  // 영어 이름으로도 쓸 수 있어요
  snippetCompletion('forward(100)', { label: 'forward', detail: '= 앞으로', type: 'method' }),
  snippetCompletion('back(50)', { label: 'back', detail: '= 뒤로', type: 'method' }),
  snippetCompletion('right(90)', { label: 'right', detail: '= 오른쪽', type: 'method' }),
  snippetCompletion('left(90)', { label: 'left', detail: '= 왼쪽', type: 'method' }),
  snippetCompletion('color("${red}")', { label: 'color', detail: '= 색깔', type: 'method' }),
  snippetCompletion('width(5)', { label: 'width', detail: '= 굵기', type: 'method' }),
  snippetCompletion('say("${안녕!}")', { label: 'say', detail: '= 말하기', type: 'method' }),
  snippetCompletion('penup()', { label: 'penup', detail: '= 펜올리기', type: 'method' }),
  snippetCompletion('pendown()', { label: 'pendown', detail: '= 펜내리기', type: 'method' }),
  snippetCompletion('circle(${50})', { label: 'circle', detail: '= 원', type: 'method' }),
  snippetCompletion('goto(${100}, ${50})', { label: 'goto', detail: '= 이동', type: 'method' }),
  snippetCompletion('home()', { label: 'home', detail: '= 집으로', type: 'method' }),
  snippetCompletion('dot(${20})', { label: 'dot', detail: '= 점찍기', type: 'method' }),
  snippetCompletion('write("${안녕}")', { label: 'write', detail: '= 글쓰기', type: 'method' }),
]

/** 자동완성에서 제외할 예약어들 */
const RESERVED = new Set<string>([...KEYWORDS, ...BUILTIN_NAMES, ...Object.keys(EN_TO_KO), '캐릭터', 'elif'])

const IDENT_SRC = '[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_][A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]*'
const FUNC_DEF_RE = new RegExp(`(?:함수|def|function)\\s+(${IDENT_SRC})`, 'g')
const ASSIGN_RE = new RegExp(`(?:^|\\n)\\s*(${IDENT_SRC})\\s*=(?!=)`, 'g')
const LOOP_VAR_RE = new RegExp(`(?:반복|for|repeat)\\s+(${IDENT_SRC})\\s*=`, 'g')

/** 주석과 문자열을 지운 코드 (이름을 잘못 주워 담지 않도록) */
function stripCommentsAndStrings(text: string): string {
  return text
    .replace(/"([^"\\]|\\.)*"?/g, '""')
    .replace(/'([^'\\]|\\.)*'?/g, "''")
    .replace(/#[^\n]*/g, '')
}

/** 코드에서 아이가 직접 만든 변수/함수 이름 */
function collectNames(state: EditorState): Map<string, 'function' | 'variable'> {
  const text = stripCommentsAndStrings(state.doc.sliceString(0, Math.min(state.doc.length, 20000)))
  const found = new Map<string, 'function' | 'variable'>()
  let m: RegExpExecArray | null
  FUNC_DEF_RE.lastIndex = 0
  ASSIGN_RE.lastIndex = 0
  LOOP_VAR_RE.lastIndex = 0
  while ((m = FUNC_DEF_RE.exec(text))) if (!RESERVED.has(m[1])) found.set(m[1], 'function')
  while ((m = ASSIGN_RE.exec(text))) if (!RESERVED.has(m[1]) && !found.has(m[1])) found.set(m[1], 'variable')
  while ((m = LOOP_VAR_RE.exec(text))) if (!RESERVED.has(m[1]) && !found.has(m[1])) found.set(m[1], 'variable')
  return found
}

function userDefinedNames(state: EditorState): Set<string> {
  return new Set(collectNames(state).keys())
}

function docIdentifiers(state: EditorState): Completion[] {
  const options: Completion[] = []
  for (const [name, type] of collectNames(state)) {
    options.push({
      label: name,
      type,
      detail: type === 'function' ? '내가 만든 함수' : '내가 만든 변수',
      boost: 10,
    })
  }
  return options
}

/**
 * VS Code처럼 동작하는 자동완성 소스.
 * 이미 다 친 단어와 똑같은 '그냥 단어' 후보는 빼서, Enter가 먹히지 않도록 한다.
 */
function hangulCompletionSource(context: CompletionContext): CompletionResult | null {
  // 1) 캐릭터./turtle. 멤버 완성
  const member = context.matchBefore(/(?:캐릭터|turtle)\s*\.\s*[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]*$/)
  if (member) {
    const dot = member.text.lastIndexOf('.')
    const typed = member.text.slice(dot + 1).trimStart()
    const from = member.to - typed.length
    return {
      from,
      options: TURTLE_MEMBERS.filter((o) => !(o.label === typed && !o.apply)),
      validFor: /^[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]*$/,
    }
  }

  // 2) 일반 단어 완성 (키워드/명령 + 내가 만든 이름)
  const word = context.matchBefore(/[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_][A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]*$/)
  if (!word && !context.explicit) return null
  const typed = word ? word.text : ''
  const options = [...STATIC_COMPLETIONS, ...docIdentifiers(context.state)]
    .filter((o) => !(o.label === typed && !o.apply))
  if (options.length === 0) return null
  return {
    from: word ? word.from : context.pos,
    options,
    validFor: /^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]*$/,
  }
}

export function hangulLanguage(): LanguageSupport {
  const language = StreamLanguage.define(streamParser)
  return new LanguageSupport(language, [
    syntaxHighlighting(hangulHighlightStyle),
    indentUnit.of('    '),
    hangulIndent,
    keywordHover,
    language.data.of({
      autocomplete: hangulCompletionSource,
    }),
  ])
}
