// File: src/routes/sendEmail.js
require("dotenv").config();
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// Check environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("ERROR: EMAIL_USER or EMAIL_PASS environment variables are not set in .env.");
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App password for Gmail
  },
});

// Helper function to format currency
const formatCurrency = (amount) => `₹${Number(amount).toFixed(2)}`;

router.post("/send-email", async (req, res) => {
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
    orderId = "N/A",
  } = req.body;

  // Basic validation
  if (!email || !fullName || !orderDetails || !Array.isArray(orderDetails.items)) {
    return res.status(400).json({ error: "Missing required order details." });
  }

  // Generate items table HTML
  const itemsTableHtml = `
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="background:#f8f8f8;">
          <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Product</th>
          <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">Weight</th>
          <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">Qty</th>
          <th style="padding:8px; border-bottom:1px solid #eee; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${orderDetails.items.map(item => {
          const name = item.product?.name || "N/A";
          const weight = item.weight || "N/A";
          const quantity = item.quantity || 0;
          const unitPrice = item.product?.pricePerWeight?.[item.weight] || 0;
          const total = unitPrice * quantity;
          return `
            <tr>
              <td style="padding:8px; text-align:left;">${name}</td>
              <td style="padding:8px; text-align:center;">${weight}g</td>
              <td style="padding:8px; text-align:center;">${quantity}</td>
              <td style="padding:8px; text-align:right;">${formatCurrency(total)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  // Store email HTML
  const storeHtmlContent = `
    <div style="font-family:Arial,sans-serif; color:#333; max-width:650px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:8px; background:#fff;">
      <h1 style="color:#d35400; text-align:center;">New Order #${orderId}</h1>
      <p style="text-align:center;">Customer: ${fullName} (${email})</p>
      <p><strong>Payment:</strong> ${paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</p>
      <h3>Customer Info:</h3>
      <p>
        <strong>Phone:</strong> ${phoneNumber}<br/>
        <strong>Address:</strong> ${address}, ${city}, ${state}, ${postalCode}
      </p>
      <h3>Items Ordered:</h3>
      ${itemsTableHtml}
      <h3>Total: ${formatCurrency(orderDetails.finalTotal)}</h3>
      <p style="text-align:center; font-size:12px; color:#777;">Automated notification. Do not reply.</p>
    </div>
  `;

  // Customer email HTML
  const customerHtmlContent = `
    <div style="font-family:Arial,sans-serif; color:#333; max-width:600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:8px; background:#fff8e1;">
      <h1 style="color:#d35400; text-align:center;">Thank you for your order, ${fullName}!</h1>
      <p style="text-align:center;">Your order #${orderId} has been received and is being processed.</p>
      <h3>Order Summary:</h3>
      ${itemsTableHtml}
      <p style="text-align:right; font-size:16px;"><strong>Total: ${formatCurrency(orderDetails.finalTotal)}</strong></p>
      <h3>Shipping Address:</h3>
      <p>
        ${fullName}<br/>
        ${address}<br/>
        ${city}, ${state} - ${postalCode}<br/>
        Ph: ${phoneNumber}
      </p>
      <p style="margin-top:15px;"><strong>Payment Method:</strong> ${paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</p>
      <p style="text-align:center; font-size:14px; color:#555;">Questions? Contact us at ${process.env.CUSTOMER_SERVICE_PHONE || "+91 7995059659"}.</p>
      <p style="text-align:center; font-size:12px; color:#777;">ADHYAA PICKLES Team</p>
    </div>
  `;

  try {
    // Send email to store
    await transporter.sendMail({
      from: `"ADHYAA PICKLES" <${process.env.EMAIL_USER}>`,
      to: "tech.adhyaapickles@gmail.com",
      subject: `New Order #${orderId} from ${fullName}`,
      html: storeHtmlContent,
    });

    // Send email to customer
    await transporter.sendMail({
      from: `"ADHYAA PICKLES" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Order #${orderId} Confirmation`,
      html: customerHtmlContent,
    });

    res.status(200).json({ message: "Emails sent successfully." });
  } catch (error) {
    console.error("Failed to send emails:", error);
    res.status(500).json({ error: "Failed to send emails", details: error.message });
  }
});

module.exports = router;
