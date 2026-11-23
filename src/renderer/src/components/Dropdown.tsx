import { ChevronDown } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'

export interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  direction?: 'down' | 'up'
  className?: string
  menuClassName?: string
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
  direction = 'down',
  className,
  menuClassName
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Absolute menus near a screen edge (the composer controls on a phone) can
  // render partially off-screen. Nudge them back into the viewport without
  // changing the desktop positioning.
  useLayoutEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const wrapper = ref.current
    if (!menu || !wrapper) return
    menu.style.left = ''
    menu.style.right = ''
    const rect = menu.getBoundingClientRect()
    const margin = 12
    let shift = 0
    if (rect.left < margin) shift = margin - rect.left
    else if (rect.right > window.innerWidth - margin) {
      shift = window.innerWidth - margin - rect.right
    }
    if (shift !== 0) {
      const wrapperRect = wrapper.getBoundingClientRect()
      menu.style.left = `${rect.left - wrapperRect.left + shift}px`
      menu.style.right = 'auto'
    }
  }, [open])

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
          ref={menuRef}
          className={`dropdown-menu ${align === 'right' ? 'align-right' : 'align-left'} ${
            direction === 'up' ? 'open-up' : ''
          } ${menuClassName || ''}`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}
