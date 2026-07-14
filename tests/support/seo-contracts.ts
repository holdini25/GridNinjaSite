import { expect } from "vitest"

type ValidatorResult =
  | void
  | boolean
  | readonly unknown[]
  | {
      valid?: boolean
      errors?: readonly unknown[]
      warnings?: readonly unknown[]
    }

export function expectValidatorToPass(
  validator: () => ValidatorResult,
  label: string
) {
  let result: ValidatorResult = undefined

  expect(() => {
    result = validator()
  }, `${label} must not throw`).not.toThrow()

  if (typeof result === "boolean") {
    expect(result, `${label} returned false`).toBe(true)
  } else if (Array.isArray(result)) {
    expect(result, `${label} returned validation issues`).toEqual([])
  } else if (typeof result === "object" && result !== null) {
    const report = result as Exclude<ValidatorResult, void | boolean | readonly unknown[]>

    if (report.valid !== undefined) {
      expect(report.valid, `${label} reported an invalid contract`).toBe(true)
    }
    if (report.errors !== undefined) {
      expect(report.errors, `${label} reported errors`).toEqual([])
    }
  }
}

export function expectUnique(values: readonly string[], label: string) {
  expect(new Set(values).size, `${label} must be unique`).toBe(values.length)
}
