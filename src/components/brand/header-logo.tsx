import { MicroMark } from "./micro-gridninja-mark"

/** Rendered by the server layout and passed through the navigation island. */
export function HeaderLogo() {
  return <span className="inline-flex items-center gap-2 sm:gap-2.5">
    <span className={`gn-header-root size-[34px] shrink-0`} data-logo-motion="micro-response" data-logo-reveal="none" data-logo-revealed="true" data-logo-reveal-stage="settled">
      <MicroMark ids={{copper:"header-mark-copper",guardian:"header-mark-guardian"}} className={"gn-header-mark"} />
    </span>
    <span className="gn-header-wordmark text-[22px] font-semibold tracking-[-0.045em]">GridNinja</span>
  </span>
}
