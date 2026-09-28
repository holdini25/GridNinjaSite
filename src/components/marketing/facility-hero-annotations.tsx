import { FacilityHeroActivity } from "./facility-hero-activity"

/** Camera-projected anchors for cinematic-v1 only. The SVG uses the same contain
 * fit as the underlying image/video, including after a frozen rendition rotates. */
export function FacilityHeroAnnotations() {
  return <>
    <svg className="gn-home-annotations gn-home-annotations--desktop" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <FacilityHeroActivity />
      <g className="gn-home-annotation-lines"><path d="M384.563 279.312V164H177" /><circle cx="384.563" cy="279.312" r="5" /><path d="M1160.165 244.557V129H1480" /><circle cx="1160.165" cy="244.557" r="5" /><path d="M838.630 555.684 1255 792H1460" /><circle cx="838.630" cy="555.684" r="5" /></g>
      <g className="gn-home-annotation-labels"><text x="177" y="142">Power</text><text x="1480" y="107" textAnchor="end">Cooling</text><text x="1460" y="848" textAnchor="end">Workloads</text></g>
    </svg>
    <svg className="gn-home-annotations gn-home-annotations--mobile" viewBox="0 0 1600 1200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <FacilityHeroActivity mobile />
      <g className="gn-home-annotation-lines"><path d="M384.563 379.312V240H115" /><circle cx="384.563" cy="379.312" r="5" /><path d="M1160.165 344.556V212H1500" /><circle cx="1160.165" cy="344.556" r="5" /><path d="M838.630 655.684 1255 904H1490" /><circle cx="838.630" cy="655.684" r="5" /></g>
      <g className="gn-home-annotation-labels"><text x="115" y="212">Power</text><text x="1500" y="184" textAnchor="end">Cooling</text><text x="1490" y="982" textAnchor="end">Workloads</text></g>
    </svg>
  </>
}
