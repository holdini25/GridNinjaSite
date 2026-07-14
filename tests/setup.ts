import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

import {
  installTestMatchMedia,
  testMatchMedia,
} from "./support/match-media"

if (typeof window !== "undefined") {
  installTestMatchMedia()
}

afterEach(() => {
  testMatchMedia.reset()
  if (typeof window !== "undefined") {
    installTestMatchMedia()
  }
})
