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
  assertGeometryInputs(samples, domainIds, dimensions)
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
  if (!samples.some((sample) => !sample.proofEligible)) {
    return ""
  }

  return (
    area<EnvelopeSample>()
      .defined((sample) => !sample.proofEligible)
      .x((sample) => x(sample.minute))
      .y0(y(0))
      .y1((sample) => y(sample.requestedMw))
      .curve(curveLinear)(samples) ?? ""
  )
}

function assertGeometryInputs(samples: EnvelopeSample[], domainIds: DomainId[], dimensions: ChartDimensions) {
  if (samples.length < 2) throw new Error("Geometry requires at least two samples")
  const values = [dimensions.width, dimensions.height, ...Object.values(dimensions.margin)]
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Geometry dimensions must be finite")
  if (dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width - dimensions.margin.left - dimensions.margin.right <= 0 || dimensions.height - dimensions.margin.top - dimensions.margin.bottom <= 0) throw new Error("Geometry plot dimensions must be positive")
  if (new Set(domainIds).size !== domainIds.length) throw new Error("Geometry domain IDs must be unique")
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    const numeric = [sample.minute, sample.requestedMw, sample.acceptedMw, sample.repairDeltaMw, ...Object.values(sample.limits).filter((value): value is number => value != null), ...Object.values(sample.lowerConfidence), ...Object.values(sample.upperConfidence)]
    if (numeric.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Geometry samples must contain finite nonnegative values")
    if (index > 0 && sample.minute <= samples[index - 1].minute) throw new Error("Geometry sample minutes must be unique and strictly increasing")
  }
}
