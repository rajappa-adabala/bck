const express = require("express");
const axios = require("axios");
const {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest,
} = require("pg-sdk-node");

const router = express.Router();
let supabase = null; // will be injected
let phonepeClient = null;

// Initialize PhonePe client
const getPhonePeClient = () => {
  if (!phonepeClient) {
    const clientId = process.env.PHONEPE_CLIENT_ID;
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
    const clientVersion = parseInt(process.env.PHONEPE_CLIENT_VERSION || "1");
    const env = process.env.PHONEPE_ENV === "PRODUCTION" ? Env.PRODUCTION : Env.SANDBOX;

    if (!clientId || !clientSecret) {
      throw new Error("PhonePe credentials are missing from environment variables.");
    }

    phonepeClient = StandardCheckoutClient.getInstance(
      clientId,
      clientSecret,
      clientVersion,
      env
    );

    console.log("✅ PhonePe client initialized");
  }

  return phonepeClient;
};

// Initiate Payment
router.post("/", async (req, res) => {
  try {
    const { amount, customer } = req.body;
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: "Invalid or missing amount" });
    }

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const redirectUrl = process.env.REDIRECT_URL;
    const callbackUrl = process.env.CALLBACK_URL;

    const payRequest = StandardCheckoutPayRequest.builder()
      .merchantOrderId(orderId)
      .amount(amount)
      .redirectUrl(redirectUrl)
      .build({ callbackUrl });

    const client = getPhonePeClient();
    const response = await client.pay(payRequest);

    if (response?.redirectUrl) {
      return res.status(200).json({ paymentUrl: response.redirectUrl, orderId });
    } else {
      return res.status(500).json({ message: "No payment redirect URL from PhonePe" });
    }
  } catch (err) {
    console.error("❌ PhonePe Payment Error:", err);
    return res.status(500).json({ message: "Payment initiation failed", error: err.message });
  }
});

// Webhook Endpoint (PhonePe will call this after transaction)
router.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const { merchantTransactionId, transactionStatus, transactionId } = payload;

    console.log("📬 PhonePe Webhook Payload:", payload);

    // Only mark order paid if SUCCESS
    if (transactionStatus === "SUCCESS") {
      const { data, error } = await supabase
        .from("orders")
        .update({ payment_id: transactionId, order_status: "paid" })
        .eq("order_id", merchantTransactionId)
        .select();

      if (error) {
        console.error("❌ DB Update Failed:", error);
        return res.status(500).send({ status: "ERROR", message: "DB update failed" });
      }

      // Send confirmation email to customer
      const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
      await axios.post(`${backendBaseUrl}/api/send-email`, {
        ...data[0].customer_info,
        paymentMethod: data[0].payment_method,
        orderDetails: {
          items: data[0].ordered_items,
          subtotal: data[0].subtotal,
          discountAmount: data[0].discount_amount,
          taxes: data[0].taxes,
          shippingCost: data[0].shipping_cost,
          additionalFees: data[0].additional_fees,
          finalTotal: data[0].total_amount,
        },
        orderId: data[0].order_id,
      });

      return res.status(200).send({ status: "OK" });
    }

    // Mark failed or cancelled transactions
    if (transactionStatus === "FAILED" || transactionStatus === "CANCELLED") {
      await supabase
        .from("orders")
        .update({ order_status: transactionStatus.toLowerCase() })
        .eq("order_id", merchantTransactionId);

      return res.status(200).send({ status: "OK", message: `Payment ${transactionStatus}` });
    }

    res.status(200).send({ status: "OK", message: "Pending/unknown status" });
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.status(500).send({ status: "ERROR", message: err.message });
  }
});

// Poll Payment Status (optional)
router.get("/status/:orderId", async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const client = getPhonePeClient();
    const statusRes = await client.checkStatus(orderId);
    const status = statusRes.data?.status;

    console.log("🔍 PhonePe Status:", status);

    if (status === "SUCCESS") {
      return res.json({ message: "✅ Payment confirmed", status });
    }

    if (status === "FAILED" || status === "CANCELLED") {
      return res.json({ message: `❌ Payment ${status.toLowerCase()}`, status });
    }

    return res.json({ message: "⏳ Payment pending or unknown", status });
  } catch (err) {
    console.error("❌ Status Check Error:", err.message);
    res.status(500).json({ error: "Unable to check payment status" });
  }
});

// Export router
module.exports = (injectedSupabase) => {
  supabase = injectedSupabase;
  return router;
};
