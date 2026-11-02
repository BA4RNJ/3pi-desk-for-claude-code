import appIcon from '../assets/app-icon.png'

interface AppMarkProps {
  size?: number
  className?: string
}

/** The 3PI Desk application mark, used for brand surfaces in the UI. */
export function AppMark({ size = 24, className }: AppMarkProps) {
  return (
    <img
      src={appIcon}
      width={size}
      height={size}
      className={className}
      alt=""
      draggable={false}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: '22%' }}
    />
  )
}
