// srcset separates its URL from descriptors at whitespace. Encode the complete
// XML payload so the browser cannot discard this candidate and fetch img.src.
export const FACILITY_POSTER_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"></svg>')}`
