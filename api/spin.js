import { google } from 'googleapis';

// Solana wallet validation (Base58 check)
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function isValidSolanaWallet(address) {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, isRetry } = req.body;

  // Validate Solana wallet address
  if (!isValidSolanaWallet(wallet)) {
    return res.status(400).json({ error: 'Invalid Solana wallet address' });
  }

  // Get IP address
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             'unknown';

  const today = new Date().toISOString().split('T')[0];

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID.trim();

    // Check spin history for this IP today
    let spinsToday = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Spins!A:E',
      });

      const rows = response.data.values || [];
      spinsToday = rows.filter(row => row[0] === ip && row[2]?.startsWith(today));
    } catch (e) {
      // Sheet might not exist yet, create it
      if (e.message?.includes('Unable to parse range')) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: { title: 'Spins' }
                }
              }]
            }
          });
        } catch (createError) {
          // Sheet might already exist, ignore
        }
      }
    }

    // Count spins today
    const spinCount = spinsToday.length;
    const hasUsedRetry = spinsToday.some(row => row[4] === 'RETRY_USED');
    const gotTryAgain = spinsToday.some(row => row[3] === 'TRY_AGAIN');

    // Spin limit logic:
    // - 0 spins: allowed
    // - 1 spin that was TRY_AGAIN and no RETRY_USED: allowed (this is the retry)
    // - Any other case: blocked

    if (spinCount === 0) {
      // First spin of the day - allowed
    } else if (spinCount === 1 && gotTryAgain && !hasUsedRetry && isRetry) {
      // Using their retry from TRY_AGAIN - allowed
    } else {
      // Already spun today
      return res.status(429).json({
        error: 'Already spun today',
        message: 'Come back tomorrow for another spin!'
      });
    }

    // Determine result
    let result, canRetry;

    if (isRetry) {
      // Retry spin - can only be NO_WIN (no infinite retries)
      result = 'NO_WIN';
      canRetry = false;
    } else {
      // First spin - 5% chance of TRY_AGAIN
      const roll = Math.random() * 100;
      if (roll < 5) {
        result = 'TRY_AGAIN';
        canRetry = true;
      } else {
        result = 'NO_WIN';
        canRetry = false;
      }
    }

    // Log the spin
    const logResult = isRetry ? 'RETRY_USED' : result;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Spins!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[ip, wallet, new Date().toISOString(), result, isRetry ? 'RETRY_USED' : '']],
      },
    });

    return res.status(200).json({
      success: true,
      result,
      canRetry
    });

  } catch (error) {
    console.error('Spin error:', error);
    return res.status(500).json({ error: 'Spin failed. Try again.' });
  }
}
