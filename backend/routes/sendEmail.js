require('dotenv').config();
const express = require('express');
const { Resend } = require('resend');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

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

  if (!email || !fullName || !orderDetails || !Array.isArray(orderDetails.items)) {
    return res.status(400).json({ error: 'Missing required order details.' });
  }

  // Build items table
  const itemsTableHtml = `
    <table style="width:100%; border-collapse:collapse; margin-top:15px;">
      <thead>
        <tr style="background:#f8f8f8;">
          <th style="padding:10px; border-bottom:1px solid #ddd; text-align:left;">Product</th>
          <th style="padding:10px; border-bottom:1px solid #ddd; text-align:center;">Weight</th>
          <th style="padding:10px; border-bottom:1px solid #ddd; text-align:center;">Qty</th>
          <th style="padding:10px; border-bottom:1px solid #ddd; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${orderDetails.items.map(item => {
          const name = item.product?.name || 'N/A';
          const weight = item.weight || 'N/A';
          const qty = item.quantity || 0;
          const price = item.product?.pricePerWeight?.[item.weight] || 0;
          const total = price * qty;
          return `<tr>
                    <td style="padding:10px;">${name}</td>
                    <td style="padding:10px; text-align:center;">${weight}g</td>
                    <td style="padding:10px; text-align:center;">${qty}</td>
                    <td style="padding:10px; text-align:right;">${formatCurrency(total)}</td>
                  </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Build costs summary
  const costsTableHtml = `
    <table style="width:100%; margin-top:15px; font-size:16px;">
      <tr>
        <td>Subtotal:</td>
        <td style="text-align:right;">${formatCurrency(orderDetails.subtotal || 0)}</td>
      </tr>
      ${orderDetails.discountAmount > 0 ? `<tr>
        <td style="color:#28a745;">Discount:</td>
        <td style="text-align:right; color:#28a745;">-${formatCurrency(orderDetails.discountAmount)}</td>
      </tr>` : ''}
      <tr>
        <td>Shipping:</td>
        <td style="text-align:right;">${formatCurrency(orderDetails.shippingCost || 0)}</td>
      </tr>
      <tr>
        <td>Taxes:</td>
        <td style="text-align:right;">${formatCurrency(orderDetails.taxes || 0)}</td>
      </tr>
      ${orderDetails.additionalFees > 0 ? `<tr>
        <td>Additional Fees:</td>
        <td style="text-align:right;">${formatCurrency(orderDetails.additionalFees)}</td>
      </tr>` : ''}
      <tr style="border-top:2px solid #d35400; font-weight:bold;">
        <td>Total:</td>
        <td style="text-align:right; color:#d35400;">${formatCurrency(orderDetails.finalTotal)}</td>
      </tr>
    </table>
  `;

  // Common HTML template
  const emailHtml = `
    <div style="font-family:Arial,sans-serif; max-width:650px; margin:auto; padding:20px; background:#fdf6e3; border-radius:10px;">
      <div style="text-align:center; border-bottom:2px solid #d35400; padding-bottom:15px;">
        <h1 style="color:#d35400; font-size:28px; margin:0;">ADHYAA PICKLES</h1>
        <p>Order #${orderId}</p>
      </div>
      <div style="background:#fff; padding:15px; border-radius:8px; margin-top:20px;">
        <h2 style="color:#d35400;">Hello ${fullName},</h2>
        <p>Your order has been received and is being processed:</p>
        ${itemsTableHtml}
        ${costsTableHtml}
      </div>
      <div style="background:#fff; padding:15px; border-radius:8px; margin-top:15px;">
        <h3 style="color:#d35400;">Shipping Address</h3>
        <p>${fullName}<br/>${address}, ${city}, ${state} - ${postalCode}<br/>Phone: ${phoneNumber}</p>
        <p><strong>Payment Method:</strong> ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
      </div>
      <p style="text-align:center; margin-top:20px; font-size:12px; color:#777;">
        This is an automated email. Please do not reply.
      </p>
    </div>
  `;

  try {
    // Send emails **in parallel** so both go out
    const sendToCustomer = resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: email,
      subject: `Your Order #${orderId} Confirmation`,
      html: emailHtml,
    });

    const sendToStore = resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: 'tech.adhyaapickles@gmail.com',
      subject: `NEW ORDER #${orderId} from ${fullName}`,
      html: emailHtml,
    });

    await Promise.all([sendToCustomer, sendToStore]);

    res.status(200).json({ message: 'Emails sent successfully to customer and store.' });
  } catch (err) {
    console.error('Email sending failed:', err);
    res.status(500).json({ error: 'Failed to send emails', details: err.message });
  }
});

module.exports = router;
