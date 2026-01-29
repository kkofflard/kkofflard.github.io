# Gebruiker Onboarding & Verificatie Systeem

Systeem voor het aanmaken van nieuwe medewerkers in Microsoft Entra ID met een veilige verificatie-flow.

## Flow

```
Admin maakt gebruiker aan
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
  - `admin.html` – Formulier voor IT-admin om nieuwe gebruiker aan te maken
  - `verify.html` – Multi-stap verificatie voor nieuwe medewerker
  - `style.css` – Gedeelde styling (Microsoft Fluent-geïnspireerd)

- **Backend** (`/api/`): Azure Functions (Node.js)
  - `create-user` – Maakt gebruiker in Entra, verstuurt welkomstmail
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

### Environment Variables

Kopieer `local.settings.json.example` naar `local.settings.json` en vul in:

| Variabele | Beschrijving |
|-----------|-------------|
| `TENANT_ID` | Entra tenant ID |
| `CLIENT_ID` | App registration client ID |
| `CLIENT_SECRET` | App registration client secret |
| `TENANT_DOMAIN` | Tenant domein (bijv. `bedrijf.onmicrosoft.com`) |
| `COMMUNICATION_CONNECTION_STRING` | Azure Communication Services connection string |
| `SENDER_EMAIL` | Afzender e-mailadres |
| `SMS_FROM_NUMBER` | SMS afzendernummer |
| `FRONTEND_URL` | URL van de frontend (bijv. `https://kkofflard.github.io`) |
| `OTP_SECRET` | Geheim voor HMAC token-signing |

## Deployment

### Backend (Azure Functions)

```bash
cd api
npm install
func azure functionapp publish <your-function-app-name>
```

### Frontend (GitHub Pages)

De frontend wordt automatisch gehost via GitHub Pages. Pas de `API_BASE` variabele aan in de HTML-bestanden naar de URL van je Azure Functions app:

```javascript
// In admin.html en verify.html:
window.APP_CONFIG = { API_BASE: 'https://<your-function-app>.azurewebsites.net/api' };
```

## Beveiliging

- Accounts worden **uitgeschakeld** aangemaakt en pas geactiveerd na volledige verificatie
- Verificatielinks verlopen na **24 uur**
- OTP-codes verlopen na **10 minuten**
- HMAC-signed tokens voorkomen manipulatie
- Wachtwoorden moeten minimaal 12 tekens bevatten met hoofdletters, kleine letters, cijfers en speciale tekens
- Timing-safe vergelijking van tokens ter bescherming tegen timing-aanvallen
