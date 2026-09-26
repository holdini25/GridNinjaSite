import { z } from "zod"

// Configure before any client-capable schema is constructed. Zod's default JIT
// feature probe calls Function even when it catches the CSP rejection; disabling
// JIT avoids both that probe and generated parsers under our no-eval policy.
z.config({ jitless: true })

export { z }
