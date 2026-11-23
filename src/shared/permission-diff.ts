/**
 * Build reviewable before/after text for file-changing tools. The strings are
 * shown in the inline permission card so a user can inspect the edit before
 * approving it.
 */
export interface PermissionDiffBlock {
  label: string
  before: string
  after: string
}

function stringField(input: Record<string, unknown>, key: string): string {
  return typeof input[key] === 'string' ? String(input[key]) : ''
}

function fileLabel(input: Record<string, unknown>, index?: number): string {
  const path = stringField(input, 'file_path') || stringField(input, 'path') || '文件'
  return index === undefined ? path : `${path} · 编辑 ${index + 1}`
}

export function permissionDiff(
  toolName: string,
  input: Record<string, unknown>
): PermissionDiffBlock[] {
  if (toolName === 'Edit') {
    return [
      {
        label: fileLabel(input),
        before: stringField(input, 'old_string'),
        after: stringField(input, 'new_string')
      }
    ]
  }

  if (toolName === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? input.edits : []
    return edits
      .filter((edit): edit is Record<string, unknown> => Boolean(edit && typeof edit === 'object'))
      .map((edit, index) => ({
        label: fileLabel(input, index),
        before: stringField(edit, 'old_string'),
        after: stringField(edit, 'new_string')
      }))
  }

  if (toolName === 'Write') {
    return [
      {
        label: fileLabel(input),
        before: '',
        after: stringField(input, 'content')
      }
    ]
  }

  if (toolName === 'NotebookEdit') {
    return [
      {
        label: fileLabel(input),
        before: '',
        after: stringField(input, 'new_source')
      }
    ]
  }

  return []
}
