export function PowerWallChart() {
  return (
    <div className="rounded-[1.6rem] border border-border/70 bg-surface p-6">
      <svg
        viewBox="0 0 640 390"
        className="h-auto w-full"
        aria-labelledby="power-wall-title power-wall-desc"
        role="img"
      >
        <title id="power-wall-title">AI demand versus grid delivery timing</title>
        <desc id="power-wall-desc">
          A solid orange AI demand curve rises faster than a dashed grid delivery
          curve, with the shaded gap showing stranded capacity.
        </desc>
        <defs>
          <linearGradient id="power-wall-gap" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,159,26,0.05)" />
            <stop offset="45%" stopColor="rgba(255,159,26,0.16)" />
            <stop offset="100%" stopColor="rgba(224,178,74,0.12)" />
          </linearGradient>
        </defs>

        <rect
          x="26"
          y="24"
          width="588"
          height="326"
          rx="22"
          fill="#111111"
          stroke="rgba(255,184,74,0.18)"
        />

        <path
          d="M78 280 V82 M78 280 H566"
          fill="none"
          stroke="rgba(184,184,184,0.18)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        <path
          d="M176 223 C230 198 292 153 354 111 C426 90 492 84 560 82 L560 176 C492 188 420 199 344 209 C280 217 226 221 176 223 Z"
          fill="url(#power-wall-gap)"
        />

        <path
          d="M78 252 C128 233 170 227 220 194 C286 151 354 111 560 82"
          fill="none"
          stroke="#FF9F1A"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M78 226 C176 221 260 214 344 204 C420 194 492 185 560 176"
          fill="none"
          stroke="#E0B24A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="7 9"
        />

        <text
          x="486"
          y="74"
          fill="#F4F4F4"
          fontSize="16"
          fontFamily="Geist Mono, monospace"
          textAnchor="start"
        >
          AI demand
        </text>
        <text
          x="388"
          y="210"
          fill="#B8B8B8"
          fontSize="14"
          fontFamily="Geist Mono, monospace"
          textAnchor="start"
        >
          Grid / interconnect timeline
        </text>

        <line
          x1="436"
          y1="156"
          x2="396"
          y2="182"
          stroke="rgba(184,184,184,0.42)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        <rect
          x="412"
          y="96"
          width="164"
          height="92"
          rx="18"
          fill="#222222"
          stroke="rgba(255,184,74,0.22)"
        />
        <text
          x="438"
          y="128"
          fill="#F4F4F4"
          fontSize="24"
          fontFamily="Geist, sans-serif"
        >
          Stranded MW
        </text>
        <text
          x="438"
          y="153"
          fill="#B8B8B8"
          fontSize="15"
          fontFamily="Geist, sans-serif"
        >
          AI demand outpaces
        </text>
        <text
          x="438"
          y="173"
          fill="#B8B8B8"
          fontSize="15"
          fontFamily="Geist, sans-serif"
        >
          grid delivery.
        </text>
      </svg>
    </div>
  )
}
