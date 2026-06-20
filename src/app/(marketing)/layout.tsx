import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground selection:bg-primary/30 selection:text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-3 z-[100] rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground shadow-xl focus:not-sr-only"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="relative min-w-0">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
