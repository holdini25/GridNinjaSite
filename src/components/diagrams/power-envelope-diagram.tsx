"use client"

import { motion, useReducedMotion } from "motion/react"

export function PowerEnvelopeDiagram() {
  const reduceMotion = useReducedMotion()

  const nodes = [
    { x: 126, y: 76, label: "Utility feed" },
    { x: 494, y: 76, label: "Cooling" },
    { x: 126, y: 290, label: "Battery / DER" },
    { x: 494, y: 290, label: "Workload" },
  ]

  const connections = [
    { d: "M142 76 H198 V166", color: "#FF9F1A" },
    { d: "M478 76 H422 V166", color: "#E0B24A" },
    { d: "M142 290 H198 V212", color: "#FF9F1A" },
    { d: "M478 290 H422 V212", color: "#FF9F1A" },
  ]

  const badges = [
    { x: 223, label: "Power" },
    { x: 286, label: "Thermal" },
    { x: 357, label: "Reserve" },
    { x: 425, label: "Proof" },
  ]

  return (
    <div className="rounded-[1.7rem] border border-border/70 bg-surface/94 p-6 shadow-[0_18px_48px_-36px_rgba(8,8,8,0.82)]">
      <svg viewBox="0 0 620 390" className="h-auto w-full">
        <defs>
          <linearGradient id="envelope" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,159,26,0.18)" />
            <stop offset="100%" stopColor="rgba(224,178,74,0.14)" />
          </linearGradient>
        </defs>

        <rect
          x="34"
          y="28"
          width="552"
          height="310"
          rx="22"
          fill="#111111"
          stroke="rgba(255,184,74,0.18)"
        />
        <rect
          x="56"
          y="50"
          width="508"
          height="266"
          rx="18"
          fill="none"
          stroke="rgba(184,184,184,0.12)"
        />
        <motion.rect
          x="196"
          y="118"
          width="228"
          height="96"
          rx="20"
          fill="url(#envelope)"
          stroke="rgba(255,159,26,0.34)"
          initial={reduceMotion ? false : { opacity: 0.86 }}
          animate={reduceMotion ? {} : { opacity: [0.86, 1, 0.9] }}
          transition={{
            duration: 3.8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />

        {connections.map((line, index) => (
          <motion.path
            key={line.d}
            d={line.d}
            fill="none"
            stroke={line.color}
            strokeWidth="2.75"
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0.28 }}
            animate={reduceMotion ? {} : { pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut", delay: index * 0.12 }}
          />
        ))}

        {nodes.map((node) => (
          <g key={node.label}>
            <circle
              cx={node.x}
              cy={node.y}
              r="15"
              fill="#111111"
              stroke="rgba(255,159,26,0.75)"
              strokeWidth="2"
            />
            <text
              x={node.x}
              y={node.y + 36}
              textAnchor="middle"
              fill="#F4F4F4"
              fontSize="15"
              fontFamily="Geist Mono, monospace"
            >
              {node.label}
            </text>
          </g>
        ))}

        {badges.map((badge, index) => (
          <motion.g
            key={badge.label}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.45 + index * 0.06 }}
          >
            <rect
              x={badge.x - 30}
              y="235"
              width="60"
              height="26"
              rx="13"
              fill="#222222"
              stroke="rgba(255,184,74,0.16)"
            />
            <text
              x={badge.x}
              y="252"
              textAnchor="middle"
              fill="#B8B8B8"
              fontSize="12.5"
              fontFamily="Geist Mono, monospace"
            >
              {badge.label}
            </text>
          </motion.g>
        ))}

        <text
          x="220"
          y="158"
          fill="#F4F4F4"
          fontSize="26"
          fontFamily="Geist, sans-serif"
        >
          Safe operating envelope
        </text>
        <text
          x="220"
          y="186"
          fill="#B8B8B8"
          fontSize="15"
          fontFamily="Geist, sans-serif"
        >
          Runtime assurance validates each bundle before execution.
        </text>
      </svg>
      <div className="mt-5 space-y-1.5 text-base leading-7 text-muted-foreground">
        <p>Coordinate utility, DER, cooling, and workload actions</p>
        <p>inside a visible safety envelope with proof before dispatch.</p>
      </div>
    </div>
  )
}
