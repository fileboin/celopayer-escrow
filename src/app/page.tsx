'use client'

import { useState, useEffect } from 'react'
import { HowItWorks } from '@/components/HowItWorks'
import { Wallet, ShieldAlert, Zap, Copy, CheckCircle2, Loader2 } from 'lucide-react'
import { useAccount, useConnect, useDisconnect, useWriteContract, usePublicClient } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QRCodeSVG } from 'qrcode.react'
import { parseUnits, isAddress } from 'viem'
import { USDC_ABI, ESCROW_ABI, CONTRACT_ADDRESS, USDC_ADDRESS } from '@/lib/abi'

export default function Home() {
  const [mode, setMode] = useState<'escrow' | 'instant'>('escrow')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [timeLock, setTimeLock] = useState('3600')
  const [copied, setCopied] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  
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
        alert('Escrow created successfully! TX: ' + escrowHash)
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
        alert('Instant transfer successful! TX: ' + transferHash)
      }
    } catch (error: any) {
      console.error(error)
      setStatusMsg('')
      alert('Transaction failed: ' + (error.shortMessage || error.message))
    }
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <header className="flex justify-between items-center mb-6 w-full">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Celopayer</h1>
          {isConnected ? (
            <button 
              onClick={() => disconnect()}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 transition-all"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button 
              onClick={() => connect({ connector: injected() })}
              className="px-5 py-2.5 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm flex items-center gap-2"
            >
              <Wallet size={18} />
              Connect
            </button>
          )}
        </header>

        {/* Mode Switcher */}
        <div className="flex bg-gray-100/80 p-1.5 rounded-xl mb-6 shadow-inner">
          <button
            onClick={() => setMode('escrow')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex justify-center items-center gap-2 transition-all ${
              mode === 'escrow' 
                ? 'bg-white text-celo-green shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldAlert size={18} />
            Escrow
          </button>
          <button
            onClick={() => setMode('instant')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex justify-center items-center gap-2 transition-all ${
              mode === 'instant' 
                ? 'bg-white text-celo-green shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap size={18} />
            Instant
          </button>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 sm:p-8 mb-6">
          
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

          <button 
            onClick={handlePayment}
            disabled={!isConnected || isPending}
            className="w-full p-4 bg-celo-green text-white font-bold rounded-xl hover:bg-[#2AAB66] transition-all shadow-md shadow-celo-green/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <><Loader2 className="animate-spin text-white" size={24} /> Processing...</>
            ) : (
              'Pay with MiniPay'
            )}
          </button>
          {statusMsg && <p className="text-center font-semibold mt-4 text-celo-green text-sm">{statusMsg}</p>}
        </div>

        {/* QR & Copy Section */}
        {total > 0 && mode === 'instant' && (
          <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 flex flex-col items-center mb-6">
            <h3 className="font-semibold text-gray-600 mb-5 text-sm uppercase tracking-wider">
              Scan to Pay
            </h3>
            <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl mb-5">
              <QRCodeSVG 
                value={recipient || '0x'} 
                size={160} 
                fgColor="#171717"
              />
            </div>
            
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 font-semibold text-gray-700 bg-gray-50 border border-gray-200 py-2.5 px-5 rounded-xl hover:bg-gray-100 transition-colors text-sm"
            >
              {copied ? <CheckCircle2 size={16} className="text-celo-green" /> : <Copy size={16} />}
              {copied ? 'Copied to Clipboard' : 'Copy Address'}
            </button>
          </div>
        )}

        <HowItWorks />

      </div>
    </main>
  )
}
