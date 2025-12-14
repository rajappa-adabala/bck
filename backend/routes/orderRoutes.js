const express = require('express');
const axios = require('axios');

module.exports = (supabase, io) => {
  const router = express.Router();

  // ---------------------------------
  // ✅ POST /api/orders
  // ---------------------------------
  router.post('/', async (req, res) => {
    console.log("\n--- START ORDER PROCESSING ---");
    console.log("Timestamp:", new Date().toISOString());

    try {
      const orderData = req.body;
      const appliedCouponCode = req.header('X-Applied-Coupon');

      console.log("1. Received orderData:", JSON.stringify(orderData, null, 2));

      // -------------------------------
      // Validation
      // -------------------------------
      if (
        !orderData.orderId ||
        !orderData.customerInfo ||
        !orderData.orderedItems ||
        typeof orderData.totalAmount === 'undefined'
      ) {
        console.error("Validation failed");
        return res.status(400).json({ message: 'Missing required order fields' });
      }

      // -------------------------------
      // Prepare DB object
      // -------------------------------
      const orderToInsert = {
        order_id: orderData.orderId,
        customer_info: orderData.customerInfo,
        ordered_items: orderData.orderedItems,
        subtotal: orderData.orderDetails?.subtotal || 0,
        discount_amount: orderData.orderDetails?.discountAmount || 0,
        taxes: orderData.orderDetails?.taxes || 0,
        shipping_cost: orderData.orderDetails?.shippingCost || 0,
        additional_fees: orderData.orderDetails?.additionalFees || 0,
        total_amount: orderData.totalAmount,
        payment_method: orderData.paymentMethod,
        payment_id: orderData.paymentId || null,
        applied_coupon: appliedCouponCode
          ? { code: appliedCouponCode }
          : null,
        order_status: 'pending',
      };

      console.log("2. Prepared orderToInsert:", JSON.stringify(orderToInsert, null, 2));

      // -------------------------------
      // Insert into Supabase
      // -------------------------------
      const { data, error } = await supabase
        .from('orders')
        .insert(orderToInsert)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert failed:", error);
        return res.status(500).json({ message: 'Failed to place order' });
      }

      console.log(`3. Order saved (UUID: ${data.id})`);

      // -------------------------------
      // Respond IMMEDIATELY to frontend
      // -------------------------------
      res.status(201).json({
        message: 'Order placed successfully',
        orderId: data.order_id,
        supabaseId: data.id
      });

      console.log("4. Response sent to frontend");

      // -------------------------------
      // Send email in background
      // -------------------------------
      const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const sendEmailUrl = `${backendBaseUrl}/api/send-email`;

      const emailPayload = {
        email: data.customer_info.email,
        fullName: data.customer_info.fullName,
        address: data.customer_info.address,
        city: data.customer_info.city,
        state: data.customer_info.state,
        postalCode: data.customer_info.postalCode,
        phoneNumber: data.customer_info.phoneNumber,
        paymentMethod: data.payment_method,
        orderDetails: {
          items: data.ordered_items,
          subtotal: data.subtotal,
          discountAmount: data.discount_amount,
          taxes: data.taxes,
          shippingCost: data.shipping_cost,
          additionalFees: data.additional_fees,
          finalTotal: data.total_amount,
        },
        orderId: data.order_id,
      };

      setImmediate(async () => {
        try {
          await axios.post(sendEmailUrl, emailPayload, {
            timeout: 5000
          });
          console.log("5. Confirmation email sent");
        } catch (err) {
          console.error("5a. Email sending failed:", err.message);
        }
      });

      console.log("--- END ORDER PROCESSING ---\n");

    } catch (err) {
      console.error("\n--- UNEXPECTED ERROR ---");
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ---------------------------------
  // ✅ GET /api/orders/products/:id/reviews
  // ---------------------------------
  router.get('/products/:id/reviews', async (req, res) => {
    try {
      const productId = req.params.id;

      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, user_id (name)')
        .eq('product_id', productId);

      if (error) {
        console.error("Review fetch error:", error);
        return res.status(500).json({ message: 'Failed to fetch reviews' });
      }

      const formatted = data.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: r.user_id?.name || 'Anonymous'
      }));

      res.status(200).json({ reviews: formatted });

    } catch (err) {
      console.error("Review server error:", err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return router;
};
