import test from 'node:test'
import assert from 'node:assert/strict'
import { isNewerState, stateRevision } from '../src/shared/sessionState.ts'

test('accepts the first revisioned snapshot', () => {
  assert.equal(isNewerState(undefined, { revision: 1 }), true)
})

test('accepts a strictly newer snapshot', () => {
  assert.equal(isNewerState(3, { revision: 4 }), true)
})

test('rejects an older snapshot delivered late', () => {
  assert.equal(isNewerState(4, { revision: 3 }), false)
})

test('rejects a duplicate snapshot', () => {
  assert.equal(isNewerState(4, { revision: 4 }), false)
})

test('accepts snapshots without a revision for backwards compatibility', () => {
  assert.equal(isNewerState(4, {}), true)
  assert.equal(stateRevision({}), undefined)
})
