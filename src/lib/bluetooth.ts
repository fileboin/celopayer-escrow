export interface BluetoothDevice {
  id: string
  name: string
  address?: string
}

export interface BluetoothPaymentRequest {
  recipient: string
  amount: string
  token: string
  mode: 'instant' | 'escrow'
  timeLock?: string
}

export interface BluetoothPaymentResponse {
  status: 'accepted' | 'rejected' | 'error'
  transactionHash?: string
  error?: string
}

export class BluetoothService {
  private isSupported: boolean = false
  private device: BluetoothDevice | null = null
  private characteristic: any | null = null

  constructor() {
    this.checkSupport()
  }

  private checkSupport() {
    this.isSupported = 'bluetooth' in navigator && 'Web Bluetooth' in window
  }

  public isBluetoothSupported(): boolean {
    return this.isSupported
  }

  public async requestDevice(): Promise<BluetoothDevice | null> {
    if (!this.isSupported) {
      throw new Error('Bluetooth is not supported on this device')
    }

    try {
      const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service']
      })

      this.device = {
        id: bluetoothDevice.id,
        name: bluetoothDevice.name || 'Unknown Device'
      }

      return this.device
    } catch (error) {
      console.error('Bluetooth device request failed:', error)
      return null
    }
  }

  public async connect(): Promise<boolean> {
    if (!this.device || !this.isSupported) {
      return false
    }

    try {
      const gattServer = await (this.device as any).gatt.connect()
      
      // Try to get a generic characteristic for communication
      const service = await gattServer.getPrimaryService('generic_access')
      const characteristics = await service.getCharacteristics()
      
      if (characteristics.length > 0) {
        this.characteristic = characteristics[0]
        return true
      }
      
      return false
    } catch (error) {
      console.error('Bluetooth connection failed:', error)
      return false
    }
  }

  public async disconnect(): Promise<void> {
    if (this.device && 'gatt' in this.device) {
      await (this.device as any).gatt.disconnect()
    }
    this.device = null
    this.characteristic = null
  }

  public async sendPaymentRequest(request: BluetoothPaymentRequest): Promise<BluetoothPaymentResponse> {
    if (!this.characteristic) {
      return { status: 'error', error: 'No Bluetooth connection established' }
    }

    try {
      const requestData = JSON.stringify(request)
      const encoder = new TextEncoder()
      
      // Send the payment request
      await this.characteristic.writeValue(encoder.encode(requestData))
      
      // Wait for response (simplified - in real implementation would listen for notifications)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate response for demo
      return {
        status: 'accepted',
        transactionHash: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')
      }
    } catch (error) {
      console.error('Failed to send payment request via Bluetooth:', error)
      return { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown Bluetooth error' 
      }
    }
  }

  public async receivePaymentRequest(): Promise<BluetoothPaymentRequest | null> {
    if (!this.characteristic) {
      return null
    }

    try {
      // Start listening for incoming data
      await this.characteristic.startNotifications()
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.characteristic?.stopNotifications()
          resolve(null)
        }, 30000) // 30 second timeout

        this.characteristic!.addEventListener('characteristicvaluechanged', (event: any) => {
          clearTimeout(timeout)
          const value = event.target.value
          const decoder = new TextDecoder()
          const jsonData = decoder.decode(value)
          
          try {
            const paymentRequest = JSON.parse(jsonData) as BluetoothPaymentRequest
            resolve(paymentRequest)
          } catch (error) {
            console.error('Failed to parse payment request:', error)
            resolve(null)
          }
        })
      })
    } catch (error) {
      console.error('Failed to receive payment request via Bluetooth:', error)
      return null
    }
  }

  public getConnectedDevice(): BluetoothDevice | null {
    return this.device
  }

  public isConnected(): boolean {
    return this.device !== null && this.characteristic !== null
  }
}

// Singleton instance
export const bluetoothService = new BluetoothService()
