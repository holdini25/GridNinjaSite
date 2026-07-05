import { max } from "d3-array"
import { scaleLinear } from "d3-scale"
import { area, curveLinear, line } from "d3-shape"

import type { DomainId, EnvelopeSample } from "@/types/dispatch-envelope"

export interface ChartDimensions {
  width: number
  height: number
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface DispatchEnvelopeGeometry {
  plotWidth: number
  plotHeight: number
  xTicks: number[]
  yTicks: number[]
  requestedLinePath: string
  requestedAreaPath: string
  acceptedLinePath: string
  acceptedAreaPath: string
  repairDeltaAreaPath: string
  domainLinePaths: Partial<Record<DomainId, string>>
  domainConfidenceAreaPaths: Partial<Record<DomainId, string>>
  apertureClipPath: string
  noProofMaskPath: string
  x: ReturnType<typeof scaleLinear<number, number>>
  y: ReturnType<typeof scaleLinear<number, number>>
}

export function buildDispatchEnvelopeGeometry(args: {
  samples: EnvelopeSample[]
  domainIds: DomainId[]
  dimensions: ChartDimensions
}): DispatchEnvelopeGeometry {
  const { samples, domainIds, dimensions } = args
  const { width, height, margin } = dimensions
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const maxY = Math.max(
    1,
    (max(samples, (sample) =>
      Math.max(
        sample.requestedMw,
        sample.acceptedMw,
        ...Object.values(sample.limits).map((value) => value ?? 0),
        ...Object.values(sample.upperConfidence).map((value) => value ?? 0)
      )
    ) ?? 1) * 1.16
  )
  const maxX = max(samples, (sample) => sample.minute) ?? 1
  const x = scaleLinear()
    .domain([0, maxX])
    .range([margin.left, width - margin.right])
    .clamp(true)
  const y = scaleLinear()
    .domain([0, maxY])
    .nice()
    .range([height - margin.bottom, margin.top])
    .clamp(true)
  const requestedLine = line<EnvelopeSample>()
    .x((sample) => x(sample.minute))
    .y((sample) => y(sample.requestedMw))
    .curve(curveLinear)
  const requestedArea = area<EnvelopeSample>()
    .x((sample) => x(sample.minute))
    .y0(y(0))
    .y1((sample) => y(sample.requestedMw))
    .curve(curveLinear)
  const acceptedLine = line<EnvelopeSample>()
    .x((sample) => x(sample.minute))
    .y((sample) => y(sample.acceptedMw))
    .curve(curveLinear)
  const acceptedArea = area<EnvelopeSample>()
    .x((sample) => x(sample.minute))
    .y0(y(0))
    .y1((sample) => y(sample.acceptedMw))
    .curve(curveLinear)
  const repairDeltaArea = area<EnvelopeSample>()
    .x((sample) => x(sample.minute))
    .y0((sample) => y(sample.acceptedMw))
    .y1((sample) => y(sample.requestedMw))
    .curve(curveLinear)
  const domainLinePaths: Partial<Record<DomainId, string>> = {}
  const domainConfidenceAreaPaths: Partial<Record<DomainId, string>> = {}

  for (const domainId of domainIds) {
    domainLinePaths[domainId] =
      line<EnvelopeSample>()
        .defined((sample) => sample.limits[domainId] !== null)
        .x((sample) => x(sample.minute))
        .y((sample) => y(sample.limits[domainId] ?? 0))
        .curve(curveLinear)(samples) ?? ""

    domainConfidenceAreaPaths[domainId] =
      area<EnvelopeSample>()
        .defined(
          (sample) =>
            sample.lowerConfidence[domainId] != null &&
            sample.upperConfidence[domainId] != null
        )
        .x((sample) => x(sample.minute))
        .y0((sample) => y(sample.lowerConfidence[domainId] ?? 0))
        .y1((sample) => y(sample.upperConfidence[domainId] ?? 0))
        .curve(curveLinear)(samples) ?? ""
  }

  return {
    plotWidth,
    plotHeight,
    xTicks: x.ticks(width < 560 ? 4 : 7),
    yTicks: y.ticks(height < 380 ? 3 : 5),
    requestedLinePath: requestedLine(samples) ?? "",
    requestedAreaPath: requestedArea(samples) ?? "",
    acceptedLinePath: acceptedLine(samples) ?? "",
    acceptedAreaPath: acceptedArea(samples) ?? "",
    repairDeltaAreaPath: repairDeltaArea(samples) ?? "",
    domainLinePaths,
    domainConfidenceAreaPaths,
    apertureClipPath: buildApertureClipPath({ width, height, margin }),
    noProofMaskPath: buildNoProofMaskPath({ samples, x, y }),
    x,
    y,
  }
}

function buildApertureClipPath({
  width,
  height,
  margin,
}: Pick<ChartDimensions, "width" | "height" | "margin">) {
  const plotWidth = width - margin.left - margin.right
  const left = margin.left + plotWidth * 0.42
  const right = margin.left + plotWidth * 0.58

  return [
    `M ${left} ${margin.top}`,
    `L ${right} ${margin.top}`,
    `L ${right + 18} ${height - margin.bottom}`,
    `L ${left - 18} ${height - margin.bottom}`,
    "Z",
  ].join(" ")
}

function buildNoProofMaskPath({
  samples,
  x,
  y,
}: {
  samples: EnvelopeSample[]
  x: ReturnType<typeof scaleLinear<number, number>>
  y: ReturnType<typeof scaleLinear<number, number>>
}) {
  const noProofSamples = samples.filter((sample) => !sample.proofEligible)

  if (!noProofSamples.length) {
    return ""
  }

  return (
    area<EnvelopeSample>()
      .x((sample) => x(sample.minute))
      .y0(y(0))
      .y1((sample) => y(sample.requestedMw))
      .curve(curveLinear)(noProofSamples) ?? ""
  )
}
