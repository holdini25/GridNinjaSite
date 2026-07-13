import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

import {
  installTestMatchMedia,
  testMatchMedia,
} from "./support/match-media"

installTestMatchMedia()

afterEach(() => {
  testMatchMedia.reset()
  installTestMatchMedia()
})
