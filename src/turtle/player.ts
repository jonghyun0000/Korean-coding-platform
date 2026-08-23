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
const INSTANT_BATCH = 300      // 한 프레임에 처리할 즉시 효과(출력 등) 최대 개수
const MAX_DONE_PER_FRAME = 200 // 한 프레임에 완료할 이동/회전 최대 개수
const CATCH_UP_MS = 250        // 프레임이 오래 멈췄을 때 따라잡기 한계
const TOTAL_BUDGET_MS = 12_000 // 전체 재생이 이보다 길면 비율을 줄여 빠르게

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
  /** 중앙에서 가장 멀리 나간 거리 — 그림이 화면 밖으로 나가면 자동으로 줄여 보여 준다 */
  private extent = 0

  // 재생 상태
  private effects: Effect[] = []
  private index = 0
  private raf = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private effectStart = 0 // 현재 효과 시작 시각
  private initedIndex = -1 // 시작 처리를 마친 효과 번호
  private moveFrom = { x: 0, y: 0 }
  private turnFrom = 0
  private timeScale = 1 // 전체가 너무 길면 1보다 커진다
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

  /** 속도를 바꾸되, 지금 하던 동작의 진행률은 그대로 유지한다 */
  setSpeed(next: number) {
    const effect = this.effects[this.index]
    if (this.playing && effect && this.effectStart !== 0 && this.initedIndex === this.index) {
      const oldDur = this.duration(effect)
      const now = performance.now()
      const progress = oldDur > 0 ? Math.min(1, (now - this.effectStart) / oldDur) : 1
      this.speed = next
      const newDur = this.duration(effect)
      this.effectStart = now - progress * newDur
    } else {
      this.speed = next
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
    this.extent = 0
    this.index = 0
    this.initedIndex = -1
    this.effectStart = 0
    this.timeScale = 1
  }

  play(effects: Effect[], callbacks: PlayCallbacks) {
    this.stop()
    this.resetState()
    this.effects = effects
    this.callbacks = callbacks
    this.playing = true
    // 전체 재생이 너무 길어지면(원 그리기 등) 비율을 줄여 12초 안쪽으로 맞춘다
    let total = 0
    for (const e of effects) total += this.rawDuration(e)
    this.timeScale = total > TOTAL_BUDGET_MS ? total / TOTAL_BUDGET_MS : 1
    this.scheduleStep()
  }

  /** 남은 그림을 한 번에 완성한다 (기다리기 지루할 때) */
  finishNow() {
    if (!this.playing) return
    const cb = this.callbacks!
    while (this.index < this.effects.length) {
      const effect = this.effects[this.index]
      if (effect.kind === 'move' || effect.kind === 'turn') {
        if (this.initedIndex !== this.index) {
          if (effect.kind === 'move') this.moveFrom = { x: this.x, y: this.y }
          if (effect.kind === 'turn') this.turnFrom = this.heading
        }
      }
      this.applyInstant(effect, cb)
      this.index++
      this.initedIndex = -1
    }
    this.render()
    this.playing = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    cb.onLine(null)
    this.callbacks = null
    cb.onDone()
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

  /** 속도/전체 길이 보정 전의 기본 소요 시간 */
  private rawDuration(effect: Effect): number {
    switch (effect.kind) {
      case 'move': return Math.min(600, Math.max(120, Math.abs(effect.dist) * 2.4))
      case 'turn': return Math.min(320, Math.max(90, Math.abs(effect.angle) * 1.4))
      case 'say': return 950
      default: return 0
    }
  }

  private duration(effect: Effect): number {
    const speed = Math.max(0.2, this.speed)
    const d = this.rawDuration(effect) / speed / this.timeScale
    return Math.max(16, d)
  }

  /** 중앙에서 얼마나 멀리 갔는지 기록 (자동 축소용) */
  private noteExtent(x: number, y: number) {
    const r = Math.max(Math.abs(x), Math.abs(y))
    if (r > this.extent) this.extent = r
  }

  /** 효과를 즉시(끝난 상태로) 반영 */
  private applyInstant(effect: Effect, cb: PlayCallbacks) {
    switch (effect.kind) {
      case 'print':
        cb.onPrint(effect.text)
        return
      case 'color':
        this.color = effect.color
        return
      case 'pen':
        this.penDown = effect.down
        return
      case 'width':
        this.width = effect.width
        return
      case 'say':
        this.bubble = effect.text
        return
      case 'turn':
        this.heading = this.turnFrom + effect.angle
        return
      case 'move': {
        const rad = (this.heading * Math.PI) / 180
        const endX = this.moveFrom.x + Math.sin(rad) * effect.dist
        const endY = this.moveFrom.y - Math.cos(rad) * effect.dist
        this.x = endX
        this.y = endY
        this.noteExtent(endX, endY)
        if (this.penDown) {
          this.segments.push({
            x1: this.moveFrom.x, y1: this.moveFrom.y,
            x2: endX, y2: endY,
            color: this.color, width: this.width,
          })
        }
        return
      }
    }
  }

  private advance(ts: number) {
    const cb = this.callbacks!
    let instantBudget = INSTANT_BATCH
    let doneBudget = MAX_DONE_PER_FRAME

    while (this.index < this.effects.length) {
      const effect = this.effects[this.index]

      // 즉시 처리되는 효과
      if (effect.kind === 'print' || effect.kind === 'color' || effect.kind === 'pen' || effect.kind === 'width') {
        if (instantBudget-- <= 0) return
        cb.onLine(effect.line)
        this.applyInstant(effect, cb)
        this.index++
        continue
      }

      // 시간이 걸리는 효과 — 처음 만나면 시작 처리
      if (this.initedIndex !== this.index) {
        this.initedIndex = this.index
        // 프레임이 오래 멈춰 있었으면 너무 많이 따라잡지 않도록 제한
        if (this.effectStart === 0) this.effectStart = ts
        else this.effectStart = Math.max(this.effectStart, ts - CATCH_UP_MS)
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
        this.x = this.moveFrom.x + Math.sin(rad) * effect.dist * eased
        this.y = this.moveFrom.y - Math.cos(rad) * effect.dist * eased
      } else if (effect.kind === 'turn') {
        this.heading = this.turnFrom + effect.angle * eased
      }

      if (t < 1) return // 다음 프레임에서 계속
      if (doneBudget-- <= 0) return // 한 프레임에 너무 많이 처리하지 않기

      this.applyInstant(effect, cb)
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
    ctx.beginPath()
    const grid = 25
    for (let gx = (w / 2) % grid; gx < w; gx += grid) {
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, h)
    }
    for (let gy = (h / 2) % grid; gy < h; gy += grid) {
      ctx.moveTo(0, gy)
      ctx.lineTo(w, gy)
    }
    ctx.stroke()

    const cx = w / 2
    const cy = h / 2

    // 그림이 화면 밖으로 나가면 전체를 줄여서 보여 준다
    const half = Math.min(w, h) / 2 - 24
    const liveExtent = Math.max(this.extent, Math.abs(this.x), Math.abs(this.y))
    const scale = liveExtent > half && half > 0 ? Math.max(0.2, half / liveExtent) : 1

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const minWidth = 1.5 / scale
    for (const s of this.segments) {
      ctx.strokeStyle = s.color
      ctx.lineWidth = Math.max(s.width, minWidth)
      ctx.beginPath()
      ctx.moveTo(s.x1, s.y1)
      ctx.lineTo(s.x2, s.y2)
      ctx.stroke()
    }

    // 지금 그리는 중인 선 (부분)
    if (this.playing && this.penDown) {
      const effect = this.effects[this.index]
      if (effect && effect.kind === 'move' && this.effectStart !== 0) {
        ctx.strokeStyle = this.color
        ctx.lineWidth = Math.max(this.width, minWidth)
        ctx.beginPath()
        ctx.moveTo(this.moveFrom.x, this.moveFrom.y)
        ctx.lineTo(this.x, this.y)
        ctx.stroke()
      }
    }
    ctx.restore()

    // 거북이와 말풍선은 줄이지 않고 원래 크기로
    const px = cx + this.x * scale
    const py = cy + this.y * scale
    this.drawTurtle(ctx, px, py, this.heading)
    if (this.bubble) this.drawBubble(ctx, px, py, this.bubble, w)

    // 축소해서 보여 주는 중이라고 알려 주기
    if (scale < 1) {
      ctx.save()
      ctx.font = '12px "Gowun Dodum", sans-serif'
      ctx.fillStyle = 'rgba(71, 85, 105, 0.75)'
      ctx.fillText(`그림이 커서 ${Math.round(scale * 100)}% 크기로 보여 주고 있어요`, 10, h - 10)
      ctx.restore()
    }
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

  /** 말풍선 (띄어쓰기가 없는 한국어도 글자 단위로 줄바꿈) */
  private drawBubble(ctx: CanvasRenderingContext2D, px: number, py: number, text: string, canvasW: number) {
    ctx.save()
    ctx.font = '15px "Jua", "Gowun Dodum", sans-serif'

    const maxWidth = 170
    const maxLines = 6
    const lines: string[] = []
    let current = ''

    const pushLine = () => {
      if (current) lines.push(current)
      current = ''
    }

    for (const word of text.split(' ')) {
      const trial = current ? current + ' ' + word : word
      if (ctx.measureText(trial).width <= maxWidth) {
        current = trial
        continue
      }
      pushLine()
      // 한 낱말이 너무 길면 글자 단위로 쪼갠다
      if (ctx.measureText(word).width <= maxWidth) {
        current = word
        continue
      }
      let chunk = ''
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          lines.push(chunk)
          chunk = ch
          if (lines.length >= maxLines) break
        } else {
          chunk += ch
        }
      }
      current = chunk
      if (lines.length >= maxLines) break
    }
    pushLine()

    let shown = lines.slice(0, maxLines)
    if (lines.length > maxLines) shown = [...shown.slice(0, maxLines - 1), shown[maxLines - 1] + '…']
    if (shown.length === 0) shown = ['']

    const lineHeight = 20
    const padding = 10
    const bw = Math.min(maxWidth, Math.max(...shown.map((l) => ctx.measureText(l).width))) + padding * 2
    const bh = shown.length * lineHeight + padding * 2 - 4

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
    shown.forEach((l, i) => {
      ctx.fillText(l, bx + padding, by + padding + 12 + i * lineHeight)
    })
    ctx.restore()
  }
}
