# Gebruiker Onboarding & Verificatie Systeem

Systeem voor het onboarden van nieuwe medewerkers in Microsoft Entra ID met een veilige verificatie-flow. Het aanmaken van een gebruiker in Entra ID triggert automatisch de onboarding via een Microsoft Graph webhook.

## Flow

```
Admin maakt gebruiker aan in Entra ID (accountEnabled: false)
        │
        ▼
Microsoft Graph webhook detecteert nieuwe gebruiker
        │
        ▼
E-mail naar privé-adres (username + verificatie-URL)
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
Doorsturen naar Microsoft Office MFA-setup
```

## Architectuur

- **Frontend** (`/onboarding/`): Statische HTML/CSS/JS pagina's (GitHub Pages)
  - `verify.html` – Multi-stap verificatie voor nieuwe medewerker
  - `style.css` – Gedeelde styling (Microsoft Fluent-geïnspireerd)

- **Backend** (`/api/`): Azure Functions (Node.js)
  - `user-created-webhook` – Ontvangt Graph change notifications, verstuurt welkomstmail
  - `manage-subscription` – Beheert het Microsoft Graph webhook-abonnement
  - `verify-identity` – Controleert geboortedatum + telefoonnummer, stuurt OTP
  - `verify-otp` – Valideert de SMS-code
  - `set-password` – Stelt wachtwoord in en activeert account

## Vereisten

### Azure Resources
1. **Microsoft Entra ID (Azure AD)** tenant
2. **App Registration** met de volgende API permissions:
   - `User.ReadWrite.All` (Application)
   - `Directory.ReadWrite.All` (Application)
3. **Azure Communication Services** voor e-mail en SMS
4. **Azure Functions** voor de API hosting

### App Registration Setup

1. Ga naar Azure Portal → Microsoft Entra ID → App registrations
2. Maak een nieuwe registratie aan
3. Voeg een Client Secret toe
4. Wijs de volgende API permissions toe (Application type):
   - Microsoft Graph: `User.ReadWrite.All`
   - Microsoft Graph: `Directory.ReadWrite.All`
5. Geef Admin Consent

### Gebruiker aanmaken in Entra ID

Bij het aanmaken van een nieuwe medewerker in Entra ID moeten de volgende velden worden ingevuld:

| Veld | Beschrijving |
|------|-------------|
| `accountEnabled` | **false** (verplicht – triggert de onboarding) |
| `birthday` | Geboortedatum medewerker (verplicht – voor identiteitsverificatie) |
| `mobilePhone` | Mobiel nummer medewerker (verplicht – voor SMS OTP) |
| `otherMails` | Array met privé-emailadres (verplicht – welkomstmail wordt hier naartoe gestuurd) |
| `displayName` | Weergavenaam |
| `givenName` | Voornaam |
| `surname` | Achternaam |
| `userPrincipalName` | Gebruikersnaam (bijv. `jan.devries@bedrijf.onmicrosoft.com`) |

### Environment Variables

Kopieer `local.settings.json.example` naar `local.settings.json` en vul in:

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

## Deployment

### Backend (Azure Functions)

```bash
cd api
npm install
func azure functionapp publish <your-function-app-name>
```

### Webhook abonnement aanmaken

Na deployment moet het Graph webhook-abonnement worden aangemaakt:

```bash
curl -X POST "https://<function-app>.azurewebsites.net/api/webhook/manage-subscription?code=<function-key>"
```

Het abonnement verloopt na maximaal 29 dagen. Stel een periodieke verlenging in (bijv. via Azure Logic App).

### Frontend (GitHub Pages)

De frontend wordt automatisch gehost via GitHub Pages. Pas de `API_BASE` variabele aan in verify.html naar de URL van je Azure Functions app:

```javascript
// In verify.html:
window.APP_CONFIG = { API_BASE: 'https://<your-function-app>.azurewebsites.net/api' };
```

## Beveiliging

- Accounts worden **uitgeschakeld** aangemaakt en pas geactiveerd na volledige verificatie
- Webhook-notificaties gevalideerd via clientState geheim
- Alleen gebruikers met `accountEnabled=false` én `otherMails`, `birthday` en `mobilePhone` triggeren onboarding
- Verificatielinks verlopen na **24 uur**
- OTP-codes verlopen na **10 minuten**
- HMAC-signed tokens voorkomen manipulatie
- Wachtwoorden moeten minimaal 12 tekens bevatten met hoofdletters, kleine letters, cijfers en speciale tekens
- Timing-safe vergelijking van tokens ter bescherming tegen timing-aanvallen
