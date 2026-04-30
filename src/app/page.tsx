'use client'

import { useState } from 'react'
import { HowItWorks } from '@/components/HowItWorks'
import { Wallet, ShieldAlert, Zap, Copy, CheckCircle2, Loader2 } from 'lucide-react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QRCodeSVG } from 'qrcode.react'
import { parseUnits } from 'viem'
import { USDC_ABI, ESCROW_ABI, CONTRACT_ADDRESS, USDC_ADDRESS } from '@/lib/abi'

export default function Home() {
  const [mode, setMode] = useState<'escrow' | 'instant'>('escrow')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [timeLock, setTimeLock] = useState('3600')
  const [copied, setCopied] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContractAsync, isPending } = useWriteContract()

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
    if (!recipient || numAmount <= 0) {
      alert("Please enter a valid recipient address and amount.")
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
        
        setStatusMsg('Creating Escrow...')
        const escrowHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'createEscrow',
          args: [recipient, parsedAmount, BigInt(timeLock)],
        })
        
        setStatusMsg('Payment successful!')
        alert('Escrow created successfully! TX: ' + escrowHash)
      } else {
        // Instant Mode: Direct USDC transfer
        setStatusMsg('Transferring USDC...')
        const transferHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [recipient, parsedAmount],
        })
        
        setStatusMsg('Payment successful!')
        alert('Instant transfer successful! TX: ' + transferHash)
      }
    } catch (error: any) {
      console.error(error)
      setStatusMsg('')
      alert('Transaction failed: ' + (error.shortMessage || error.message))
    }
  }

  return (
    <main className="flex-1 p-4 md:p-8 max-w-md mx-auto w-full">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 mt-4">
        <h1 className="text-2xl font-bold tracking-tight">Celopayer</h1>
        {isConnected ? (
          <button 
            onClick={() => disconnect()}
            className="text-sm font-medium px-4 py-2 rounded-full bg-gray-100 text-gray-700 active:scale-95 transition-transform"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        ) : (
          <button 
            onClick={() => connect({ connector: injected() })}
            className="text-sm font-medium px-4 py-2 rounded-full bg-[var(--celo-yellow)] text-yellow-900 active:scale-95 transition-transform flex items-center gap-2 shadow-sm"
          >
            <Wallet size={16} />
            Connect
          </button>
        )}
      </header>

      {/* Mode Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
        <button
          onClick={() => setMode('escrow')}
          className={`flex-1 py-3 text-sm font-medium rounded-xl flex justify-center items-center gap-2 transition-all ${
            mode === 'escrow' 
              ? 'bg-white shadow-sm text-foreground' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldAlert size={16} className={mode === 'escrow' ? 'text-[var(--celo-green-dark)]' : ''} />
          Escrow
        </button>
        <button
          onClick={() => setMode('instant')}
          className={`flex-1 py-3 text-sm font-medium rounded-xl flex justify-center items-center gap-2 transition-all ${
            mode === 'instant' 
              ? 'bg-white shadow-sm text-foreground' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap size={16} className={mode === 'instant' ? 'text-[var(--celo-yellow)]' : ''} />
          Instant
        </button>
      </div>

      {/* Payment Form */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {mode === 'escrow' ? 'Seller Address' : 'Recipient Address'}
          </label>
          <input 
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 font-medium outline-none focus:border-[var(--celo-green)] focus:ring-2 focus:ring-[var(--celo-green)]/20 transition-all text-sm"
            placeholder="0x..."
          />
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USDC)</label>
        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
          <input 
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-8 pr-4 text-2xl font-bold outline-none focus:border-[var(--celo-green)] focus:ring-2 focus:ring-[var(--celo-green)]/20 transition-all"
            placeholder="0.00"
          />
        </div>

        {mode === 'escrow' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Time-Lock</label>
            <select 
              value={timeLock}
              onChange={(e) => setTimeLock(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 font-medium outline-none focus:border-[var(--celo-green)]"
            >
              <option value="3600">1 Hour</option>
              <option value="86400">24 Hours</option>
              <option value="259200">3 Days</option>
              <option value="604800">1 Week</option>
            </select>
          </div>
        )}

        <div className="space-y-3 mb-8 bg-gray-50 p-4 rounded-2xl">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount</span>
            <span className="font-medium">${numAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fee {mode === 'escrow' ? '(0.5%)' : '(0%)'}</span>
            <span className="font-medium text-gray-700">${fee.toFixed(2)}</span>
          </div>
          <div className="h-px bg-gray-200 w-full my-2"></div>
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-[var(--celo-green-dark)]">${total.toFixed(2)}</span>
          </div>
        </div>

        <button 
          onClick={handlePayment}
          disabled={!isConnected || isPending}
          className="w-full bg-[var(--celo-green)] hover:bg-[var(--celo-green-dark)] disabled:bg-gray-300 disabled:shadow-none text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-[var(--celo-green)]/30 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isPending ? (
            <><Loader2 className="animate-spin" size={20} /> Processing...</>
          ) : (
            'Pay with MiniPay'
          )}
        </button>
        {statusMsg && <p className="text-center text-sm font-medium mt-3 text-gray-500">{statusMsg}</p>}
      </div>

      {/* QR & Copy Section */}
      {total > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col items-center mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            {mode === 'escrow' ? 'Escrow Contract Address' : 'Recipient Address'}
          </h3>
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
            <QRCodeSVG 
              value={`celo:${mode === 'escrow' ? CONTRACT_ADDRESS : (recipient || '0x')}?amount=${total}`} 
              size={160} 
            />
          </div>
          
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-100 py-2 px-4 rounded-full hover:bg-gray-200 transition-colors"
          >
            {copied ? <CheckCircle2 size={16} className="text-[var(--celo-green-dark)]" /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Contract Address'}
          </button>
        </div>
      )}

      <HowItWorks />

    </main>
  )
}
