/* Immutable, responsive civic art; no image service or client runtime. */
import type { ReactNode } from "react"
import { civicCopy } from "@/content/copy/civic"
import type { CivicRelease } from "@/types/civic"

function FacilityGeometry() {
  return <g className="gn-civic-facility">
    <path d="m420 165 230-95 255 114-230 100Z" className="gn-civic-roof" />
    <path d="M420 165v119l255 119V284Z" className="gn-civic-wall" />
    <path d="M675 284v119l230-102V184Z" className="gn-civic-roof" />
    <path d="m472 147 178-73 200 90-177 76Z" className="gn-civic-wall" />
    {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${485 + i * 30} ${167 + i * 13}v84l18 8v-84Z`} className="gn-civic-inset" />)}
    {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${700 + i * 36} ${287 - i * 16}v67l20-9v-67Z`} className="gn-civic-inset" />)}
    <path d="m690 271 201-90" className="gn-civic-highlight" />
    <path d="m370 292 310 145 273-121-6-150" className="gn-civic-boundary" />
  </g>
}

function GridGeometry() {
  return <g>
    <path d="m96 250 137-60 122 55-137 62Z" className="gn-civic-roof" />
    <path d="M96 250v25l122 57v-25m0 25 137-61v-26" className="gn-civic-wall" />
    {[0, 1, 2].map(i => <g key={i}><path d={`M${143 + i * 54} ${231 + i * 24}v-67m-18 17h36m-36 15h36m-36 15h36`} /><path d={`M${126 + i * 54} ${233 + i * 24}l18-8 18 8v26l-18 8-18-8Z`} className="gn-civic-wall" /></g>)}
  </g>
}

function CommunityGeometry() {
  return <g>{[[1010, 150], [1090, 200], [1000, 260]].map(([x, y]) => <g key={x}>
    <path d={`M${x} ${y}l34-32 40 18 15 40-36 16Z`} className="gn-civic-roof" />
    <path d={`M${x} ${y}v46l53 24v-54m0 54 36-16v-38`} className="gn-civic-wall" />
    <path d={`M${x + 15} ${y + 12}v16l12 6v-16Z`} className="gn-civic-window" />
  </g>)}</g>
}

/** The static geometry also remains underneath failed media. Meaning stays in HTML. */
function CivicFallback() {
  return <div className="gn-civic-fallback" aria-hidden="true">
    <svg className="gn-civic-landscape" viewBox="0 0 1280 460" focusable="false">
      <g className="gn-civic-ground">{Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${80 + i * 100} 20 ${i * 100 - 220} 440`} />)}{Array.from({ length: 8 }, (_, i) => <path key={i} d={`M20 ${40 + i * 45}H1260`} />)}</g>
      <GridGeometry /><FacilityGeometry /><CommunityGeometry />
    </svg>
    <svg className="gn-civic-portrait" viewBox="0 0 400 340" focusable="false">
      <g transform="translate(-120 -4) scale(.48)"><FacilityGeometry /></g>
      <g transform="translate(-10 154) scale(.46)"><GridGeometry /></g>
      <g transform="translate(-330 154) scale(.55)"><CommunityGeometry /></g>
    </svg>
  </div>
}

/** Static illustration: no arrows, energy quantities, control lines or claimed benefits. */
export function CivicIllustration({ release = null, immersive = false, intro }: { release?: CivicRelease | null; immersive?: boolean; intro?: ReactNode }) {
  const portraitSizes = immersive ? "(min-width: 680px) 680px, 100vw" : "calc(100vw - 48px)"
  const landscapeMaxWidth = release?.release === "civic-v2" ? 1600 : 1920
  const landscapeSizes = immersive ? `(min-width: ${landscapeMaxWidth}px) ${landscapeMaxWidth}px, 100vw` : "(min-width: 1376px) 1280px, calc(100vw - 96px)"
  return <figure className={`gn-civic-figure${immersive ? " gn-civic-figure--immersive" : ""}`} data-civic-release={release?.release ?? "unavailable"}>
    <div className={immersive ? "gn-civic-scene" : undefined}>
      {intro}
      <div className="gn-civic-artwork" data-has-artwork={Boolean(release)}>
        <CivicFallback />
        {release && <picture>
          {release.images.portrait.avif && <source media="(max-width: 819px)" type="image/avif" srcSet={release.images.portrait.avif.srcSet} sizes={portraitSizes} width={release.images.portrait.width} height={release.images.portrait.height} />}
          <source media="(max-width: 819px)" type="image/webp" srcSet={release.images.portrait.srcSet} sizes={portraitSizes} width={release.images.portrait.width} height={release.images.portrait.height} />
          {release.images.landscape.avif && <source media="(min-width: 820px)" type="image/avif" srcSet={release.images.landscape.avif.srcSet} sizes={landscapeSizes} width={release.images.landscape.width} height={release.images.landscape.height} />}
          <img src={release.images.landscape.src} srcSet={release.images.landscape.srcSet} sizes={landscapeSizes} width={release.images.landscape.width} height={release.images.landscape.height} alt="" loading="lazy" decoding="async" />
        </picture>}
      </div>
    </div>
    <figcaption className={`gn-civic-caption${immersive ? " gn-home-container" : ""}`}>
      <div className="gn-civic-labels"><span>Grid constraints</span><span>Facility perimeter</span><span>Local community</span></div>
      <p><span className="sr-only">A fenced data center, separate grid infrastructure, and a nearby local community. The scene does not define an assessment boundary or operating authority. </span>Synthetic concept. Grid services, resource impacts and community benefits require separate evidence and review.</p>
    </figcaption>
  </figure>
}

export function CivicComposition({ id = "shared-infrastructure", release = null }: { id?: string; release?: CivicRelease | null }) {
  const [headingStart, headingEnd] = civicCopy.heading.split("accountable neighbors")
  return <section className="gn-civic gn-civic--immersive gn-home-section" id={id} aria-labelledby={`${id}-heading`}>
    <CivicIllustration release={release} immersive intro={<div className="gn-home-container gn-civic-copy"><header className="gn-civic-intro"><p className="gn-home-eyebrow">Our ambition</p><h2 id={`${id}-heading`}>{headingStart}<span>accountable neighbors</span>{headingEnd}</h2></header></div>} />
    <div className="gn-home-container gn-civic-principles">
      <ol className="gn-civic-responsibilities">{civicCopy.responsibilities.map((item, i) => <li key={item.title}><span aria-hidden="true">0{i + 1}</span><h3>{item.title}</h3><p>{item.body}</p></li>)}</ol>
      <p className="gn-civic-bridge">{civicCopy.bridge}</p>
    </div>
  </section>
}
