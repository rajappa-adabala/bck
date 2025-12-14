// backend/src/routes/sendEmail.js
require("dotenv").config();
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// Ensure these environment variables are set
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("ERROR: EMAIL_USER or EMAIL_PASS environment variables are not set. Please check your .env file.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASS, // app password generated for Nodemailer
  },
});

router.post("/send-email", async (req, res) => {
  // --- DEBUGGING LOGS AT THE VERY TOP OF THE ROUTE HANDLER ---
  console.log("\nDEBUG: Received POST request to /api/send-email");
  console.log("DEBUG: Raw req.body:", JSON.stringify(req.body, null, 2));
  console.log("DEBUG: Does req.body.orderDetails exist?", !!req.body.orderDetails);
  console.log("DEBUG: Does req.body.orderDetails.items exist?", !!req.body.orderDetails?.items);
  console.log("DEBUG: Type of req.body.orderDetails.items:", typeof req.body.orderDetails?.items);
  if (Array.isArray(req.body.orderDetails?.items)) {
      console.log("DEBUG: Length of req.body.orderDetails.items:", req.body.orderDetails.items.length);
  }
  // --- END DEBUGGING LOGS ---

  const {
    email,
    fullName,
    address,
    city,
    state,
    postalCode,
    phoneNumber,
    paymentMethod,
    orderDetails, // Destructured here
    orderId = "N/A"
  } = req.body;

  // --- ADD THIS SPECIFIC DEBUGGING LINE ---
  console.log("DEBUG: Value of orderDetails after destructuring:", JSON.stringify(orderDetails, null, 2));
  // --- END DEBUGGING LINE ---


  // Basic validation
  if (!email || !fullName || !orderDetails || !orderDetails.items || typeof orderDetails.finalTotal === 'undefined') {
      console.error("Validation failed in sendEmail route:", { email, fullName, orderDetails });
    return res.status(400).json({ error: "Missing required order details for email." });
  }

  // Helper function to format currency for consistency
  const formatCurrency = (amount) => ₹${Number(amount).toFixed(2)};

  // Generate HTML for order items (using a table for better structure)
  const itemsTableHtml = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="background-color:#f8f8f8;">
          <th style="padding: 10px; border-bottom: 1px solid #eee; text-align: left;">Product</th>
          <th style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">Weight</th>
          <th style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">Qty</th>
          <th style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${orderDetails.items.map((item) => {
          const name = item.product?.name || "N/A"; // Use item.product?.name with optional chaining
          const weight = item.weight || "N/A";
          const quantity = item.quantity || 0;
          // Access price safely using optional chaining for product and pricePerWeight
          const unitPrice = item.product?.pricePerWeight?.[item.weight] || 0;
          const itemTotal = unitPrice * quantity;

          return `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left;">${name}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${weight}g</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${quantity}</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(itemTotal)}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;

    const storeHtmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 650px; margin: auto; padding: 25px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
        <h1 style="color: #d35400; text-align: center; margin-bottom: 20px; font-size: 28px;">ADHYAA PICKLES - New Order Notification</h1>
        <p style="font-size: 16px; text-align: center; color: #555;">You have received a new order from your website!</p>

        <div style="margin-top: 30px; padding: 20px; border: 1px solid #eee; border-radius: 6px; background-color: #f9f9f9;">
            <h2 style="color: #d35400; font-size: 20px; margin-bottom: 15px;">Order Details #${orderId}</h2>
            <p style="font-size: 15px; line-height: 1.6;">
            <strong>Order Date:</strong> ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}<br/>
            <strong>Payment Method:</strong> ${
                paymentMethod === "cod"
                ? "Cash on Delivery (COD)"
                : "Razorpay (Online Payment)"
            }
            </p>
            <hr style="border: none; border-top: 1px dashed #ccc; margin: 20px 0;" />

            <h3 style="color: #444; font-size: 18px; margin-bottom: 10px;">Customer Information</h3>
            <p style="font-size: 15px; line-height: 1.6;">
            <strong>Full Name:</strong> ${fullName}<br/>
            <strong>Email:</strong> ${email}<br/>
            <strong>Phone Number:</strong> ${phoneNumber}<br/>
            <strong>Address:</strong> ${address}, ${city}, ${state}, ${postalCode}
            </p>
        </div>

        <div style="margin-top: 25px; padding: 20px; border: 1px solid #eee; border-radius: 6px; background-color: #f9f9f9;">
            <h3 style="color: #444; font-size: 18px; margin-bottom: 15px;">Items Ordered:</h3>
            ${itemsTableHtml}
        </div>

        <div style="margin-top: 25px; padding: 20px; border: 1px solid #eee; border-radius: 6px; background-color: #f9f9f9; text-align: right;">
            <p style="font-size: 16px; margin: 5px 0;"><strong>Subtotal:</strong> ${formatCurrency(orderDetails?.subtotal || 0)}</p>
            <p style="font-size: 16px; margin: 5px 0;"><strong>Shipping:</strong> ${formatCurrency(orderDetails?.shippingCost || 0)}</p>
            <p style="font-size: 16px; margin: 5px 0;"><strong>Discount:</strong> -${formatCurrency(orderDetails?.discountAmount || 0)}</p>
            <p style="font-size: 16px; margin: 5px 0;"><strong>Taxes:</strong> ${formatCurrency(orderDetails?.taxes || 0)}</p>
            ${orderDetails?.additionalFees > 0 ? <p style="font-size: 16px; margin: 5px 0;"><strong>Additional Fees:</strong> ${formatCurrency(orderDetails?.additionalFees || 0)}</p> : ''}
            <hr style="border: none; border-top: 2px solid #d35400; margin: 15px 0;" />
            <p style="font-size: 22px; font-weight: bold; color: #d35400; margin: 0;">Total Amount: ${formatCurrency(orderDetails?.finalTotal || 0)}</p>
        </div>

        <p style="margin-top: 30px; font-size: 14px; text-align: center; color: #777;">
            Please log in to your admin panel to manage this order.
        </p>
        <p style="margin-top: 20px; font-size: 12px; text-align: center; color: #999;">
            This is an automated notification. Please do not reply to this email.
        </p>
        </div>
    `;

    const customerHtmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e2e2; border-radius: 8px; background-color: #fff8e1;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e2e2e2;">
            <img src="https://example.com/your-logo.png" alt="ADHYAA PICKLES Logo" style="max-width: 150px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
            <h1 style="color: #d35400; font-size: 28px; margin-top: 10px; margin-bottom: 0;">ADHYAA PICKLES</h1>
        </div>

        <h2 style="color: #d35400; text-align: center; margin-top: 30px; margin-bottom: 20px; font-size: 24px;">Thank you for your order, ${fullName}!</h2>
        <p style="font-size: 16px; line-height: 1.6; text-align: center; color: #555;">
            We’re thrilled to have you as a customer. Your order *#${orderId}* has been received and is now being processed with care.
        </p>

        <div style="margin-top: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 6px; background-color: #fefefe;">
            <h3 style="border-bottom: 2px solid #d35400; padding-bottom: 8px; margin-bottom: 15px; color: #444; font-size: 18px;">Your Order Summary</h3>
            ${itemsTableHtml}
            
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; margin-top: 20px;">
            <tr>
                <td style="font-size: 16px; padding: 5px 0;">Subtotal:</td>
                <td style="font-size: 16px; text-align: right; padding: 5px 0;">${formatCurrency(orderDetails?.subtotal || 0)}</td>
            </tr>
            ${orderDetails?.discountAmount > 0 ? `
                <tr>
                <td style="font-size: 16px; padding: 5px 0; color: #28a745;">Coupon Discount:</td>
                <td style="font-size: 16px; text-align: right; padding: 5px 0; color: #28a745;">-${formatCurrency(orderDetails?.discountAmount || 0)}</td>
                </tr>` : ''}
            <tr>
                <td style="font-size: 16px; padding: 5px 0;">Shipping:</td>
                <td style="font-size: 16px; text-align: right; padding: 5px 0;">${formatCurrency(orderDetails?.shippingCost || 0)}</td>
            </tr>
            <tr>
                <td style="font-size: 16px; padding: 5px 0;">Taxes:</td>
                <td style="font-size: 16px; text-align: right; padding: 5px 0;">${formatCurrency(orderDetails?.taxes || 0)}</td>
            </tr>
            ${orderDetails?.additionalFees > 0 ? `
                <tr>
                <td style="font-size: 16px; padding: 5px 0;">Additional Fees:</td>
                <td style="font-size: 16px; text-align: right; padding: 5px 0;">${formatCurrency(orderDetails?.additionalFees || 0)}</td>
                </tr>` : ''}
            <tr style="border-top: 2px solid #d35400;">
                <td style="font-size: 20px; font-weight: bold; padding-top: 15px;">Total Amount:</td>
                <td style="font-size: 20px; font-weight: bold; color: #d35400; text-align: right; padding-top: 15px;">${formatCurrency(orderDetails?.finalTotal || 0)}</td>
            </tr>
            </table>
        </div>

        <div style="margin-top: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 6px; background-color: #fefefe;">
            <h3 style="border-bottom: 2px solid #d35400; padding-bottom: 8px; margin-bottom: 15px; color: #444; font-size: 18px;">Shipping Address</h3>
            <p style="font-size: 16px; line-height: 1.5; color: #555; text-transform: uppercase;">
            <strong>${fullName}</strong><br/>
            ${address}<br/>
            ${city}, ${state} - ${postalCode}<br/>
            Ph: ${phoneNumber}
            </p>
            <p style="margin-top: 15px; font-size: 16px; color: #555;">
            <strong>Payment Method:</strong> ${
                paymentMethod === "cod"
                ? "Cash on Delivery (COD)"
                : "Razorpay (Online Payment)"
            }
            </p>
        </div>

        <p style="margin-top: 30px; font-size: 16px; text-align: center;">
            If you have any questions about your order, please feel free to reply to this email or call us anytime at <strong>${process.env.CUSTOMER_SERVICE_PHONE || '+91 7995059659'}</strong>.
        </p>

        <p style="margin-top: 40px; font-style: italic; text-align: center; color: #7f8c8d; font-size: 15px;">
            Warm regards,<br />
            <strong>The ADHYAA PICKLES Team</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin-top: 40px;" />

        <p style="font-size: 12px; color: #aaa; text-align: center; margin-top: 20px;">
            You’re receiving this email because you placed an order at ADHYAA PICKLES. If you believe this is a mistake, please contact us immediately.
        </p>
        </div>
    `;

  try {
    // Send email to the store
    await transporter.sendMail({
      from: "ADHYAA PICKLES" <${process.env.EMAIL_USER}>,
      to: "tech.adhyaapickles@gmail.com", // Your store's email address
      subject: NEW ORDER #${orderId} from ${fullName}, // Include Order ID in subject
      html: storeHtmlContent,
    });

    // Send confirmation email to the customer
    await transporter.sendMail({
      from: "ADHYAA PICKLES" <${process.env.EMAIL_USER}>,
      to: email,
      subject: Your Order #${orderId} Confirmation from ADHYAA PICKLES, // Include Order ID in subject
      html: customerHtmlContent,
    });

    res.status(200).json({ message: "Emails sent successfully" });
  } catch (error) {
    console.error("Failed to send emails:", error);
    res.status(500).json({ error: "Failed to send emails", details: error.message });
  }
});

module.exports = router;
