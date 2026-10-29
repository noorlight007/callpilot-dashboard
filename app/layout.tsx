import React from "react"
import type { Metadata } from 'next'
import { ThemeProvider } from "@/components/theme-provider"
import { BaseUIProvider } from "@/components/base-ui-provider"

import './globals.css'


export const metadata: Metadata = {
  title: {
    default: "CallPilot",
    template: "%s | CallPilot",
  },
  description: "CallPilot account dashboard.",
  robots: {
    index: false,
    follow: false,
  }, // whole panel is private by default
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange
        >
          <BaseUIProvider>
            {children}
          </BaseUIProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
