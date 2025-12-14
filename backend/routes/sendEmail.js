// File: src/routes/sendEmail.js
require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');

const router = express.Router();

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to format currency
const formatCurrency = (amount) => `₹${Number(amount).toFixed(2)}`;

router.post('/send-email', async (req, res) => {
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
    orderId = 'N/A'
  } = req.body;

  // Validation
  if (!email || !fullName || !orderDetails || !Array.isArray(orderDetails.items)) {
    return res.status(400).json({ error: 'Missing required order details.' });
  }

  // Generate items table HTML
  const itemsTableHtml = `
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="border-bottom:1px solid #eee; text-align:left;">Product</th>
          <th style="border-bottom:1px solid #eee; text-align:center;">Weight</th>
          <th style="border-bottom:1px solid #eee; text-align:center;">Qty</th>
          <th style="border-bottom:1px solid #eee; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${orderDetails.items.map(item => {
          const name = item.product?.name || 'N/A';
          const weight = item.weight || 'N/A';
          const quantity = item.quantity || 0;
          const unitPrice = item.product?.pricePerWeight?.[item.weight] || 0;
          const total = unitPrice * quantity;
          return `
            <tr>
              <td>${name}</td>
              <td style="text-align:center;">${weight}g</td>
              <td style="text-align:center;">${quantity}</td>
              <td style="text-align:right;">${formatCurrency(total)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  // Store email HTML
  const storeHtmlContent = `
    <h1>New Order #${orderId}</h1>
    <p>Customer: ${fullName} (${email})</p>
    <p>Payment: ${paymentMethod}</p>
    ${itemsTableHtml}
    <p><strong>Total: ${formatCurrency(orderDetails.finalTotal)}</strong></p>
  `;

  // Customer email HTML
  const customerHtmlContent = `
    <h1>Thank you for your order, ${fullName}!</h1>
    <p>Your order #${orderId} has been received and is being processed.</p>
    ${itemsTableHtml}
    <p><strong>Total: ${formatCurrency(orderDetails.finalTotal)}</strong></p>
    <p>Shipping Address: ${address}, ${city}, ${state} - ${postalCode}</p>
    <p>Phone: ${phoneNumber}</p>
  `;

  try {
    // Send email to store
    await resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: 'tech.adhyaapickles@gmail.com',
      subject: `NEW ORDER #${orderId} from ${fullName}`,
      html: storeHtmlContent,
    });

    // Send confirmation email to customer
    await resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: email,
      subject: `Your Order #${orderId} Confirmation`,
      html: customerHtmlContent,
    });

    res.status(200).json({ message: 'Emails sent successfully.' });
  } catch (err) {
    console.error('Failed to send emails via Resend:', err);
    res.status(500).json({ error: 'Failed to send emails', details: err.message });
  }
});

module.exports = router;
