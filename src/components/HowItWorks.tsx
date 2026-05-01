import { ShieldCheck, LockKeyhole, ArrowRightLeft } from 'lucide-react'

export function HowItWorks() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mt-8 mb-8 transition-colors">
      <h3 className="text-xl font-semibold mb-6 text-foreground dark:text-white text-center">How Celopayer Works</h3>
      
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--celo-yellow-light)] flex items-center justify-center text-[var(--celo-yellow)]">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h4 className="font-medium text-foreground dark:text-gray-100">1. Lock Funds</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Buyer pays for the item. The funds are locked safely in our smart contract.</p>
          </div>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h4 className="font-medium text-foreground dark:text-gray-100">2. Await Delivery</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Seller ships or delivers the service. Buyer inspects upon arrival.</p>
          </div>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--celo-green)]/10 flex items-center justify-center text-[var(--celo-green-dark)]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h4 className="font-medium text-foreground dark:text-gray-100">3. Release & Get Paid</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Buyer confirms delivery, instantly releasing the funds to the seller's wallet.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
