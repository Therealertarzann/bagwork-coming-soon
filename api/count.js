import { google } from 'googleapis';

export default async function handler(req, res) {
  // Allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Base count to start from (larped number)
  const BASE_COUNT = 2847;

  try {
    // Parse credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Trim to remove any accidental whitespace/newlines from env var
    const spreadsheetId = process.env.GOOGLE_SHEET_ID.trim();

    // Get all rows in column A
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:A',
    });

    // Count the actual signups (rows in the sheet)
    const actualSignups = response.data.values ? response.data.values.length : 0;

    // Return base + actual signups
    return res.status(200).json({
      count: BASE_COUNT + actualSignups,
      success: true
    });
  } catch (error) {
    console.error('Error getting count:', error);
    // On error, just return the base count
    return res.status(200).json({
      count: BASE_COUNT,
      success: true
    });
  }
}
