// src/pages/PaymentStatus.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState("Verifying payment...");

  useEffect(() => {
    if (!orderId) return;

    const checkStatus = async () => {
      try {
        const res = await axios.get(`https://bck-d1ip.onrender.com/api/phonepe/status/${orderId}`);
        if (res.data?.status === "SUCCESS") setStatus("✅ Payment Successful!");
        else if (res.data?.status === "FAILED" || res.data?.status === "CANCELLED") setStatus("❌ Payment Failed / Cancelled");
        else setStatus("⏳ Payment Pending...");
      } catch (err) {
        console.error(err);
        setStatus("⚠️ Unable to verify payment. Try again later.");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000); // poll every 5 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>{status}</h2>
      {status.includes("Successful") && <p>Thank you for your order!</p>}
      {(status.includes("Failed") || status.includes("Unable")) && <p>Please try again or contact support.</p>}
    </div>
  );
}
