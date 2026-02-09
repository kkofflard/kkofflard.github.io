# Medewerker Onboarding Systeem

Veilig onboarding- en verificatiesysteem voor nieuwe medewerkers met Microsoft Entra ID integratie.

## Wat doet dit systeem?

Dit systeem automatiseert het aanmaken van nieuwe gebruikersaccounts met een veilige verificatie-flow:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   IT Admin                    Nieuwe Medewerker                     │
│   ─────────                   ─────────────────                     │
│       │                                                             │
│       │  1. Vult formulier in                                       │
│       ▼     (naam, privé-email, geboortedatum, 06-nummer)           │
│   ┌───────────┐                                                     │
│   │  Admin    │                                                     │
│   │  Pagina   │                                                     │
│   └─────┬─────┘                                                     │
│         │                                                           │
│         │  2. Account aangemaakt (uitgeschakeld)                    │
│         ▼                                                           │
│   ┌───────────┐         3. Welkomstmail                             │
│   │  Entra ID │  ─────────────────────────────▶  📧 Privé inbox     │
│   └───────────┘         (username + link)              │            │
│                                                        │            │
│                                                        ▼            │
│                                                 4. Opent link       │
│                                                        │            │
│                                                        ▼            │
│                                                ┌──────────────┐     │
│                                                │ Verificatie  │     │
│                                                │    Pagina    │     │
│                                                └──────┬───────┘     │
│                                                       │             │
│                                          5. Voert geboortedatum     │
│                                             en 06-nummer in         │
│                                                       │             │
│                                                       ▼             │
│                                          6. ✓ Gegevens kloppen      │
│                                             → OTP via SMS           │
│                                                       │             │
│                                                       ▼             │
│                                          7. Voert OTP code in       │
│                                                       │             │
│                                                       ▼             │
│                                          8. Kiest wachtwoord        │
│                                                       │             │
│                                                       ▼             │
│                                          9. Account geactiveerd     │
│                                             → MFA setup             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Projectstructuur

```
├── api/                          # Azure Functions backend
│   ├── create-user/              # Gebruiker aanmaken + welkomstmail
│   ├── verify-identity/          # Identiteit controleren + OTP sturen
│   ├── verify-otp/               # OTP code valideren
│   ├── set-password/             # Wachtwoord instellen
│   └── shared/                   # Gedeelde utilities
│       ├── graph-client.js       # Microsoft Graph API client
│       ├── otp.js                # OTP generatie/validatie
│       └── sms.js                # SMS verzending
│
├── onboarding/                   # Frontend (GitHub Pages)
│   ├── admin.html                # IT admin formulier
│   ├── verify.html               # Verificatie wizard
│   └── style.css                 # Styling
│
└── CLAUDE.md                     # Project context voor AI assistentie
```

## Vereisten

### Azure Resources

| Resource | Doel |
|----------|------|
| **Microsoft Entra ID** | Gebruikersbeheer |
| **App Registration** | API authenticatie naar Entra |
| **Azure Communication Services** | E-mail en SMS verzending |
| **Azure Functions** | Backend API hosting |

### App Registration Permissions

De App Registration heeft de volgende Microsoft Graph **Application** permissions nodig:

- `User.ReadWrite.All`
- `Directory.ReadWrite.All`

> ⚠️ Vergeet niet om **Admin Consent** te geven na het toewijzen van permissions.

## Installatie

### 1. Clone de repository

```bash
git clone https://github.com/kkofflard/kkofflard.github.io.git
cd kkofflard.github.io
```

### 2. Configureer de backend

```bash
cd api
cp local.settings.json.example local.settings.json
```

Vul de waarden in `local.settings.json` in:

| Variabele | Beschrijving |
|-----------|--------------|
| `TENANT_ID` | Je Entra tenant ID |
| `CLIENT_ID` | App Registration client ID |
| `CLIENT_SECRET` | App Registration client secret |
| `TENANT_DOMAIN` | Domein (bijv. `bedrijf.onmicrosoft.com`) |
| `COMMUNICATION_CONNECTION_STRING` | Azure Communication Services |
| `SENDER_EMAIL` | Afzender e-mailadres |
| `SMS_FROM_NUMBER` | SMS afzendernummer |
| `FRONTEND_URL` | URL van de frontend |
| `OTP_SECRET` | Willekeurige string voor token signing |

### 3. Installeer dependencies

```bash
cd api
npm install
```

### 4. Test lokaal

```bash
func start
```

### 5. Deploy naar Azure

```bash
func azure functionapp publish <jouw-function-app-naam>
```

### 6. Configureer de frontend

Pas de API URL aan in `onboarding/admin.html` en `onboarding/verify.html`:

```javascript
window.APP_CONFIG = {
  API_BASE: 'https://<jouw-function-app>.azurewebsites.net/api'
};
```

## Gebruik

### Voor IT Admins

1. Ga naar `/onboarding/admin.html`
2. Vul de gegevens van de nieuwe medewerker in
3. Klik op "Gebruiker Aanmaken"
4. De medewerker ontvangt een e-mail op het privé-adres

### Voor Nieuwe Medewerkers

1. Open de link in de welkomstmail
2. Voer je geboortedatum en 06-nummer in
3. Voer de SMS-code in die je ontvangt
4. Kies een sterk wachtwoord
5. Voltooi de MFA-setup in Microsoft Office

## Beveiliging

| Maatregel | Beschrijving |
|-----------|--------------|
| **Uitgeschakelde accounts** | Accounts worden pas geactiveerd na volledige verificatie |
| **Token expiratie** | Verificatielinks verlopen na 24 uur |
| **OTP expiratie** | SMS-codes verlopen na 10 minuten |
| **HMAC signing** | Tokens zijn cryptografisch ondertekend |
| **Wachtwoordeisen** | Min. 12 tekens, hoofdletters, kleine letters, cijfers, speciale tekens |

## API Endpoints

| Methode | Endpoint | Beschrijving |
|---------|----------|--------------|
| `POST` | `/api/users/create` | Nieuwe gebruiker aanmaken |
| `POST` | `/api/verify/identity` | Identiteit verifiëren + OTP sturen |
| `POST` | `/api/verify/otp` | OTP code valideren |
| `POST` | `/api/verify/set-password` | Wachtwoord instellen |

## Licentie

MIT
