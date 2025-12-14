const express = require("express");
const { Resend } = require("resend");

const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/", async (req, res) => {
  try {
    const { email, fullName, orderId, orderDetails, paymentMethod } = req.body;

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Order Confirmed - ${orderId}`,
      html: `
        <h2>Thank you ${fullName}!</h2>
        <p>Your order <b>${orderId}</b> was placed successfully.</p>
        <p><b>Payment:</b> ${paymentMethod.toUpperCase()}</p>
        <p><b>Total:</b> ₹${orderDetails.finalTotal}</p>
        <p>We will deliver your order soon.</p>
      `,
    });

    res.json({ message: "Email sent" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ message: "Email failed" });
  }
});

module.exports = router;
