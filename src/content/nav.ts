type NavItem = {
  label: string
  href: string
  children?: Array<{
    label: string
    href: string
  }>
}

export const navItems: NavItem[] = [
  {
    label: "Platform",
    href: "/platform",
  },
  {
    label: "Solutions",
    href: "/solutions/ai-cloud",
    children: [
      {
        label: "AI Cloud",
        href: "/solutions/ai-cloud",
      },
      {
        label: "Colocation & REITs",
        href: "/solutions/colocation",
      },
      {
        label: "Bridge Power & DER",
        href: "/solutions/bridge-power",
      },
    ],
  },
  {
    label: "Proof",
    href: "/proof",
  },
  {
    label: "ROI",
    href: "/roi",
  },
  {
    label: "About",
    href: "/about",
  },
  {
    label: "Contact",
    href: "/contact",
  },
] 

export const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "Platform", href: "/platform" },
      { label: "Proof Before Autonomy", href: "/proof" },
      { label: "Proof Pack", href: "/proof/proof-pack" },
      { label: "Proof Demo", href: "/demo" },
      { label: "ROI / Capacity Audit", href: "/roi" },
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "AI Cloud", href: "/solutions/ai-cloud" },
      { label: "Colocation & REITs", href: "/solutions/colocation" },
      { label: "Bridge Power & DER", href: "/solutions/bridge-power" },
      { label: "DCII Project", href: "/dcii" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "Request Capacity Audit", href: "/contact?intent=capacity-audit&source=footer" },
      { label: "See Shadow Mode", href: "/proof" },
      { label: "Book Demo", href: "/contact?intent=book-demo&source=footer" },
      { label: "Request DCII Memo", href: "/contact?intent=dcii-memo&source=footer" },
      { label: "Download Proof Pack", href: "/proof/proof-pack" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const
