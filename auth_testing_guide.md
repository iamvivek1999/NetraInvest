# Auth Module — Testing Guide (Postman)

Base URL: `http://localhost:5000/api/v1`

---

## 1. Health Check (verify server is running)

**GET** `{{base}}/health`

Expected:
```json
{ "success": true, "message": "Enigma Invest API is running" }
```

---

## 2. Register — Investor

**POST** `{{base}}/auth/register`

Headers: `Content-Type: application/json`

Body:
```json
{
  "fullName": "Alice Sharma",
  "email": "alice@example.com",
  "password": "Invest@123",
  "role": "investor"
}
```

Expected (201):
```json
{
  "success": true,
  "message": "Account created successfully",
  "token": "<jwt>",
  "data": {
    "user": {
      "_id": "...",
      "fullName": "Alice Sharma",
      "email": "alice@example.com",
      "role": "investor",
      "walletAddress": null,
      "isEmailVerified": false
    }
  }
}
```

---

## 3. Register — Startup

**POST** `{{base}}/auth/register`

Body:
```json
{
  "fullName": "Rajan Patel",
  "email": "rajan@techstartup.io",
  "password": "Startup@456",
  "role": "startup"
}
```

Expected (201): Same shape as above with `"role": "startup"`

---

## 4. Register — Duplicate Email (should fail)

**POST** `{{base}}/auth/register`

Same email as above → Expected (409):
```json
{
  "success": false,
  "message": "An account with this email address already exists."
}
```

---

## 5. Register — Admin Role Blocked (should fail)

Body with `"role": "admin"` → Expected (403):
```json
{
  "success": false,
  "message": "Admin accounts cannot be created through this endpoint."
}
```

---

## 6. Register — Validation Errors

Body:
```json
{ "fullName": "", "email": "not-an-email", "password": "abc", "role": "superuser" }
```

Expected (422):
```json
{
  "success": false,
  "message": "Full name is required. Please provide a valid email address. Password must be at least 8 characters. Role must be either \"investor\" or \"startup\""
}
```

---

## 7. Login

**POST** `{{base}}/auth/login`

Body:
```json
{
  "email": "alice@example.com",
  "password": "Invest@123"
}
```

Expected (200):
```json
{
  "success": true,
  "message": "Login successful",
  "token": "<jwt>",
  "data": { "user": { ... } }
}
```

> **Save the `token` value** — set it as `{{token}}` in your Postman environment.

---

## 8. Login — Wrong Password

Body with wrong password → Expected (401):
```json
{
  "success": false,
  "message": "Invalid email or password."
}
```

> Note: Same error for wrong email AND wrong password — no email enumeration.

---

## 9. Get Current User (Protected)

**GET** `{{base}}/auth/me`

Headers:
```
Authorization: Bearer {{token}}
```

Expected (200): Returns current user's profile

---

## 10. Get Me — No Token (should fail)

Same request without Authorization header → Expected (401):
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

---

## 11. Link Wallet Address (Protected)

**PATCH** `{{base}}/auth/wallet`

Headers: `Authorization: Bearer {{token}}`

Body:
```json
{
  "walletAddress": "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"
}
```

Expected (200):
```json
{
  "success": true,
  "message": "Wallet address linked successfully",
  "data": {
    "user": {
      "walletAddress": "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
      ...
    }
  }
}
```

---

## 12. Role Guard Test

To test the authorize() middleware once a protected route exists:

- Login as investor → get investor JWT
- Call a startup-only route with investor JWT → expect 403
```json
{
  "success": false,
  "message": "Access denied. This route requires one of the following roles: startup"
}
```

---

## Postman Environment Variables

| Variable | Value |
|---|---|
| `base` | `http://localhost:5000/api/v1` |
| `token` | Paste JWT from login/register response |
| `adminToken` | Paste JWT from admin login (after seeding) |
