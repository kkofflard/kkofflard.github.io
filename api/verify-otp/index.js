const { getStoredOtp, clearOtp } = require("../shared/otp");

module.exports = async function (context, req) {
  try {
    const { userId, otpCode } = req.body;

    if (!userId || !otpCode) {
      context.res = {
        status: 400,
        body: { error: "Verplichte velden: userId, otpCode" },
      };
      return;
    }

    const stored = getStoredOtp(userId);

    if (!stored) {
      context.res = {
        status: 404,
        body: { error: "Geen verificatiecode gevonden. Vraag een nieuwe aan." },
      };
      return;
    }

    // Check expiry
    if (Date.now() > stored.expiresAt) {
      clearOtp(userId);
      context.res = {
        status: 410,
        body: {
          error: "De verificatiecode is verlopen. Vraag een nieuwe aan.",
        },
      };
      return;
    }

    // Compare OTP
    if (otpCode !== stored.code) {
      context.res = {
        status: 403,
        body: { error: "Onjuiste verificatiecode" },
      };
      return;
    }

    // OTP is correct - clear it
    clearOtp(userId);

    context.res = {
      status: 200,
      body: {
        success: true,
        userId,
        token: stored.token,
        message: "Verificatiecode correct. Je kunt nu een wachtwoord instellen.",
      },
    };
  } catch (error) {
    context.log.error("Error verifying OTP:", error);
    context.res = {
      status: 500,
      body: {
        error: "Fout bij het verifiëren van de code",
        details: error.message,
      },
    };
  }
};
