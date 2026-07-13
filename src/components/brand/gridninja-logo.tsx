import Image from "next/image"
import type { ComponentPropsWithoutRef, CSSProperties } from "react"

import { cn } from "@/lib/utils"

import {
  AnimatedGridNinjaMark,
  type GridNinjaLogoMotion as AnimatedGridNinjaLogoMotion,
} from "./animated-gridninja-mark"

export type GridNinjaLogoVariant =
  | "proof-core"
  | "micro"
  | "detailed"
  | "ceremonial"
  | "monochrome"
  | "light"
  | "watermark"

const logoAssets: Record<
  GridNinjaLogoVariant,
  { src: string; width: number; height: number }
> = {
  "proof-core": {
    src: "/brand/gridninja-favicon-proof-core.svg",
    width: 64,
    height: 64,
  },
  micro: {
    src: "/brand/gridninja-mark-micro.svg",
    width: 256,
    height: 256,
  },
  detailed: {
    src: "/brand/gridninja-emblem-detailed-dark.svg",
    width: 512,
    height: 512,
  },
  ceremonial: {
    src: "/brand/gridninja-emblem-ceremonial.svg",
    width: 640,
    height: 560,
  },
  monochrome: {
    src: "/brand/gridninja-emblem-monochrome.svg",
    width: 512,
    height: 512,
  },
  light: {
    src: "/brand/gridninja-badge-light.svg",
    width: 512,
    height: 512,
  },
  watermark: {
    src: "/brand/gridninja-watermark.svg",
    width: 512,
    height: 512,
  },
}

type GridNinjaImageVariant = Exclude<GridNinjaLogoVariant, "monochrome">

type GridNinjaAssetProps = Omit<
  ComponentPropsWithoutRef<typeof Image>,
  "alt" | "height" | "src" | "width"
> & {
  variant: GridNinjaImageVariant
}

function GridNinjaAsset({
  variant,
  className,
  ...props
}: GridNinjaAssetProps) {
  const asset = logoAssets[variant]

  return (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt=""
      className={cn("shrink-0 object-contain", className)}
      unoptimized
      {...props}
    />
  )
}

type GridNinjaImageMarkProps = Omit<
  ComponentPropsWithoutRef<typeof Image>,
  "alt" | "height" | "src" | "width"
> & {
  variant?: GridNinjaImageVariant
}

type GridNinjaMonochromeMarkProps = {
  variant: "monochrome"
  className?: string
  style?: CSSProperties
}

export type GridNinjaMarkProps =
  | GridNinjaImageMarkProps
  | GridNinjaMonochromeMarkProps

function GridNinjaMonochromeMark({
  className,
  style,
}: Omit<GridNinjaMonochromeMarkProps, "variant">) {
  const maskImage = `url("${logoAssets.monochrome.src}")`

  return (
    <span
      aria-hidden="true"
      data-gridninja-mark="monochrome"
      className={cn(
        "inline-block aspect-square w-[512px] max-w-full shrink-0 bg-current",
        className
      )}
      style={{
        ...style,
        backgroundColor: "currentColor",
        maskImage,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: maskImage,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  )
}

/**
 * Compatibility export for mark-only placements. New brand compositions should
 * use GridNinjaLogo so their accessible label and live wordmark stay together.
 */
export function GridNinjaMark(props: GridNinjaMarkProps) {
  if (props.variant === "monochrome") {
    const { className, style } = props

    return <GridNinjaMonochromeMark className={className} style={style} />
  }

  const { className, variant = "detailed", ...imageProps } = props

  return (
    <GridNinjaAsset
      variant={variant}
      className={className}
      {...imageProps}
    />
  )
}

type GridNinjaLogoBaseProps = {
  variant?: GridNinjaLogoVariant
  className?: string
  markClassName?: string
  textClassName?: string
  signatureClassName?: string
  showWordmark?: boolean
  showSignature?: boolean
  label?: string
}

export type GridNinjaLogoMotion = "none" | AnimatedGridNinjaLogoMotion
export type GridNinjaLogoReveal = "none" | "once"

type StaticGridNinjaLogoProps = GridNinjaLogoBaseProps & {
  motion?: "none"
  reveal?: never
}

type MicroMotionGridNinjaLogoProps = Omit<
  GridNinjaLogoBaseProps,
  "variant"
> & {
  variant: "micro"
  motion: "micro-response"
  reveal?: never
}

type GuardianWakeGridNinjaLogoProps = Omit<
  GridNinjaLogoBaseProps,
  "variant"
> & {
  variant: "ceremonial"
  motion: "guardian-wake"
  reveal?: GridNinjaLogoReveal
}

export type GridNinjaLogoProps =
  | StaticGridNinjaLogoProps
  | MicroMotionGridNinjaLogoProps
  | GuardianWakeGridNinjaLogoProps

export function GridNinjaLogo(props: GridNinjaLogoProps) {
  const {
    variant = "micro",
    className,
    markClassName,
    textClassName,
    signatureClassName,
    showWordmark = true,
    showSignature = false,
    label,
  } = props
  const hasVisibleText = showWordmark || showSignature
  const isDecorative = !label && !hasVisibleText
  const motion = props.motion ?? "none"

  return (
    <span
      className={cn("inline-flex items-center gap-3", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={isDecorative ? "true" : undefined}
    >
      {motion === "micro-response" || motion === "guardian-wake" ? (
        <AnimatedGridNinjaMark
          variant={motion}
          reveal={
            motion === "guardian-wake" && "reveal" in props
              ? props.reveal
              : undefined
          }
          className={cn("size-10 shrink-0", markClassName)}
        />
      ) : (
        variant === "monochrome" ? (
          <GridNinjaMonochromeMark
            className={cn("size-10", markClassName)}
          />
        ) : (
          <GridNinjaAsset
            variant={variant}
            className={cn("size-10", markClassName)}
          />
        )
      )}
      {hasVisibleText ? (
        <span
          className="inline-flex min-w-0 flex-col"
          aria-hidden={label ? "true" : undefined}
        >
          {showWordmark ? (
            <span
              className={cn(
                "font-medium tracking-[0.18em] text-foreground uppercase",
                textClassName
              )}
            >
              GridNinja
            </span>
          ) : null}
          {showSignature ? (
            <span
              className={cn(
                "mt-1 font-mono text-[0.55rem] leading-tight tracking-[0.13em] text-muted-foreground uppercase",
                signatureClassName
              )}
            >
              Infrastructure · Intelligence · Control
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
