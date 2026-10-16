import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledContent } from './bundled.ts'
import { newGame } from './state.ts'
import { nextTicket, ticketDue } from './messages.ts'

const base = { now: 200_000, lastShownAt: 0, everySeconds: 180, queueEmpty: true, onJobs: true, tutorialDone: true }

test('a ticket is due every 180 s on the jobs screen when nothing else is shown', () => {
  assert.equal(ticketDue(base), true)
  assert.equal(ticketDue({ ...base, now: 179_999 }), false)
  assert.equal(ticketDue({ ...base, queueEmpty: false }), false)
  assert.equal(ticketDue({ ...base, onJobs: false }), false)
  assert.equal(ticketDue({ ...base, tutorialDone: false }), false)
})

test('tickets go through the whole bank without repeats, then start over', () => {
  const s = newGame(bundledContent, 0, 'ru', 1)
  const seen = Array.from({ length: 50 }, () => nextTicket(s, 50))
  assert.deepEqual(seen, Array.from({ length: 50 }, (_, i) => i))
  assert.equal(nextTicket(s, 50), 0)
  assert.equal(s.ui.ticketCursor, 51)
})
