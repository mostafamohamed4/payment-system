const fakeGateway = async () => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gateway timeout")), 3000),
  );

  const process = new Promise((resolve, reject) => {
    setTimeout(() => {
      const random = Math.random();
      if (random < 0.6) {
        resolve({ success: true, transactionId: "TXN_" + Date.now() });
      } else if (random < 0.8) {
        resolve({ success: false });
      } else {
        reject(new Error("Gateway timeout"));
      }
    }, 2000);
  });

  return Promise.race([process, timeout]);
};

module.exports = fakeGateway;
