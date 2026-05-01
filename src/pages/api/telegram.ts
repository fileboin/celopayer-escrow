import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://celopayer.onrender.com'

  if (!TOKEN) {
    return res.status(500).json({ error: 'No token' })
  }

  try {
    const { message } = req.body

    if (!message || !message.text) {
      return res.status(200).json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.toLowerCase()

    let responseText = ''
    let replyMarkup = {}

    if (text.startsWith('/start')) {
      responseText = `👋 *Welcome to Celopayer Bot!*\n\nI am your mobile-first gateway for Celo ecosystem. You can send, request, and schedule payments easily.\n\nClick the button below to open the app directly!`
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Open Celopayer App',
              web_app: { url: APP_URL }
            }
          ],
          [
            {
              text: '📖 How it Works',
              callback_data: 'how_it_works'
            }
          ]
        ]
      }
    } else if (text.startsWith('/pay')) {
      const parts = text.split(' ')
      if (parts.length > 1) {
        const amount = parts[1]
        responseText = `💸 *Ready to pay ${amount} USDC?*\n\nClick the button below to complete the payment via Web3.`
        replyMarkup = {
          inline_keyboard: [
            [
              {
                text: `💰 Pay ${amount} USDC`,
                web_app: { url: `${APP_URL}?amount=${amount}&mode=instant` }
              }
            ]
          ]
        }
      } else {
        responseText = `❌ *Invalid Format*\n\nUse: \`/pay [amount]\`\nExample: \`/pay 10\``
      }
    } else {
      responseText = `🤖 *Celopayer Bot Commands:*\n\n/start - Open the App\n/pay [amount] - Create a payment link\n\n_Note: You can also open the App via the menu button below!_`
    }

    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      })
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Telegram Error:', error)
    return res.status(200).json({ ok: true })
  }
}
