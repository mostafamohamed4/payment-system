const express = require("express");
const connectDB = require("./config/db");
require("./workers/payment.worker");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Payment System Running");
});
connectDB();
const registerRoutes = require("./routes");

registerRoutes(app);
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
