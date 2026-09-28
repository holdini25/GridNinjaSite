export function TopologyMap({
  items,
}: {
  items: Array<{ title: string; body: string }>
}) {
  return (
    <div className="rounded-[1.8rem] border border-border/70 bg-surface p-5">
      <svg viewBox="0 0 1140 220" className="h-auto w-full">
        {items.map((item, index) => {
          const x = 38 + index * 182
          const isLast = index === items.length - 1

          return (
            <g key={item.title}>
              <rect
                x={x}
                y="58"
                width="140"
                height="84"
                rx="22"
                fill="rgba(34,34,34,0.92)"
                stroke="rgba(255,184,74,0.18)"
              />
              <text
                x={x + 70}
                y="92"
                textAnchor="middle"
                fill="#F4F4F4"
                fontSize="17"
                fontFamily="Geist, sans-serif"
              >
                {item.title}
              </text>
              {!isLast ? (
                <path
                  d={`M${x + 140} 100 H${x + 182}`}
                  fill="none"
                  stroke="#FF9F1A"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ) : null}
            </g>
          )
        })}
      </svg>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-[1.2rem] border border-border/70 bg-background/60 px-4 py-4"
          >
            <h3 className="text-base font-medium text-foreground">{item.title}</h3>
            <p className="mt-2 text-base leading-8 text-muted-foreground">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
