const express = require("express");
const crypto = require("crypto");

const router = express.Router();
let supabase = null;

// Helper to verify PhonePe signature (optional but recommended)
const verifyPhonePeSignature = (rawBody, signature, secret) => {
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return hash === signature;
};

// Webhook
router.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const rawBody = req.body.toString();
    const signature = req.headers["authorization"]?.split(" ")[1]; // PhonePe sends like "Bearer <sig>"

    // Optional: verify signature
    if (!verifyPhonePeSignature(rawBody, signature, process.env.PHONEPE_CLIENT_SECRET)) {
      console.error("❌ Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    const callbackData = JSON.parse(rawBody);
    console.log("📩 Received PhonePe callback", callbackData);

    const payload = callbackData.payload || {};
    const orderId = payload.merchantOrderId;
    const state = payload.state; // SUCCESS / FAILED / CANCELLED

    if (!orderId || !state) {
      return res.status(400).send("Invalid Callback");
    }

    // Update Supabase order
    await supabase
      .from("orders")
      .update({ order_status: state.toLowerCase(), payment_id: payload.orderId })
      .eq("order_id", orderId);

    // Optional: send email if SUCCESS
    if (state === "SUCCESS") {
      const { data } = await supabase.from("orders").select("*").eq("order_id", orderId);
      if (data && data[0]) {
        await axios.post(`${process.env.BACKEND_URL}/api/send-email`, {
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
    }

    return res.status(200).send("Webhook processed");
  } catch (err) {
    console.error("❌ Error in PhonePe callback handler:", err.message);
    return res.status(500).send("Callback processing failed");
  }
});

module.exports = (injectedSupabase) => {
  supabase = injectedSupabase;
  return router;
};
