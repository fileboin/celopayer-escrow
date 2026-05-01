'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, usePublicClient } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { CONTRACT_ADDRESS, ESCROW_ABI, TREASURY_ADDRESS } from '@/lib/abi'
import { ShieldAlert, Wallet, CheckCircle, RotateCcw, Loader2, ArrowLeft } from 'lucide-react'
import { formatUnits } from 'viem'
import Link from 'next/link'

type Escrow = {
  id: number
  buyer: string
  seller: string
  amount: bigint
  lockedUntil: bigint
  state: number // 0: Created, 1: Locked, 2: Disputed, 3: Released, 4: Refunded
}

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [mounted, setMounted] = useState(false)
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [showConnectMenu, setShowConnectMenu] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isAdmin = isConnected && address?.toLowerCase() === TREASURY_ADDRESS.toLowerCase()

  const loadEscrows = async () => {
    if (!publicClient || !isAdmin) return
    setLoading(true)
    try {
      const nextId = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'nextEscrowId',
      }) as bigint

      const fetchedEscrows: Escrow[] = []
      for (let i = 0; i < Number(nextId); i++) {
        const data = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'escrows',
          args: [BigInt(i)],
        }) as any[]
        
        fetchedEscrows.push({
          id: i,
          buyer: data[0],
          seller: data[1],
          amount: data[2],
          lockedUntil: data[3],
          state: data[4],
        })
      }
      setEscrows(fetchedEscrows.reverse()) // newest first
    } catch (error) {
      console.error("Failed to load escrows:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadEscrows()
    }
  }, [isAdmin, publicClient])

  const handleResolve = async (id: number, refundBuyer: boolean) => {
    try {
      setProcessingId(id)
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'resolveDispute',
        args: [BigInt(id), refundBuyer],
      })
      await publicClient?.waitForTransactionReceipt({ hash })
      await loadEscrows()
      alert("Spor uspešno rešen!")
    } catch (error: any) {
      console.error(error)
      alert("Greška: " + (error.shortMessage || error.message))
    } finally {
      setProcessingId(null)
    }
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="text-celo-green" /> Admin Panel
            </h1>
          </div>
          
          {isConnected ? (
            <button 
              onClick={() => disconnect()}
              className="text-sm font-bold px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              Disconnect {address?.slice(0, 6)}...
            </button>
          ) : (
            <div className="relative">
              <button 
                onClick={() => setShowConnectMenu(!showConnectMenu)}
                className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-md flex items-center gap-2 text-sm"
              >
                <Wallet size={16} />
                Connect Admin
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
        </header>

        {!isConnected ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
            <ShieldAlert size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Poveži Admin Novčanik</h2>
            <p className="text-gray-500 dark:text-gray-400">Da bi pristupio kontrolnoj tabli za rešavanje sporova, moraš povezati Treasury adresu.</p>
          </div>
        ) : !isAdmin ? (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-12 text-center shadow-sm border border-red-100 dark:border-red-800/30">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Pristup Odbijen</h2>
            <p className="text-red-500 dark:text-red-300">Povezana adresa ({address}) nije glavna Treasury adresa. Samo gazda može da rešava sporove.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sve Escrow Transakcije</h2>
              <button 
                onClick={loadEscrows}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                <RotateCcw size={16} /> Osveži
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-celo-green" size={32} />
              </div>
            ) : escrows.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">Nema pronađenih Escrow ugovora na mreži.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {escrows.map((escrow) => (
                  <div key={escrow.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-black px-2 py-1 rounded-md">
                          ID: #{escrow.id}
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                          escrow.state === 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          escrow.state === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          escrow.state === 2 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          escrow.state === 3 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          {['Created', 'Locked (Aktivno)', 'Disputed (Spor)', 'Released (Završeno)', 'Refunded (Vraćeno)'][escrow.state]}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p><strong className="text-gray-900 dark:text-gray-200">Kupac:</strong> {escrow.buyer}</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Prodavac:</strong> {escrow.seller}</p>
                        <p><strong className="text-gray-900 dark:text-gray-200">Iznos:</strong> ${formatUnits(escrow.amount, 6)} USDC</p>
                      </div>
                    </div>

                    {escrow.state === 2 && ( // Disputed
                      <div className="flex gap-2 w-full md:w-auto">
                        <button 
                          onClick={() => handleResolve(escrow.id, true)} // Refund buyer
                          disabled={processingId === escrow.id}
                          className="flex-1 md:flex-none px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold rounded-xl transition-colors disabled:opacity-50 text-sm flex justify-center items-center gap-2"
                        >
                          {processingId === escrow.id ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                          Vrati Kupcu
                        </button>
                        <button 
                          onClick={() => handleResolve(escrow.id, false)} // Pay seller
                          disabled={processingId === escrow.id}
                          className="flex-1 md:flex-none px-4 py-2 bg-celo-green hover:bg-[#2AAB66] text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm flex justify-center items-center gap-2"
                        >
                          {processingId === escrow.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                          Isplati Prodavcu
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
