import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  Decoration, type DecorationSet, type Command,
} from '@codemirror/view'
import { EditorState, StateEffect, StateField, Annotation } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import {
  closeBrackets, autocompletion, closeBracketsKeymap,
  acceptCompletion, closeCompletion, moveCompletionSelection, startCompletion, selectedCompletion,
} from '@codemirror/autocomplete'
import { setDiagnostics, lintKeymap, lintGutter } from '@codemirror/lint'
import { hangulLanguage } from './hangulLanguage'

export interface CodeEditorHandle {
  getCode: () => string
  setCode: (code: string) => void
  /** 에러 줄 빨간 밑줄 + 메시지. null이면 지움 */
  setError: (line: number | null, message?: string) => void
  /** 실행 중인 줄 하이라이트. null이면 지움 */
  setRunningLine: (line: number | null) => void
  focus: () => void
}

interface Props {
  initialCode: string
  onChange: (code: string) => void
  onRun: () => void
}

/** 프로그램이 코드를 통째로 바꾼 변경 — 사용자 입력과 구분해 자동 저장을 건너뛴다 */
const programmaticChange = Annotation.define<boolean>()

// ---- 실행 중 줄 하이라이트 ----

const setRunningLineEffect = StateEffect.define<number | null>()

const runningLineDeco = Decoration.line({ class: 'cm-running-line' })

const runningLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setRunningLineEffect)) {
        if (effect.value === null) return Decoration.none
        const lineNo = effect.value
        if (lineNo < 1 || lineNo > tr.state.doc.lines) return Decoration.none
        const line = tr.state.doc.line(lineNo)
        return Decoration.set([runningLineDeco.range(line.from)])
      }
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

/**
 * Enter로 자동완성을 받아들이되, 이미 똑같이 다 친 '그냥 단어'라면
 * Enter를 줄바꿈으로 넘겨 준다 (아이가 Enter를 눌렀는데 아무 일도 안 나는 상황 방지).
 */
const acceptCompletionOnEnter: Command = (view) => {
  const selected = selectedCompletion(view.state)
  if (!selected) return false
  if (!selected.apply) {
    const pos = view.state.selection.main.head
    const line = view.state.doc.lineAt(pos)
    const before = line.text.slice(0, pos - line.from)
    const m = /[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ_]+$/.exec(before)
    if (m && m[0] === selected.label) return false
  }
  return acceptCompletion(view)
}

const editorTheme = EditorView.theme({
  '&': {
    fontSize: '16.5px',
    height: '100%',
    backgroundColor: '#ffffff',
  },
  '.cm-scroller': {
    fontFamily: '"Nanum Gothic Coding", "D2Coding", monospace',
    lineHeight: '1.75',
    overflow: 'auto',
  },
  '.cm-content': { padding: '12px 0' },
  '.cm-line': { padding: '0 12px' },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: 'none',
    borderRight: '2px solid #e2e8f0',
    fontSize: '14px',
  },
  '.cm-activeLineGutter': { backgroundColor: '#e0e7ff', color: '#3730a3' },
  '.cm-activeLine': { backgroundColor: 'rgba(224, 231, 255, 0.35)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-running-line': {
    backgroundColor: 'rgba(250, 204, 21, 0.28)',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #dc2626 2px',
    textUnderlineOffset: '4px',
  },
  '.cm-tooltip': {
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
    fontFamily: '"Gowun Dodum", sans-serif',
  },
  // ---- 자동완성 팝업 (VS Code 스타일) ----
  '.cm-tooltip.cm-tooltip-autocomplete': {
    borderRadius: '12px',
    border: '1.5px solid #c7d2fe',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: '"Nanum Gothic Coding", monospace',
    fontSize: '14.5px',
    maxHeight: '260px',
    borderRadius: '10px',
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '3.5px 10px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: '#e0e7ff',
    color: '#1e1b4b',
  },
  '.cm-completionIcon': {
    paddingRight: '10px',
    fontSize: '90%',
  },
  '.cm-completionLabel': {
    color: '#1e293b',
  },
  '.cm-completionDetail': {
    color: '#64748b',
    fontStyle: 'normal',
    marginLeft: '10px',
    fontSize: '12px',
  },
  '.cm-completionInfo': {
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
    backgroundColor: '#ffffff',
    padding: '8px 12px',
    fontFamily: '"Gowun Dodum", sans-serif',
    fontSize: '13.5px',
    lineHeight: '1.6',
    color: '#334155',
    maxWidth: '250px',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.1)',
  },
})

export const CodeEditor = forwardRef<CodeEditorHandle, Props>(function CodeEditor(
  { initialCode, onChange, onRun },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  /** 지금 빨간 밑줄이 떠 있는지 — 사용자가 고치기 시작하면 지운다 */
  const hasErrorMarkRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  onChangeRef.current = onChange
  onRunRef.current = onRun

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        lineNumbers(),
        lintGutter(),
        history(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        autocompletion({
          // 자동완성 단축키는 아래에서 직접 정의한다 (Enter 함정 방지)
          defaultKeymap: false,
          activateOnTyping: true,
          selectOnOpen: true,
          icons: true,
          maxRenderedOptions: 24,
        }),
        runningLineField,
        hangulLanguage(),
        editorTheme,
        keymap.of([
          // 실행 (Ctrl/Cmd+Enter)
          {
            key: 'Mod-Enter',
            run: () => {
              onRunRef.current()
              return true
            },
          },
          // 자동완성 조작
          { key: 'Ctrl-Space', run: startCompletion },
          { key: 'Escape', run: closeCompletion },
          { key: 'ArrowDown', run: moveCompletionSelection(true) },
          { key: 'ArrowUp', run: moveCompletionSelection(false) },
          { key: 'PageDown', run: moveCompletionSelection(true, 'page') },
          { key: 'PageUp', run: moveCompletionSelection(false, 'page') },
          { key: 'Tab', run: acceptCompletion },
          { key: 'Enter', run: acceptCompletionOnEnter },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          const fromProgram = update.transactions.some((tr) => tr.annotation(programmaticChange))
          if (fromProgram) return
          // 사용자가 고치기 시작하면 빨간 밑줄을 지운다
          if (hasErrorMarkRef.current) {
            hasErrorMarkRef.current = false
            queueMicrotask(() => {
              const view = viewRef.current
              if (view) view.dispatch(setDiagnostics(view.state, []))
            })
          }
          onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    if (import.meta.env.DEV) {
      // 개발 모드 전용: 자동화 테스트에서 에디터를 조작할 수 있게 노출
      ;(window as unknown as Record<string, unknown>).__cmView = view
    }
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // 에디터는 한 번만 생성. 코드 교체는 setCode로.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    getCode: () => viewRef.current?.state.doc.toString() ?? '',
    setCode: (code: string) => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
        selection: { anchor: Math.min(code.length, code.length) },
        effects: setRunningLineEffect.of(null),
        annotations: programmaticChange.of(true),
      })
      hasErrorMarkRef.current = false
      view.dispatch({ ...setDiagnostics(view.state, []), annotations: programmaticChange.of(true) })
    },
    setError: (line, message = '여기를 확인해 보세요') => {
      const view = viewRef.current
      if (!view) return
      if (line === null || line < 1 || line > view.state.doc.lines) {
        hasErrorMarkRef.current = false
        view.dispatch({ ...setDiagnostics(view.state, []), annotations: programmaticChange.of(true) })
        return
      }
      const docLine = view.state.doc.line(line)
      hasErrorMarkRef.current = true
      view.dispatch({
        ...setDiagnostics(view.state, [
          { from: docLine.from, to: docLine.to, severity: 'error', message },
        ]),
        annotations: programmaticChange.of(true),
      })
      // 에러 줄이 화면 밖이면 보이게 스크롤
      view.dispatch({ effects: EditorView.scrollIntoView(docLine.from, { y: 'center' }) })
    },
    setRunningLine: (line) => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({ effects: setRunningLineEffect.of(line) })
      if (line !== null && line >= 1 && line <= view.state.doc.lines) {
        const docLine = view.state.doc.line(line)
        view.dispatch({ effects: EditorView.scrollIntoView(docLine.from) })
      }
    },
    focus: () => viewRef.current?.focus(),
  }), [])

  return <div ref={containerRef} className="h-full min-h-0" />
})
