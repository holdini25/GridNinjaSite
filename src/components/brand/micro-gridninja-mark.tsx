/** Shared static geometry; no animation runtime or hooks. */
export function MicroMark({ ids, className }: { ids: { copper: string; guardian: string }; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
      className={className}
    >
      <defs>
        <linearGradient id={ids.copper} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF9A2E" />
          <stop offset=".55" stopColor="#F58220" />
          <stop offset="1" stopColor="#C9570A" />
        </linearGradient>
        <g id={ids.guardian}>
          <path d="M204.5 165 271 195.5 275 205.5 188.5 249 141 269 142 266.5 142 259.5 143 258.5 150 203.5 151 198.5 153.5 196Z" />
          <path d="M282.5 216Q285.1 215.2 284 218.5L283 219.5 279 250.5 275.5 254 245 273.5 247.5 274 273.5 263 274 269.5 272 275.5 269 298.5 266.5 301 178.5 360 153 330.5 217 281.5 223 252.5 225.5 247Z" />
          <path d="M179.5 266 180 274.5 179 275.5 179 285.5 176.5 290 145.5 312 145 280Z" />
        </g>
      </defs>

      <g
        fill="none"
        stroke={`url(#${ids.copper})`}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-part="globe-grid"
      >
        <circle cx="128" cy="128" r="100" />
        <path d="M128 28v67M128 161v67" strokeWidth="5" />
      </g>
      <g
        transform="translate(128 128) scale(.45) translate(-345 -290)"
        fill="#F7FAFC"
        stroke="#07182B"
        strokeWidth="4"
        strokeLinejoin="round"
      >
        <g data-part="guardian-left">
          <use href={`#${ids.guardian}`} />
        </g>
        <g data-part="guardian-right">
          <use
            href={`#${ids.guardian}`}
            transform="translate(690 0) scale(-1 1)"
          />
        </g>
      </g>
      <path
        d="M128 94c4 18 10 28 29 34-19 6-25 16-29 34-4-18-10-28-29-34 19-6 25-16 29-34Z"
        fill={`url(#${ids.copper})`}
        data-part="proof-glow"
      />
      <path
        d="M128 94c4 18 10 28 29 34-19 6-25 16-29 34-4-18-10-28-29-34 19-6 25-16 29-34Z"
        fill={`url(#${ids.copper})`}
        data-part="proof-core"
      />
      <circle
        cx="128"
        cy="128"
        r="100"
        pathLength="1"
        fill="none"
        stroke="#FF9A2E"
        strokeWidth="5"
        strokeLinecap="round"
        data-part="proof-sweep"
      />
    </svg>
  )
}

