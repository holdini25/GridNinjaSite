import type { FacilitySpecimenKind, FacilitySurfaceProfile } from "@/types/facility"

export const SURFACE_ROLES = ["powder-coat", "bare-metal", "polymer", "rubber", "copper", "grille", "platform", "label", "indicator"] as const
export function isSurfaceRole(value: unknown): value is typeof SURFACE_ROLES[number] { return typeof value === "string" && (SURFACE_ROLES as readonly string[]).includes(value) }
export function surfaceTextureBytes(width: number, height: number): number {
  let bytes = 0
  while (width > 0 || height > 0) { bytes += Math.max(1, width) * Math.max(1, height) * 4; width = Math.floor(width / 2); height = Math.floor(height / 2) }
  return bytes
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) }
function index(value: unknown, length: number): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= length) throw new Error("surface_resource_index")
  return value as number
}

/** Read bounded PNG headers before GLTFLoader can allocate decoded image storage.
 * Full PNG decoding/CRC validation remains the browser decoder's responsibility. */
export function preflightSurfaceContract(document: Record<string, unknown>, binary: Uint8Array | undefined, profile: FacilitySurfaceProfile, specimen?: FacilitySpecimenKind) {
  if (profile.version !== 1 || profile.pipeline !== "pbr-semantic-v2" || profile.uvSet !== 0 || profile.maxTextureBytes !== 3145728) throw new Error("surface_profile")
  const images = document.images, textures = document.textures, views = document.bufferViews, materials = document.materials
  if (!binary || !Array.isArray(images) || images.length < 2 || images.length > 3 || !Array.isArray(textures) || textures.length < 2 || textures.length > 3 || !Array.isArray(views) || !Array.isArray(materials)) throw new Error("surface_resources")
  let allocation = 0
  const sizes = images.map(image => {
    if (!record(image) || image.mimeType !== "image/png") throw new Error("surface_image_format")
    const view = views[index(image.bufferView, views.length)]
    if (!record(view) || view.buffer !== 0 || !Number.isSafeInteger(view.byteLength) || (view.byteLength as number) < 33 || !Number.isSafeInteger(view.byteOffset ?? 0)) throw new Error("surface_image_view")
    const start = (view.byteOffset ?? 0) as number, length = view.byteLength as number
    if (start < 0 || start + length > binary.byteLength) throw new Error("surface_image_view")
    const header = new DataView(binary.buffer, binary.byteOffset + start, length)
    if (header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a || header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452) throw new Error("surface_image_header")
    const width = header.getUint32(16), height = header.getUint32(20)
    if (width < 1 || height < 1 || width > 512 || height > 512 || (width & (width - 1)) || (height & (height - 1)) || header.getUint8(24) !== 8 || ![2, 6].includes(header.getUint8(25)) || header.getUint8(26) !== 0 || header.getUint8(27) !== 0 || header.getUint8(28) > 1) throw new Error("surface_image_dimensions")
    allocation += surfaceTextureBytes(width, height)
    return { width, height, rgba: header.getUint8(25) === 6 }
  })
  if (allocation > profile.maxTextureBytes) throw new Error("surface_texture_budget")
  const imageRoles = new Map<number, string>(), roleImages = new Map<string, number>()
  if (textures.length !== images.length || new Set(textures.map(texture => record(texture) ? texture.source : undefined)).size !== images.length) throw new Error("surface_duplicate_texture")
  const textureInfo = (value: unknown, role: "normal" | "orm" | "color") => {
    if (!record(value) || (value.texCoord ?? 0) !== 0 || value.extensions !== undefined) throw new Error("surface_uv_contract")
    const texture = textures[index(value.index, textures.length)]
    if (!record(texture) || texture.extensions !== undefined) throw new Error("surface_texture")
    const source = index(texture.source, images.length), size = sizes[source]
    if (role === "color" && (size.width > 256 || size.height > 256 || !size.rgba)) throw new Error("surface_color_dimensions")
    if ((imageRoles.has(source) && imageRoles.get(source) !== role) || (roleImages.has(role) && roleImages.get(role) !== source)) throw new Error("surface_texture_role")
    imageRoles.set(source, role); roleImages.set(role, source)
    const samplers = document.samplers
    if (texture.sampler !== undefined) {
      if (!Array.isArray(samplers)) throw new Error("surface_sampler")
      const sampler = samplers[index(texture.sampler, samplers.length)]
      if (!record(sampler) || (sampler.magFilter ?? 9729) !== 9729 || (sampler.minFilter ?? 9987) !== 9987 || ![33071, 10497].includes((sampler.wrapS ?? 10497) as number) || ![33071, 10497].includes((sampler.wrapT ?? 10497) as number)) throw new Error("surface_sampler")
    }
    return source
  }
  for (const material of materials) {
    if (!record(material) || !record(material.extras) || !isSurfaceRole(material.extras.gnSurfaceRole) || !record(material.pbrMetallicRoughness)) throw new Error("surface_material_role")
    const pbr = material.pbrMetallicRoughness, mode = material.alphaMode ?? "OPAQUE"
    if (mode !== "OPAQUE" && mode !== "MASK") throw new Error("surface_alpha_mode")
    if (mode === "MASK") {
      const feature = material.extras.gnCutoutMinFeatureTexels
      if (specimen !== "rack" || material.extras.gnSurfaceRole !== "grille" || material.alphaCutoff !== .5 || typeof feature !== "number" || !Number.isFinite(feature) || feature < 1 || feature > 16 || !pbr.baseColorTexture) throw new Error("surface_cutout_contract")
    } else if (material.extras.gnCutoutMinFeatureTexels !== undefined) throw new Error("surface_cutout_contract")
    if (material.normalTexture !== undefined) textureInfo(material.normalTexture, "normal")
    if (material.occlusionTexture !== undefined) textureInfo(material.occlusionTexture, "orm")
    if (pbr.metallicRoughnessTexture !== undefined) textureInfo(pbr.metallicRoughnessTexture, "orm")
    if (pbr.baseColorTexture !== undefined) textureInfo(pbr.baseColorTexture, "color")
    if (material.emissiveTexture !== undefined) throw new Error("surface_unapproved_texture")
  }
  if (!roleImages.has("normal") || !roleImages.has("orm") || imageRoles.size !== images.length) throw new Error("surface_unused_image")
  return { textureBytes: Math.ceil(allocation), images: sizes }
}
