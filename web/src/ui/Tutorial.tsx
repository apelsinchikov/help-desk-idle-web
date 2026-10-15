import { useEffect, useState } from 'preact/hooks'
import { t } from '../app/strings.ts'
import { tutorialView } from '../core/progress.ts'
import type { TutorialTarget } from '../core/progress.ts'
import { useGame } from './context.ts'

type Rect = { top: number; left: number; width: number; height: number }
const PAD = 6

function selector(target: TutorialTarget): string | null {
  if (target.kind === 'none') return null
  return 'jobId' in target ? `[data-tutorial="${target.kind}:${target.jobId}"]` : `[data-tutorial="${target.kind}"]`
}

/**
 * Обучение: затемняет всё, кроме подсвеченного элемента, и блокирует нажатия вне него.
 * Позиция элемента пересчитывается каждый кадр (список скроллится, карточки перерисовываются).
 */
export function Tutorial() {
  const game = useGame()
  const view = tutorialView(game.engine, game.route.value)
  const sel = view ? selector(view.target) : null
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!sel) { setRect(null); return }
    let frame = 0
    let scrolled = false
    const tick = () => {
      const el = document.querySelector(sel)
      if (el) {
        const r = el.getBoundingClientRect()
        if (!scrolled && (r.top < 0 || r.bottom > window.innerHeight)) {
          el.scrollIntoView({ block: 'center' })
          scrolled = true
        }
        setRect((old) => old && old.top === r.top && old.left === r.left && old.width === r.width && old.height === r.height
          ? old : { top: r.top, left: r.left, width: r.width, height: r.height })
      } else {
        setRect(null)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [sel])

  if (!view) return null
  if (sel && !rect) return null

  const hole = rect && { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
  const below = !hole || hole.top + hole.height < window.innerHeight * 0.6
  const bubbleStyle = hole
    ? below ? { top: `${hole.top + hole.height + 12}px` } : { bottom: `${window.innerHeight - hole.top + 12}px` }
    : { top: '40%' }

  return (
    <div class="tutorial">
      {hole ? (
        <>
          {/* четыре блокера вокруг выреза: нажатия проходят только в подсвеченный элемент */}
          <div class="tutorial__block" style={{ top: 0, left: 0, right: 0, height: `${Math.max(0, hole.top)}px` }} />
          <div class="tutorial__block" style={{ top: `${hole.top + hole.height}px`, left: 0, right: 0, bottom: 0 }} />
          <div class="tutorial__block" style={{ top: `${hole.top}px`, left: 0, width: `${Math.max(0, hole.left)}px`, height: `${hole.height}px` }} />
          <div class="tutorial__block" style={{ top: `${hole.top}px`, left: `${hole.left + hole.width}px`, right: 0, height: `${hole.height}px` }} />
          <div class="tutorial__frame" style={{ top: `${hole.top}px`, left: `${hole.left}px`, width: `${hole.width}px`, height: `${hole.height}px` }} />
        </>
      ) : (
        <div class="tutorial__block tutorial__block--dim" style={{ inset: 0 }} />
      )}
      <div class="tutorial__bubble" style={bubbleStyle}>
        <p>{t(view.textKey)}</p>
        {view.needsAck && <button class="hint__ok" onClick={() => game.ackTutorial()}>{t('common.gotIt')}</button>}
      </div>
    </div>
  )
}
