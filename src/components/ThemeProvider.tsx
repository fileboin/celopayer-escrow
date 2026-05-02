'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme="celo-yellow" 
      enableSystem
      themes={['light', 'dark', 'celo-yellow', 'celo-modern']}
    >
      {children}
    </NextThemesProvider>
  )
}
