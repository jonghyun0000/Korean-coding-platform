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
    // 예상 못 한 내부 오류도 아이 눈높이 문구로
    return { ok: false, message: '앗, 알 수 없는 문제가 생겼어요. 코드를 조금 바꿔서 다시 실행해 보세요.', line: null }
  }
}
