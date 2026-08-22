import { StreamLanguage, LanguageSupport, HighlightStyle, syntaxHighlighting, indentService, type StreamParser } from '@codemirror/language'
import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import { tags } from '@lezer/highlight'
import { KEYWORDS } from '../lang/lexer'
import { BUILTIN_NAMES } from '../lang/interpreter'
import { EN_TO_KO, KO_TO_EN } from '../lang/aliases'
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
  },
}

/** 블록을 여는 줄인지 (다음 줄 들여쓰기 +1) */
function opensBlock(lineText: string): boolean {
  const t = lineText.replace(/#.*$/, '').trim()
  if (/(이면|아니면|then|else)$/.test(t)) return true
  if (/^(반복|동안|함수|for|repeat|while|def|function)(\s|\()/.test(t)) return true
  return false
}

const INDENT_UNIT = 4

const hangulIndent = indentService.of((context, pos) => {
  const line = context.state.doc.lineAt(pos)
  if (line.number === 1) return 0
  const prev = context.state.doc.line(line.number - 1)
  const prevText = prev.text
  const prevIndent = /^\s*/.exec(prevText)![0].length

  let indent = prevIndent
  if (opensBlock(prevText)) indent = prevIndent + INDENT_UNIT

  // 현재 줄이 끝/아니면으로 시작하면 한 단계 밖으로
  const currentText = line.text.slice(0, Math.max(0, pos - line.from)) + line.text.slice(pos - line.from)
  const trimmed = currentText.trim()
  if (/^(끝|아니면|end|else|elif)/.test(trimmed)) indent = Math.max(0, indent - INDENT_UNIT)

  return indent
})

export const hangulHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c3aed', fontWeight: 'bold' },
  { tag: tags.atom, color: '#0891b2', fontWeight: 'bold' },
  { tag: tags.string, color: '#16a34a' },
  { tag: tags.number, color: '#ea580c' },
  { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#db2777', fontWeight: 'bold' },
  { tag: tags.standard(tags.variableName), color: '#2563eb' },
  { tag: tags.operator, color: '#64748b' },
])

/**
 * 단어 위에 마우스를 올리면 짝이 되는 실제 코딩(영어) 단어를 보여주는 툴팁.
 * 한글 단어 → 영어, 영어 단어 → 한글 양방향.
 */
const WORD_CHAR = /[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]/

const keywordHover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos)
  let start = pos
  let end = pos
  while (start > line.from && WORD_CHAR.test(view.state.doc.sliceString(start - 1, start))) start--
  while (end < line.to && WORD_CHAR.test(view.state.doc.sliceString(end, end + 1))) end++
  if (start === end) return null

  const word = view.state.doc.sliceString(start, end)
  let main: string | null = null
  let sub: string | null = null

  if (KO_TO_EN[word]) {
    main = `${word} = ${KO_TO_EN[word]}`
    sub = `실제 코딩에서는 ${KO_TO_EN[word]} 라고 써요. 그대로 써도 돼요!`
  } else if (word === 'elif') {
    main = 'elif = 아니면 만약'
    sub = '한글랭에서는 "아니면 만약" 이라고 써요'
  } else if (EN_TO_KO[word]) {
    main = `${word} = ${EN_TO_KO[word]}`
    sub = `한글랭에서는 ${EN_TO_KO[word]} 라고 써요`
  }
  if (!main) return null

  return {
    pos: start,
    end,
    above: true,
    create() {
      const dom = document.createElement('div')
      dom.className = 'cm-word-bridge'
      const title = document.createElement('div')
      title.className = 'cm-word-bridge-title'
      const icon = document.createElement('img')
      icon.src = EMOJI.abc
      icon.width = 16
      icon.height = 16
      icon.alt = ''
      icon.style.verticalAlign = '-0.18em'
      icon.style.marginRight = '6px'
      title.append(icon, document.createTextNode(main))
      const desc = document.createElement('div')
      desc.className = 'cm-word-bridge-desc'
      desc.textContent = sub ?? ''
      dom.append(title, desc)
      return { dom }
    },
  }
})

const STATIC_COMPLETIONS: Completion[] = [
  snippetCompletion('출력(${})', { label: '출력', detail: '화면에 글자 보여주기', type: 'function' }),
  snippetCompletion('만약 ${조건} 이면\n    ${}\n끝', { label: '만약', detail: '조건에 따라 실행', type: 'keyword' }),
  snippetCompletion('만약 ${조건} 이면\n    ${}\n아니면\n    \n끝', { label: '만약-아니면', detail: '조건 + 아니면', type: 'keyword' }),
  snippetCompletion('반복 i = 1 부터 5\n    ${}\n끝', { label: '반복', detail: '정해진 횟수만큼 반복', type: 'keyword' }),
  snippetCompletion('동안 ${조건}\n    ${}\n끝', { label: '동안', detail: '조건이 참인 동안 반복', type: 'keyword' }),
  snippetCompletion('함수 ${이름}(${})\n    \n끝', { label: '함수', detail: '나만의 명령 만들기', type: 'keyword' }),
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
  { label: '그리고', type: 'keyword', detail: '둘 다 참일 때 (and)' },
  { label: '또는', type: 'keyword', detail: '하나라도 참일 때 (or)' },
  { label: '아니다', type: 'keyword', detail: '반대로 (not)' },
  { label: '참', type: 'keyword', detail: 'true' },
  { label: '거짓', type: 'keyword', detail: 'false' },
  { label: '반환', type: 'keyword', detail: '함수의 결과 돌려주기 (return)' },
  // 실제 코딩(영어) 단어도 그대로 쓸 수 있어요
  snippetCompletion('print(${})', { label: 'print', detail: '= 출력', type: 'function' }),
  snippetCompletion('if ${조건} then\n    ${}\nend', { label: 'if', detail: '= 만약', type: 'keyword' }),
  snippetCompletion('for i = 1 to 5\n    ${}\nend', { label: 'for', detail: '= 반복', type: 'keyword' }),
  snippetCompletion('while ${조건}\n    ${}\nend', { label: 'while', detail: '= 동안', type: 'keyword' }),
  snippetCompletion('def ${이름}(${})\n    \nend', { label: 'def', detail: '= 함수', type: 'keyword' }),
  snippetCompletion('turtle.forward(100)', { label: 'turtle.forward', detail: '= 캐릭터.앞으로', type: 'method' }),
  snippetCompletion('turtle.right(90)', { label: 'turtle.right', detail: '= 캐릭터.오른쪽', type: 'method' }),
  snippetCompletion('turtle.color("${빨강}")', { label: 'turtle.color', detail: '= 캐릭터.색깔', type: 'method' }),
]

// ---- VS Code 스타일 자동완성 ----

/** 캐릭터. / turtle. 점을 찍으면 나오는 멤버 명령 목록 */
const TURTLE_MEMBERS: Completion[] = [
  snippetCompletion('앞으로(100)', { label: '앞으로', detail: 'forward', type: 'method', boost: 9, info: '앞으로 걸으며 선을 그려요. 괄호 안은 걸어갈 거리!' }),
  snippetCompletion('오른쪽(90)', { label: '오른쪽', detail: 'right', type: 'method', boost: 9, info: '제자리에서 오른쪽(시계방향)으로 돌아요. 괄호 안은 각도!' }),
  snippetCompletion('왼쪽(90)', { label: '왼쪽', detail: 'left', type: 'method', boost: 8, info: '제자리에서 왼쪽으로 돌아요.' }),
  snippetCompletion('뒤로(50)', { label: '뒤로', detail: 'back', type: 'method', boost: 8, info: '뒤로 걸어요. 바라보는 방향은 그대로!' }),
  snippetCompletion('색깔("${빨강}")', { label: '색깔', detail: 'color', type: 'method', boost: 7, info: '펜 색을 바꿔요. 빨강, 주황, 노랑, 초록, 파랑, 보라, 분홍, 검정...' }),
  snippetCompletion('굵기(5)', { label: '굵기', detail: 'width', type: 'method', boost: 6, info: '선의 두께를 바꿔요. 1(얇게) ~ 40(두껍게)' }),
  snippetCompletion('말하기("${안녕!}")', { label: '말하기', detail: 'say', type: 'method', boost: 6, info: '거북이 머리 위에 말풍선을 띄워요.' }),
  snippetCompletion('펜올리기()', { label: '펜올리기', detail: 'penup', type: 'method', boost: 5, info: '펜을 들어요. 이동해도 선이 안 그려져요.' }),
  snippetCompletion('펜내리기()', { label: '펜내리기', detail: 'pendown', type: 'method', boost: 5, info: '펜을 다시 내려요. 이동하면 선이 그려져요.' }),
  // 영어 이름으로도 쓸 수 있어요
  snippetCompletion('forward(100)', { label: 'forward', detail: '= 앞으로', type: 'method' }),
  snippetCompletion('back(50)', { label: 'back', detail: '= 뒤로', type: 'method' }),
  snippetCompletion('right(90)', { label: 'right', detail: '= 오른쪽', type: 'method' }),
  snippetCompletion('left(90)', { label: 'left', detail: '= 왼쪽', type: 'method' }),
  snippetCompletion('color("${빨강}")', { label: 'color', detail: '= 색깔', type: 'method' }),
  snippetCompletion('width(5)', { label: 'width', detail: '= 굵기', type: 'method' }),
  snippetCompletion('say("${안녕!}")', { label: 'say', detail: '= 말하기', type: 'method' }),
  snippetCompletion('penup()', { label: 'penup', detail: '= 펜올리기', type: 'method' }),
  snippetCompletion('pendown()', { label: 'pendown', detail: '= 펜내리기', type: 'method' }),
]

/** 자동완성에서 제외할 예약어들 */
const RESERVED = new Set<string>([...KEYWORDS, ...BUILTIN_NAMES, ...Object.keys(EN_TO_KO), '캐릭터', 'elif'])

const IDENT_RE_G = /[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_][A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]*/
const FUNC_DEF_RE = new RegExp(`(?:함수|def|function)\\s+(${IDENT_RE_G.source})`, 'g')
const ASSIGN_RE = new RegExp(`(?:^|\\n)\\s*(${IDENT_RE_G.source})\\s*=(?!=)`, 'g')
const LOOP_VAR_RE = new RegExp(`(?:반복|for|repeat)\\s+(${IDENT_RE_G.source})\\s*=`, 'g')

/** 코드에서 내가 만든 변수/함수 이름을 모아 제안 (VS Code의 단어 제안처럼) */
function docIdentifiers(state: EditorState): Completion[] {
  const text = state.doc.sliceString(0, Math.min(state.doc.length, 20000))
  const found = new Map<string, 'function' | 'variable'>()
  let m: RegExpExecArray | null
  FUNC_DEF_RE.lastIndex = 0
  ASSIGN_RE.lastIndex = 0
  LOOP_VAR_RE.lastIndex = 0
  while ((m = FUNC_DEF_RE.exec(text))) found.set(m[1], 'function')
  while ((m = ASSIGN_RE.exec(text))) if (!found.has(m[1])) found.set(m[1], 'variable')
  while ((m = LOOP_VAR_RE.exec(text))) if (!found.has(m[1])) found.set(m[1], 'variable')

  const options: Completion[] = []
  for (const [name, type] of found) {
    if (RESERVED.has(name)) continue
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
 * VS Code처럼 동작하는 자동완성 소스:
 * - 타이핑하면 바로 목록이 떠요
 * - 캐릭터. / turtle. 처럼 점을 찍으면 명령 목록이 떠요
 * - 내가 만든 변수/함수 이름도 제안해요
 */
function hangulCompletionSource(context: CompletionContext): CompletionResult | null {
  // 1) 캐릭터./turtle. 멤버 완성
  const member = context.matchBefore(/(?:캐릭터|turtle)\.[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]*$/)
  if (member) {
    return {
      from: member.from + member.text.indexOf('.') + 1,
      options: TURTLE_MEMBERS,
      validFor: /^[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]*$/,
    }
  }

  // 2) 일반 단어 완성 (키워드/명령 + 내가 만든 이름)
  const word = context.matchBefore(/[A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_][A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]*$/)
  if (!word && !context.explicit) return null
  return {
    from: word ? word.from : context.pos,
    options: [...STATIC_COMPLETIONS, ...docIdentifiers(context.state)],
    validFor: /^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]*$/,
  }
}

export function hangulLanguage(): LanguageSupport {
  const language = StreamLanguage.define(streamParser)
  return new LanguageSupport(language, [
    syntaxHighlighting(hangulHighlightStyle),
    hangulIndent,
    keywordHover,
    language.data.of({
      autocomplete: hangulCompletionSource,
    }),
  ])
}
