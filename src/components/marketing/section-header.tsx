import type { SectionCopy } from "@/types/site"

type SectionHeaderProps = SectionCopy & {
  align?: "left" | "center"
}

export function SectionHeader({
  eyebrow,
  headline,
  body,
  align = "left",
}: SectionHeaderProps) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-3xl text-center"
          : "max-w-3xl text-left"
      }
    >
      {eyebrow ? (
        <p className="mb-4 text-xs tracking-[0.28em] text-primary uppercase sm:text-sm">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-balance text-[2.15rem] leading-[1.06] font-medium tracking-tight text-foreground sm:text-[2.65rem] sm:leading-[1.04] lg:text-[2.85rem]">
        {headline}
      </h2>
      <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-muted-foreground sm:text-lg">
        {body}
      </p>
    </div>
  )
}
