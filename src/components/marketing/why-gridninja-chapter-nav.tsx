"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

export function WhyGridNinjaChapterNav({
  chapters,
}: {
  chapters: ReadonlyArray<{ id: string; label: string }>
}) {
  const [activeId, setActiveId] = useState(chapters[0]?.id)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight
      setProgress(scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0)

      const header = document.querySelector("header")
      const chapterNav = document.querySelector(
        'nav[aria-label="Why GridNinja page chapters"]'
      )
      const headerHeight = header?.getBoundingClientRect().height ?? 0
      const chapterNavHeight = chapterNav?.getBoundingClientRect().height ?? 0
      const activationLine =
        window.scrollY + headerHeight + chapterNavHeight + 128

      let nextActiveId = chapters[0]?.id

      chapters.forEach((chapter) => {
        const element = document.getElementById(chapter.id)
        if (element && element.offsetTop <= activationLine) {
          nextActiveId = chapter.id
        }
      })

      setActiveId(nextActiveId)
    }

    const syncHashTarget = () => {
      const hashId = window.location.hash.slice(1)

      if (!hashId || !chapters.some((chapter) => chapter.id === hashId)) {
        handleScroll()
        return
      }

      const element = document.getElementById(hashId)

      if (!element) {
        return
      }

      window.requestAnimationFrame(() => {
        element.scrollIntoView({ block: "start" })
        window.requestAnimationFrame(handleScroll)
      })
    }

    handleScroll()
    syncHashTarget()
    const syncTimeouts = [150, 450].map((delay) =>
      window.setTimeout(syncHashTarget, delay)
    )
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleScroll)
    window.addEventListener("hashchange", syncHashTarget)
    window.addEventListener("load", syncHashTarget)

    return () => {
      syncTimeouts.forEach((timeout) => window.clearTimeout(timeout))
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleScroll)
      window.removeEventListener("hashchange", syncHashTarget)
      window.removeEventListener("load", syncHashTarget)
    }
  }, [chapters])

  useEffect(() => {
    const activeChapter = document.querySelector(
      'nav[aria-label="Why GridNinja page chapters"] a[aria-current="location"]'
    )

    activeChapter?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [activeId])

  return (
    <nav
      aria-label="Why GridNinja page chapters"
      className="sticky top-[4.75rem] z-40 border-y border-border/60 bg-background/88 backdrop-blur-xl lg:top-[7.75rem] xl:top-24"
    >
      <div
        className="h-px bg-proof-cyan"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
      <div className="mx-auto flex max-w-7xl scroll-px-4 gap-2 overflow-x-auto px-4 py-2 sm:scroll-px-6 sm:px-6 lg:scroll-px-8 lg:px-8">
        {chapters.map((chapter, index) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            aria-current={activeId === chapter.id ? "location" : undefined}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-3 py-2 font-mono text-xs tracking-[0.1em] uppercase transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
              activeId === chapter.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 bg-surface/80 text-muted-foreground hover:text-foreground"
            )}
          >
            {String(index + 1).padStart(2, "0")} {chapter.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
