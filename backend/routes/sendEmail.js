require("dotenv").config();
const express = require("express");
const { Resend } = require("resend");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/send-email", async (req, res) => {
  console.log("\nDEBUG: Received POST request to /api/send-email");

  try {
    const {
      email,
      fullName,
      address,
      city,
      state,
      postalCode,
      phoneNumber,
      paymentMethod,
      orderDetails,
      orderId = "N/A"
    } = req.body;

    if (!email || !fullName || !orderDetails?.items) {
      return res.status(400).json({ error: "Missing required email fields" });
    }

    const formatCurrency = (amt) => `₹${Number(amt).toFixed(2)}`;

    const itemsHtml = orderDetails.items.map(item => {
      const price = item.product?.pricePerWeight?.[item.weight] || 0;
      return `
        <tr>
          <td>${item.product?.name}</td>
          <td>${item.weight}g</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(price * item.quantity)}</td>
        </tr>
      `;
    }).join("");

    const html = `
      <h2>Order Confirmation - ${orderId}</h2>
      <p>Hi ${fullName},</p>
      <p>Thank you for your order at <strong>ADHYAA PICKLES</strong>.</p>

      <table border="1" cellpadding="8" cellspacing="0">
        <tr>
          <th>Product</th><th>Weight</th><th>Qty</th><th>Total</th>
        </tr>
        ${itemsHtml}
      </table>

      <p><strong>Total:</strong> ${formatCurrency(orderDetails.finalTotal)}</p>
      <p><strong>Payment:</strong> ${paymentMethod.toUpperCase()}</p>

      <p>Shipping Address:<br/>
      ${address}, ${city}, ${state} - ${postalCode}<br/>
      ${phoneNumber}</p>

      <p>— ADHYAA PICKLES</p>
    `;

    // 🔥 SEND EMAIL (API – NO SMTP)
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: [email, "tech.adhyaapickles@gmail.com"],
      subject: `Order Confirmation #${orderId}`,
      html
    });

    console.log("Email sent successfully via Resend");
    return res.status(200).json({ message: "Email sent" });

  } catch (err) {
    console.error("Resend email error:", err);
    return res.status(500).json({ error: "Email failed" });
  }
});

module.exports = router;
