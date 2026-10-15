import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../app/strings.ts'
import type { JobStatus } from '../../core/state.ts'
import { money, timer, useGame } from '../context.ts'

/** Полоса работы со стрелкой: заполнение из startedAt каждый кадр; при «потоке» — полная, с бегущими полосками. */
export function ProgressBar({ jobId, status }: { jobId: string; status: JobStatus }) {
  const game = useGame()
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status.kind !== 'running') return
    let frame = 0
    const draw = () => {
      const s = game.engine.status(jobId)
      if (s.kind === 'running' && fillRef.current) {
        fillRef.current.style.width = `${Math.min(Math.max(s.progress, 0), 1) * 100}%`
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [status.kind, jobId])

  const fill = status.kind === 'running' ? status.progress : status.kind === 'ready' || status.kind === 'streaming' ? 1 : 0
  const label =
    status.kind === 'streaming' ? t('job.perSecond', money(status.perSecond))
    : status.kind === 'ready' ? t('job.ready')
    : money(game.engine.payout(jobId))
  return (
    <div class={`bar bar--${status.kind}`}>
      <div class="bar__fill" ref={fillRef} style={{ width: `${fill * 100}%` }} />
      <div class="bar__text">{label}</div>
    </div>
  )
}

/** Сколько осталось до конца цикла; «0,0 с» для потока и готовой работы. */
export function TimeBox({ jobId, status }: { jobId: string; status: JobStatus }) {
  const game = useGame()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (status.kind !== 'running') return
    let frame = 0
    const draw = () => {
      const s = game.engine.status(jobId)
      if (s.kind === 'running' && ref.current) ref.current.textContent = timer(s.remaining)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [status.kind, jobId])
  const text =
    status.kind === 'running' ? timer(status.remaining)
    : status.kind === 'idle' ? timer(game.engine.cycle(jobId))
    : timer(0)
  // key: при смене статуса — новый span, иначе Preact пишет в текстовый узел, заменённый из rAF
  return <div class="card__time"><span ref={ref} key={status.kind}>{text}</span></div>
}
