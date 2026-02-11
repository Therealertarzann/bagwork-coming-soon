# BAGWORK Coming Soon - Setup Guide

## Google Sheets Integration (Secure)

The email signups go directly to a private Google Sheet that only you can access. Here's how to set it up:

### Step 1: Create a Google Sheet
1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it "BAGWORK Waitlist" or whatever you want
3. Copy the spreadsheet ID from the URL (the long string between /d/ and /edit)
   - Example: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`**`/edit`

### Step 2: Create Google Cloud Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search "Google Sheets API" and enable it
4. Create a Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Name it "bagwork-sheets" or whatever
   - Skip the optional steps, click "Done"
5. Create a key for the service account:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the file (keep this secret!)

### Step 3: Share the Sheet with Service Account
1. Open the JSON key file you downloaded
2. Find the `client_email` field (looks like `something@project.iam.gserviceaccount.com`)
3. Go to your Google Sheet
4. Click "Share" and add that email as an Editor

### Step 4: Deploy to Vercel
1. Push this project to GitHub
2. Import it in [Vercel](https://vercel.com)
3. Add these Environment Variables in Vercel settings:
   - `GOOGLE_SHEET_ID` = the spreadsheet ID from Step 1
   - `GOOGLE_CREDENTIALS` = the entire JSON content from the key file (paste the whole thing)

### Security Notes
- The API credentials are stored as environment variables on Vercel (never exposed to users)
- The Google Sheet is only accessible by you and the service account
- No one can see your spreadsheet ID or credentials from the frontend
- Rate limiting can be added if spam becomes an issue

## Local Development
```bash
npm install
# Create a .env.local file with your credentials for local testing
vercel dev
```
