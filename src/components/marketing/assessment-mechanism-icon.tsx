/** Purpose-made line drawings with no independent meaning beyond their headings. */
export function AssessmentMechanismIcon({ step }: { step: number }) {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {step === 0 ? <>
      <path d="m32 6 14 8-14 8-14-8 14-8Z" /><path d="M18 14v17l14 8 14-8V14M32 22v17" />
      <path d="m18 31-14 8 14 8 14-8M4 39v16l14 8 14-8V39M18 47v16" />
      <path d="m46 31 14 8-14 8-14-8M60 39v16l-14 8-14-8M46 47v16" />
    </> : step === 1 ? <>
      <path d="M39 54H10V7h36v24M18 17h19M18 27h19M18 37h12M18 47h9" />
      <circle cx="46" cy="45" r="14" /><path className="gn-mechanism-accent" d="m39 45 5 5 9-11" />
    </> : <>
      <path d="M30 54H9V7h35v18M17 17h18M17 27h14M17 37h9M17 47h6" />
      <circle cx="41" cy="39" r="12" /><path d="m50 49 11 11" /><path className="gn-mechanism-accent" d="M37 39h8M41 35v8" />
    </>}
  </svg>
}
