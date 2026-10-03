/** Visible activity emitters projected from the unchanged cinematic-v1 masters.
 * Fixed-status lamps and LEDs occluded by reserve equipment are excluded.
 * Projection/occlusion evidence: build/qa/cinematic/light-refinement/.
 * The mobile camera preserves x and adds 100 in its 1600 × 1200 view box. */
const lamps = [
  { id: "GN_LED_00", x: 480.308, y: 551.473 },
  { id: "GN_LED_02", x: 480.308, y: 435.952 },
  { id: "GN_LED_04", x: 556.583, y: 583.715 },
  { id: "GN_LED_06", x: 556.583, y: 468.195 },
  { id: "GN_LED_08", x: 632.857, y: 615.957 },
  { id: "GN_LED_10", x: 632.857, y: 500.437 },
  { id: "GN_LED_12", x: 709.132, y: 648.200 },
  { id: "GN_LED_14", x: 709.132, y: 532.679 },
  { id: "GN_LED_16", x: 785.407, y: 680.442 },
  { id: "GN_LED_18", x: 785.407, y: 564.922 },
  { id: "GN_LED_45", x: 1031.490, y: 554.436 },
  { id: "GN_LED_46", x: 1031.490, y: 496.675 },
] as const

export function FacilityHeroActivity({ mobile = false }: { mobile?: boolean }) {
  return <g className="gn-home-activity" transform={mobile ? "translate(0 100)" : undefined}>
      {lamps.map((lamp, index) => {
        // Five/ten-second cycles divide the movie loop, with staggered phases.
        const duration = index % 3 === 0 ? 10 : 5
        return <g key={lamp.id} data-light={lamp.id} className="gn-home-activity-lamp"
          transform={`translate(${lamp.x} ${lamp.y})`}
          style={{ animationDuration: `${duration}s`, animationDelay: `-${((index * .61803398875) % 1 * duration).toFixed(3)}s` }}>
          <circle className="gn-home-activity-halo" r="7" />
          <circle className="gn-home-activity-edge" r="4" />
          <circle className="gn-home-activity-core" r="2.5" />
        </g>
      })}
  </g>
}
