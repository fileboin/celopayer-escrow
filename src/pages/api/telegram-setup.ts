import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://celopayer.onrender.com'

  if (!TOKEN) {
    return res.status(500).json({ ok: false, description: 'TELEGRAM_BOT_TOKEN is missing' })
  }

  const webhookUrl = `${APP_URL}/api/telegram`

  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=${webhookUrl}`)
    const data = await response.json()
    return res.status(200).json(data)
  } catch (error: any) {
    return res.status(500).json({ ok: false, description: error.message })
  }
}
