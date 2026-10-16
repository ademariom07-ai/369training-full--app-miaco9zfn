import React, { createContext, useContext, useEffect, useState } from 'react'

type FontSize = 'normal' | 'large' | 'xlarge'

interface AccessibilityContextType {
  fontSize: FontSize
  isBold: boolean
  setFontSize: (size: FontSize) => void
  setIsBold: (bold: boolean) => void
  toggleBold: () => void
  cycleFontSize: () => void
  resetAccessibility: () => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

const FONT_SIZE_KEY = '369_accessibility_font_size'
const BOLD_KEY = '369_accessibility_bold'

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_KEY)
      if (saved === 'large' || saved === 'xlarge') return saved
    } catch {
      /* intentionally ignored */
    }
    return 'normal'
  })

  const [isBold, setIsBoldState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BOLD_KEY) === 'true'
    } catch {
      /* intentionally ignored */
    }
    return false
  })

  // Aplica classes no elemento <html> ou <body>
  useEffect(() => {
    const root = document.documentElement

    // Remover classes anteriores
    root.classList.remove('a11y-font-large', 'a11y-font-xlarge')
    if (fontSize === 'large') {
      root.classList.add('a11y-font-large')
    } else if (fontSize === 'xlarge') {
      root.classList.add('a11y-font-xlarge')
    }

    try {
      localStorage.setItem(FONT_SIZE_KEY, fontSize)
    } catch {
      /* intentionally ignored */
    }
  }, [fontSize])

  useEffect(() => {
    const root = document.documentElement
    if (isBold) {
      root.classList.add('a11y-bold')
    } else {
      root.classList.remove('a11y-bold')
    }

    try {
      localStorage.setItem(BOLD_KEY, String(isBold))
    } catch {
      /* intentionally ignored */
    }
  }, [isBold])

  const setFontSize = (size: FontSize) => setFontSizeState(size)
  const setIsBold = (bold: boolean) => setIsBoldState(bold)
  const toggleBold = () => setIsBoldState((prev) => !prev)

  const cycleFontSize = () => {
    setFontSizeState((prev) => {
      if (prev === 'normal') return 'large'
      if (prev === 'large') return 'xlarge'
      return 'normal'
    })
  }

  const resetAccessibility = () => {
    setFontSizeState('normal')
    setIsBoldState(false)
  }

  return (
    <AccessibilityContext.Provider
      value={{
        fontSize,
        isBold,
        setFontSize,
        setIsBold,
        toggleBold,
        cycleFontSize,
        resetAccessibility,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility deve ser usado dentro de um AccessibilityProvider')
  }
  return context
}
