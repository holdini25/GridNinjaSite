"use client"

import Link from "next/link"
import { useState, type RefObject } from "react"

import { ChevronDownIcon } from "lucide-react"

import { headerCapacityAuditHref, navItems } from "@/content/nav"
import {
  getMostSpecificActiveHref,
  isNavPathActive,
} from "@/lib/navigation"
import { cn } from "@/lib/utils"

import { GridNinjaLogo } from "@/components/brand/gridninja-logo"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const getMobileGroupId = (label: string) =>
  `mobile-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

function DrawerNavigation({ pathname }: { pathname: string }) {
  const activeGroup = navItems.find(
    (item) =>
      "children" in item &&
      getMostSpecificActiveHref(
        pathname,
        item.children.map((child) => child.href)
      ) !== undefined
  )
  const [openGroup, setOpenGroup] = useState<string | null>(
    activeGroup?.label ?? null
  )

  return (
    <nav
      aria-label="Primary"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-4"
    >
      {navItems.map((item) => {
        const hasChildren = "children" in item
        const activeChildHref = hasChildren
          ? getMostSpecificActiveHref(
              pathname,
              item.children.map((child) => child.href)
            )
          : undefined
        const itemActive = hasChildren
          ? activeChildHref !== undefined
          : isNavPathActive(pathname, item.href)

        if (!hasChildren) {
          return (
            <SheetClose key={item.href} asChild>
              <Link
                href={item.href}
                prefetch={false}
                aria-current={itemActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  itemActive && "bg-surface-hover text-primary"
                )}
              >
                {item.label}
              </Link>
            </SheetClose>
          )
        }

        const groupId = getMobileGroupId(item.label)
        const expanded = openGroup === item.label

        return (
          <div key={item.label} className="flex flex-col">
            <button
              type="button"
              data-mobile-nav-group={item.label}
              aria-controls={groupId}
              aria-expanded={expanded}
              className={cn(
                "flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-base font-medium text-foreground transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                itemActive && "text-primary"
              )}
              onClick={() =>
                setOpenGroup((current) =>
                  current === item.label ? null : item.label
                )
              }
            >
              <span className="flex items-center gap-2">
                {item.label}
                {itemActive ? (
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-primary"
                  />
                ) : null}
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className={cn(
                  "size-4 transition-transform duration-150",
                  expanded && "rotate-180"
                )}
              />
            </button>
            {expanded ? (
              <div
                id={groupId}
                className="mt-1 flex flex-col gap-1 border-l border-divider py-1 pl-3"
              >
                {item.children.map((child) => {
                  const childActive = child.href === activeChildHref

                  return (
                    <SheetClose key={child.href} asChild>
                      <Link
                        href={child.href}
                        prefetch={false}
                        aria-current={childActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center rounded-lg px-3 text-base text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          childActive && "bg-surface-hover text-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    </SheetClose>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

export type DrawerDialogProps = {
  pathname: string
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: RefObject<HTMLButtonElement | null>
  dialogId: string
}

export default function NavDrawerDialog({ pathname, open, onOpenChange, trigger, dialogId }: DrawerDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id={dialogId}
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus() }}
        side="right"
        className="h-dvh max-h-dvh gap-0 overflow-hidden border-border bg-surface-2 px-0 text-foreground"
      >
        <SheetHeader className="border-b border-divider">
          <SheetTitle>
            <SheetClose asChild>
              <Link
                href="/"
                prefetch={false}
                aria-label="GridNinja home"
                data-gn-logo-trigger
                className="inline-flex min-h-11 items-center"
              >
                <GridNinjaLogo
                  variant="micro"
                  motion="micro-response"
                  className="gap-2.5"
                  markClassName="size-[36px]"
                  textClassName="text-sm"
                />
              </Link>
            </SheetClose>
          </SheetTitle>
          <SheetDescription>
            Capacity decisions supported by explicit evidence.
          </SheetDescription>
        </SheetHeader>
        <DrawerNavigation key={pathname} pathname={pathname} />
        <SheetFooter
          data-mobile-nav-footer
          className="shrink-0 border-t border-divider bg-surface-2 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetClose asChild>
            <Button asChild className="h-11 w-full rounded-[9px] shadow-none">
              <Link
                href={headerCapacityAuditHref}
                prefetch={false}
                data-gn-event="mobile-nav-capacity-audit"
                data-analytics-event="assessment_cta_selected"
                data-analytics-source="header"
              >
                Contact Us
              </Link>
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
