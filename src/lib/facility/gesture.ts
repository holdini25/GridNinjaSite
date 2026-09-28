import type { FacilitySystem } from "@/types/facility"

export type Gesture = Readonly<{ pointerId: number; system: FacilitySystem; x: number; y: number; maxDistanceSquared: number; cancelled: boolean }>

function point(x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError("A gesture needs finite CSS coordinates")
}

export function pointerDown(pointerId: number, system: FacilitySystem, x: number, y: number): Gesture {
  point(x, y)
  return { pointerId, system, x, y, maxDistanceSquared: 0, cancelled: false }
}

export function pointerMove(gesture: Gesture, pointerId: number, x: number, y: number): Gesture {
  if (pointerId !== gesture.pointerId) return gesture
  point(x, y)
  return { ...gesture, maxDistanceSquared: Math.max(gesture.maxDistanceSquared, (x - gesture.x) ** 2 + (y - gesture.y) ** 2) }
}

export function cancelGesture(gesture: Gesture): Gesture {
  return { ...gesture, cancelled: true }
}

export function pointerUp(gesture: Gesture, pointerId: number, hitSystem: FacilitySystem | null, x: number, y: number, thresholdCssPx = 6): FacilitySystem | null {
  if (!Number.isFinite(thresholdCssPx) || thresholdCssPx <= 0 || thresholdCssPx > 20) throw new TypeError("Invalid gesture threshold")
  const moved = pointerMove(gesture, pointerId, x, y)
  return pointerId === gesture.pointerId && !moved.cancelled && hitSystem === gesture.system && moved.maxDistanceSquared <= thresholdCssPx ** 2 ? gesture.system : null
}

export function canvasNdc(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): readonly [number, number] | null {
  point(clientX, clientY)
  point(rect.left, rect.top)
  point(rect.width, rect.height)
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = (clientX - rect.left) / rect.width, y = (clientY - rect.top) / rect.height
  return x < 0 || x > 1 || y < 0 || y > 1 ? null : [2 * x - 1, 1 - 2 * y]
}
