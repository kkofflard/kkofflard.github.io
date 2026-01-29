const { getGraphClient } = require("../shared/graph-client");
const { EmailClient } = require("@azure/communication-email");
const { signToken } = require("../shared/otp");

module.exports = async function (context, req) {
  try {
    const {
      displayName,
      firstName,
      lastName,
      privateEmail,
      birthDate,
      mobilePhone,
      department,
      jobTitle,
    } = req.body;

    if (
      !displayName ||
      !firstName ||
      !lastName ||
      !privateEmail ||
      !birthDate ||
      !mobilePhone
    ) {
      context.res = {
        status: 400,
        body: {
          error:
            "Verplichte velden: displayName, firstName, lastName, privateEmail, birthDate, mobilePhone",
        },
      };
      return;
    }

    const client = getGraphClient();

    // Generate a UPN (user principal name)
    const mailNickname = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(
      /\s+/g,
      ""
    );
    const domain = process.env.TENANT_DOMAIN || "yourdomain.onmicrosoft.com";
    const userPrincipalName = `${mailNickname}@${domain}`;

    // Create user in Entra ID with a temporary random password
    // Account is disabled until verification is complete
    const tempPassword =
      "Temp!" +
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 4).toUpperCase() +
      "1!";

    const user = await client.api("/users").post({
      accountEnabled: false,
      displayName,
      givenName: firstName,
      surname: lastName,
      userPrincipalName,
      mailNickname,
      mobilePhone,
      birthday: birthDate,
      department: department || undefined,
      jobTitle: jobTitle || undefined,
      passwordProfile: {
        forceChangePasswordNextSignIn: false,
        password: tempPassword,
      },
      otherMails: [privateEmail],
    });

    // Store birthDate and mobilePhone as extension attributes for verification
    // Using open extensions
    await client
      .api(`/users/${user.id}/extensions`)
      .post({
        "@odata.type": "microsoft.graph.openTypeExtension",
        extensionName: "onboardingVerification",
        birthDate,
        mobilePhone: mobilePhone.replace(/[\s\-()]/g, ""),
        verificationComplete: false,
      });

    // Generate verification token
    const tokenPayload = {
      userId: user.id,
      upn: userPrincipalName,
      createdAt: Date.now(),
    };
    const { data, hmac } = signToken(tokenPayload);
    const token = Buffer.from(JSON.stringify({ data, hmac })).toString(
      "base64url"
    );

    // Build verification URL
    const frontendUrl =
      process.env.FRONTEND_URL || "https://kkofflard.github.io";
    const verificationUrl = `${frontendUrl}/onboarding/verify.html?token=${token}`;

    // Send welcome email to private address
    const emailClient = new EmailClient(
      process.env.COMMUNICATION_CONNECTION_STRING
    );

    const emailMessage = {
      senderAddress: process.env.SENDER_EMAIL,
      content: {
        subject: "Welkom! Activeer je account",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #0078d4;">Welkom bij het team!</h1>
            <p>Beste ${firstName},</p>
            <p>Er is een account voor je aangemaakt. Hieronder vind je je gegevens:</p>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Gebruikersnaam:</strong> ${userPrincipalName}</p>
            </div>
            <p>Om je account te activeren, moet je jezelf eerst verifiëren. Klik op de onderstaande knop om te beginnen:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}"
                 style="background: #0078d4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-size: 16px;">
                Account Activeren
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Deze link is 24 uur geldig. Neem contact op met IT als je problemen ondervindt.
            </p>
          </div>
        `,
        plainText: `Welkom ${firstName}!\n\nJe gebruikersnaam: ${userPrincipalName}\n\nActiveer je account via: ${verificationUrl}\n\nDeze link is 24 uur geldig.`,
      },
      recipients: {
        to: [{ address: privateEmail, displayName: displayName }],
      },
    };

    const poller = await emailClient.beginSend(emailMessage);
    await poller.pollUntilDone();

    context.res = {
      status: 201,
      body: {
        success: true,
        userId: user.id,
        userPrincipalName,
        message: `Gebruiker aangemaakt en verificatie-email verstuurd naar ${privateEmail}`,
      },
    };
  } catch (error) {
    context.log.error("Error creating user:", error);
    context.res = {
      status: 500,
      body: {
        error: "Fout bij het aanmaken van de gebruiker",
        details: error.message,
      },
    };
  }
};
