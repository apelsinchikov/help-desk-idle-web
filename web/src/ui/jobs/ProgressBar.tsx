import { useEffect, useRef } from 'preact/hooks'
import { t } from '../../app/strings.ts'
import type { JobStatus } from '../../core/state.ts'
import { duration, money, useGame } from '../context.ts'

/** Полоска выполнения: ширина и оставшееся время обновляются каждый кадр из startedAt, без ре-рендера. */
export function ProgressBar({ jobId, status }: { jobId: string; status: JobStatus }) {
  const game = useGame()
  const fillRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLSpanElement>(null)
  const payout = game.engine.payout(jobId)

  useEffect(() => {
    if (status.kind !== 'running') return
    let frame = 0
    const draw = () => {
      const s = game.engine.status(jobId)
      if (s.kind === 'running') {
        if (fillRef.current) fillRef.current.style.width = `${Math.min(Math.max(s.progress, 0), 1) * 100}%`
        if (rightRef.current) rightRef.current.textContent = duration(s.remaining)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [status.kind, jobId])

  const fill = status.kind === 'running' ? status.progress : status.kind === 'ready' || status.kind === 'streaming' ? 1 : 0
  const left =
    status.kind === 'ready' ? t('job.ready')
    : status.kind === 'streaming' ? t('job.perSecond', money(status.perSecond))
    : money(payout)
  const right =
    status.kind === 'ready' ? money(payout)
    : status.kind === 'running' ? duration(status.remaining)
    : status.kind === 'idle' ? t('job.tapToStart')
    : ''

  return (
    <div class={`bar ${status.kind === 'ready' ? 'bar--ready' : ''}`}>
      <div class="bar__fill" ref={fillRef} style={{ width: `${fill * 100}%` }} />
      <div class="bar__text">
        <span>{left}</span>
        <span ref={rightRef}>{right}</span>
      </div>
    </div>
  )
}
