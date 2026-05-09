const fakeGateway = async () => {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const random = Math.random();

  if (random < 0.6) {
    return {
      success: true,
      transactionId: "TXN_" + Date.now(),
    };
  }

  if (random < 0.8) {
    return {
      success: false,
    };
  }

  throw new Error("Gateway timeout");
};

module.exports = fakeGateway;
