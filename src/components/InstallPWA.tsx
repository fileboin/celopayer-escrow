'use client'

import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstallable(false)
    }
    setDeferredPrompt(null)
  }

  if (!isInstallable) return null

  return (
    <button 
      onClick={handleInstallClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-black rounded-full hover:bg-gray-800 transition-colors shadow-sm"
    >
      <Download size={14} />
      Install App
    </button>
  )
}
