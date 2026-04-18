# Enigma Invest — Backend

> Node.js + Express backend for the Transparent Investment Platform.

## Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB via Mongoose
- **Auth**: JWT
- **Blockchain**: ethers.js (Polygon Mumbai)

## Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your MONGO_URI, JWT_SECRET, and Alchemy keys
```

### 3. Run in development
```bash
npm run dev
```

### 4. Verify server is running
```bash
curl http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  "success": true,
  "message": "Enigma Invest API is running",
  "environment": "development"
}
```

## Folder Structure
```
backend/
├── server.js                  # Entry point
├── .env.example               # Environment template
├── package.json
└── src/
    ├── app.js                 # Express app setup + middleware
    ├── config/
    │   ├── env.js             # Centralized env config
    │   └── db.js              # MongoDB connection
    ├── middleware/
    │   ├── errorHandler.js    # Global error handler + ApiError class
    │   └── requestLogger.js   # Morgan HTTP logger
    └── routes/
        └── index.js           # Central route registry
```

## API Base URL
```
http://localhost:5000/api/v1
```
