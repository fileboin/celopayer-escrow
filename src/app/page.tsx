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
  
  const { theme, setTheme } = useTheme()
  const { width, height } = useWindowSize()
  
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
      
      const token = TOKENS[selectedTokenIndex]
      const usdcDecimals = token.decimals
      const parsedAmount = parseUnits(numAmount.toString(), usdcDecimals)
      
      let txHash = ''

      if (mode === 'escrow') {
        const totalWithFee = parseUnits(total.toString(), usdcDecimals)
        
        setStatusMsg(t.apprUsdc)
        const approveHash = await writeContractAsync({
          address: token.address,
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
        
        txHash = escrowHash
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
          address: token.address,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [cleanRecipient as `0x${string}`, parsedAmount],
        })
        
        txHash = transferHash
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

      // Add to history
      const newTx = {
        hash: txHash,
        amount: numAmount,
        token: token.symbol,
        to: cleanRecipient,
        date: new Date().toISOString(),
        mode
      }
      setHistory([newTx, ...history])

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
            {mode === 'escrow' ? t.escrowStarted : t.paymentCompleted}
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

            {/* Telegram Bot Link */}
            <a 
              href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'volegram-celopay'}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              title="Telegram Bot"
            >
              <MessageCircle size={18} className="text-[#0088cc]" />
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
            
            <button 
              onClick={() => setShowHistory(true)}
              className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              title={t.history}
            >
              <HistoryIcon size={18} />
            </button>

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

          {flow !== 'scheduled' && (
            <button 
              onClick={!isConnected ? () => setShowConnectMenu(true) : handlePayment}
              disabled={isPending}
              id="main-payment-button"
              className={`w-full p-5 text-white font-black text-xl rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 transform active:scale-95 ${
                !isConnected 
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-black' 
                  : 'bg-gradient-to-r from-[#2AAB66] to-[#F6C644] hover:brightness-110 shadow-celo-green/30'
              }`}
            >
              {!isConnected ? (
                <><Wallet size={24} /> {t.connectToPay}</>
              ) : isPending ? (
                <><Loader2 className="animate-spin text-white" size={24} /> {t.processing}</>
              ) : (
                <><Zap size={24} /> {flow === 'request' ? t.generateLink : (mode === 'escrow' ? t.payWith : t.sendPayment)}</>
              )}
            </button>
          )}
          
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
