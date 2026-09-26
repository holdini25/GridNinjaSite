import { useId, useRef } from "react"
import { AssessmentAttribution } from "@/components/assessment/assessment-attribution"
import { ECOSYSTEM_STORY_SCOPE, ecosystemNarrative } from "@/lib/facility/ecosystem-narrative"
import type { AssessmentRecord } from "@/types/assessment"
import type { FacilityPresentationCommand } from "@/types/facility"

type Props = {
  record: AssessmentRecord
  presentation: FacilityPresentationCommand
  rackLabel: string
  motionUnavailable: string | null
  ready: boolean
  sectionOpen: boolean
  onOpen: () => void
  onExit: () => void
  onChapter: (chapter: number) => void
  onPlaying: (playing: boolean) => void
  onReplay: () => void
  onSection: () => void
}

/** A complete HTML story survives poster mode, failed graphics and reduced motion. */
export function FacilityEcosystemStory(props: Props) {
  const narrative = ecosystemNarrative(props.record)
  const headingId = useId(), noteId = useId(), chapterId = useId()
  const openButton = useRef<HTMLButtonElement>(null)
  const chapter = props.presentation.chapter
  const step = chapter === null ? null : narrative.chapters[chapter]
  const exit = () => { props.onExit(); openButton.current?.focus({ preventScroll: true }) }
  return <div className="facility-ecosystem" data-testid="facility-ecosystem" data-story-open={step ? "true" : "false"}>
    <div className="facility-ecosystem-actions">
      <button ref={openButton} type="button" className="facility-action facility-action--activate" aria-expanded={Boolean(step)} aria-controls={step ? headingId : undefined} onClick={step ? exit : props.onOpen}>{step ? "Exit story" : "Follow one workload"}<span aria-hidden="true">{step ? "×" : "→"}</span></button>
      <button type="button" className="facility-action" aria-pressed={props.sectionOpen} disabled={!props.ready} onClick={props.onSection}>{props.sectionOpen ? "Close air-path section" : "Show air-path section"}</button>
    </div>
    {step && <section id={headingId} className="facility-ecosystem-story" aria-labelledby={chapterId} aria-describedby={noteId} data-testid="facility-ecosystem-story" data-chapter={chapter} data-playing={props.presentation.playing ? "true" : "false"} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); exit() } }}>
      <p className="facility-ecosystem-kicker">{props.rackLabel} · Representative inspection anchor</p>
      <nav className="facility-ecosystem-chapters" aria-label="Workload story chapters">{narrative.chapters.map((item, index) => <button key={item.id} type="button" aria-current={chapter === index ? "step" : undefined} aria-label={`Chapter ${index + 1}: ${item.title}`} onClick={() => props.onChapter(index)}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{item.title}</span></button>)}</nav>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{props.presentation.playing ? `Playing chapter ${chapter! + 1} of ${narrative.chapters.length}: ${step.title}.` : ""}</p>
      <div className="facility-ecosystem-copy" aria-live={props.presentation.playing ? "off" : "polite"} aria-atomic="true">
        <p className="facility-ecosystem-index">Chapter {chapter! + 1} of {narrative.chapters.length} · Fixture {props.record.scenario.toUpperCase()}</p>
        <h3 id={chapterId}>{step.title}</h3><p>{step.body}</p><p className="facility-ecosystem-evidence">{step.evidence}</p>
      </div>
      {step.id === "conditions" && <div className="facility-ecosystem-attribution"><AssessmentAttribution record={props.record} /></div>}
      {step.id === "screening" && narrative.comparison && <details className="facility-ecosystem-comparison" key={narrative.identity}>
        <summary>Compare the recorded revision</summary>
        <dl><div><dt>Requested increment</dt><dd>{narrative.comparison.requested}</dd></div><div><dt>Proposed revised increment</dt><dd>{narrative.comparison.revised}</dd></div></dl>
        <p>{narrative.comparison.question}</p><p>Whole-facility assessment values. No alternative rack allocation or operating transition has been evaluated.</p>
      </details>}
      {step.id === "evidence" && <nav className="facility-ecosystem-links" aria-label="Workload story publication files"><a className="facility-evidence-link" href={narrative.links.brief}>Read the versioned brief</a><a className="facility-evidence-link" href={narrative.links.pdf}>Download this PDF</a><a className="facility-evidence-link" href={narrative.links.json}>Download this technical record</a></nav>}
      <div className="facility-ecosystem-playback">
        <button type="button" className="facility-action" disabled={chapter === 0} onClick={() => props.onChapter(chapter! - 1)}>Previous chapter</button>
        <button type="button" className="facility-action facility-action--activate" disabled={Boolean(props.motionUnavailable)} aria-describedby={props.motionUnavailable ? noteId : undefined} onClick={() => props.onPlaying(!props.presentation.playing)}>{props.presentation.playing ? "Pause story" : "Play story"}</button>
        <button type="button" className="facility-action" onClick={props.onReplay}>Replay story</button>
        <button type="button" className="facility-action" onClick={chapter === narrative.chapters.length - 1 ? exit : () => props.onChapter(chapter! + 1)}>{chapter === narrative.chapters.length - 1 ? "Finish story" : "Next chapter"}</button>
      </div>
      <p id={noteId} className="facility-ecosystem-note">{props.motionUnavailable && <span>{props.motionUnavailable} Chapters remain available. </span>}{ECOSYSTEM_STORY_SCOPE}</p>
    </section>}
    <noscript><details className="facility-ecosystem-transcript"><summary>Read “Follow one workload”</summary><p>{ECOSYSTEM_STORY_SCOPE}</p><ol>{narrative.chapters.map(item => <li key={item.id}><h3>{item.title}</h3><p>{item.body}</p><p>{item.evidence}</p></li>)}</ol>{narrative.comparison && <p>Requested: {narrative.comparison.requested}. Proposed revision: {narrative.comparison.revised}. {narrative.comparison.question}</p>}<p><a href={narrative.links.brief}>Read the versioned brief</a> · <a href={narrative.links.pdf}>Download this PDF</a> · <a href={narrative.links.json}>Download this technical record</a></p></details></noscript>
  </div>
}
