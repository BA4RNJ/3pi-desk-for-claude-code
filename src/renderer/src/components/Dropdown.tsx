import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  direction?: 'down' | 'up'
  className?: string
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
  direction = 'down',
  className
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className={`dropdown ${className || ''}`} ref={ref}>
      <button type="button" className="chip" onClick={() => setOpen((value) => !value)}>
        {trigger}
        <ChevronDown size={13} className={open ? 'is-open' : ''} />
      </button>
      {open && (
        <div
          className={`dropdown-menu ${align === 'right' ? 'align-right' : 'align-left'} ${
            direction === 'up' ? 'open-up' : ''
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}
