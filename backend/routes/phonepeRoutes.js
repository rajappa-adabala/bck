const express = require("express");
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require("pg-sdk-node");
const axios = require("axios");

const router = express.Router();
let supabase=null, phonepeClient=null;

const getPhonePeClient = ()=>{
  if(!phonepeClient){
    const env=process.env.PHONEPE_ENV==="PRODUCTION"?Env.PRODUCTION:Env.SANDBOX;
    phonepeClient=StandardCheckoutClient.getInstance(
      process.env.PHONEPE_CLIENT_ID,
      process.env.PHONEPE_CLIENT_SECRET,
      parseInt(process.env.PHONEPE_CLIENT_VERSION||"1"),
      env
    );
  }
  return phonepeClient;
};

// Initiate payment
router.post("/", async (req,res)=>{
  try{
    const {amount}=req.body;
    if(!amount) return res.status(400).json({message:"Invalid amount"});
    const orderId=ORD-${Date.now()}-${Math.floor(Math.random()*10000)};
    const redirectUrl=process.env.REDIRECT_URL;
    const callbackUrl=process.env.CALLBACK_URL;

    const payReq=StandardCheckoutPayRequest.builder()
      .merchantOrderId(orderId)
      .amount(amount)
      .redirectUrl(redirectUrl)
      .build({callbackUrl});

    const client=getPhonePeClient();
    const response=await client.pay(payReq);
    return res.status(200).json({paymentUrl:response.redirectUrl, orderId});
  }catch(err){
    console.error("PhonePe Error:",err);
    res.status(500).json({error:err.message});
  }
});

// Check payment status
router.get("/status/:orderId", async (req,res)=>{
  const orderId=req.params.orderId;
  try{
    const client=getPhonePeClient();
    const statusRes=await client.checkStatus(orderId);
    const status=statusRes.data?.status;

    if(status==="SUCCESS"){
      const {data}=await supabase.from("orders").update({order_status:"paid", payment_id: statusRes.data.transactionId}).eq("order_id",orderId).select();
      // send email to customer/store
      const backendUrl=process.env.BACKEND_URL;
      await axios.post(${backendUrl}/api/send-email, {
        ...data[0].customer_info,
        paymentMethod:data[0].payment_method,
        orderDetails:{
          items:data[0].ordered_items,
          subtotal:data[0].subtotal,
          discountAmount:data[0].discount_amount,
          taxes:data[0].taxes,
          shippingCost:data[0].shipping_cost,
          additionalFees:data[0].additional_fees,
          finalTotal:data[0].total_amount,
        },
        orderId:data[0].order_id
      });
      return res.json({message:"Payment SUCCESS", order:data[0]});
    }

    if(status==="FAILED"||status==="CANCELLED"){
      await supabase.from("orders").update({order_status:status.toLowerCase()}).eq("order_id",orderId);
      return res.json({message:Payment ${status}, status});
    }

    return res.json({message:"Pending payment", status});
  }catch(err){
    console.error("Status check error:",err);
    res.status(500).json({error:err.message});
  }
});

// Webhook endpoint (optional)
router.post("/webhook", express.json(), (req,res)=>{
  console.log("PhonePe webhook:",req.body);
  res.status(200).send("OK");
});

// Inject Supabase instance
module.exports = (injectedSupabase)=>{
  supabase=injectedSupabase;
  return router;
};
