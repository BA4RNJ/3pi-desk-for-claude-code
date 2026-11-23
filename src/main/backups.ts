import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import type { BackupEntry } from '../shared/types'

const SESSION_ID = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i

export function backupSessionId(name: string): string | undefined {
  return name.match(SESSION_ID)?.[1]
}

function safeBackupName(name: string): string {
  if (!name || name !== basename(name) || name === '.' || name === '..') {
    throw new Error('Invalid backup name.')
  }
  if (!name.endsWith('.jsonl')) throw new Error('Not a session backup.')
  return name
}

export async function listBackups(directory: string): Promise<BackupEntry[]> {
  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
  const backups: BackupEntry[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue
    const path = join(directory, entry.name)
    try {
      const info = await fs.stat(path)
      backups.push({
        name: entry.name,
        path,
        size: info.size,
        modifiedAt: info.mtimeMs,
        sessionId: backupSessionId(entry.name)
      })
    } catch {
      // A backup can disappear while the list is being read.
    }
  }
  return backups.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

export async function readBackup(
  directory: string,
  name: string,
  maxBytes = 200 * 1024
): Promise<string> {
  const safe = safeBackupName(name)
  const path = join(directory, safe)
  const handle = await fs.open(path, 'r')
  try {
    const info = await handle.stat()
    const size = Math.min(info.size, Math.max(1, maxBytes))
    const buffer = Buffer.alloc(size)
    const { bytesRead } = await handle.read(buffer, 0, size, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

export async function copyBackup(
  directory: string,
  name: string,
  target: string
): Promise<void> {
  const safe = safeBackupName(name)
  await fs.copyFile(join(directory, safe), target)
}
