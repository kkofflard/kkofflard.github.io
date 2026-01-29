const { SmsClient } = require("@azure/communication-sms");

async function sendSms(phoneNumber, message) {
  const connectionString = process.env.COMMUNICATION_CONNECTION_STRING;
  const client = new SmsClient(connectionString);

  // Ensure phone number is in E.164 format
  const formattedNumber = formatDutchPhone(phoneNumber);

  const result = await client.send({
    from: process.env.SMS_FROM_NUMBER || "+31000000000",
    to: [formattedNumber],
    message,
  });

  return result;
}

/**
 * Convert Dutch 06-number to E.164 format (+316xxxxxxxx)
 */
function formatDutchPhone(phone) {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+31")) return cleaned;
  if (cleaned.startsWith("0031")) return "+" + cleaned.slice(2);
  if (cleaned.startsWith("06")) return "+316" + cleaned.slice(2);
  if (cleaned.startsWith("6")) return "+316" + cleaned.slice(1);
  return cleaned;
}

module.exports = { sendSms, formatDutchPhone };
