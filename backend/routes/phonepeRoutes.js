// routes/phonepeRoutes.js
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest,
} = require("pg-sdk-node");

const router = express.Router();

let supabase = null; // injected Supabase instance
let phonepeClient = null;

// Initialize PhonePe client
const getPhonePeClient = () => {
  if (!phonepeClient) {
    const clientId = process.env.PHONEPE_CLIENT_ID;
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
    const clientVersion = parseInt(process.env.PHONEPE_CLIENT_VERSION || "1");
    const env = process.env.PHONEPE_ENV === "PRODUCTION" ? Env.PRODUCTION : Env.SANDBOX;

    if (!clientId || !clientSecret) {
      throw new Error("PhonePe credentials missing in environment variables");
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

// Helper to verify PhonePe signature
const verifyPhonePeSignature = (rawBody, signature, secret) => {
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return hash === signature;
};

// ========================
// INITIATE PAYMENT
// ========================
router.post("/pay", async (req, res) => {
  try {
    const { amount, customer } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: "Invalid or missing amount" });
    }

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const redirectUrl = process.env.REDIRECT_URL;
    const callbackUrl = process.env.CALLBACK_URL;

    if (!redirectUrl || !callbackUrl) {
      return res.status(500).json({ message: "REDIRECT_URL or CALLBACK_URL missing" });
    }

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
      return res.status(500).json({ message: "PhonePe did not return redirect URL" });
    }
  } catch (err) {
    console.error("❌ PhonePe Payment Error:", err);
    return res.status(500).json({ message: "Payment initiation failed", error: err.message });
  }
});

// ========================
// WEBHOOK
// ========================
router.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const rawBody = req.body.toString();
    const signature = req.headers["authorization"]?.split(" ")[1];

    if (!verifyPhonePeSignature(rawBody, signature, process.env.PHONEPE_CLIENT_SECRET)) {
      console.error("❌ Invalid PhonePe signature");
      return res.status(400).send("Invalid signature");
    }

    const callbackData = JSON.parse(rawBody);
    console.log("📩 PhonePe webhook received:", callbackData);

    const payload = callbackData.payload || {};
    const orderId = payload.merchantOrderId;
    const state = payload.state; // SUCCESS / FAILED / CANCELLED

    if (!orderId || !state) return res.status(400).send("Invalid callback");

    // Update Supabase order status
    const { data, error } = await supabase
      .from("orders")
      .update({ order_status: state.toLowerCase(), payment_id: payload.orderId })
      .eq("order_id", orderId)
      .select();

    if (error) console.error("❌ Supabase update error:", error);

    // Send email if payment SUCCESS
    if (state === "SUCCESS" && data?.[0]) {
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
    }

    res.status(200).send("Webhook processed");
  } catch (err) {
    console.error("❌ Error in PhonePe webhook:", err.message);
    res.status(500).send("Webhook processing failed");
  }
});

// ========================
// POLL PAYMENT STATUS
// ========================
router.get("/status/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  const client = getPhonePeClient();

  try {
    const statusRes = await client.checkStatus(orderId);
    const status = statusRes.data?.status;

    console.log("🔍 PhonePe status:", status);

    if (status === "SUCCESS") {
      const { data, error } = await supabase
        .from("orders")
        .update({ payment_id: statusRes.data.transactionId, order_status: "paid" })
        .eq("order_id", orderId)
        .select();

      if (error) return res.status(500).json({ message: "DB update failed", error });

      // Send confirmation email
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

      return res.json({ message: "✅ Payment confirmed", order: data[0] });
    }

    if (status === "FAILED" || status === "CANCELLED") {
      return res.json({ message: `❌ Payment ${status.toLowerCase()}`, status });
    }

    return res.json({ message: "⏳ Payment pending or unknown", status });
  } catch (err) {
    console.error("❌ Error in status check:", err.message);
    return res.status(500).json({ error: "Unable to check payment status" });
  }
});

// Export router with injected Supabase
module.exports = (injectedSupabase) => {
  supabase = injectedSupabase;
  return router;
};
