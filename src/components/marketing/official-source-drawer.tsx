"use client"

import { cloneElement, type MouseEvent, type ReactElement } from "react"

import type { WhyGridNinjaSourceRecord } from "@/content/copy/why-gridninja"
import { notifyWhyGridNinjaContextChange } from "@/lib/url-state"

import { openWhyGridNinjaSourceDrawer } from "@/components/marketing/why-gridninja-source-drawer-host"

export function OfficialSourceDrawer({
  source,
  trigger,
}: {
  source: WhyGridNinjaSourceRecord
  trigger: ReactElement<{ onClick?: (event: MouseEvent) => void }>
}) {
  return cloneElement(trigger, {
    onClick: (event: MouseEvent) => {
      trigger.props.onClick?.(event)
      openWhyGridNinjaSourceDrawer(source.id)
      notifyWhyGridNinjaContextChange()
    },
  })
}
