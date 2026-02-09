# Entra ID User Onboarding

Automatisch onboarding- en verificatiesysteem voor Microsoft Entra ID (Azure AD). Wanneer een nieuwe gebruiker wordt aangemaakt in Entra ID, triggert een Microsoft Graph webhook automatisch de verificatie-flow via e-mail.

## Flow

```
Admin maakt gebruiker aan in Entra ID (accountEnabled: false)
        │
        ▼
Microsoft Graph webhook detecteert nieuwe gebruiker
        │
        ▼
Welkomstmail naar privé-adres (gebruikersnaam + verificatie-URL)
        │
        ▼
Medewerker opent link → voert geboortedatum + 06-nummer in
        │
        ▼
Gegevens worden gecontroleerd tegen Entra ID
        │
        ▼
OTP wordt via SMS naar 06-nummer gestuurd
        │
        ▼
Na OTP-verificatie: wachtwoord aanmaken
        │
        ▼
Account geactiveerd → doorsturen naar MFA-setup
```

## Architectuur

| Laag | Technologie | Locatie |
|------|------------|---------|
| Frontend | Statische HTML/CSS/JS (GitHub Pages) | `/onboarding/` |
| Backend | Azure Functions (Node.js 18) | `/api/` |
| Trigger | Microsoft Graph change notifications | Webhook |
| Identiteit | Microsoft Entra ID | Azure |
| Communicatie | Azure Communication Services | E-mail & SMS |

## Vereisten

- **Microsoft Entra ID** tenant
- **App Registration** met `User.ReadWrite.All` en `Directory.ReadWrite.All` (Application permissions)
- **Azure Communication Services** (e-mail + SMS)
- **Azure Functions** hosting

## Snel starten

### 1. API dependencies installeren

```bash
cd api && npm install
```

### 2. Configuratie

Kopieer `api/local.settings.json.example` naar `api/local.settings.json` en vul de waarden in:

| Variabele | Beschrijving |
|-----------|-------------|
| `TENANT_ID` | Entra tenant ID |
| `CLIENT_ID` | App registration client ID |
| `CLIENT_SECRET` | App registration client secret |
| `COMMUNICATION_CONNECTION_STRING` | Azure Communication Services connection string |
| `SENDER_EMAIL` | Afzender e-mailadres |
| `SMS_FROM_NUMBER` | SMS afzendernummer |
| `FRONTEND_URL` | URL van de frontend (bijv. `https://kkofflard.github.io`) |
| `OTP_SECRET` | Geheim voor HMAC token-signing |
| `NOTIFICATION_URL` | Publieke URL van het webhook-endpoint |
| `WEBHOOK_CLIENT_STATE` | Geheim voor validatie van inkomende webhook-notificaties |

### 3. Deployen

```bash
cd api && func azure functionapp publish <function-app-name>
```

### 4. Webhook abonnement activeren

```bash
curl -X POST "https://<function-app>.azurewebsites.net/api/webhook/manage-subscription?code=<function-key>"
```

Het abonnement verloopt na maximaal 29 dagen. Stel een periodieke verlenging in (bijv. via Azure Logic App).

## Gebruiker aanmaken

Maak een nieuwe gebruiker aan in Entra ID (via portal, PowerShell, of Graph API) met de volgende velden:

| Veld | Verplicht | Beschrijving |
|------|-----------|-------------|
| `accountEnabled` | Ja | Moet `false` zijn (triggert onboarding) |
| `birthday` | Ja | Geboortedatum (voor identiteitsverificatie) |
| `mobilePhone` | Ja | Mobiel nummer (voor SMS OTP) |
| `otherMails` | Ja | Array met privé-emailadres (voor welkomstmail) |
| `displayName` | Ja | Weergavenaam |
| `givenName` | Ja | Voornaam |
| `surname` | Ja | Achternaam |
| `userPrincipalName` | Ja | Gebruikersnaam |

## Projectstructuur

```
api/
├── user-created-webhook/   # Ontvangt Graph change notifications
├── manage-subscription/    # Beheert webhook-abonnement
├── verify-identity/        # Controleert geboortedatum + telefoon, stuurt OTP
├── verify-otp/             # Valideert SMS-code
├── set-password/           # Stelt wachtwoord in, activeert account
└── shared/
    ├── graph-client.js     # Microsoft Graph API client
    ├── otp.js              # OTP generatie & HMAC tokens
    └── sms.js              # Azure Communication Services SMS

onboarding/
├── verify.html             # Multi-stap verificatie frontend
└── style.css               # Microsoft Fluent-geïnspireerde styling
```

## Beveiliging

- Accounts zijn uitgeschakeld tot volledige verificatie
- Webhook-notificaties gevalideerd via `clientState` geheim
- Alleen gebruikers met `accountEnabled=false` + `otherMails` + `birthday` + `mobilePhone` triggeren onboarding
- Verificatielinks verlopen na 24 uur
- OTP-codes verlopen na 10 minuten
- HMAC-signed tokens met timing-safe vergelijking
- Wachtwoordeisen: min. 12 tekens, hoofdletters, kleine letters, cijfers, speciale tekens
