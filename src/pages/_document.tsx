import { Head, Html, Main, NextScript } from "next/document"

export default function ContactDocument() {
  return <Html lang="en" className="dark">
    <Head />
    <body className="min-h-screen bg-background text-foreground antialiased">
      <Main />
      <NextScript />
    </body>
  </Html>
}
