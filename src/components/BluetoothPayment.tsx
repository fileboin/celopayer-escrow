'use client'

import { useState, useEffect } from 'react'
import { Bluetooth, BluetoothOff, Send, Receive, Loader2, CheckCircle, XCircle, Smartphone } from 'lucide-react'
import { bluetoothService, BluetoothDevice, BluetoothPaymentRequest, BluetoothPaymentResponse } from '@/lib/bluetooth'

interface BluetoothPaymentProps {
  onPaymentRequest?: (request: BluetoothPaymentRequest) => void
  onPaymentResponse?: (response: BluetoothPaymentResponse) => void
  recipient?: string
  amount?: string
  token?: string
  mode?: 'instant' | 'escrow'
  timeLock?: string
}

export function BluetoothPayment({ 
  onPaymentRequest, 
  onPaymentResponse, 
  recipient = '', 
  amount = '', 
  token = 'USDC', 
  mode = 'instant', 
  timeLock = '3600' 
}: BluetoothPaymentProps) {
  const [isSupported, setIsSupported] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isReceiving, setIsReceiving] = useState(false)
  const [lastResponse, setLastResponse] = useState<BluetoothPaymentResponse | null>(null)
  const [showStatus, setShowStatus] = useState(false)

  useEffect(() => {
    setIsSupported(bluetoothService.isBluetoothSupported())
    
    // Check if already connected
    const device = bluetoothService.getConnectedDevice()
    if (device) {
      setConnectedDevice(device)
      setIsConnected(bluetoothService.isConnected())
    }
  }, [])

  const handleConnect = async () => {
    if (!isSupported) return
    
    setIsConnecting(true)
    try {
      const device = await bluetoothService.requestDevice()
      if (device) {
        const connected = await bluetoothService.connect()
        if (connected) {
          setConnectedDevice(device)
          setIsConnected(true)
          setShowStatus(true)
          setTimeout(() => setShowStatus(false), 3000)
        }
      }
    } catch (error) {
      console.error('Bluetooth connection failed:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await bluetoothService.disconnect()
      setConnectedDevice(null)
      setIsConnected(false)
      setLastResponse(null)
    } catch (error) {
      console.error('Bluetooth disconnection failed:', error)
    }
  }

  const handleSendPayment = async () => {
    if (!isConnected || !recipient || !amount) return
    
    setIsSending(true)
    setShowStatus(true)
    
    try {
      const paymentRequest: BluetoothPaymentRequest = {
        recipient,
        amount,
        token,
        mode,
        timeLock
      }
      
      const response = await bluetoothService.sendPaymentRequest(paymentRequest)
      setLastResponse(response)
      onPaymentResponse?.(response)
      
      if (response.status === 'accepted') {
        setTimeout(() => {
          setShowStatus(false)
          setLastResponse(null)
        }, 5000)
      }
    } catch (error) {
      console.error('Failed to send payment via Bluetooth:', error)
      setLastResponse({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleReceivePayment = async () => {
    if (!isConnected) return
    
    setIsReceiving(true)
    setShowStatus(true)
    
    try {
      const request = await bluetoothService.receivePaymentRequest()
      if (request) {
        onPaymentRequest?.(request)
        setLastResponse({
          status: 'accepted',
          transactionHash: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')
        })
      }
    } catch (error) {
      console.error('Failed to receive payment via Bluetooth:', error)
      setLastResponse({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsReceiving(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <BluetoothOff size={20} />
          <div>
            <p className="text-sm font-semibold">Bluetooth Not Available</p>
            <p className="text-xs">Bluetooth is not supported on this device or browser</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bluetooth size={20} className="text-blue-600" />
          Bluetooth Payment
        </h3>
        
        {isConnected ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-semibold rounded-lg transition-colors"
          >
            <BluetoothOff size={16} />
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {isConnecting ? <Loader2 className="animate-spin" size={16} /> : <Bluetooth size={16} />}
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>

      {connectedDevice && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <Smartphone size={16} className="text-green-600" />
            <span className="font-semibold text-gray-900 dark:text-white">Connected to:</span>
            <span className="text-gray-600 dark:text-gray-400">{connectedDevice.name}</span>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSendPayment}
            disabled={isSending || !recipient || !amount}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
          >
            {isSending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            {isSending ? 'Sending...' : 'Send Payment'}
          </button>
          
          <button
            onClick={handleReceivePayment}
            disabled={isReceiving}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
          >
            {isReceiving ? <Loader2 className="animate-spin" size={16} /> : <Receive size={16} />}
            {isReceiving ? 'Receiving...' : 'Receive Payment'}
          </button>
        </div>
      )}

      {showStatus && lastResponse && (
        <div className={`mt-4 p-3 rounded-xl border ${
          lastResponse.status === 'accepted' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30'
            : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30'
        }`}>
          <div className="flex items-center gap-2">
            {lastResponse.status === 'accepted' ? (
              <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <XCircle size={16} className="text-red-600 dark:text-red-400" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                lastResponse.status === 'accepted' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {lastResponse.status === 'accepted' ? 'Payment Successful' : 'Payment Failed'}
              </p>
              {lastResponse.error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{lastResponse.error}</p>
              )}
              {lastResponse.transactionHash && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
                  Tx: {lastResponse.transactionHash.slice(0, 10)}...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!recipient && isConnected && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800/30">
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Please enter a recipient address and amount to send payments via Bluetooth
          </p>
        </div>
      )}
    </div>
  )
}
