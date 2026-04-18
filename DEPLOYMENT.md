# Enigma Invest — Production Deployment Guide

> **UPDATED FOR DEPLOYMENT PREP**
> This document outlines the official process for deploying the Enigma platform to cloud infrastructure (Heroku, AWS, DigitalOcean, etc.).

---

## 🏗️ Architecture Overview

The system consists of three main components:
1.  **Backend**: Node.js / Express API.
2.  **Frontend**: React / Vite / Tailwind SPA.
3.  **Database**: MongoDB Atlas (managed cloud DB).
4.  **External Services**: Razorpay (payments) and Alchemy (blockchain transparency logging).

---

## 🔐 Required Production Environment Variables

### Backend Variables
| Variable | Description | Source |
| :--- | :--- | :--- |
| `NODE_ENV` | Must be set to `production` | Infra |
| `PORT` | Public port for the API (default: 5000) | Infra |
| `FRONTEND_URL` | Full URL of the hosted frontend (no trailing slash) | Deployment |
| `MONGO_URI` | MongoDB Atlas production connection string | MongoDB Atlas |
| `JWT_SECRET` | 64-character random hex string | Admin |
| `JWT_EXPIRE` | e.g., `7d` | Admin |
| `RAZORPAY_KEY_ID` | Production Razorpay key | Razorpay Dash |
| `RAZORPAY_KEY_SECRET` | Production Razorpay secret | Razorpay Dash |
| `ALCHEMY_RPC_URL` | Production Polygon RPC URL | Alchemy Dash |
| `ADMIN_WALLET_PRIVATE_KEY` | Ethers-compatible private key for logging | Wallet |
| `INVESTMENT_LOGGER_CONTRACT_ADDRESS` | Deployed contract address on Polygon Mainnet | Deploy Script |

### Frontend Variables (Build-time)
| Variable | Description |
| :--- | :--- |
| `VITE_API_URL` | Public URL of the backend API |
| `VITE_APP_NAME` | `Enigma Invest` |
| `VITE_CHAIN_ID` | `137` (Polygon Mainnet) or `80002` (Amoy) |
| `VITE_POLYGONSCAN_URL` | `https://polygonscan.com/tx` |

---

## 🚀 Deployment Steps

### 1. Backend Deployment (PaaS/VPS)

If using a platform with **Procfile** support (Heroku, Render):
- The `Procfile` is already included in the root.
- Ensure the build command is `npm install`.

If using **Docker**:
- Build with: `docker build -t enigma-backend ./backend`
- Run with: `docker run -p 5000:5000 --env-file .env enigma-backend`

If using **PM2** (VPS/Linux):
- Run: `pm2 start backend/ecosystem.config.js`

### 2. Frontend Deployment (Vercel/Netlify)

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Must be provided during the build process.

---

## ⚠️ Security Checklist

1.  **NODE_ENV**: Verify it is strictly `production`. This automatically disables all developer bypasses for payments and blockchain.
2.  **CORS**: Ensure `FRONTEND_URL` is configured correctly. The backend will reject all other origins in production.
3.  **HSTS**: The application uses Helmet with HSTS enabled. Ensure your SSL certificate is correctly configured.
4.  **Secrets**: Never commit `.env` files. Rotate `JWT_SECRET` if it is ever leaked.

---

## 🧪 Post-Deploy Smoke Test

1.  Hit `https://your-api.com/api/v1/health`. Verify `success: true`.
2.  Attempt to log in with an existing account.
3.  Verify that payment popups initialize correctly (indicates CSP and Razorpay keys are correct).
4.  Check a successful investment record to see if the blockchain status is `logged`.
