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
          args: [recipient as `0x${string}`, parsedAmount, BigInt(timeLock)],
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
          args: [recipient as `0x${string}`, parsedAmount],
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
    <main className="min-h-screen bg-[#FBCC5C] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <header className="flex justify-between items-center mb-6 w-full">
          <h1 className="text-3xl font-extrabold tracking-tight text-black">Celopayer</h1>
          {isConnected ? (
            <button 
              onClick={() => disconnect()}
              className="text-sm font-bold px-4 py-2 rounded-xl bg-white text-black border-2 border-yellow-500 hover:bg-yellow-100 transition-all"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button 
              onClick={() => connect({ connector: injected() })}
              className="px-5 py-3 bg-yellow-500 text-black font-bold uppercase rounded-xl hover:bg-yellow-600 transition-all border-2 border-black flex items-center gap-2"
            >
              <Wallet size={18} />
              Connect
            </button>
          )}
        </header>

        {/* Mode Switcher */}
        <div className="flex bg-white border-2 border-yellow-500 p-1 rounded-xl mb-6">
          <button
            onClick={() => setMode('escrow')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg flex justify-center items-center gap-2 transition-all uppercase ${
              mode === 'escrow' 
                ? 'bg-yellow-500 text-black border-2 border-black' 
                : 'text-gray-600 hover:text-black border-2 border-transparent'
            }`}
          >
            <ShieldAlert size={18} />
            Escrow
          </button>
          <button
            onClick={() => setMode('instant')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg flex justify-center items-center gap-2 transition-all uppercase ${
              mode === 'instant' 
                ? 'bg-yellow-500 text-black border-2 border-black' 
                : 'text-gray-600 hover:text-black border-2 border-transparent'
            }`}
          >
            <Zap size={18} />
            Instant
          </button>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-2xl border-4 border-black p-6 mb-6">
          
          <div className="mb-4">
            <label className="block text-sm font-bold text-black mb-2 uppercase">
              {mode === 'escrow' ? 'Seller Address' : 'Recipient Address'}
            </label>
            <input 
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full p-3 bg-white text-black border-2 border-yellow-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-600 font-mono text-sm"
              placeholder="0x..."
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-black mb-2 uppercase">Amount (USDC)</label>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 bg-white text-black border-2 border-yellow-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-600 text-xl font-bold"
              placeholder="0.00"
            />
          </div>

          {mode === 'escrow' && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-black mb-2 uppercase">Time-Lock</label>
              <select 
                value={timeLock}
                onChange={(e) => setTimeLock(e.target.value)}
                className="w-full p-3 bg-white text-black border-2 border-yellow-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-600 font-bold cursor-pointer"
              >
                <option value="3600">1 Hour</option>
                <option value="86400">24 Hours</option>
                <option value="259200">3 Days</option>
                <option value="604800">1 Week</option>
              </select>
            </div>
          )}

          <div className="space-y-2 mb-6 bg-yellow-100 border-2 border-yellow-500 p-4 rounded-lg text-black font-medium">
            <div className="flex justify-between">
              <span>Amount</span>
              <span className="font-bold">${numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee {mode === 'escrow' ? '(0.5%)' : '(0%)'}</span>
              <span className="font-bold">${fee.toFixed(2)}</span>
            </div>
            <div className="h-0.5 bg-yellow-500 w-full my-2"></div>
            <div className="flex justify-between font-black text-xl">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <button 
            onClick={handlePayment}
            disabled={!isConnected || isPending}
            className="w-full p-4 bg-yellow-500 text-black font-bold uppercase rounded-xl hover:bg-yellow-600 transition-all flex items-center justify-center gap-2 border-4 border-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <><Loader2 className="animate-spin text-black" size={24} /> PROCESSING...</>
            ) : (
              'PAY WITH MINIPAY'
            )}
          </button>
          {statusMsg && <p className="text-center font-bold mt-4 text-black uppercase">{statusMsg}</p>}
        </div>

        {/* QR & Copy Section */}
        {total > 0 && (
          <div className="bg-white rounded-2xl border-4 border-black p-6 flex flex-col items-center mb-6">
            <h3 className="font-bold text-black mb-4 uppercase">
              {mode === 'escrow' ? 'Escrow Contract Address' : 'Recipient Address'}
            </h3>
            <div className="p-4 bg-white border-4 border-yellow-500 rounded-xl mb-4">
              <QRCodeSVG 
                value={`celo:${mode === 'escrow' ? CONTRACT_ADDRESS : (recipient || '0x')}?amount=${total}`} 
                size={160} 
              />
            </div>
            
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 font-bold text-black bg-yellow-100 border-2 border-yellow-500 py-3 px-6 rounded-xl hover:bg-yellow-200 transition-colors uppercase"
            >
              {copied ? <CheckCircle2 size={18} className="text-black" /> : <Copy size={18} />}
              {copied ? 'COPIED!' : 'COPY ADDRESS'}
            </button>
          </div>
        )}

        <HowItWorks />

      </div>
    </main>
  )
}
