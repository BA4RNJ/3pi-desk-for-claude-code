interface StarburstProps {
  size?: number
  className?: string
}

export function Starburst({ size = 22, className }: StarburstProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="17" strokeLinecap="round">
        <g>
          <line x1="128" y1="88" x2="128" y2="20" transform="rotate(0 128 128)" />
          <line x1="128" y1="88" x2="128" y2="20" transform="rotate(60 128 128)" />
          <line x1="128" y1="88" x2="128" y2="20" transform="rotate(120 128 128)" />
          <line x1="128" y1="88" x2="128" y2="20" transform="rotate(180 128 128)" />
          <line x1="128" y1="88" x2="128" y2="20" transform="rotate(240 128 128)" />
          <line x1="128" y1="88" x2="128" y2="20" transform="rotate(300 128 128)" />
        </g>
        <g>
          <line x1="128" y1="88" x2="128" y2="44" transform="rotate(30 128 128)" />
          <line x1="128" y1="88" x2="128" y2="44" transform="rotate(90 128 128)" />
          <line x1="128" y1="88" x2="128" y2="44" transform="rotate(150 128 128)" />
          <line x1="128" y1="88" x2="128" y2="44" transform="rotate(210 128 128)" />
          <line x1="128" y1="88" x2="128" y2="44" transform="rotate(270 128 128)" />
          <line x1="128" y1="88" x2="128" y2="44" transform="rotate(330 128 128)" />
        </g>
      </g>
    </svg>
  )
}
