# CLAUDE.md

## Project Overview

User onboarding and verification system for Microsoft Entra ID (Azure AD). When a new user is created in Entra ID, a Microsoft Graph webhook automatically triggers the verification flow via email.

## Architecture

- **Frontend** (`/onboarding/`): Static HTML/CSS/JS hosted on GitHub Pages
- **Backend** (`/api/`): Azure Functions (Node.js 18)
- **Trigger**: Microsoft Graph change notifications (webhook) for user creation events

## Key Files

### Backend API (`/api/`)
- `user-created-webhook/index.js` - Receives Graph change notifications, sends welcome email for new users
- `manage-subscription/index.js` - Creates/renews Microsoft Graph webhook subscription
- `verify-identity/index.js` - Validates DOB + phone against Entra user properties, sends SMS OTP
- `verify-otp/index.js` - Validates OTP code
- `set-password/index.js` - Sets password, enables account
- `shared/graph-client.js` - Microsoft Graph API client wrapper
- `shared/otp.js` - HMAC-based OTP generation/verification
- `shared/sms.js` - Azure Communication Services SMS helper

### Frontend (`/onboarding/`)
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

## Setup

### Webhook subscription
After deploying the Azure Functions, create the Graph webhook subscription:
```bash
# POST to the manage-subscription endpoint to create the subscription
curl -X POST https://<function-app>.azurewebsites.net/api/webhook/manage-subscription?code=<function-key>
```
The subscription must be renewed before it expires (max 29 days). Call the same endpoint periodically (e.g., via Azure Logic App or timer).

### Creating users in Entra ID
When creating a new user in Entra ID (via portal, PowerShell, or Graph API), set the following fields:
- `accountEnabled`: **false** (required - triggers onboarding)
- `birthday`: employee's date of birth (required - used for identity verification)
- `mobilePhone`: employee's mobile number (required - used for SMS OTP)
- `otherMails`: array with employee's private email address (required - welcome email is sent here)
- `displayName`, `givenName`, `surname`, `userPrincipalName`: standard user fields

## Environment Variables

Required in `api/local.settings.json` (see `local.settings.json.example`):
- `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` - Entra app registration
- `COMMUNICATION_CONNECTION_STRING` - Azure Communication Services
- `SENDER_EMAIL`, `SMS_FROM_NUMBER` - Email/SMS sender info
- `FRONTEND_URL` - GitHub Pages URL
- `OTP_SECRET` - Secret for HMAC token signing
- `NOTIFICATION_URL` - Public URL of the webhook endpoint
- `WEBHOOK_CLIENT_STATE` - Secret for validating incoming webhook notifications

### App Registration Permissions
The Entra app registration requires the following Microsoft Graph **application** permissions:
- `User.ReadWrite.All` - Read/write user profiles and enable accounts
- `Mail.Send` or Communication Services setup for email

## Flow

1. Admin creates user directly in Entra ID (accountEnabled: false, with birthday, mobilePhone, otherMails)
2. Microsoft Graph sends change notification to webhook
3. Webhook processes new user, generates verification token, sends welcome email to private address
4. Employee verifies identity (DOB + phone checked against Entra user properties)
5. OTP sent via SMS → employee enters code
6. Password set → account enabled
7. Redirect to Microsoft MFA setup

## Security Notes

- Accounts are disabled until full verification
- Webhook notifications validated via clientState secret
- Verification tokens expire after 24 hours
- OTP codes expire after 10 minutes
- HMAC-signed tokens prevent tampering
- Password requirements: 12+ chars, uppercase, lowercase, numbers, special chars
- Only users with accountEnabled=false AND otherMails+birthday+mobilePhone set trigger onboarding

## Language

All user-facing text is in Dutch (Nederlands).
