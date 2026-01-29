const crypto = require("crypto");

const OTP_EXPIRY_MINUTES = 10;

/**
 * Generates a 6-digit OTP and a signed token containing the OTP + expiry.
 * The token is stored server-side (in-memory or table storage) keyed by userId.
 */
function generateOtp() {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
  return { code, expiresAt };
}

/**
 * Creates an HMAC signature for a verification token.
 */
function signToken(payload) {
  const secret = process.env.OTP_SECRET;
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return { data, hmac };
}

/**
 * Verifies an HMAC-signed token.
 */
function verifyToken(data, hmac) {
  const secret = process.env.OTP_SECRET;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}

// Simple in-memory OTP store (use Azure Table Storage in production)
const otpStore = new Map();

function storeOtp(userId, otpData) {
  otpStore.set(userId, otpData);
}

function getStoredOtp(userId) {
  return otpStore.get(userId);
}

function clearOtp(userId) {
  otpStore.delete(userId);
}

module.exports = {
  generateOtp,
  signToken,
  verifyToken,
  storeOtp,
  getStoredOtp,
  clearOtp,
};
