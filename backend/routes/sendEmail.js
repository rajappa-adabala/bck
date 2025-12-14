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

  // Items table HTML
  const itemsTableHtml = `
    <table style="width:100%; border-collapse:collapse; margin-top:10px;">
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
          const quantity = item.quantity || 0;
          const unitPrice = item.product?.pricePerWeight?.[item.weight] || 0;
          const total = unitPrice * quantity;
          return `
            <tr>
              <td style="padding:10px; border-bottom:1px solid #eee;">${name}</td>
              <td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">${weight}g</td>
              <td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">${quantity}</td>
              <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(total)}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Store email
  const storeHtml = `
    <div style="font-family:Arial,sans-serif; max-width:650px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:8px; background:#fff;">
      <h1 style="color:#d35400; text-align:center;">ADHYAA PICKLES - New Order</h1>
      <p style="font-size:16px;">You have received a new order from your website!</p>
      <h2 style="color:#444; font-size:18px;">Order #${orderId}</h2>
      <p><strong>Customer:</strong> ${fullName} (${email})</p>
      <p><strong>Payment Method:</strong> ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
      ${itemsTableHtml}
      <p style="text-align:right; font-weight:bold; font-size:16px;">Total: ${formatCurrency(orderDetails.finalTotal)}</p>
    </div>
  `;

  // Customer email
  const customerHtml = `
    <div style="font-family:Arial,sans-serif; max-width:650px; margin:auto; padding:20px; border:1px solid #eee; border-radius:8px; background:#fff8e1;">
      <div style="text-align:center; margin-bottom:20px;">
        <h1 style="color:#d35400;">Thank you for your order, ${fullName}!</h1>
      </div>
      <p style="font-size:16px; text-align:center;">Your order #${orderId} is confirmed and being processed.</p>
      ${itemsTableHtml}
      <div style="margin-top:20px;">
        <h3 style="font-size:16px; color:#444;">Shipping Address:</h3>
        <p style="font-size:15px; line-height:1.5;">
          ${fullName}<br/>
          ${address}, ${city}, ${state} - ${postalCode}<br/>
          Phone: ${phoneNumber}
        </p>
      </div>
      <p style="text-align:right; font-weight:bold; font-size:16px;">Total: ${formatCurrency(orderDetails.finalTotal)}</p>
      <p style="text-align:center; margin-top:30px; font-size:14px; color:#777;">ADHYAA PICKLES Team</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: 'tech.adhyaapickles@gmail.com',
      subject: `NEW ORDER #${orderId} from ${fullName}`,
      html: storeHtml,
    });

    await resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: email,
      subject: `Your Order #${orderId} Confirmation`,
      html: customerHtml,
    });

    res.status(200).json({ message: 'Emails sent successfully.' });
  } catch (err) {
    console.error('Failed to send emails via Resend:', err);
    res.status(500).json({ error: 'Failed to send emails', details: err.message });
  }
});

module.exports = router;
