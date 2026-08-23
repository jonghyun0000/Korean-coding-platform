import { parse } from './parser'
import { run, type Effect } from './interpreter'
import { KidError } from './errors'

export type ProgramResult =
  | { ok: true; effects: Effect[] }
  | { ok: false; message: string; line: number | null }

/** 소스 코드를 파싱하고 실행해서 효과 목록 또는 친절한 에러를 돌려준다. */
export function runProgram(src: string): ProgramResult {
  try {
    const program = parse(src)
    const { effects } = run(program)
    return { ok: true, effects }
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
