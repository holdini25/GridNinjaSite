// Full field validation stays shared with the API, but loads after interaction.
export async function loadContactValidation() {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      import("@/lib/validators"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Validation module unavailable")), 10_000)
      }),
    ])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}
