import { google } from 'googleapis';

// Prize segments (the 10k is there but will never be selected)
const PRIZES = [
  { name: 'EARLY ACCESS', weight: 30 },
  { name: '2X BONUS', weight: 25 },
  { name: 'VIP STATUS', weight: 20 },
  { name: 'FREE SPIN', weight: 15 },
  { name: '$100 CREDIT', weight: 8 },
  { name: '$500 CREDIT', weight: 2 },
  { name: '$10,000', weight: 0 }, // Weight 0 = never wins
];

// Get weighted random prize (excludes $10k)
function getRandomPrize() {
  const totalWeight = PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (const prize of PRIZES) {
    if (prize.weight === 0) continue; // Skip impossible prizes
    random -= prize.weight;
    if (random <= 0) return prize.name;
  }
  return PRIZES[0].name; // Fallback
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet } = req.body;

  // Validate wallet address (basic Solana/ETH format check)
  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // Get IP address
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             'unknown';

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID.trim();

    // Check if IP already spun today - look in Sheet2 (Spins)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    let hasSpunToday = false;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Spins!A:C',
      });

      const rows = response.data.values || [];
      hasSpunToday = rows.some(row => row[0] === ip && row[2]?.startsWith(today));
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

    if (hasSpunToday) {
      return res.status(429).json({
        error: 'Already spun today',
        message: 'Come back tomorrow for another spin!'
      });
    }

    // Get the prize
    const prize = getRandomPrize();

    // Log the spin
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Spins!A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[ip, wallet, new Date().toISOString(), prize]],
      },
    });

    // Return prize with the segment index for animation
    const prizeIndex = PRIZES.findIndex(p => p.name === prize);

    return res.status(200).json({
      success: true,
      prize,
      prizeIndex,
      totalSegments: PRIZES.length
    });

  } catch (error) {
    console.error('Spin error:', error);
    return res.status(500).json({ error: 'Spin failed. Try again.' });
  }
}
