'use client'
// Celopayer v0.1.1 - Fresh Build Trigger 2026-05-01

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { InstallPWA } from '@/components/InstallPWA'
import { HowItWorks } from '@/components/HowItWorks'
import { BluetoothPayment } from '@/components/BluetoothPayment'
import { Wallet, ShieldAlert, Zap, Copy, CheckCircle2, Loader2, Moon, Sun, Globe, QrCode, Share2, Send, MessageCircle, Mail, Palette, Smartphone } from 'lucide-react'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { useAccount, useConnect, useDisconnect, useWriteContract, usePublicClient } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QRCodeSVG } from 'qrcode.react'
import { parseUnits, isAddress } from 'viem'
import { USDC_ABI, ESCROW_ABI, CONTRACT_ADDRESS, USDC_ADDRESS, TOKENS } from '@/lib/abi'
import { translations, Language } from '@/lib/i18n'
import { useTheme } from 'next-themes'
import { Search, UserPlus, History as HistoryIcon, FileText, X } from 'lucide-react'

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-celo-green" /></div>}>
      <PaymentApp />
    </Suspense>
  )
}

function PaymentApp() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  
  // Move all state initialization after mounted check
  const [mode, setMode] = useState<'escrow' | 'instant'>('escrow')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [timeLock, setTimeLock] = useState('3600')
  const [copied, setCopied] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successTx, setSuccessTx] = useState<string | null>(null)
  const [successMode, setSuccessMode] = useState<'instant' | 'escrow'>('instant')
  const [isConfirming, setIsConfirming] = useState(false)
  
  const [lang, setLang] = useState<Language>('en')
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showConnectMenu, setShowConnectMenu] = useState(false)
  const [flow, setFlow] = useState<'send' | 'request' | 'scheduled'>('send')
  const [tasks, setTasks] = useState<any[]>([])
  const [frequency, setFrequency] = useState('day')
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0)
  const [contacts, setContacts] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [showContacts, setShowContacts] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', address: '' })
  const [rating, setRating] = useState(0)
  const [showRatingThanks, setShowRatingThanks] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  
  const { theme, setTheme } = useTheme()
  const { width, height } = useWindowSize()
  
  // Only use wagmi hooks after mounted
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync, isPending } = useWriteContract()
  const publicClient = usePublicClient()
  
  useEffect(() => {
    setMounted(true)
    
    if (!searchParams) return
    
    // Handle query params for deep linking
    const toParam = searchParams.get('to')
    const amountParam = searchParams.get('amount')
    const modeParam = searchParams.get('mode')
    
    if (toParam) setRecipient(toParam)
    if (amountParam) setAmount(amountParam)
    if (modeParam === 'instant' || modeParam === 'escrow') setMode(modeParam as any)

    // Load data
    const savedTasks = localStorage.getItem('celopayer_tasks')
    if (savedTasks) setTasks(JSON.parse(savedTasks))
    
    const savedContacts = localStorage.getItem('celopayer_contacts')
    if (savedContacts) setContacts(JSON.parse(savedContacts))
    
    const savedHistory = localStorage.getItem('celopayer_history')
    if (savedHistory) setHistory(JSON.parse(savedHistory))
  }, [searchParams])

  useEffect(() => {
    localStorage.setItem('celopayer_tasks', JSON.stringify(tasks))
    localStorage.setItem('celopayer_contacts', JSON.stringify(contacts))
    localStorage.setItem('celopayer_history', JSON.stringify(history))
  }, [tasks, contacts, history])
  
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-celo-green" size={48} />
      </div>
    )
  }

  const t = translations[lang]

  const handleCopy = () => {
    navigator.clipboard.writeText(recipient || '0x')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Generate invoice URL
  const generateInvoiceUrl = () => {
    const baseUrl = window.location.origin
    const params = new URLSearchParams()
    
    if (recipient) params.append('to', recipient)
    if (amount) params.append('amount', amount)
    if (mode) params.append('mode', mode)
    
    const paramString = params.toString()
    return paramString ? `${baseUrl}?${paramString}` : baseUrl
  }

  // Fees calculation
  const numAmount = parseFloat(amount) || 0
  const fee = mode === 'escrow' ? numAmount * 0.005 : 0
  const total = numAmount + fee

  const handlePayment = async (modeOverride?: 'instant' | 'escrow') => {
    const effectiveMode = modeOverride ?? mode
    if (modeOverride) setMode(modeOverride)
    setErrorMsg('')
    
    // Enhanced address validation
    let cleanRecipient = recipient.trim()
    
    // Extract address from various formats
    if (cleanRecipient.includes('celopayer:')) {
      const match = cleanRecipient.match(/0x[a-fA-F0-9]{40}/i)
      cleanRecipient = match ? match[0] : ''
    } else if (cleanRecipient.includes('0x')) {
      const match = cleanRecipient.match(/0x[a-fA-F0-9]{40}/i)
      cleanRecipient = match ? match[0] : cleanRecipient
    }
    
    // Validate address
    if (!cleanRecipient) {
      setErrorMsg('Please enter a wallet address')
      return
    }
    
    if (!isAddress(cleanRecipient)) {
      setErrorMsg('Invalid wallet address format. Please check and try again.')
      return
    }
    if (numAmount <= 0) {
      setErrorMsg(t.invalidAmount)
      return
    }

    try {
      setStatusMsg(t.processing)
      
      if (demoMode) {
        // Demo mode - simulate payment
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        if (effectiveMode === 'escrow') {
          setStatusMsg('Creating escrow...')
          await new Promise(resolve => setTimeout(resolve, 1500))
          setStatusMsg('Escrow created successfully!')
        } else {
          setStatusMsg('Sending payment...')
          await new Promise(resolve => setTimeout(resolve, 1500))
          setStatusMsg('Payment sent successfully!')
        }
        
        setStatusMsg(t.success)
        setSuccessTx('demo-tx-hash')
        setSuccessMode(effectiveMode)
        setAmount('')
        setRecipient('')
        setMode('escrow')
        setFlow('send')
        
        // Add to history
        const newTx = {
          hash: 'demo-tx-hash',
          amount: numAmount,
          token: TOKENS[selectedTokenIndex].symbol,
          to: cleanRecipient,
          date: new Date().toISOString(),
          mode: effectiveMode
        }
        setHistory([newTx, ...history])
        
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)
      } else {
        // Real blockchain transactions
        const token = TOKENS[selectedTokenIndex]
        const usdcDecimals = token.decimals
        const parsedAmount = parseUnits(numAmount.toString(), usdcDecimals)
        
        let txHash = ''
        setStatusMsg(t.waitTrans + " (Hash: " + transferHash.slice(0, 10) + "...")
        const transferReceipt = await publicClient?.waitForTransactionReceipt({ hash: transferHash })

        if (transferReceipt?.status !== 'success') {
          throw new Error(t.errTrans)
        }

        setStatusMsg(t.paymentSuccess)
        setIsConfirming(false)
        setSuccessMode('instant')
        setSuccessTx(transferHash)
      }

    } catch (error: any) {
      console.error(error)
      setStatusMsg('')
      setIsConfirming(false)
      
      // Improve error readability
      let errMsg = error.shortMessage || error.message
      if (errMsg.includes('insufficient funds') || errMsg.includes('exceeds balance')) {
        errMsg = "Insufficient funds (USDC and a small amount of CELO tokens for network fees required)."
      } else if (errMsg.includes('User rejected')) {
        errMsg = "Transaction rejected in wallet."
      }
      
      setErrorMsg(t.txFailed + errMsg)
    }
  }

  const getShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const baseUrl = window.location.origin
    const params = new URLSearchParams()
    if (recipient) params.set('to', recipient)
    if (amount) params.set('amount', amount)
    params.set('mode', mode)
    return `${baseUrl}/?${params.toString()}`
  }

  const shareVia = (platform: string) => {
    const url = getShareUrl()
    const text = mode === 'escrow' 
      ? `Plati mi sigurno preko Celopayer Escrow-a: ${url}`
      : `Pošalji mi uplatu preko Celopayer-a: ${url}`
    
    let shareLink = ''
    switch (platform) {
      case 'whatsapp': shareLink = `https://wa.me/?text=${encodeURIComponent(text)}`; break
      case 'telegram': shareLink = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`; break
      case 'viber': shareLink = `viber://forward?text=${encodeURIComponent(text)}`; break
      case 'mail': shareLink = `mailto:?subject=Zahtev za uplatu&body=${encodeURIComponent(text)}`; break
      default:
        if (navigator.share) {
          navigator.share({ title: 'Celopayer Request', text, url })
          return
        }
    }
    if (shareLink) window.open(shareLink, '_blank')
  }

  const addScheduledTask = () => {
    if (!recipient || !amount) return
    const newTask = {
      id: Date.now(),
      recipient,
      amount,
      frequency,
      lastPaid: 0,
      mode
    }
    setTasks([...tasks, newTask])
    setFlow('send')
    alert("Payment scheduled! You will see a reminder when it's due.")
  }

  const deleteTasks = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  const payScheduled = (task: any) => {
    setRecipient(task.recipient)
    setAmount(task.amount)
    setMode(task.mode)
    setFlow('send')
    // The user will then click the Pay button
  }

  const addContactToList = () => {
    if (!newContact.name || !newContact.address) return
    setContacts([...contacts, newContact])
    setNewContact({ name: '', address: '' })
  }

  const deleteContact = (addr: string) => {
    setContacts(contacts.filter(c => c.address !== addr))
  }

  const selectContact = (c: any) => {
    setRecipient(c.address)
    setShowContacts(false)
  }

  const downloadReceipt = (tx: any) => {
    const text = `
CELOPAYER RECEIPT
-----------------
Transaction Hash: ${tx.hash}
Date: ${new Date(tx.date).toLocaleString()}
Mode: ${tx.mode.toUpperCase()}
Recipient: ${tx.to}
Amount: ${tx.amount} ${tx.token}
Status: CONFIRMED
-----------------
Thank you for using Celopayer!
    `
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `receipt-${tx.hash.slice(0,8)}.txt`;
    document.body.appendChild(element);
    element.click();
  }

  if (!mounted) return null

  if (successTx) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-8 transition-colors">
        <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner animate-bounce">
             <span className="text-5xl">✅</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
            {successMode === 'escrow' ? t.escrowStarted : t.paymentCompleted}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">{t.successDesc}</p>
          
          <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 text-left">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-400 uppercase font-black">Status</span>
              <span className="text-[10px] text-celo-green font-black uppercase">Confirmed</span>
            </div>
            <p className="text-lg font-black text-gray-900 dark:text-white">
              {amount} {TOKENS[selectedTokenIndex].symbol}
            </p>
            <p className="text-[10px] text-gray-500 font-mono truncate">{recipient}</p>
          </div>

          {!showRatingThanks ? (
            <div className="mb-8">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">{t.rateTransaction}</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => { setRating(star); setShowRatingThanks(true) }}
                    className={`text-2xl transition-transform hover:scale-125 ${rating >= star ? 'grayscale-0' : 'grayscale'}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mb-8 text-xs font-bold text-celo-green animate-pulse">{t.ratingThankYou}</p>
          )}

          <a 
            href={`https://celoscan.io/tx/${successTx}`} 
            target="_blank" 
            rel="noreferrer" 
            className="block w-full py-3.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl mb-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            {t.viewCeloScan}
          </a>
          <button 
            onClick={() => {
              setSuccessTx(null)
              setAmount('')
              setRecipient('')
              setShowRatingThanks(false)
              setRating(0)
            }} 
            className="block w-full py-3.5 px-4 bg-celo-green text-white font-bold rounded-xl hover:bg-[#2AAB66] transition-colors shadow-md shadow-celo-green/20"
          >
            {t.newPayment}
          </button>
        </div>
      </main>
    )
  }

  if (isConfirming) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-8 transition-colors text-center">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col items-center">
          <Loader2 className="animate-spin text-celo-green mb-6" size={64} />
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Transaction in progress...</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">Transaction sent to the network. Please wait a few seconds for confirmation.</p>
          <div className="w-full bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-xs font-mono text-gray-400 break-all">{statusMsg}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-8 w-full relative">
          <h1 className="text-3xl font-black tracking-tight text-black dark:text-white">{t.title}</h1>
          <div className="flex items-center gap-2">
            
            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Admin Link */}
            <a 
              href="/admin"
              className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              title="Admin Panel"
            >
              <ShieldAlert size={18} className="text-celo-green" />
            </a>

            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={t.changeLanguage}
              >
                <Globe size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  {(['en', 'sr', 'es', 'fr'] as Language[]).map(l => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); setShowLangMenu(false) }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-xl last:rounded-b-xl transition-colors ${
                        lang === l ? 'bg-celo-green text-white' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {l === 'en' ? 'English' : l === 'sr' ? 'Српски' : l === 'es' ? 'Español' : 'Français'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Enhanced Theme Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Change Theme"
              >
                <Palette size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <button
                    onClick={() => { setTheme('celo-yellow'); setShowThemeMenu(false) }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-xl transition-colors ${
                      theme === 'celo-yellow' ? 'bg-celo-green text-white' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    🌞 Celo Yellow
                  </button>
                  <button
                    onClick={() => { setTheme('celo-modern'); setShowThemeMenu(false) }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      theme === 'celo-modern' ? 'bg-celo-green text-white' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    🌙 Modern Dark
                  </button>
                  <button
                    onClick={() => { setTheme('light'); setShowThemeMenu(false) }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      theme === 'light' ? 'bg-celo-green text-white' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    ☀️ Light
                  </button>
                  <button
                    onClick={() => { setTheme('dark'); setShowThemeMenu(false) }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 last:rounded-b-xl transition-colors ${
                      theme === 'dark' ? 'bg-celo-green text-white' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    🌙 Dark
                  </button>
                </div>
              )}
            </div>
            
            {/* Connect Wallet */}
            {!isConnected ? (
              <button
                onClick={() => setShowConnectMenu(!showConnectMenu)}
                className="flex items-center gap-2 bg-celo-green hover:bg-celo-green-dark text-white font-bold py-2 px-4 rounded-full transition-all transform hover:scale-105"
              >
                <Wallet size={16} />
                {t.connect}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 px-3 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowConnectMenu(!showConnectMenu)}
                    className="p-1 rounded-full hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                    title="Switch Wallet"
                  >
                    <Wallet size={14} className="text-green-600 dark:text-green-400" />
                  </button>
                  <button
                    onClick={() => disconnect()}
                    className="p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                    title={t.disconnect}
                  >
                    <X size={14} className="text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Connect Menu */}
            {showConnectMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => { connect({ connector }); setShowConnectMenu(false) }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-xl last:rounded-b-xl transition-colors text-gray-700 dark:text-gray-300"
                  >
                    {connector.name === 'Injected' ? 'Browser / MiniPay' : connector.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Send / Request Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full mb-6">
          <button
            onClick={() => setFlow('send')}
            className={`flex-1 py-3 text-sm font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
              flow === 'send' 
                ? 'bg-[#2AAB66] text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Send size={18} />
            {t.sendPayment}
          </button>
          <button
            onClick={() => setFlow('request')}
            className={`flex-1 py-3 text-sm font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
              flow === 'request' 
                ? 'bg-[#F6C644] text-black shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <QrCode size={18} />
            {t.requestPayment}
          </button>
          <button
            onClick={() => setFlow('scheduled')}
            className={`flex-1 py-3 text-sm font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
              flow === 'scheduled' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Wallet size={18} />
            {t.scheduled}
          </button>
        </div>

        {/* Mode Switcher (only for Send mode) */}
        {flow === 'send' && (
          <>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full mb-4">
              <button
                onClick={() => setMode('escrow')}
                className={`flex-1 py-3 text-sm font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
                  mode === 'escrow' 
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <ShieldAlert size={18} />
                {t.escrow}
              </button>
              <button
                onClick={() => setMode('instant')}
                className={`flex-1 py-3 text-sm font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
                  mode === 'instant' 
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <Zap size={18} />
                {t.instant}
              </button>
            </div>

            {/* Modern Pay buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                id="btn-pay-escrow"
                onClick={() => !isConnected ? setShowConnectMenu(true) : handlePayment('escrow')}
                disabled={isPending}
                className="group relative flex items-center justify-center gap-3 py-5 px-4 bg-gradient-to-r from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 text-white font-black rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-sm border-2 border-gray-800"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ShieldAlert size={20} className="relative z-10" />
                <span className="relative z-10">{t.payEscrow}</span>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </button>
              <button
                id="btn-pay-instant"
                onClick={() => !isConnected ? setShowConnectMenu(true) : handlePayment('instant')}
                disabled={isPending}
                className="group relative flex items-center justify-center gap-3 py-5 px-4 bg-gradient-to-r from-celo-green to-green-600 hover:from-green-600 hover:to-green-700 text-white font-black rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-sm border-2 border-green-700"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Zap size={20} className="relative z-10" />
                <span className="relative z-10">{t.payInstant}</span>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
              </button>
            </div>
          </>
        )}

        {/* Payment Form */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-gray-700 p-6 sm:p-8 mb-6 transition-colors">
          
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t.selectToken}</label>
            <div className="grid grid-cols-3 gap-2">
              {TOKENS.map((token, idx) => (
                <button
                  key={token.symbol}
                  onClick={() => setSelectedTokenIndex(idx)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    selectedTokenIndex === idx 
                      ? 'bg-celo-green text-white border-celo-green shadow-md' 
                      : 'bg-gray-50 dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-celo-green'
                  }`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {flow === 'request' ? t.recipientAddress : (mode === 'escrow' ? t.sellerAddress : t.recipientAddress)}
              </label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowContacts(true)}
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Search size={10} /> {t.contacts}
                </button>
                {flow === 'request' && isConnected && (
                  <button 
                    onClick={() => setRecipient(address || '')}
                    className="text-[10px] font-bold text-celo-green hover:underline"
                  >
                    {t.useMyAddress}
                  </button>
                )}
              </div>
            </div>
            <input 
              type="text"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value)
                setErrorMsg('')
              }}
              className="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-celo-green/50 focus:border-celo-green transition-all font-mono text-sm"
              placeholder="0x..."
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t.amountUsdc}</label>
            <input 
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-celo-green/50 focus:border-celo-green transition-all text-lg font-semibold"
              placeholder="0.00"
            />
          </div>

          {/* Enhanced Main Payment Button */}
          {flow !== 'scheduled' && (
            <div className="relative mb-8">
              <button 
                onClick={!isConnected ? () => setShowConnectMenu(true) : handlePayment}
                disabled={isPending}
                id="main-payment-button-top"
                className={`group relative w-full p-6 text-white font-black text-xl rounded-3xl transition-all duration-300 shadow-2xl flex items-center justify-center gap-4 transform hover:scale-105 border-4 ${
                  !isConnected 
                    ? 'bg-gradient-to-r from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 border-gray-800 shadow-gray-900/50' 
                    : 'bg-gradient-to-r from-celo-green to-green-600 hover:from-green-600 hover:to-green-700 border-green-700 shadow-green-500/50'
                }`}
              >
                <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                  !isConnected 
                    ? 'bg-gradient-to-r from-gray-800 to-gray-900' 
                    : 'bg-gradient-to-r from-green-600 to-green-700'
                }`}></div>
                
                {!isConnected ? (
                  <>
                    <Wallet size={28} className="relative z-10" />
                    <span className="relative z-10">{t.connectToPay}</span>
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                  </>
                ) : isPending ? (
                  <>
                    <Loader2 className="animate-spin text-white relative z-10" size={28} />
                    <span className="relative z-10">{t.processing}</span>
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
                  </>
                ) : (
                  <>
                    <Zap size={28} className="relative z-10" />
                    <span className="relative z-10">{flow === 'request' ? t.generateLink : (mode === 'escrow' ? t.payWith : t.sendPayment)}</span>
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                  </>
                )}
              </button>
              
              {/* Glow effect */}
              <div className={`absolute inset-0 rounded-3xl blur-xl opacity-50 ${
                !isConnected 
                  ? 'bg-gray-900' 
                  : 'bg-green-500'
              } -z-10`}></div>
            </div>
          )}

          {mode === 'escrow' && (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t.timeLock}</label>
              <select 
                value={timeLock}
                onChange={(e) => setTimeLock(e.target.value)}
                className="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-celo-green/50 focus:border-celo-green transition-all font-semibold cursor-pointer appearance-none"
              >
                <option value="3600">{t.hour}</option>
                <option value="86400">{t.hours24}</option>
                <option value="259200">{t.days3}</option>
                <option value="604800">{t.week}</option>
              </select>
            </div>
          )}

          <div className="space-y-3 mb-8 bg-gray-50/80 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl text-gray-600 dark:text-gray-400 font-medium text-sm">
            <div className="flex justify-between items-center">
              <span>{t.amount}</span>
              <span className="font-semibold text-gray-900 dark:text-white">${numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t.fee} {mode === 'escrow' ? '(0.5%)' : '(0%)'}</span>
              <span className="font-semibold text-gray-900 dark:text-white">${fee.toFixed(2)}</span>
            </div>
            <div className="h-px bg-gray-200 dark:bg-gray-700 w-full my-2"></div>
            <div className="flex justify-between items-center font-bold text-lg text-gray-900 dark:text-white">
              <span>{t.total}</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {flow === 'scheduled' && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t.every}</label>
              <select 
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full p-3.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:white border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-celo-green/50 focus:border-celo-green transition-all font-semibold cursor-pointer appearance-none"
              >
                <option value="minute">{t.unitMinute}</option>
                <option value="hour">{t.unitHour}</option>
                <option value="day">{t.unitDay}</option>
                <option value="month">{t.unitMonth}</option>
              </select>
              <button 
                onClick={addScheduledTask}
                className="mt-6 w-full p-4 bg-blue-600 text-white font-extrabold text-lg rounded-2xl hover:opacity-90 transition-all shadow-lg"
              >
                {t.addTask}
              </button>
            </div>
          )}



          
          {statusMsg && <p className="text-center font-bold mt-4 text-celo-green text-sm">{statusMsg}</p>}
          {errorMsg && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl text-center border border-red-100 dark:border-red-800/30">
              {errorMsg}
            </div>
          )}

          {/* Enhanced QR Code Section */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col items-center">
            <h3 className="font-semibold text-gray-500 dark:text-gray-400 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
              <QrCode size={14} /> {t.scanToPay}
            </h3>
            
            {/* Payment Details Display */}
            {(recipient || amount) && (
              <div className="mb-4 p-4 bg-gradient-to-r from-celo-green/10 to-celo-yellow/10 border border-celo-green/20 rounded-xl text-center">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {amount && (
                    <div className="text-2xl font-bold text-celo-green">
                      ${amount} {TOKENS[selectedTokenIndex].symbol}
                    </div>
                  )}
                  {recipient && (
                    <div className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-1">
                      {recipient.slice(0, 6)}...{recipient.slice(-4)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {mode === 'escrow' ? 'Escrow Payment' : 'Instant Payment'}
                  </div>
                </div>
                
                {/* Invoice Buttons */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(generateInvoiceUrl())}
                    className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-xs font-semibold text-gray-700 dark:text-gray-300"
                  >
                    <FileText size={12} />
                    Copy Invoice
                  </button>
                  <button
                    onClick={() => window.open(generateInvoiceUrl(), '_blank')}
                    className="flex items-center justify-center gap-2 bg-celo-green hover:bg-celo-green-dark text-white py-2 px-3 rounded-lg transition-all text-xs font-semibold"
                  >
                    <Share2 size={12} />
                    Share Invoice
                  </button>
                </div>
              </div>
            )}
            
            <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-2xl mb-4 transition-colors">
              <QRCodeSVG 
                value={getShareUrl() || `celopayer:${recipient || '0x0000000000000000000000000000000000000000'}?amount=${amount || '0'}&mode=${mode}&token=${TOKENS[selectedTokenIndex].symbol}`} 
                size={140} 
                fgColor="#171717"
              />
            </div>
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 py-2.5 px-5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm w-full justify-center"
            >
              {copied ? <CheckCircle2 size={16} className="text-celo-green" /> : <Copy size={16} />}
              {copied ? t.copied : t.copyAddress}
            </button>

            {/* Sharing Menu */}
            <div className="mt-6 w-full">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-center">Share Request</p>
              <div className="grid grid-cols-4 gap-3">
                <button 
                  onClick={() => shareVia('whatsapp')}
                  className="flex flex-col items-center gap-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl hover:scale-105 transition-transform"
                  title="WhatsApp"
                >
                  <MessageCircle size={24} className="text-[#25D366]" />
                  <span className="text-[10px] font-bold text-gray-500">WhatsApp</span>
                </button>
                <button 
                  onClick={() => shareVia('telegram')}
                  className="flex flex-col items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl hover:scale-105 transition-transform"
                  title="Telegram"
                >
                  <Send size={24} className="text-[#0088cc]" />
                  <span className="text-[10px] font-bold text-gray-500">Telegram</span>
                </button>
                <button 
                  onClick={() => shareVia('viber')}
                  className="flex flex-col items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-2xl hover:scale-105 transition-transform"
                  title="Viber"
                >
                  <MessageCircle size={24} className="text-[#7360f2]" />
                  <span className="text-[10px] font-bold text-gray-500">Viber</span>
                </button>
                <button 
                  onClick={() => shareVia('mail')}
                  className="flex flex-col items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl hover:scale-105 transition-transform"
                  title="Email"
                >
                  <Mail size={24} className="text-gray-500" />
                  <span className="text-[10px] font-bold text-gray-500">Email</span>
                </button>
              </div>
              <button 
                onClick={() => shareVia('native')}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold text-xs hover:opacity-90 transition-opacity"
              >
                <Share2 size={14} /> Other Options
              </button>
            </div>
          </div>
          
          {/* Scheduled Tasks List */}
          {tasks.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Wallet size={12} /> {t.scheduled} Payments
              </h3>
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center animate-in slide-in-from-bottom-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">${task.amount} USDC</p>
                      <p className="text-[10px] text-gray-400 font-mono">{task.recipient.slice(0,10)}...</p>
                      <p className="text-[10px] text-celo-green font-bold uppercase mt-1">Every {task.frequency}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => payScheduled(task)}
                        className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-black text-[10px] font-bold rounded-lg hover:opacity-80"
                      >
                        {t.payWith}
                      </button>
                      <button 
                        onClick={() => deleteTasks(task.id)}
                        className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Quick Actions Section */}
        <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap size={20} className="text-purple-600" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setRecipient(address || '')
                setAmount('10')
                setMode('instant')
                setFlow('send')
              }}
              className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <div className="text-purple-600 dark:text-purple-400 font-bold text-sm">Quick Send $10</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">To my address</div>
            </button>
            <button
              onClick={() => {
                setRecipient(address || '')
                setAmount('25')
                setMode('escrow')
                setFlow('request')
              }}
              className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <div className="text-purple-600 dark:text-purple-400 font-bold text-sm">Request $25</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Escrow payment</div>
            </button>
            <button
              onClick={() => {
                setFlow('scheduled')
                setFrequency('week')
              }}
              className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <div className="text-purple-600 dark:text-purple-400 font-bold text-sm">Schedule</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Recurring payment</div>
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <div className="text-purple-600 dark:text-purple-400 font-bold text-sm">History</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">View transactions</div>
            </button>
          </div>
        </div>

        {/* Enhanced Bluetooth Payment Section */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Smartphone size={20} className="text-blue-600" />
              Bluetooth Payments
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full font-semibold">
                NEW
              </span>
            </div>
          </div>
          
          <BluetoothPayment 
            recipient={recipient}
            amount={amount}
            token={TOKENS[selectedTokenIndex].symbol}
            mode={mode}
            timeLock={timeLock}
            onPaymentRequest={(request) => {
              setRecipient(request.recipient)
              setAmount(request.amount)
              setMode(request.mode)
              if (request.timeLock) setTimeLock(request.timeLock)
              setStatusMsg('Bluetooth payment request received!')
            }}
            onPaymentResponse={(response) => {
              if (response.status === 'accepted' && response.transactionHash) {
                setStatusMsg('Bluetooth payment successful!')
                setSuccessTx(response.transactionHash)
                setSuccessMode(mode)
              } else if (response.status === 'error') {
                setErrorMsg(response.error || 'Bluetooth payment failed')
              }
            }}
          />
        </div>

        {/* Modal: Contacts */}
        {showContacts && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus size={20} className="text-blue-600" /> {t.contacts}
                </h2>
                <button onClick={() => setShowContacts(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <div className="flex gap-2 mb-6">
                  <div className="flex-1 space-y-2">
                    <input 
                      placeholder={t.name}
                      value={newContact.name}
                      onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                      className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none"
                    />
                    <input 
                      placeholder={t.address}
                      value={newContact.address}
                      onChange={(e) => setNewContact({...newContact, address: e.target.value})}
                      className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                  <button 
                    onClick={addContactToList}
                    className="bg-blue-600 text-white px-4 rounded-xl font-bold text-sm"
                  >
                    {t.save}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {contacts.map(c => (
                    <div key={c.address} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                      <button onClick={() => selectContact(c)} className="flex-1 text-left">
                        <p className="text-sm font-bold">{c.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{c.address.slice(0,12)}...</p>
                      </button>
                      <button onClick={() => deleteContact(c.address)} className="text-red-500 p-2">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {contacts.length === 0 && <p className="text-center text-gray-400 py-8 text-xs">No contacts yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: History */}
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <HistoryIcon size={20} className="text-celo-green" /> {t.history}
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3">
                {history.map(tx => (
                  <div key={tx.hash} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{tx.amount} {tx.token}</p>
                        <p className="text-[10px] text-gray-400">{new Date(tx.date).toLocaleDateString()} • {tx.mode.toUpperCase()}</p>
                      </div>
                      <button 
                        onClick={() => downloadReceipt(tx)}
                        className="p-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm hover:scale-105 transition-transform"
                        title={t.downloadReceipt}
                      >
                        <FileText size={14} className="text-celo-green" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono break-all line-clamp-1">{tx.to}</p>
                    <a 
                      href={`https://celoscan.io/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-[9px] font-bold text-celo-green hover:underline"
                    >
                      View on Explorer →
                    </a>
                  </div>
                ))}
                {history.length === 0 && <p className="text-center text-gray-400 py-12 text-xs">{t.noHistory}</p>}
              </div>
            </div>
          </div>
        )}

        <HowItWorks />

        {/* Footer with Admin Link */}
        <footer className="mt-8 text-center">
          <a href="/admin" className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            Admin Panel
          </a>
        </footer>

        <div className="mt-8 p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700 text-center">
          <p className="text-[10px] leading-relaxed text-gray-400 font-medium max-w-xs mx-auto">
            {t.nonCustodialNote}
          </p>
        </div>

      </div>
    </main>
  )
}
