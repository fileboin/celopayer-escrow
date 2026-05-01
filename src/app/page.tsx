'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { InstallPWA } from '@/components/InstallPWA'
import { HowItWorks } from '@/components/HowItWorks'
import { Wallet, ShieldAlert, Zap, Copy, CheckCircle2, Loader2, Moon, Sun, Globe, QrCode, Share2, Send, MessageCircle, Mail } from 'lucide-react'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { useAccount, useConnect, useDisconnect, useWriteContract, usePublicClient } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QRCodeSVG } from 'qrcode.react'
import { parseUnits, isAddress } from 'viem'
import { USDC_ABI, ESCROW_ABI, CONTRACT_ADDRESS, USDC_ADDRESS } from '@/lib/abi'
import { translations, Language } from '@/lib/i18n'
import { useTheme } from 'next-themes'

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-celo-green" /></div>}>
      <PaymentApp />
    </Suspense>
  )
}

function PaymentApp() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'escrow' | 'instant'>('escrow')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [timeLock, setTimeLock] = useState('3600')
  const [copied, setCopied] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  const [successTx, setSuccessTx] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  
  const [lang, setLang] = useState<Language>('en')
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showConnectMenu, setShowConnectMenu] = useState(false)
  
  const { theme, setTheme } = useTheme()
  const { width, height } = useWindowSize()
  
  useEffect(() => {
    setMounted(true)
    
    // Handle query params for deep linking
    const toParam = searchParams.get('to')
    const amountParam = searchParams.get('amount')
    const modeParam = searchParams.get('mode')
    
    if (toParam) setRecipient(toParam)
    if (amountParam) setAmount(amountParam)
    if (modeParam === 'instant' || modeParam === 'escrow') setMode(modeParam as any)
  }, [searchParams])
  
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync, isPending } = useWriteContract()
  const publicClient = usePublicClient()

  const t = translations[lang]

  const handleCopy = () => {
    navigator.clipboard.writeText(recipient || '0x')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Fees calculation
  const numAmount = parseFloat(amount) || 0
  const fee = mode === 'escrow' ? numAmount * 0.005 : 0
  const total = numAmount + fee

  const handlePayment = async () => {
    setErrorMsg('')
    // Extract the raw 0x address from any pasted string or URI
    const match = recipient.match(/0x[a-fA-F0-9]{40}/i)
    const cleanRecipient = match ? match[0] : recipient.trim()
    
    if (!cleanRecipient || !isAddress(cleanRecipient)) {
      setErrorMsg(t.invalidAddress)
      return
    }
    if (numAmount <= 0) {
      setErrorMsg(t.invalidAmount)
      return
    }

    try {
      setStatusMsg(t.processing)
      
      const usdcDecimals = 6 // Native Celo USDC has 6 decimals
      const parsedAmount = parseUnits(numAmount.toString(), usdcDecimals)
      
      if (mode === 'escrow') {
        const totalWithFee = parseUnits(total.toString(), usdcDecimals)
        
        setStatusMsg(t.apprUsdc)
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, totalWithFee],
        })
        
        setStatusMsg(t.waitAppr)
        const approveReceipt = await publicClient?.waitForTransactionReceipt({ hash: approveHash })
        
        if (approveReceipt?.status !== 'success') {
          throw new Error(t.errAppr)
        }

        setStatusMsg(t.creatEscrow)
        const escrowHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'createEscrow',
          args: [cleanRecipient as `0x${string}`, parsedAmount, BigInt(timeLock)],
        })
        
        setIsConfirming(true)
        setStatusMsg(t.creatEscrow + " (Hash: " + escrowHash.slice(0, 10) + "...)")
        const escrowReceipt = await publicClient?.waitForTransactionReceipt({ hash: escrowHash })

        if (escrowReceipt?.status !== 'success') {
          throw new Error(t.errEscrow)
        }

        setStatusMsg(t.paymentSuccess)
        setIsConfirming(false)
        setSuccessTx(escrowHash)
      } else {
        setStatusMsg(t.waitTrans)
        const transferHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [cleanRecipient as `0x${string}`, parsedAmount],
        })
        
        setIsConfirming(true)
        setStatusMsg(t.waitTrans + " (Hash: " + transferHash.slice(0, 10) + "...)")
        const transferReceipt = await publicClient?.waitForTransactionReceipt({ hash: transferHash })

        if (transferReceipt?.status !== 'success') {
          throw new Error(t.errTrans)
        }

        setStatusMsg(t.paymentSuccess)
        setIsConfirming(false)
        setSuccessTx(transferHash)
      }
    } catch (error: any) {
      console.error(error)
      setStatusMsg('')
      setIsConfirming(false)
      
      // Improve error readability
      let errMsg = error.shortMessage || error.message
      if (errMsg.includes('insufficient funds') || errMsg.includes('exceeds balance')) {
        errMsg = "Nedovoljno sredstava (potreban USDC i malo CELO tokena za proviziju mreže)."
      } else if (errMsg.includes('User rejected')) {
        errMsg = "Transakcija je odbijena u novčaniku."
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

  if (!mounted) return null

  if (successTx) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-8 transition-colors">
        <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner">
             <span className="text-5xl">🎉</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">{t.paymentSuccess}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">{t.successDesc}</p>
          <a 
            href={`https://celoscan.io/tx/${successTx}`} 
            target="_blank" 
            rel="noreferrer" 
            className="block w-full py-3.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl mb-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t.viewCeloScan}
          </a>
          <button 
            onClick={() => {
              setSuccessTx(null)
              setAmount('')
              setRecipient('')
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
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Transakcija u toku...</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">Transakcija je poslata na mrežu. Molimo sačekajte par sekundi za potvrdu.</p>
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

            {/* Language Selector */}
            <div className="relative">
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-1"
              >
                <Globe size={18} />
                <span className="text-xs font-bold uppercase">{lang}</span>
              </button>
              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                  {(Object.keys(translations) as Language[]).map(l => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); setShowLangMenu(false) }}
                      className={`w-full text-left px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 ${lang === l ? 'text-celo-green' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      {l === 'en' ? 'English' : l === 'sr' ? 'Srpski' : l === 'es' ? 'Español' : 'Français'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <InstallPWA />
            {isConnected ? (
              <button 
                onClick={() => disconnect()}
                className="text-sm font-bold px-4 py-2 rounded-full bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </button>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setShowConnectMenu(!showConnectMenu)}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-md flex items-center gap-2 text-sm"
                >
                  <Wallet size={16} />
                  {t.connect}
                </button>
                {showConnectMenu && (
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                    {connectors.map(connector => (
                      <button
                        key={connector.uid}
                        onClick={() => { connect({ connector }); setShowConnectMenu(false) }}
                        className="w-full text-left px-4 py-3 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-b border-gray-50 dark:border-gray-700 last:border-0"
                      >
                        {connector.name === 'Injected' ? 'Browser / MiniPay' : connector.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Mode Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full mb-6">
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

        {/* Payment Form */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-gray-700 p-6 sm:p-8 mb-6 transition-colors">
          
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
              {mode === 'escrow' ? t.sellerAddress : t.recipientAddress}
            </label>
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

          <button 
            onClick={handlePayment}
            disabled={!isConnected || isPending}
            className="w-full p-4 bg-gradient-to-r from-[#2AAB66] to-[#F6C644] text-white font-extrabold text-lg rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-celo-green/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
          >
            {isPending ? (
              <><Loader2 className="animate-spin text-white" size={24} /> {t.processing}</>
            ) : (
              t.payWith
            )}
          </button>
          {statusMsg && <p className="text-center font-bold mt-4 text-celo-green text-sm">{statusMsg}</p>}
          {errorMsg && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl text-center border border-red-100 dark:border-red-800/30">
              {errorMsg}
            </div>
          )}

          {/* Persistent QR Code Section */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col items-center">
            <h3 className="font-semibold text-gray-500 dark:text-gray-400 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
              <QrCode size={14} /> {t.scanToPay}
            </h3>
            <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-2xl mb-4 transition-colors">
              <QRCodeSVG 
                value={recipient.match(/0x[a-fA-F0-9]{40}/i)?.[0] || recipient || '0x'} 
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
          
        </div>

        <HowItWorks />

        {/* Footer with Admin Link */}
        <footer className="mt-8 text-center">
          <a href="/admin" className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            Admin Panel
          </a>
        </footer>

      </div>
    </main>
  )
}
