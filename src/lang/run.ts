import { parse } from './parser'
import { run, type Effect, type AskRequest, type RunOptions } from './interpreter'
import { KidError } from './errors'

export type ProgramResult =
  | { ok: true; effects: Effect[]; randoms: number[] }
  /** 아직 안 끝났어요 — 이 질문의 답이 필요합니다 */
  | { ok: 'ask'; ask: AskRequest; effects: Effect[]; randoms: number[] }
  | { ok: false; message: string; line: number | null }

/**
 * 소스 코드를 파싱하고 실행해서 효과 목록 또는 친절한 에러를 돌려준다.
 *
 * 입력( )을 만나면 실행을 멈추고 `ok: 'ask'` 로 돌아온다.
 * 답을 받은 뒤 answers 에 이어 붙여 다시 부르면, 같은 코드를 처음부터 다시 실행하되
 * 이미 받은 답과 무작위 값을 그대로 써서 똑같은 결과를 이어 간다.
 */
export function runProgram(src: string, options: RunOptions = {}): ProgramResult {
  try {
    const program = parse(src)
    const result = run(program, options)
    if (result.ask) {
      return { ok: 'ask', ask: result.ask, effects: result.effects, randoms: result.randoms }
    }
    return { ok: true, effects: result.effects, randoms: result.randoms }
  } catch (e) {
    if (e instanceof KidError) {
      return { ok: false, message: e.message, line: e.line }
    }
    // 값이 너무 커지거나 재귀가 너무 깊어 자바스크립트 자체가 멈춘 경우
    if (e instanceof RangeError) {
      return {
        ok: false,
        message: '값이 너무 커지거나 너무 깊어졌어요. 반복 횟수나 리스트 크기를 줄여 보세요.',
        line: null,
      }
    }
    if (import.meta.env?.DEV) console.error('[한글랭 내부 오류]', e)
    // 예상 못 한 내부 오류도 아이 눈높이 문구로
    return { ok: false, message: '앗, 알 수 없는 문제가 생겼어요. 코드를 조금 바꿔서 다시 실행해 보세요.', line: null }
  }
}

/** 질문에 답이 필요 없을 때(테스트·판정용) 한 번에 끝까지 실행 */
export function runProgramOnce(src: string): ProgramResult {
  return runProgram(src)
}
