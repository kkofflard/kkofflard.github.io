const { getGraphClient } = require("../shared/graph-client");

module.exports = async function (context, req) {
  try {
    const client = getGraphClient();
    const notificationUrl = process.env.NOTIFICATION_URL;
    const clientState = process.env.WEBHOOK_CLIENT_STATE;

    if (!notificationUrl || !clientState) {
      context.res = {
        status: 400,
        body: {
          error:
            "NOTIFICATION_URL en WEBHOOK_CLIENT_STATE moeten geconfigureerd zijn",
        },
      };
      return;
    }

    // Check for existing subscription
    const subscriptions = await client.api("/subscriptions").get();
    const existing = subscriptions.value.find(
      (s) =>
        s.resource === "/users" &&
        s.changeType === "created" &&
        s.notificationUrl === notificationUrl
    );

    // Max subscription duration for /users is 29 days
    const expirationDateTime = new Date(
      Date.now() + 28 * 24 * 60 * 60 * 1000
    ).toISOString();

    if (existing) {
      // Renew existing subscription
      await client.api(`/subscriptions/${existing.id}`).patch({
        expirationDateTime,
      });

      context.res = {
        status: 200,
        body: {
          success: true,
          action: "renewed",
          subscriptionId: existing.id,
          expirationDateTime,
          message: "Abonnement op gebruikerswijzigingen is verlengd",
        },
      };
    } else {
      // Create new subscription
      const subscription = await client.api("/subscriptions").post({
        changeType: "created",
        notificationUrl,
        resource: "/users",
        expirationDateTime,
        clientState,
      });

      context.res = {
        status: 201,
        body: {
          success: true,
          action: "created",
          subscriptionId: subscription.id,
          expirationDateTime,
          message: "Abonnement op gebruikerswijzigingen is aangemaakt",
        },
      };
    }
  } catch (error) {
    context.log.error("Error managing subscription:", error);
    context.res = {
      status: 500,
      body: {
        error: "Fout bij het beheren van het webhook-abonnement",
        details: error.message,
      },
    };
  }
};
