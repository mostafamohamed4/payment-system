const paymentRoutes = require("./payment.routes");
const webhookRoutes = require("./webhook.routes");
module.exports = (app) => {
  app.use("/payments", paymentRoutes);
  app.use("/webhooks", webhookRoutes);
};
