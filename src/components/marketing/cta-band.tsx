import Link from "next/link"

import { ArrowRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function CtaBand({
  eyebrow = "Capacity Audit",
  headline,
  body,
  label,
  href,
  eventName = "cta-band",
}: {
  eyebrow?: string
  headline: string
  body: string
  label: string
  href: string
  eventName?: string
}) {
  return (
    <div className="gn-panel px-6 py-7 sm:px-8 sm:py-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
      <div className="max-w-2xl">
        <p className="gn-eyebrow">{eyebrow}</p>
        <h2 className="mt-4 text-balance text-[2.05rem] leading-[1.08] font-medium text-foreground sm:text-[2.45rem] sm:leading-[1.06] lg:text-[2.65rem]">
          {headline}
        </h2>
        <p className="mt-4 max-w-xl text-[1.02rem] leading-8 text-muted-foreground sm:text-lg sm:leading-9">
          {body}
        </p>
      </div>
      <div className="mt-8 lg:mt-0">
        <Button asChild size="lg" className="group">
          <Link href={href} data-gn-event={eventName}>
            {label}
            <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
