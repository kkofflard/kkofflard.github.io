# CLAUDE.md

## Project Overview

User onboarding and verification system for Microsoft Entra ID (Azure AD). Allows IT admins to create new employee accounts with a secure multi-step verification flow.

## Architecture

- **Frontend** (`/onboarding/`): Static HTML/CSS/JS hosted on GitHub Pages
- **Backend** (`/api/`): Azure Functions (Node.js 18)

## Key Files

### Backend API (`/api/`)
- `create-user/index.js` - Creates disabled user in Entra, sends welcome email
- `verify-identity/index.js` - Validates DOB + phone against Entra, sends SMS OTP
- `verify-otp/index.js` - Validates OTP code
- `set-password/index.js` - Sets password, enables account
- `shared/graph-client.js` - Microsoft Graph API client wrapper
- `shared/otp.js` - HMAC-based OTP generation/verification
- `shared/sms.js` - Azure Communication Services SMS helper

### Frontend (`/onboarding/`)
- `admin.html` - IT admin form for creating new users
- `verify.html` - Multi-step verification flow for new employees
- `style.css` - Shared styles (Microsoft Fluent-inspired)

## Commands

```bash
# Install API dependencies
cd api && npm install

# Run Azure Functions locally
cd api && func start

# Deploy to Azure
cd api && func azure functionapp publish <function-app-name>
```

## Environment Variables

Required in `api/local.settings.json` (see `local.settings.json.example`):
- `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` - Entra app registration
- `TENANT_DOMAIN` - e.g., `company.onmicrosoft.com`
- `COMMUNICATION_CONNECTION_STRING` - Azure Communication Services
- `SENDER_EMAIL`, `SMS_FROM_NUMBER` - Email/SMS sender info
- `FRONTEND_URL` - GitHub Pages URL
- `OTP_SECRET` - Secret for HMAC token signing

## Flow

1. Admin creates user → account created disabled in Entra
2. Welcome email sent to private address with verification URL
3. Employee verifies identity (DOB + phone checked against Entra)
4. OTP sent via SMS → employee enters code
5. Password set → account enabled
6. Redirect to Microsoft MFA setup

## Security Notes

- Accounts are disabled until full verification
- Verification tokens expire after 24 hours
- OTP codes expire after 10 minutes
- HMAC-signed tokens prevent tampering
- Password requirements: 12+ chars, uppercase, lowercase, numbers, special chars

## Language

All user-facing text is in Dutch (Nederlands).
