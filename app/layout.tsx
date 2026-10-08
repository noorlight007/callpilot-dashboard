import React from "react"
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ThemeProvider } from "@/components/theme-provider"
import { MotionEffects } from "@/components/motion-effects"
import { BaseUIProvider } from "@/components/base-ui-provider"

import './globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })

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
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={true}
          disableTransitionOnChange
        >
          <MotionEffects />
          <BaseUIProvider>
            {children}
          </BaseUIProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
