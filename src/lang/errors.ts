/** 아이 눈높이 에러. message는 이미 친절한 한글 문장이고, line은 1부터 시작. */
export class KidError extends Error {
  line: number | null

  constructor(message: string, line: number | null = null) {
    super(message)
    this.name = 'KidError'
    this.line = line
  }
}

/** 콘솔에 보여줄 최종 문구 */
export function formatKidError(err: KidError): string {
  if (err.line != null) return `${err.line}번째 줄: ${err.message}`
  return err.message
}
