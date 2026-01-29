const { getGraphClient } = require("../shared/graph-client");
const { verifyToken } = require("../shared/otp");

module.exports = async function (context, req) {
  try {
    const { userId, token, password } = req.body;

    if (!userId || !token || !password) {
      context.res = {
        status: 400,
        body: { error: "Verplichte velden: userId, token, password" },
      };
      return;
    }

    // Verify token is still valid
    let tokenPayload;
    try {
      const decoded = JSON.parse(
        Buffer.from(token, "base64url").toString("utf-8")
      );
      if (!verifyToken(decoded.data, decoded.hmac)) {
        context.res = {
          status: 401,
          body: { error: "Ongeldige token" },
        };
        return;
      }
      tokenPayload = JSON.parse(decoded.data);
    } catch {
      context.res = {
        status: 401,
        body: { error: "Ongeldige token" },
      };
      return;
    }

    if (tokenPayload.userId !== userId) {
      context.res = {
        status: 403,
        body: { error: "Token komt niet overeen met gebruiker" },
      };
      return;
    }

    // Validate password complexity
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      context.res = {
        status: 400,
        body: {
          error: "Wachtwoord voldoet niet aan de eisen",
          details: passwordErrors,
        },
      };
      return;
    }

    const client = getGraphClient();

    // Set the password and enable the account
    await client.api(`/users/${userId}`).patch({
      accountEnabled: true,
      passwordProfile: {
        forceChangePasswordNextSignIn: false,
        password,
      },
    });

    // Mark verification as complete
    try {
      const extensions = await client
        .api(`/users/${userId}/extensions`)
        .get();
      const ext = extensions.value.find(
        (e) => e.extensionName === "onboardingVerification"
      );
      if (ext) {
        await client
          .api(`/users/${userId}/extensions/${ext.id}`)
          .patch({ verificationComplete: true });
      }
    } catch (extError) {
      context.log.warn("Could not update extension:", extError.message);
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        userPrincipalName: tokenPayload.upn,
        message:
          "Wachtwoord ingesteld en account geactiveerd. Je wordt doorgeleid naar MFA-setup.",
        mfaSetupUrl: "https://mysignins.microsoft.com/security-info",
      },
    };
  } catch (error) {
    context.log.error("Error setting password:", error);
    context.res = {
      status: 500,
      body: {
        error: "Fout bij het instellen van het wachtwoord",
        details: error.message,
      },
    };
  }
};

function validatePassword(password) {
  const errors = [];
  if (password.length < 12) {
    errors.push("Minimaal 12 tekens");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Minimaal 1 hoofdletter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Minimaal 1 kleine letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Minimaal 1 cijfer");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Minimaal 1 speciaal teken");
  }
  return errors;
}
