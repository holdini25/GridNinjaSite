"use client"

import type { CSSProperties } from "react"

import { motion, useReducedMotion } from "motion/react"

import type { getDispatchDimensions } from "@/content/copy/dispatch-envelope"

type DimensionRow = ReturnType<typeof getDispatchDimensions>[number]

export function DispatchDimensionAuditPanel({
  dimensions,
  scenarioId,
}: {
  dimensions: DimensionRow[]
  scenarioId: string
}) {
  const reduced = useReducedMotion()

  return (
    <section className="border-t border-border/70 px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gn-eyebrow text-[0.68rem]">Envelope dimension audit</p>
          <h3 className="mt-2 text-xl font-medium text-foreground">
            What changed beyond MW?
          </h3>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          requested -&gt; accepted -&gt; binding source
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dimensions.map((dimension) => {
          const base = Math.max(
            dimension.requestedValue,
            dimension.acceptedValue ?? 0,
            1
          )
          const requestedWidth = Math.min(
            100,
            (dimension.requestedValue / base) * 100
          )
          const acceptedWidth =
            dimension.acceptedValue == null
              ? 0
              : Math.min(100, (dimension.acceptedValue / base) * 100)
          const changed =
            dimension.acceptedValue == null ||
            Math.abs(dimension.requestedValue - dimension.acceptedValue) > 0.001

          return (
            <motion.article
              key={`${scenarioId}-${dimension.id}`}
              className="rounded-[0.9rem] border border-border/70 bg-background/45 p-4"
              initial={reduced || !changed ? false : { boxShadow: "0 0 0 rgba(224,178,74,0)" }}
              animate={
                reduced || !changed
                  ? {}
                  : {
                      boxShadow: [
                        "0 0 0 rgba(224,178,74,0)",
                        "0 0 0 1px rgba(224,178,74,.42)",
                        "0 0 0 rgba(224,178,74,0)",
                      ],
                    }
              }
              transition={{ duration: 0.54, ease: [0.16, 1, 0.3, 1] }}
              data-testid={`dispatch-dimension-${dimension.id}`}
              data-dimension-changed={changed}
            >
              <p className="font-mono text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
                {dimension.label}
              </p>
              <p className="mt-3 font-mono text-lg">
                <span className="text-primary">{dimension.requested}</span>
                <span className="mx-2 text-muted-foreground">-&gt;</span>
                <motion.span
                  className="text-signal"
                  initial={reduced || !changed ? false : { opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {dimension.accepted}
                </motion.span>
              </p>
              <div
                className="gn-dispatch-dimension-rail mt-4"
                style={
                  {
                    "--requested-width": `${requestedWidth}%`,
                    "--accepted-width": `${acceptedWidth}%`,
                  } as CSSProperties
                }
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Binding source:{" "}
                <span className={changed ? "text-warning" : undefined}>
                  {dimension.bindingSource}
                </span>
              </p>
            </motion.article>
          )
        })}
      </div>
    </section>
  )
}
