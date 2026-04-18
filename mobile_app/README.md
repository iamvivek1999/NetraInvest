# Enigma Invest — Flutter Mobile App

Mobile companion for the **Enigma Invest** platform — a transparent startup investment platform built on MERN + Razorpay + Blockchain transparency.

---

## Architecture

| Layer | Choice |
|---|---|
| State | Provider |
| HTTP | `package:http` |
| Storage | `shared_preferences` |
| Payments | Razorpay (via backend `create-order` + `verify`) |
| Blockchain | Backend logs to Polygon Amoy — displayed in portfolio |

---

## User Roles

| Role | Home Screen | Features |
|---|---|---|
| `investor` | `/investor-dashboard` | Discover campaigns, invest via Razorpay, view portfolio + blockchain hashes |
| `startup` | `/startup-dashboard` | View own campaigns, funding progress, milestone status |

---

## Setup

### 1. Configure API URL

Open `lib/services/api_service.dart` and set the correct `baseUrl`:

```dart
// Android Emulator
static const String baseUrl = 'http://10.0.2.2:5000/api/v1';

// Physical device (USB adb reverse)
static const String baseUrl = 'http://localhost:5000/api/v1';

// Physical device (WiFi)
static const String baseUrl = 'http://192.168.x.x:5000/api/v1';
```

### 2. Install dependencies

```bash
flutter pub get
```

### 3. Start the backend

Make sure the Enigma backend is running:

```bash
cd backend
npm run dev
```

> Note: If testing investments without real Razorpay credentials, set `DEV_BYPASS_PAYMENT=true` in the backend `.env` file.

### 4. Run the app

```bash
flutter run
```

---

## Test Accounts (after running `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Investor | `investor@test.com` | `Pass1234` |
| Startup | `startup@test.com` | `Pass1234` |
| Admin | `admin@test.com` | `Pass1234` (web only) |

---

## Payment Flow (Dev Mode)

With `DEV_BYPASS_PAYMENT=true` on the backend:

1. Tap **Invest Now** on any campaign card
2. Enter an amount (respects `minInvestment`, `maxInvestment`)
3. The app calls `POST /payments/create-order` → gets a fake order ID
4. The app calls `POST /payments/verify` with placeholder Razorpay IDs
5. Backend creates the `Investment` document and logs to blockchain
6. Portfolio tab shows the confirmed investment with blockchain tx hash

---

## Project Structure

```
lib/
├── main.dart                   # App entry point, routes, theme
├── services/
│   └── api_service.dart        # HTTP client for all backend endpoints
├── providers/
│   ├── auth_provider.dart      # Login, register, session restore
│   ├── campaign_provider.dart  # Campaign listing and detail
│   └── investment_provider.dart# Razorpay flow + investment history
└── screens/
    ├── login_screen.dart       # Login (investor + startup)
    ├── register_screen.dart    # Registration (role selection)
    ├── investor_dashboard.dart # Discover campaigns + Portfolio
    └── startup_dashboard.dart  # Campaigns + Milestones
```
