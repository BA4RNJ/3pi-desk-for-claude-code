import { Check, HelpCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PermissionRequestPayload } from '../../../shared/types'

interface QuestionOption {
  label: string
  description?: string
  preview?: string
  multiSelect?: boolean
}

interface QuestionItem {
  question: string
  header?: string
  options: QuestionOption[]
  multiSelect?: boolean
}

interface QuestionDialogProps {
  request: PermissionRequestPayload
  tabTitle?: string
  onRespond: (
    request: PermissionRequestPayload,
    decision: 'allow' | 'deny',
    answers?: Record<string, string | string[]>
  ) => void
}

function readQuestions(request: PermissionRequestPayload): QuestionItem[] {
  const raw = request.input.questions
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      question: String(item.question || '请选择'),
      header: item.header ? String(item.header) : undefined,
      multiSelect: Boolean(item.multiSelect),
      options: Array.isArray(item.options)
        ? item.options
            .filter((option: any) => option && typeof option === 'object')
            .map((option: any) => ({
              label: String(option.label || ''),
              description: option.description ? String(option.description) : undefined,
              preview: option.preview ? String(option.preview) : undefined
            }))
        : []
    }))
}

export function QuestionDialog({ request, tabTitle, onRespond }: QuestionDialogProps) {
  const questions = readQuestions(request)
  const [selected, setSelected] = useState<Record<number, string[]>>({})
  const [custom, setCustom] = useState<Record<number, string>>({})

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onRespond(request, 'deny')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onRespond, request])

  const toggle = (index: number, label: string, multi: boolean): void => {
    setSelected((current) => {
      const existing = current[index] || []
      if (multi) {
        return {
          ...current,
          [index]: existing.includes(label)
            ? existing.filter((item) => item !== label)
            : [...existing, label]
        }
      }
      return { ...current, [index]: [label] }
    })
  }

  const answers: Record<string, string | string[]> = {}
  let complete = questions.length > 0
  questions.forEach((question, index) => {
    const chosen = selected[index] || []
    const customValue = (custom[index] || '').trim()
    const values = customValue ? [...chosen, customValue] : chosen
    if (values.length === 0) complete = false
    answers[question.question] = question.multiSelect ? values : values[0] || ''
  })

  const submit = (): void => {
    if (!complete) return
    onRespond(request, 'allow', answers)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="permission-dialog question-dialog" role="dialog" aria-modal="true" aria-label="回答提问">
        <button
          type="button"
          className="dialog-close"
          onClick={() => onRespond(request, 'deny')}
          aria-label="跳过"
        >
          <X size={16} />
        </button>

        <div className="permission-header">
          <span className="permission-icon question-icon">
            <HelpCircle size={20} />
          </span>
          <div>
            <h2>{request.title || '需要你的选择'}</h2>
            <p>
              {request.description || '回答下面的问题后将继续。'}
              {tabTitle ? ` · ${tabTitle}` : ''}
            </p>
          </div>
        </div>

        <div className="question-list">
          {questions.map((question, index) => {
            const chosen = selected[index] || []
            return (
              <div key={`${question.question}-${index}`} className="question-block">
                <div className="question-head">
                  {question.header && <span className="question-header">{question.header}</span>}
                  <strong>{question.question}</strong>
                  {question.multiSelect && <small>可多选</small>}
                </div>
                <div className="question-options">
                  {question.options.map((option) => {
                    const active = chosen.includes(option.label)
                    return (
                      <button
                        key={option.label}
                        type="button"
                        className={`question-option ${active ? 'is-selected' : ''}`}
                        onClick={() =>
                          toggle(index, option.label, Boolean(question.multiSelect))
                        }
                      >
                        <span className="question-check">
                          {active && <Check size={12} />}
                        </span>
                        <span>
                          <strong>{option.label}</strong>
                          {option.description && <small>{option.description}</small>}
                          {option.preview && active && (
                            <pre className="question-preview">{option.preview}</pre>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <input
                  className="text-input question-custom"
                  placeholder="其他答案（可选）"
                  value={custom[index] || ''}
                  onChange={(event) =>
                    setCustom((current) => ({
                      ...current,
                      [index]: event.target.value
                    }))
                  }
                />
              </div>
            )
          })}
        </div>

        {questions.length === 0 && (
          <div className="settings-error">这个提问没有可显示的问题数据。</div>
        )}

        <div className="permission-actions">
          <button type="button" className="button ghost" onClick={() => onRespond(request, 'deny')}>
            跳过
          </button>
          <button
            type="button"
            className="button primary"
            disabled={!complete}
            onClick={submit}
          >
            发送回答
          </button>
        </div>
      </div>
    </div>
  )
}
