import type { ComponentPropsWithoutRef, CSSProperties } from "react"

import { cn } from "@/lib/utils"

export type GridNinjaLogoVariant =
  | "proof-core"
  | "micro"
  | "detailed"
  | "ceremonial"
  | "monochrome"
  | "light"
  | "watermark"

export const gridNinjaLogoAssets: Record<
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

export type GridNinjaMonochromeMarkProps = {
  variant: "monochrome"
  className?: string
  style?: CSSProperties
}

export function GridNinjaMonochromeMark({
  className,
  style,
}: Omit<GridNinjaMonochromeMarkProps, "variant">) {
  const maskImage = `url("${gridNinjaLogoAssets.monochrome.src}")`

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

type StaticGridNinjaMarkProps =
  | (Omit<ComponentPropsWithoutRef<"img">, "alt" | "height" | "src" | "width"> & {
      variant?: Exclude<GridNinjaLogoVariant, "monochrome">
    })
  | GridNinjaMonochromeMarkProps

/** Static placements use canonical SVGs without the animated or image client runtime. */
export function StaticGridNinjaMark(props: StaticGridNinjaMarkProps) {
  if (props.variant === "monochrome") {
    return <GridNinjaMonochromeMark className={props.className} style={props.style} />
  }

  const { variant = "detailed", className, loading = "lazy", decoding = "async", ...imageProps } = props
  const asset = gridNinjaLogoAssets[variant]

  return (
    // Canonical local SVGs need no image transform or client-side loading state.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt=""
      className={cn("shrink-0 object-contain", className)}
      loading={loading}
      decoding={decoding}
      {...imageProps}
    />
  )
}
