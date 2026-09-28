"use client"

import dynamic from "next/dynamic"

import { useReducedMotion } from "motion/react"

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
})

const seriesData = [
  8.8, 9.1, 9.3, 10.2, 10.9, 11.4, 10.8, 11.6, 11.2, 11.9, 12.1, 11.6,
]

export function KpiLineChart() {
  const reduceMotion = useReducedMotion()

  return (
    <ReactECharts
      style={{ height: 280, width: "100%" }}
      option={{
        animation: !reduceMotion,
        animationDuration: 500,
        grid: {
          top: 18,
          right: 18,
          bottom: 26,
          left: 42,
        },
        tooltip: {
          trigger: "axis",
          backgroundColor: "#222222",
          borderColor: "rgba(255,184,74,0.18)",
          textStyle: {
            color: "#F4F4F4",
            fontFamily: "Geist Mono, monospace",
          },
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: [
            "12:00",
            "12:20",
            "12:40",
            "13:00",
            "13:20",
            "13:40",
            "14:00",
            "14:20",
            "14:40",
            "15:00",
            "15:20",
            "15:40",
          ],
          axisLine: { lineStyle: { color: "rgba(184,184,184,0.18)" } },
          axisLabel: { color: "#B8B8B8", fontFamily: "Geist Mono, monospace" },
        },
        yAxis: {
          type: "value",
          name: "Safe MW",
          nameTextStyle: {
            color: "#B8B8B8",
            padding: [0, 0, 0, 8],
            fontFamily: "Geist Mono, monospace",
          },
          splitLine: {
            lineStyle: { color: "rgba(184,184,184,0.12)", type: "dashed" },
          },
          axisLabel: { color: "#B8B8B8", fontFamily: "Geist Mono, monospace" },
        },
        series: [
          {
            type: "line",
            smooth: true,
            data: seriesData,
            symbol: "circle",
            symbolSize: 7,
            lineStyle: { color: "#FF9F1A", width: 3 },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "rgba(255,159,26,0.42)" },
                  { offset: 1, color: "rgba(255,159,26,0.04)" },
                ],
              },
            },
            itemStyle: {
              color: "#FF9F1A",
              borderColor: "#080808",
              borderWidth: 2,
            },
            markLine: {
              symbol: "none",
              lineStyle: { color: "#48E89A", type: "dashed" },
              data: [{ yAxis: 11.6, label: { formatter: "current envelope" } }],
            },
          },
        ],
      }}
    />
  )
}
