'use client'

import { useState, useEffect } from 'react'
import { InstallPWA } from '@/components/InstallPWA'
import { HowItWorks } from '@/components/HowItWorks'
import { Wallet, ShieldAlert, Zap, Copy, CheckCircle2, Loader2, QrCode } from 'lucide-react'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'
import { useAccount, useConnect, useDisconnect, useWriteContract, usePublicClient } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QRCodeSVG } from 'qrcode.react'
import { parseUnits, isAddress } from 'viem'
import { USDC_ABI, ESCROW_ABI, CONTRACT_ADDRESS, USDC_ADDRESS } from '@/lib/abi'

export default function Home() {
  const [mode, setMode] = useState<'escrow' | 'instant'>('escrow')
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'qr'>('wallet')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [timeLock, setTimeLock] = useState('3600')
  const [copied, setCopied] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  const [successTx, setSuccessTx] = useState<string | null>(null)
  
  const { width, height } = useWindowSize()
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync, isPending } = useWriteContract()
  const publicClient = usePublicClient()

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Fees calculation
  const numAmount = parseFloat(amount) || 0
  const fee = mode === 'escrow' ? numAmount * 0.005 : 0
  const total = numAmount + fee

  const handlePayment = async () => {
    const cleanRecipient = recipient.trim()
    if (!cleanRecipient || !/^0x[a-fA-F0-9]{40}$/.test(cleanRecipient)) {
      alert("Neispravna wallet adresa! Molim vas unesite validnu adresu koja počinje sa 0x i ima 42 karaktera.")
      return
    }
    if (numAmount <= 0) {
      alert("Molim vas unesite iznos veći od 0 (npr. 0.10).")
      return
    }

    try {
      setStatusMsg('Initiating transaction...')
      
      const usdcDecimals = 6 // Native Celo USDC has 6 decimals
      const parsedAmount = parseUnits(numAmount.toString(), usdcDecimals)
      
      if (mode === 'escrow') {
        // Escrow Mode: 1. Approve Contract to spend total (amount + fee), 2. Call createEscrow
        const totalWithFee = parseUnits(total.toString(), usdcDecimals)
        
        setStatusMsg('Approving USDC...')
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, totalWithFee],
        })
        
        setStatusMsg('Waiting for approval confirmation...')
        const approveReceipt = await publicClient?.waitForTransactionReceipt({ hash: approveHash })
        
        if (approveReceipt?.status !== 'success') {
          throw new Error('Approval transaction failed on the blockchain.')
        }

        setStatusMsg('Creating Escrow...')
        const escrowHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'createEscrow',
          args: [cleanRecipient as `0x${string}`, parsedAmount, BigInt(timeLock)],
        })
        
        setStatusMsg('Waiting for escrow confirmation...')
        const escrowReceipt = await publicClient?.waitForTransactionReceipt({ hash: escrowHash })

        if (escrowReceipt?.status !== 'success') {
          throw new Error('Escrow creation failed on the blockchain.')
        }

        setStatusMsg('Payment successful!')
        setSuccessTx(escrowHash)
      } else {
        // Instant Mode: Direct USDC transfer
        setStatusMsg('Transferring USDC...')
        const transferHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [cleanRecipient as `0x${string}`, parsedAmount],
        })
        
        setStatusMsg('Waiting for transfer confirmation...')
        const transferReceipt = await publicClient?.waitForTransactionReceipt({ hash: transferHash })

        if (transferReceipt?.status !== 'success') {
          throw new Error('Transfer transaction failed on the blockchain.')
        }

        setStatusMsg('Payment successful!')
        setSuccessTx(transferHash)
      }
    } catch (error: any) {
      console.error(error)
      setStatusMsg('')
      alert('Transaction failed: ' + (error.shortMessage || error.message))
    }
  }

  if (!mounted) return null

  if (successTx) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-8">
        <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden border border-gray-100">
          <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
             <span className="text-5xl">🎉</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Uplata Uspela!</h2>
          <p className="text-gray-500 mb-8 font-medium">Tvoja transakcija je uspešno potvrđena na mreži.</p>
          <a 
            href={`https://celoscan.io/tx/${successTx}`} 
            target="_blank" 
            rel="noreferrer" 
            className="block w-full py-3.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl mb-3 hover:bg-gray-200 transition-colors"
          >
            Pregled na CeloScan-u
          </a>
          <button 
            onClick={() => {
              setSuccessTx(null)
              setAmount('')
              setRecipient('')
            }} 
            className="block w-full py-3.5 px-4 bg-celo-green text-white font-bold rounded-xl hover:bg-[#2AAB66] transition-colors shadow-md shadow-celo-green/20"
          >
            Nova Uplata
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 w-full">
          <h1 className="text-3xl font-black tracking-tight text-black">Celopayer</h1>
          <div className="flex items-center gap-2">
            <InstallPWA />
            {isConnected ? (
              <button 
                onClick={() => disconnect()}
                className="text-sm font-bold px-4 py-2 rounded-full bg-white text-black border border-gray-200 shadow-sm hover:bg-gray-50 transition-all"
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </button>
            ) : (
              <button 
                onClick={() => connect({ connector: injected() })}
                className="px-5 py-2.5 bg-black text-white font-bold rounded-full hover:bg-gray-800 transition-all shadow-md flex items-center gap-2 text-sm"
              >
                <Wallet size={16} />
                Connect
              </button>
            )}
          </div>
        </header>

        {/* Mode Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-full mb-6">
          <button
            onClick={() => setMode('escrow')}
            className={`flex-1 py-3 text-sm font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
              mode === 'escrow' 
                ? 'bg-black text-white shadow-md' 
                : 'text-gray-500 hover:text-black'
            }`}
          >
            <ShieldAlert size={18} />
            Escrow
          </button>
          <button
            onClick={() => setMode('instant')}
            className={`flex-1 py-3 text-sm font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
              mode === 'instant' 
                ? 'bg-black text-white shadow-md' 
                : 'text-gray-500 hover:text-black'
            }`}
          >
            <Zap size={18} />
            Instant
          </button>
        </div>

        {/* Payment Method Switcher (Only for Instant Mode) */}
        {mode === 'instant' && (
          <div className="flex bg-gray-100 p-1 rounded-full mb-6">
            <button
              onClick={() => setPaymentMethod('wallet')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
                paymentMethod === 'wallet' 
                  ? 'bg-black text-white shadow-md' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              <Wallet size={16} />
              Web3 Novčanik
            </button>
            <button
              onClick={() => setPaymentMethod('qr')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-full flex justify-center items-center gap-2 transition-all duration-300 ${
                paymentMethod === 'qr' 
                  ? 'bg-black text-white shadow-md' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              <QrCode size={16} />
              Prikaži QR Kod
            </button>
          </div>
        )}

        {/* Payment Form */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 p-6 sm:p-8 mb-6">
          
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              {mode === 'escrow' ? 'Seller Address' : 'Recipient Address'}
            </label>
            <input 
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full p-3.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-celo-green/30 focus:border-celo-green transition-all font-mono text-sm"
              placeholder="0x..."
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Amount (USDC)</label>
            <input 
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-celo-green/30 focus:border-celo-green transition-all text-lg font-semibold"
              placeholder="0.00"
            />
          </div>

          {mode === 'escrow' && (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Time-Lock</label>
              <select 
                value={timeLock}
                onChange={(e) => setTimeLock(e.target.value)}
                className="w-full p-3.5 bg-gray-50 text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-celo-green/30 focus:border-celo-green transition-all font-semibold cursor-pointer appearance-none"
              >
                <option value="3600">1 Hour</option>
                <option value="86400">24 Hours</option>
                <option value="259200">3 Days</option>
                <option value="604800">1 Week</option>
              </select>
            </div>
          )}

          <div className="space-y-3 mb-6 bg-gray-50/80 border border-gray-100 p-5 rounded-2xl text-gray-600 font-medium text-sm">
            <div className="flex justify-between items-center">
              <span>Amount</span>
              <span className="font-semibold text-gray-900">${numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Fee {mode === 'escrow' ? '(0.5%)' : '(0%)'}</span>
              <span className="font-semibold text-gray-900">${fee.toFixed(2)}</span>
            </div>
            <div className="h-px bg-gray-200 w-full my-2"></div>
            <div className="flex justify-between items-center font-bold text-lg text-gray-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {mode === 'instant' && paymentMethod === 'qr' ? (
            <div className="flex flex-col items-center mt-2 pt-2 border-t border-gray-100">
              <h3 className="font-semibold text-gray-500 mb-4 text-xs uppercase tracking-wider">
                Skeniraj za uplatu
              </h3>
              <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-2xl mb-4">
                <QRCodeSVG 
                  value={recipient || '0x'} 
                  size={160} 
                  fgColor="#171717"
                />
              </div>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 font-semibold text-gray-700 bg-gray-50 border border-gray-200 py-2.5 px-5 rounded-xl hover:bg-gray-100 transition-colors text-sm w-full justify-center"
              >
                {copied ? <CheckCircle2 size={16} className="text-celo-green" /> : <Copy size={16} />}
                {copied ? 'Adresa Kopirana!' : 'Kopiraj Adresu'}
              </button>
            </div>
          ) : (
            <>
              <button 
                onClick={handlePayment}
                disabled={!isConnected || isPending}
                className="w-full p-4 bg-black text-white font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <><Loader2 className="animate-spin text-white" size={24} /> Obrađuje se...</>
                ) : (
                  'Plati sa MiniPay / Web3'
                )}
              </button>
              {statusMsg && <p className="text-center font-bold mt-4 text-black text-sm">{statusMsg}</p>}
            </>
          )}
        </div>

        <HowItWorks />

      </div>
    </main>
  )
}
