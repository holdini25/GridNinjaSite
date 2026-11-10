import Image from "next/image"
import Link from "next/link"
import { ArrowDownIcon, ArrowRightIcon, PlusIcon } from "lucide-react"

import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { founders } from "@/content/copy/founders"
import { assessmentScopeHref } from "@/lib/marketing-journeys"
import styles from "./founders-page.module.css"

export function FoundersPage() {
  return (
    <div className={styles.page}>
      <SeoPageJsonLd path="/about/founders" />
      <SeoBreadcrumbs path="/about/founders" />

      <header className={`${styles.hero} gn-home-container`}>
        <p className={styles.eyebrow}>The people behind GridNinja</p>
        <div className={styles.heroGrid}>
          <h1>Meet the <span>founders.</span></h1>
          <div className={styles.introduction}>
            <p>Holden Chung and Jonathan Malone bring backgrounds in complex adaptive systems, cloud security, machine learning and biomedical engineering.</p>
            <a className={styles.textLink} href="#founders">Explore their backgrounds <ArrowDownIcon aria-hidden="true" /></a>
          </div>
        </div>
        <div className={styles.heroRule}><span>GridNinja / Founding team</span><span>Proof before autonomy</span></div>
      </header>

      <section id="founders" aria-label="Founder profiles" className={`${styles.profiles} gn-home-container`}>
        {founders.map((founder, index) => (
          <article key={founder.id} id={founder.id} className={styles.profile} aria-labelledby={`${founder.id}-name`}>
            <div className={`${styles.portrait} ${founder.portrait.framing === "close" ? styles.portraitClose : ""}`}>
              <Image src={founder.portrait.src} alt={founder.name} fill sizes="(max-width: 759px) calc(100vw - 40px), (max-width: 1376px) calc((100vw - 128px) / 2), 608px" style={{ objectPosition: founder.portrait.position }} priority />
              <span className={styles.portraitIndex} aria-hidden="true">0{index + 1}</span>
            </div>
            <div className={styles.profileHeader}>
              <p className={styles.role}>{founder.role}</p>
              <h2 id={`${founder.id}-name`}>{founder.name}</h2>
            </div>
            <dl className={styles.background}>
              <div><dt>Background</dt><dd>{founder.background}</dd></div>
              <div><dt>Focus</dt><dd>{founder.focus}</dd></div>
            </dl>
            <details className={styles.experience}>
              <summary><span>Early experience<span className="sr-only"> — {founder.name}</span></span><PlusIcon aria-hidden="true" /></summary>
              <p>{founder.experience}</p>
            </details>
          </article>
        ))}
      </section>

      <div className={`${styles.source} gn-home-container`}>
        <p>Profile backgrounds and portraits adapted from the GridNinja founder presentation.</p>
      </div>

      <section className={`${styles.approach} gn-home-container`} aria-labelledby="founders-approach">
        <div>
          <p className={styles.eyebrow}>The work ahead</p>
          <h2 id="founders-approach">Ambition, grounded<br />in evidence.</h2>
          <Link href="/about" prefetch={false} className={styles.textLink}>About GridNinja <ArrowRightIcon aria-hidden="true" /></Link>
        </div>
        <div className={styles.approachCopy}>
          <p>GridNinja is developing an AI Data Center Virtual Capacity Control Plane. The current offer is a paid, bounded capacity decision assessment using authorized historical inputs.</p>
          <p className={styles.boundary}>Founder profiles introduce the people behind the company. For each engagement, the delivery lead, technical reviewer, relevant experience, availability and customer decision owner are agreed during scoping. Live integration and operating authority require separate evidence and permission.</p>
        </div>
      </section>

      <section className={`${styles.contact} gn-home-container`} aria-labelledby="founders-contact">
        <div><p className={styles.eyebrow}>Start a conversation</p><h2 id="founders-contact">Bring your capacity question.</h2><p>Agree the decision, evidence boundary and responsibilities before work begins.</p></div>
        <div className={styles.actions}>
          <Link href={assessmentScopeHref()} prefetch={false} className={styles.primaryLink}>Scope an assessment <ArrowRightIcon aria-hidden="true" /></Link>
          <Link href="/contact" prefetch={false} className={styles.textLink}>Contact GridNinja <ArrowRightIcon aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  )
}
