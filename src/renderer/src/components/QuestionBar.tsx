import { Check, HelpCircle } from 'lucide-react'
import { useState } from 'react'
import type { PermissionRequestPayload } from '../../../shared/types'

interface QuestionOption {
  label: string
  description?: string
  preview?: string
}

interface QuestionItem {
  question: string
  header?: string
  options: QuestionOption[]
  multiSelect?: boolean
}

interface QuestionBarProps {
  request: PermissionRequestPayload
  tabTitle?: string
  onRespond: (
    request: PermissionRequestPayload,
    decision: 'allow' | 'deny',
    answers?: Record<string, string | string[]>
  ) => void
  onSwitchTab?: () => void
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

export function QuestionBar({
  request,
  tabTitle,
  onRespond,
  onSwitchTab
}: QuestionBarProps) {
  const questions = readQuestions(request)
  const [selected, setSelected] = useState<Record<number, string[]>>({})
  const [custom, setCustom] = useState<Record<number, string>>({})

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

  return (
    <div className="permission-bar-wrap">
      <div className="permission-bar question-bar">
        <div className="permission-bar-head">
          <span className="permission-bar-icon">
            <HelpCircle size={17} />
          </span>
          <div className="permission-bar-copy">
            <strong>{request.title || '需要你的选择'}</strong>
            <small>
              {request.description || '回答下面的问题后将继续。'}
              {tabTitle && <> · <span data-i18n-skip>{tabTitle}</span></>}
            </small>
          </div>
          {onSwitchTab && tabTitle && (
            <button type="button" className="permission-switch" onClick={onSwitchTab}>
              切换
            </button>
          )}
        </div>

        <div className="question-list question-bar-list">
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

        <div className="permission-bar-actions">
          <button type="button" className="button ghost" onClick={() => onRespond(request, 'deny')}>
            跳过
          </button>
          <button
            type="button"
            className="button primary"
            disabled={!complete}
            onClick={() => {
              if (complete) onRespond(request, 'allow', answers)
            }}
          >
            发送回答
          </button>
        </div>
      </div>
    </div>
  )
}
