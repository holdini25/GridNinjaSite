export type Founder = {
  id: string
  name: string
  role: string
  portrait: { src: string; position: string; framing: "standard" | "close" }
  background: string
  focus: string
  experience: string
}

/**
 * Source: DeckNinja.pptx.pdf, page 24 (Contact), supplied 2026-10-14.
 * Library: libfile_fba419bd81d881918a6c059286aca0ca.
 * Holden's Computer Science wording was explicitly confirmed by the user.
 * Background fields do not assert a degree, graduation date, or honors.
 * Personal contact details are intentionally replaced by the shared site CTA.
 */
export const founders = [
  {
    id: "holden-chung",
    name: "Holden Chung",
    role: "Founder / operator lead",
    portrait: { src: "/images/founders/holden-chung.webp", position: "50% 42%", framing: "standard" },
    background: "Georgia Tech · Computer Science",
    focus: "Designing complex adaptive systems and neural networks.",
    experience: "Internship and early career experience in cloud security design and engineering.",
  },
  {
    id: "jonathan-malone",
    name: "Jonathan Malone",
    role: "Co-founder / technical lead",
    portrait: { src: "/images/founders/jonathan-malone.webp", position: "50% 40%", framing: "close" },
    background: "Georgia Tech · Biomedical Engineering & Machine Learning",
    focus: "Experience designing machine learning based health wearables.",
    experience: "Internship and early career experience in neurological imaging and systems design.",
  },
] as const satisfies readonly Founder[]
