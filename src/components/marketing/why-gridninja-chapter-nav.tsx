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
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) {
          setActiveId(visible.target.id)
        }
      },
      {
        rootMargin: "-24% 0px -60% 0px",
        threshold: [0.1, 0.35, 0.6],
      }
    )

    chapters.forEach((chapter) => {
      const element = document.getElementById(chapter.id)
      if (element) {
        observer.observe(element)
      }
    })

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", handleScroll)
    }
  }, [chapters])

  return (
    <nav
      aria-label="Why GridNinja page chapters"
      className="sticky top-[5.5rem] z-40 border-y border-border/60 bg-background/88 backdrop-blur-xl"
    >
      <div
        className="h-px bg-proof-cyan"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
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
