import { GridNinjaLogo } from "@/components/brand/gridninja-logo"

function typecheckLogoMotionContracts() {
  if (false) {
    ;<GridNinjaLogo variant="micro" motion="micro-response" />
    ;<GridNinjaLogo
      variant="ceremonial"
      motion="guardian-wake"
      reveal="once"
    />

    // @ts-expect-error Micro motion cannot target a detailed emblem.
    ;<GridNinjaLogo variant="detailed" motion="micro-response" />

    // @ts-expect-error Guardian Wake requires the ceremonial emblem.
    ;<GridNinjaLogo variant="micro" motion="guardian-wake" />

    // @ts-expect-error Reveal is unavailable for static artwork.
    ;<GridNinjaLogo variant="ceremonial" reveal="once" />
  }
}

void typecheckLogoMotionContracts
