import type { SessionState } from './types'

type Revisioned = Pick<SessionState, 'revision'>

export function stateRevision(state: Revisioned): number | undefined {
  return typeof state.revision === 'number' ? state.revision : undefined
}

/**
 * Whether an incoming snapshot should replace the last applied one.
 *
 * `startSession` replies and `session:state` events travel over different IPC
 * paths, so an older snapshot can arrive after a newer one. Applying it would
 * reset `running` to false while the model is still streaming. Snapshots
 * without a revision are always accepted for backwards compatibility.
 */
export function isNewerState(previous: number | undefined, incoming: Revisioned): boolean {
  const revision = stateRevision(incoming)
  if (revision === undefined) return true
  return previous === undefined || revision > previous
}
