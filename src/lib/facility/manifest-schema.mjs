import { z } from "zod"

export const releasePattern = /^facility-v[1-9][0-9]*$/
export const overviewFiles = ["facility.glb", "poster-desktop.webp", "poster-mobile.webp"]
export const specimenFiles = kind => [`${kind}.glb`, `${kind}-closed.webp`, `${kind}-cutaway.webp`]
export const allowedFiles = [...overviewFiles, ...specimenFiles("rack"), ...specimenFiles("cooling")]
export const expectedReleaseFiles = manifest => [...overviewFiles, ...Object.keys(manifest.specimens ?? {}).flatMap(specimenFiles)]
export const assetByteCeiling = file => overviewFiles.includes(file) ? file.endsWith(".glb") ? 2_500_000 : 150 * 1024 : file.endsWith(".glb") ? 1_000_000 : 60 * 1024
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const tuple = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/)
const intensity = z.number().nonnegative().max(20)
const interval = (min, max) => z.tuple([z.number().min(min).max(max), z.number().min(min).max(max)]).refine(([a, b]) => a <= b, "Inverted interval")
const boundsSchema = z.object({ min: tuple, max: tuple }).strict().refine(value => value.min.every((v, index) => v < value.max[index]), "Empty camera subject bounds")
const cameraSchema = z.object({ camera: tuple, target: tuple, padding: z.number().min(1).max(2), projection: z.enum(["orthographic", "perspective"]).optional(), fov: z.number().min(20).max(60).optional() }).strict().superRefine((camera, context) => {
  if (camera.camera.every((value, index) => value === camera.target[index])) context.addIssue({ code: "custom", message: "Camera needs a viewing direction" })
  if (camera.projection === "perspective" && camera.fov === undefined) context.addIssue({ code: "custom", message: "Perspective camera needs an authored field of view" })
  if (camera.projection !== "perspective" && camera.fov !== undefined) context.addIssue({ code: "custom", message: "Field of view requires perspective projection" })
})
export const equipmentIndexSchema = z.object({ schemaVersion: z.literal("facility-equipment-index.v1"), equipment: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), label: z.string().min(1).max(100), system: z.enum(["power", "cooling", "storage", "workloads"]), role: z.string().min(1).max(256), bounds: boundsSchema }).strict()).min(1).max(96) }).strict().refine(value => new Set(value.equipment.map(item => item.id)).size === value.equipment.length, "Duplicate public equipment identity")
export const profileSchema = z.object({
  camera: tuple, target: tuple, padding: z.number().min(1).max(2), framing: z.literal("projected-geometry").optional(), background: color, exposure: z.number().positive().max(4),
  colorSpace: z.literal("srgb"), toneMapping: z.literal("aces-filmic"),
  inspection: z.object({ version: z.literal(1), fitSubjects: z.object({ overview: boundsSchema, "air-path": boundsSchema }).strict(), mobile: cameraSchema.optional(), mobileRackAspect: z.number().min(.7).max(1.5).optional(), details: z.object({ rack: cameraSchema, "air-path": cameraSchema }).strict() }).strict().superRefine((inspection, context) => {
    if (inspection.mobile?.projection === "perspective" || Object.values(inspection.details).some(camera => camera.projection !== "perspective" || camera.fov !== 32 || camera.padding !== 1.12)) context.addIssue({ code: "custom", message: "Inspection requires orthographic mobile framing and 32-degree perspective details with 12% padding" })
  }).optional(),
  surfaces: z.object({
    version: z.literal(1), pipeline: z.literal("pbr-semantic-v2"), uvSet: z.literal(0), maxTextureBytes: z.literal(3145728),
    equipmentEdge: z.object({ version: z.literal(1), viewDirection: z.literal("projection-correct"), exponent: z.number().min(1).max(8), intensity: z.number().min(0).max(.1) }).strict().optional(),
  }).strict().optional(),
  ecosystem: z.object({
    version: z.literal(1), seed: z.number().int().min(1).max(0xffffffff),
    ambientIntervalSeconds: interval(12, 18), sequenceSeconds: z.number().min(6).max(10),
    chapterSeconds: z.tuple([z.literal(4), z.literal(4), z.literal(5), z.literal(4), z.literal(4), z.literal(3)]),
    colors: z.object({ electrical: color, cooling: color, heat: color }).strict(),
    fanModulation: z.number().min(0).max(.1), maxEquipment: z.literal(96), maxRoutes: z.literal(128), maxTraces: z.literal(2),
  }).strict().optional(),
  lighting: z.object({
    hemisphere: z.object({ sky: color, ground: color, intensity }).strict(),
    directional: z.array(z.object({ position: tuple, color, intensity }).strict()).min(1).max(4),
    finite: z.object({ version: z.literal(1), type: z.literal("point"), position: tuple, color, intensity: z.number().min(0).max(128), decay: z.literal(2), distance: z.literal(0) }).strict().optional(),
    environment: z.object({ preset: z.enum(["industrial-softbox-v1", "industrial-softbox-v2", "industrial-night-v1", "industrial-night-v2", "industrial-night-v3"]), resolution: z.literal(128), intensity: z.number().min(0).max(4), rotationY: z.number().min(-Math.PI).max(Math.PI) }).strict().optional(),
  }).strict(),
  motion: z.object({
    fanRadiansPerSecond: z.number().min(0).max(3),
    fanPhaseOffsets: z.tuple([z.number().min(0).max(2 * Math.PI), z.number().min(0).max(2 * Math.PI), z.number().min(0).max(2 * Math.PI), z.number().min(0).max(2 * Math.PI)]),
    ledPulseRadiansPerSecond: z.number().min(0).max(4), ledPulseAmplitude: z.number().min(0).max(0.15),
  }).strict().optional(),
  led: z.object({ color, steadyIntensity: z.number().min(0).max(1), size: z.tuple([z.number().positive().max(0.1), z.number().positive().max(0.1), z.number().positive().max(0.1)]) }).strict().optional(),
  engineering: z.object({
    version: z.literal(1), seed: z.number().int().min(1).max(0xffffffff),
    accent: z.object({ resting: color, hover: color, selected: color, previewWeight: z.number().min(0).max(1), baseEmission: intensity, activeEmission: intensity, transitionMs: z.number().int().min(0).max(500) }).strict(),
    activity: z.object({ resting: z.number().min(0).max(1), peak: z.number().min(0).max(1), steady: z.number().min(0).max(1), pulseMs: interval(100, 300), eventMs: interval(80, 1000), maxPulses: z.number().int().min(1).max(3), ambientTraceSeconds: interval(8, 30), selectedTraceQuietSeconds: z.number().min(2.8).max(30) }).strict(),
    cameraTransitionMs: z.number().int().min(0).max(750), poseTransitionMs: z.number().int().min(0).max(750),
    rendering: z.object({ ambientFps: z.literal(30), interactionFps: z.literal(60), mobilePixels: z.number().int().positive().max(1_000_000), desktopPixels: z.number().int().positive().max(1_500_000), probeSeconds: z.number().min(2).max(5) }).strict(),
  }).strict().optional(),
}).strict().superRefine((profile, context) => {
  if (profile.lighting.finite && (!profile.engineering || profile.lighting.directional.length > 3)) context.addIssue({ code: "custom", message: "Finite light requires engineering ownership and at most three directional sources" })
  if (profile.inspection && !profile.engineering) context.addIssue({ code: "custom", message: "Inspection cameras require the engineering session" })
  if (profile.surfaces && !profile.engineering) context.addIssue({ code: "custom", message: "Surface pipeline requires semantic engineering bindings" })
  if (profile.ecosystem && (!profile.surfaces || !profile.engineering)) context.addIssue({ code: "custom", message: "Ecosystem requires the surface and engineering pipelines" })
})
const binding = z.object({ root: z.string(), accent: z.string(), pick: z.string() }).strict()
const descriptor = z.object({ kind: z.enum(["rack", "cooling"]), label: z.string().min(1).max(100), system: z.enum(["power", "cooling", "storage", "workloads"]), profile: profileSchema, requiredIds: z.array(z.string().regex(/^GN_[A-Z0-9_]+$/)).min(2).max(64) }).strict()
export const manifestSchema = z.object({
  schemaVersion: z.literal("facility.v1"), release: z.string().regex(releasePattern), environment: z.literal("synthetic"), profile: profileSchema,
  systems: z.object({ power: binding, cooling: binding, storage: binding, workloads: binding }).strict(),
  equipment: z.object({
    rotors: z.array(z.object({ id: z.string().regex(/^GN_FAN_ROTOR_0[0-3]$/), axis: tuple }).strict()).length(4),
    leds: z.array(z.string().regex(/^GN_LED_(?:[0-3][0-9]|4[0-7])$/)).length(48),
  }).strict(),
  equipmentIndex: equipmentIndexSchema.optional(),
  specimens: z.object({ rack: descriptor.optional(), cooling: descriptor.optional() }).strict().optional(),
  files: z.array(z.object({ file: z.enum(allowedFiles), bytes: z.number().int().positive(), sha256: digest }).strict()).min(3).max(9),
  source: z.object({ blender: z.string(), masterSha256: digest, generatorSha256: digest, modules: z.record(z.string().regex(/^[a-z][a-z0-9_-]*\.(?:py|json)$/), digest).optional(), masters: z.record(z.string().regex(/^[a-z][a-z0-9_-]*\.blend$/), digest).optional() }).strict(),
}).strict().superRefine((manifest, context) => {
  const problem = message => context.addIssue({ code: "custom", message })
  if (manifest.profile.inspection && !manifest.equipmentIndex) problem("Inspection requires the authored public equipment index")
  const files = manifest.files.map(file => file.file)
  const expected = expectedReleaseFiles(manifest)
  if (files.length !== new Set(files).size || [...files].sort().join("|") !== expected.sort().join("|")) problem("Release must contain exactly its complete unique allowlisted files")
  for (const file of manifest.files) if (file.bytes > assetByteCeiling(file.file)) problem("Visual file exceeds budget")
  for (const [kind, specimen] of Object.entries(manifest.specimens ?? {})) {
    if (!specimen || specimen.kind !== kind || specimen.system !== (kind === "rack" ? "workloads" : "cooling")) problem("Invalid specimen identity")
    if (!specimen || new Set(specimen.requiredIds).size !== specimen.requiredIds.length || !specimen.requiredIds.includes("GN_SPECIMEN_ROOT")) problem("Invalid specimen semantic bindings")
    if (!manifest.profile.engineering || !specimen?.profile.engineering) problem("Specimens require engineering profiles")
    if (specimen?.profile.lighting.finite && !manifest.profile.lighting.finite) problem("Specimen finite light requires the overview session's finite-light slot")
  }
  for (const [system, value] of Object.entries(manifest.systems)) {
    const name = system.toUpperCase()
    if (value.root !== `GN_${name}` || value.accent !== `GN_ACCENT_${name}` || value.pick !== `GN_PICK_${name}`) problem("Invalid semantic mapping bindings")
  }
  if (new Set(manifest.equipment.rotors.map(item => item.id)).size !== 4 || new Set(manifest.equipment.leds).size !== 48 || manifest.equipment.rotors.some(item => item.axis.join(",") !== "0,1,0")) problem("Invalid equipment bindings")
})
export const registrySchema = z.array(z.object({ release: z.string().regex(releasePattern), status: z.enum(["available", "withheld", "withdrawn"]), manifestSha256: digest.optional() }).strict()).superRefine((registry, context) => {
  if (new Set(registry.map(item => item.release)).size !== registry.length || registry.some(item => item.status === "available" && !item.manifestSha256)) context.addIssue({ code: "custom", message: "Invalid visual release registry" })
})
