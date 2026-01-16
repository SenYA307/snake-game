# 🐍 Pixel Snake - Pay to Play

A classic snake game with Web3 payment integration on Base network.  
**Pay-per-run**: Each game costs ~£0.0003 in ETH. Die? Pay again!

---

## 🚀 Deploy in 5 Minutes (Vercel)

### One-Click Deploy

<!-- 
  ⚠️ REPLACE THE URL BELOW with your actual GitHub repository URL
  After pushing to GitHub, replace SenYA307/snake-game with your repo
-->

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SenYA307/snake-game&env=TREASURY_ADDRESS,PAYMENT_TOKEN_SECRET,NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID&envDescription=Required%20environment%20variables%20for%20Pixel%20Snake&envLink=https://github.com/SenYA307/snake-game%23environment-variables)

> **📝 Note:** Replace `SenYA307/snake-game` in the button URL above with your actual GitHub repo path after pushing.

---

### Step-by-Step Deployment

#### Step 1: Get Your Credentials (5 min)

Before deploying, gather these 3 things:

| What | Where to Get It |
|------|-----------------|
| **Treasury Address** | Your wallet address (checksummed). Get checksummed version at [ethsum.netlify.app](https://ethsum.netlify.app/) |
| **WalletConnect Project ID** | Free at [cloud.walletconnect.com](https://cloud.walletconnect.com) → Create account → New Project → Copy Project ID |
| **Payment Token Secret** | Generate in terminal: `openssl rand -hex 32` |

#### Step 2: Push to GitHub

```bash
cd ~/Desktop/snake-game

# Initialize git (if not already)
git init
git add .
git commit -m "Pixel Snake - Pay to Play"

# Create GitHub repo and push
# Option A: Using GitHub CLI (recommended)
gh repo create snake-game --public --source=. --push

# Option B: Manual
# 1. Go to github.com/new
# 2. Create repo named "snake-game"
# 3. Run:
git remote add origin https://github.com/SenYA307/snake-game.git
git branch -M main
git push -u origin main
```

#### Step 3: Import to Vercel

1. Go to **[vercel.com/new](https://vercel.com/new)**
2. Click **"Add GitHub Account"** (if first time)
3. Find and select your **snake-game** repository
4. Click **Import**

#### Step 4: Configure Environment Variables

On the "Configure Project" screen, scroll to **Environment Variables** and add:

| Name | Value | Notes |
|------|-------|-------|
| `TREASURY_ADDRESS` | `0x87AA66FB877c508420D77A3f7D1D5020b4d1A8f9` | Your checksummed wallet |
| `PAYMENT_TOKEN_SECRET` | `(your generated secret)` | From `openssl rand -hex 32` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `(your project id)` | From WalletConnect Cloud |

Optional (has default):
| `BASE_RPC_URL` | `https://mainnet.base.org` | Or use Alchemy/QuickNode |

#### Step 5: Deploy!

1. Click **Deploy**
2. Wait ~60 seconds for build
3. ✅ You'll see "Congratulations! Your project is live"

#### Step 6: Get Your Public URL

1. Click **"Continue to Dashboard"**
2. Your URL is shown at the top: `https://snake-game-xxx.vercel.app`
3. Or go to **Settings → Domains** to see/customize your domain

**🎉 Share this URL with friends!**

---

### Testing Your Deployment

After deploy, verify everything works:

```bash
# Check API is configured correctly
curl https://YOUR-PROJECT.vercel.app/api/payments/create-intent

# Should return:
# {"status":"ready","configured":true,...}
```

Then open in browser and test the full flow:
1. ✅ Connect wallet
2. ✅ Switch to Base network
3. ✅ Pay entry fee (~$0.001)
4. ✅ Play the game
5. ✅ Die → Pay again to replay

---

## 🎮 Features

- **Retro pixel art graphics** - Custom-generated sprites
- **Pay-per-run** - Each game costs ~£0.0003 in ETH
- **Base network** - Low fees (~$0.001 per transaction)
- **Secure backend** - Payments verified on-chain
- **Anti-replay** - Each transaction can only be used once

---

## 💻 Local Development

### Prerequisites

- Node.js 18+
- An Ethereum wallet with ETH on Base
- WalletConnect Project ID

### Setup

```bash
# Clone and install
git clone <your-repo>
cd snake-game
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TREASURY_ADDRESS` | ✅ Always | Your wallet address (checksummed) |
| `PAYMENT_TOKEN_SECRET` | ✅ Production | Secret for signing tokens (32+ chars) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ Production | WalletConnect Project ID |
| `BASE_RPC_URL` | Optional | Base RPC (default: mainnet.base.org) |

### Production Mode Locally

```bash
npm run build
npm run start
# Opens on http://localhost:3000 in production mode
```

---

## 🔄 Payment Flow (Pay-Per-Run)

**Every game run requires a separate payment.**

```
┌──────────────┐     pay £0.0003    ┌──────────────┐
│   Paywall    │ ─────────────────▶ │   Playing    │
│              │                    │              │
└──────────────┘                    └──────┬───────┘
       ▲                                   │
       │              💀 death             │
       └───────────────────────────────────┘
```

1. Connect wallet (MetaMask, WalletConnect, etc.)
2. Switch to Base network
3. Pay entry fee (~£0.0003 in ETH)
4. Play until you die
5. Pay again to play again

---

## 🔧 Troubleshooting

### "Payment service unavailable"

Environment variables not configured:
1. Check Vercel dashboard → Settings → Environment Variables
2. Ensure all 3 required variables are set
3. **Redeploy** after adding variables (Deployments → Redeploy)

### "Invalid or expired payment token"

Token signature mismatch:
1. Ensure `PAYMENT_TOKEN_SECRET` is set correctly
2. Don't change the secret after deployment (invalidates existing tokens)

### Wallet won't connect

WalletConnect not configured:
1. Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
2. Get a Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)

### Build fails on Vercel

Check build logs for specific error. Common issues:
- Missing environment variable → Add in Vercel dashboard
- TypeScript error → Fix locally, push, auto-redeploys

---

## 🏗️ Architecture

### Stateless Payment Tokens (Serverless-Safe)

This app uses **signed tokens** instead of server-side session storage, making it work perfectly on Vercel's serverless functions:

```
┌─────────────┐                      ┌─────────────┐
│   Browser   │  POST /create-intent │   Vercel    │
│             │ ───────────────────▶ │  Function   │
│             │                      │             │
│             │ ◀─────────────────── │ Signs token │
│             │  { token, amount }   │ with HMAC   │
│             │                      └─────────────┘
│             │
│  User pays  │  (ETH tx on Base)
│             │
│             │  POST /verify        ┌─────────────┐
│             │ ───────────────────▶ │   Vercel    │
│             │  { txHash, token }   │  Function   │
│             │                      │             │
│             │ ◀─────────────────── │ Verifies:   │
│             │   { paid: true }     │ - Signature │
└─────────────┘                      │ - TX on-chain│
                                     └─────────────┘
```

**Why this works on serverless:**
- ❌ No in-memory sessions (lost on cold start)
- ✅ Token is self-contained and signed
- ✅ Server can verify without remembering anything
- ✅ Works across multiple function instances

### Anti-Replay Protection

- Each transaction hash can only be used once (per serverless instance)
- Tokens expire after 10 minutes
- Unique nonce prevents token reuse
- All transactions verified on-chain via Base RPC

> **Note:** The txHash anti-replay uses in-memory storage which resets between serverless invocations. For a demo app this is fine - the token system provides the primary security. For high-stakes production, add Vercel KV or Upstash Redis.

---

## 📡 API Endpoints

### `POST /api/payments/create-intent`

Creates a signed payment token.

```json
// Request
{ "walletAddress": "0x..." }

// Response  
{
  "token": "eyJ...",
  "requiredAmountWei": "150000000000000",
  "treasuryAddress": "0x...",
  "ethAmount": "0.00015000",
  "expiresAt": 1700000000000
}
```

### `POST /api/payments/verify`

Verifies payment on-chain.

```json
// Request
{
  "txHash": "0x...",
  "token": "eyJ...",
  "walletAddress": "0x..."
}

// Response
{ "paid": true, "confirmations": 1 }
```

### `GET /api/payments/create-intent`

Health check - returns configuration status.

---

## 🔐 Security

| Protection | How It Works |
|------------|--------------|
| Backend verification | Never trusts frontend; verifies on Base RPC |
| HMAC-signed tokens | Tamper-proof payment intents |
| Token expiry | 10-minute TTL prevents stale token attacks |
| Anti-replay | Transaction hashes tracked |
| Address validation | Checksummed addresses only |
| Amount verification | Ensures payment meets requirement |
| Production-only secrets | `PAYMENT_TOKEN_SECRET` required in production |

---

## 📋 Production Checklist

Before sharing your link:

- [ ] All 3 required environment variables set in Vercel
- [ ] Generated a strong `PAYMENT_TOKEN_SECRET` (32+ characters)
- [ ] Tested full flow: connect → pay → play → die → pay again
- [ ] Verified payments arrive in your treasury wallet
- [ ] Updated the Deploy button URL in README (if forking)

### Optional Enhancements

For high-traffic deployments:
- [ ] Add Vercel KV for persistent anti-replay storage
- [ ] Use paid RPC (Alchemy/QuickNode) for reliability
- [ ] Add rate limiting to prevent API abuse
- [ ] Set up monitoring for payment verification

---

## 📄 License

MIT

---

## 🎯 Quick Links

| Resource | URL |
|----------|-----|
| Vercel Dashboard | [vercel.com/dashboard](https://vercel.com/dashboard) |
| WalletConnect Cloud | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| Base Network | [base.org](https://base.org) |
| Bridge ETH to Base | [bridge.base.org](https://bridge.base.org) |
| Checksum Address | [ethsum.netlify.app](https://ethsum.netlify.app) |
