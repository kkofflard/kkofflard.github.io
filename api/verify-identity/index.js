const { getGraphClient } = require("../shared/graph-client");
const { verifyToken, generateOtp, storeOtp } = require("../shared/otp");
const { sendSms } = require("../shared/sms");

module.exports = async function (context, req) {
  try {
    const { token, birthDate, mobilePhone } = req.body;

    if (!token || !birthDate || !mobilePhone) {
      context.res = {
        status: 400,
        body: {
          error: "Verplichte velden: token, birthDate, mobilePhone",
        },
      };
      return;
    }

    // Decode and verify the token
    let tokenPayload;
    try {
      const decoded = JSON.parse(
        Buffer.from(token, "base64url").toString("utf-8")
      );
      if (!verifyToken(decoded.data, decoded.hmac)) {
        context.res = {
          status: 401,
          body: { error: "Ongeldige verificatielink" },
        };
        return;
      }
      tokenPayload = JSON.parse(decoded.data);
    } catch {
      context.res = {
        status: 401,
        body: { error: "Ongeldige verificatielink" },
      };
      return;
    }

    // Check token expiry (24 hours)
    const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - tokenPayload.createdAt > TOKEN_EXPIRY_MS) {
      context.res = {
        status: 410,
        body: { error: "Deze verificatielink is verlopen" },
      };
      return;
    }

    const client = getGraphClient();
    const userId = tokenPayload.userId;

    // Get user data and verification extension from Entra
    let user;
    try {
      user = await client
        .api(`/users/${userId}`)
        .select("id,birthday,mobilePhone")
        .get();
    } catch {
      context.res = {
        status: 404,
        body: { error: "Gebruiker niet gevonden" },
      };
      return;
    }

    // Check if already verified via extension
    try {
      const extensions = await client
        .api(`/users/${userId}/extensions`)
        .get();
      const extension = extensions.value.find(
        (e) => e.extensionName === "onboardingVerification"
      );
      if (extension?.verificationComplete) {
        context.res = {
          status: 409,
          body: { error: "Account is al geverifieerd" },
        };
        return;
      }
    } catch {
      // Extension not found is acceptable, continue with verification
    }

    if (!user.birthday || !user.mobilePhone) {
      context.res = {
        status: 404,
        body: { error: "Verificatiegegevens niet gevonden" },
      };
      return;
    }

    // Normalize and compare birth date
    const inputBirthDate = new Date(birthDate).toISOString().split("T")[0];
    const storedBirthDate = new Date(user.birthday)
      .toISOString()
      .split("T")[0];

    if (inputBirthDate !== storedBirthDate) {
      context.res = {
        status: 403,
        body: { error: "Geboortedatum komt niet overeen" },
      };
      return;
    }

    // Normalize and compare mobile phone
    const normalizePhone = (p) => p.replace(/[\s\-()]/g, "");
    const inputPhone = normalizePhone(mobilePhone);
    const storedPhone = normalizePhone(user.mobilePhone);

    // Compare last 8 digits to handle format differences
    if (inputPhone.slice(-8) !== storedPhone.slice(-8)) {
      context.res = {
        status: 403,
        body: { error: "Telefoonnummer komt niet overeen" },
      };
      return;
    }

    // Identity verified - generate and send OTP
    const otp = generateOtp();
    storeOtp(userId, { ...otp, token });

    await sendSms(
      mobilePhone,
      `Je verificatiecode is: ${otp.code}. Deze code is 10 minuten geldig.`
    );

    context.res = {
      status: 200,
      body: {
        success: true,
        userId,
        message: "Identiteit geverifieerd. Een SMS-code is verstuurd naar je telefoon.",
      },
    };
  } catch (error) {
    context.log.error("Error verifying identity:", error);
    context.res = {
      status: 500,
      body: {
        error: "Fout bij het verifiëren van je identiteit",
        details: error.message,
      },
    };
  }
};
