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

  // Generate items table HTML
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

  // Costs summary table
  const costsTableHtml = `
    <table style="width:100%; margin-top:15px; font-size:16px;">
      <tr>
        <td style="padding:5px;">Subtotal:</td>
        <td style="padding:5px; text-align:right;">${formatCurrency(orderDetails.subtotal || 0)}</td>
      </tr>
      ${orderDetails.discountAmount > 0 ? `
      <tr>
        <td style="padding:5px; color:#28a745;">Discount:</td>
        <td style="padding:5px; text-align:right; color:#28a745;">-${formatCurrency(orderDetails.discountAmount)}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:5px;">Shipping:</td>
        <td style="padding:5px; text-align:right;">${formatCurrency(orderDetails.shippingCost || 0)}</td>
      </tr>
      <tr>
        <td style="padding:5px;">Taxes:</td>
        <td style="padding:5px; text-align:right;">${formatCurrency(orderDetails.taxes || 0)}</td>
      </tr>
      ${orderDetails.additionalFees > 0 ? `
      <tr>
        <td style="padding:5px;">Additional Fees:</td>
        <td style="padding:5px; text-align:right;">${formatCurrency(orderDetails.additionalFees)}</td>
      </tr>` : ''}
      <tr style="border-top:2px solid #d35400; font-weight:bold;">
        <td style="padding:5px; font-size:18px;">Total:</td>
        <td style="padding:5px; text-align:right; font-size:18px; color:#d35400;">${formatCurrency(orderDetails.finalTotal)}</td>
      </tr>
    </table>
  `;

  // Common email HTML for both store and customer
  const emailHtml = `
    <div style="font-family:Arial,sans-serif; max-width:650px; margin:auto; padding:20px; background:#fdf6e3; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
      <div style="text-align:center; padding-bottom:20px; border-bottom:2px solid #d35400;">
        <h1 style="color:#d35400; font-size:28px; margin:0;">ADHYAA PICKLES</h1>
        <p style="font-size:16px; color:#555; margin-top:5px;">Order #${orderId}</p>
      </div>

      <div style="margin-top:20px; padding:15px; background:#fff; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <h2 style="color:#d35400; font-size:20px; margin-bottom:10px;">Hello ${fullName},</h2>
        <p style="font-size:16px; color:#555; line-height:1.5;">
          Your order has been received and is being processed. Here are the details:
        </p>

        ${itemsTableHtml}
        ${costsTableHtml}
      </div>

      <div style="margin-top:20px; padding:15px; background:#fff; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <h3 style="color:#d35400; font-size:18px; margin-bottom:10px;">Shipping Address</h3>
        <p style="font-size:15px; color:#555; line-height:1.5;">
          <strong>${fullName}</strong><br/>
          ${address}, ${city}, ${state} - ${postalCode}<br/>
          Phone: ${phoneNumber}
        </p>
        <p style="margin-top:10px; font-size:15px; color:#555;">
          <strong>Payment Method:</strong> ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
        </p>
      </div>

      <p style="text-align:center; margin-top:20px; font-size:14px; color:#777;">
        If you have questions, contact us at <strong>${process.env.CUSTOMER_SERVICE_PHONE || '+91 7995059659'}</strong>
      </p>

      <p style="text-align:center; margin-top:10px; font-size:12px; color:#aaa;">
        This is an automated email. Please do not reply.
      </p>
    </div>
  `;

  try {
    // Send to customer
    await resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: email,
      subject: `Your Order #${orderId} Confirmation`,
      html: emailHtml,
    });

    // Send to store
    await resend.emails.send({
      from: 'ADHYAA PICKLES <onboarding@resend.dev>',
      to: 'tech.adhyaapickles@gmail.com',
      subject: `NEW ORDER #${orderId} from ${fullName}`,
      html: emailHtml,
    });

    res.status(200).json({ message: 'Emails sent successfully to customer and store.' });
  } catch (err) {
    console.error('Email sending failed:', err);
    res.status(500).json({ error: 'Failed to send emails', details: err.message });
  }
});

module.exports = router;
