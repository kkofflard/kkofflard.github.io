const { getGraphClient } = require("../shared/graph-client");
const { EmailClient } = require("@azure/communication-email");
const { signToken } = require("../shared/otp");

module.exports = async function (context, req) {
  // Handle subscription validation
  const validationToken = req.query.validationToken;
  if (validationToken) {
    context.log("Subscription validation request received");
    context.res = {
      status: 200,
      headers: { "Content-Type": "text/plain" },
      body: validationToken,
    };
    return;
  }

  // Process change notifications
  try {
    const notifications = req.body?.value;
    if (!notifications || !Array.isArray(notifications)) {
      context.res = { status: 202 };
      return;
    }

    const expectedClientState = process.env.WEBHOOK_CLIENT_STATE;

    for (const notification of notifications) {
      if (notification.clientState !== expectedClientState) {
        context.log.warn("Invalid clientState received, skipping notification");
        continue;
      }

      if (notification.changeType !== "created") {
        continue;
      }

      const userId = notification.resourceData?.id;
      if (!userId) continue;

      try {
        await processNewUser(context, userId);
      } catch (err) {
        context.log.error(`Error processing user ${userId}:`, err);
      }
    }

    // Must respond with 202 within 3 seconds
    context.res = { status: 202 };
  } catch (error) {
    context.log.error("Error processing webhook:", error);
    context.res = { status: 202 };
  }
};

async function processNewUser(context, userId) {
  const client = getGraphClient();

  // Get user details from Entra ID
  const user = await client
    .api(`/users/${userId}`)
    .select(
      "id,displayName,givenName,surname,userPrincipalName,accountEnabled,birthday,mobilePhone,otherMails"
    )
    .get();

  // Only process disabled accounts (onboarding candidates)
  if (user.accountEnabled) {
    context.log(`User ${userId} is enabled, skipping onboarding`);
    return;
  }

  // Require private email in otherMails
  const privateEmail = user.otherMails?.[0];
  if (!privateEmail) {
    context.log(`User ${userId} has no otherMails set, skipping onboarding`);
    return;
  }

  // Require birthday and mobilePhone for verification
  if (!user.birthday || !user.mobilePhone) {
    context.log(
      `User ${userId} missing birthday or mobilePhone, skipping onboarding`
    );
    return;
  }

  // Create extension for verification tracking
  try {
    await client.api(`/users/${userId}/extensions`).post({
      "@odata.type": "microsoft.graph.openTypeExtension",
      extensionName: "onboardingVerification",
      verificationComplete: false,
    });
  } catch (extError) {
    if (extError.statusCode === 409) {
      context.log(`Extension already exists for user ${userId}, skipping`);
      return;
    }
    throw extError;
  }

  // Generate verification token
  const tokenPayload = {
    userId: user.id,
    upn: user.userPrincipalName,
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

  const firstName = user.givenName || user.displayName;

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
            <p><strong>Gebruikersnaam:</strong> ${user.userPrincipalName}</p>
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
      plainText: `Welkom ${firstName}!\n\nJe gebruikersnaam: ${user.userPrincipalName}\n\nActiveer je account via: ${verificationUrl}\n\nDeze link is 24 uur geldig.`,
    },
    recipients: {
      to: [{ address: privateEmail, displayName: user.displayName }],
    },
  };

  const poller = await emailClient.beginSend(emailMessage);
  await poller.pollUntilDone();

  context.log(
    `Welcome email sent to ${privateEmail} for user ${user.userPrincipalName}`
  );
}
