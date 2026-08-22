import type { Effect } from '../lang/interpreter'

export interface PlayCallbacks {
  /** print 효과를 만나면 즉시 호출 */
  onPrint: (text: string) => void
  /** 지금 실행 중인 코드 줄 (하이라이트용). 끝나면 null */
  onLine: (line: number | null) => void
  onDone: () => void
}

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
}

const DEFAULT_COLOR = '#334155'
const DEFAULT_WIDTH = 3
const INSTANT_BATCH = 300 // 한 프레임에 처리할 즉시 효과(출력 등) 최대 개수

/**
 * 효과 목록을 캔버스 위에서 애니메이션으로 재생하는 거북이 그래픽 플레이어.
 * 좌표계: 캔버스 중앙이 (0,0), 시작 방향은 위쪽, 오른쪽(+각도)은 시계방향.
 */
export class TurtlePlayer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null

  // 거북이 상태
  private x = 0
  private y = 0
  private heading = 0 // 도(deg), 0 = 위쪽
  private penDown = true
  private color = DEFAULT_COLOR
  private width = DEFAULT_WIDTH
  private segments: Segment[] = []
  private bubble: string | null = null

  // 재생 상태
  private effects: Effect[] = []
  private index = 0
  private raf = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private effectStart = 0 // 현재 효과 시작 시각
  private initedIndex = -1 // 시작 처리를 마친 효과 번호
  private moveFrom = { x: 0, y: 0 }
  private turnFrom = 0
  private callbacks: PlayCallbacks | null = null
  playing = false
  speed = 1

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.resize()
  }

  /** CSS 크기에 맞춰 내부 버퍼 갱신 (DPR 반영) */
  resize() {
    const canvas = this.canvas
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    this.render()
  }

  reset() {
    this.stop()
    this.resetState()
    this.render()
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.playing) {
      this.playing = false
      this.callbacks?.onLine(null)
      this.callbacks = null
    }
  }

  private resetState() {
    this.x = 0
    this.y = 0
    this.heading = 0
    this.penDown = true
    this.color = DEFAULT_COLOR
    this.width = DEFAULT_WIDTH
    this.segments = []
    this.bubble = null
    this.index = 0
    this.initedIndex = -1
    this.effectStart = 0
  }

  play(effects: Effect[], callbacks: PlayCallbacks) {
    this.stop()
    this.resetState()
    this.effects = effects
    this.callbacks = callbacks
    this.playing = true
    this.scheduleStep()
  }

  /**
   * rAF로 부드럽게 그리되, 탭이 가려지는 등 rAF가 멈춘 환경에서도
   * setTimeout으로 최소 프레임을 보장한다. 둘 중 먼저 온 쪽만 실행.
   */
  private scheduleStep() {
    this.raf = requestAnimationFrame(() => this.step())
    this.timer = setTimeout(() => this.step(), 120)
  }

  private step() {
    if (!this.playing) return
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.timer) clearTimeout(this.timer)
    this.raf = 0
    this.timer = null
    this.advance(performance.now())
    this.render()
    if (this.playing) this.scheduleStep()
  }

  private duration(effect: Effect): number {
    const speed = Math.max(0.2, this.speed)
    switch (effect.kind) {
      case 'move': return Math.min(600, Math.max(120, Math.abs(effect.dist) * 2.4)) / speed
      case 'turn': return Math.min(320, Math.max(90, Math.abs(effect.angle) * 1.4)) / speed
      case 'say': return 950 / speed
      default: return 0
    }
  }

  private advance(ts: number) {
    const cb = this.callbacks!
    let instantBudget = INSTANT_BATCH

    while (this.index < this.effects.length) {
      const effect = this.effects[this.index]

      // 즉시 처리되는 효과
      if (effect.kind === 'print' || effect.kind === 'color' || effect.kind === 'pen' || effect.kind === 'width') {
        if (instantBudget-- <= 0) return
        cb.onLine(effect.line)
        if (effect.kind === 'print') cb.onPrint(effect.text)
        else if (effect.kind === 'color') this.color = effect.color
        else if (effect.kind === 'pen') this.penDown = effect.down
        else this.width = effect.width
        this.index++
        continue
      }

      // 시간이 걸리는 효과 — 처음 만나면 시작 처리
      if (this.initedIndex !== this.index) {
        this.initedIndex = this.index
        // 이전 효과에서 이월된 시작 시각이 너무 과거면 보정 (프레임이 뜸한 환경 대비)
        if (this.effectStart === 0) this.effectStart = ts
        else this.effectStart = Math.max(this.effectStart, ts - this.duration(effect))
        cb.onLine(effect.line)
        if (effect.kind === 'move') this.moveFrom = { x: this.x, y: this.y }
        if (effect.kind === 'turn') this.turnFrom = this.heading
        if (effect.kind === 'say') this.bubble = effect.text
      }
      const dur = this.duration(effect)
      const t = Math.min(1, (ts - this.effectStart) / dur)
      const eased = 1 - (1 - t) * (1 - t) // ease-out

      if (effect.kind === 'move') {
        const rad = (this.heading * Math.PI) / 180
        const dx = Math.sin(rad) * effect.dist
        const dy = -Math.cos(rad) * effect.dist
        this.x = this.moveFrom.x + dx * eased
        this.y = this.moveFrom.y + dy * eased
      } else if (effect.kind === 'turn') {
        this.heading = this.turnFrom + effect.angle * eased
      }

      if (t < 1) return // 다음 프레임에서 계속

      // 효과 완료
      if (effect.kind === 'move') {
        const rad = (this.heading * Math.PI) / 180
        const endX = this.moveFrom.x + Math.sin(rad) * effect.dist
        const endY = this.moveFrom.y - Math.cos(rad) * effect.dist
        this.x = endX
        this.y = endY
        if (this.penDown) {
          this.segments.push({
            x1: this.moveFrom.x, y1: this.moveFrom.y,
            x2: endX, y2: endY,
            color: this.color, width: this.width,
          })
        }
      } else if (effect.kind === 'turn') {
        this.heading = this.turnFrom + effect.angle
      }
      this.index++
      // 남은 시간을 다음 효과로 이월해서, 프레임이 드물어도 벽시계 속도 유지
      this.effectStart += dur
    }

    // 전부 끝남
    this.playing = false
    cb.onLine(null)
    const done = cb.onDone
    this.callbacks = null
    done()
  }

  // ---- 그리기 ----

  render() {
    const canvas = this.canvas
    const ctx = this.ctx
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // 은은한 모눈 배경
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'
    ctx.lineWidth = 1
    const grid = 25
    for (let gx = (w / 2) % grid; gx < w; gx += grid) {
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, h)
      ctx.stroke()
    }
    for (let gy = (h / 2) % grid; gy < h; gy += grid) {
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(w, gy)
      ctx.stroke()
    }

    const cx = w / 2
    const cy = h / 2

    // 그려진 선들
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of this.segments) {
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.beginPath()
      ctx.moveTo(cx + s.x1, cy + s.y1)
      ctx.lineTo(cx + s.x2, cy + s.y2)
      ctx.stroke()
    }

    // 지금 그리는 중인 선 (부분)
    if (this.playing && this.penDown) {
      const effect = this.effects[this.index]
      if (effect && effect.kind === 'move' && this.effectStart !== 0) {
        ctx.strokeStyle = this.color
        ctx.lineWidth = this.width
        ctx.beginPath()
        ctx.moveTo(cx + this.moveFrom.x, cy + this.moveFrom.y)
        ctx.lineTo(cx + this.x, cy + this.y)
        ctx.stroke()
      }
    }

    this.drawTurtle(ctx, cx + this.x, cy + this.y, this.heading)
    if (this.bubble) this.drawBubble(ctx, cx + this.x, cy + this.y, this.bubble, w)
  }

  /** 귀여운 아기 거북이 */
  private drawTurtle(ctx: CanvasRenderingContext2D, px: number, py: number, heading: number) {
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate((heading * Math.PI) / 180)

    // 다리 4개
    ctx.fillStyle = '#4ade80'
    const legs: [number, number][] = [[-10, -8], [10, -8], [-10, 8], [10, 8]]
    for (const [lx, ly] of legs) {
      ctx.beginPath()
      ctx.ellipse(lx, ly, 4.5, 4.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // 꼬리
    ctx.beginPath()
    ctx.moveTo(-3, 13)
    ctx.lineTo(3, 13)
    ctx.lineTo(0, 19)
    ctx.closePath()
    ctx.fill()

    // 머리 (앞쪽 = 위)
    ctx.beginPath()
    ctx.ellipse(0, -16, 6.5, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    // 눈
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(-2.6, -18, 2, 0, Math.PI * 2)
    ctx.arc(2.6, -18, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.arc(-2.6, -18.4, 1, 0, Math.PI * 2)
    ctx.arc(2.6, -18.4, 1, 0, Math.PI * 2)
    ctx.fill()

    // 등딱지
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.ellipse(0, 0, 12, 13.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#15803d'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // 등딱지 무늬
    ctx.strokeStyle = 'rgba(21, 128, 61, 0.6)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(0, 0, 6.5, 7.5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, -7.5); ctx.lineTo(0, -13.5)
    ctx.moveTo(0, 7.5); ctx.lineTo(0, 13.5)
    ctx.moveTo(-6.2, -2.3); ctx.lineTo(-11.5, -4)
    ctx.moveTo(6.2, -2.3); ctx.lineTo(11.5, -4)
    ctx.moveTo(-5, 5); ctx.lineTo(-9, 9)
    ctx.moveTo(5, 5); ctx.lineTo(9, 9)
    ctx.stroke()

    ctx.restore()
  }

  /** 말풍선 */
  private drawBubble(ctx: CanvasRenderingContext2D, px: number, py: number, text: string, canvasW: number) {
    ctx.save()
    ctx.font = '15px "Jua", "Gowun Dodum", sans-serif'

    // 줄 나누기 (최대 폭 170px)
    const maxWidth = 170
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const trial = current ? current + ' ' + word : word
      if (ctx.measureText(trial).width > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = trial
      }
    }
    if (current) lines.push(current)

    const lineHeight = 20
    const padding = 10
    const bw = Math.min(maxWidth, Math.max(...lines.map((l) => ctx.measureText(l).width))) + padding * 2
    const bh = lines.length * lineHeight + padding * 2 - 4

    let bx = px + 18
    let by = py - 30 - bh
    // 화면 밖으로 나가지 않게
    bx = Math.max(6, Math.min(bx, canvasW - bw - 6))
    by = Math.max(6, by)

    // 풍선 몸통
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 12)
    ctx.fill()
    ctx.stroke()

    // 꼬리
    ctx.beginPath()
    ctx.moveTo(Math.max(bx + 14, Math.min(px + 2, bx + bw - 26)), by + bh)
    ctx.lineTo(px + 2, py - 20)
    ctx.lineTo(Math.max(bx + 26, Math.min(px + 14, bx + bw - 14)), by + bh)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0)'
    ctx.stroke()

    // 글자
    ctx.fillStyle = '#334155'
    lines.forEach((l, i) => {
      ctx.fillText(l, bx + padding, by + padding + 12 + i * lineHeight)
    })
    ctx.restore()
  }
}
