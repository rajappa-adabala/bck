import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const MAX_RETRIES = 10; // 10 × 2s = 20 seconds

const PhonePeRedirectHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("merchantOrderId");

    if (!orderId) {
      navigate("/checkout?payment=invalid");
      return;
    }

    let attempts = 0;

    const verifyPayment = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/phonepe/status/${orderId}`
        );

        const status = res.data.status;

        console.log("PhonePe status:", status);

        if (status === "PAID" || status === "SUCCESS") {
          navigate(`/order-summary/${orderId}`);
          return;
        }

        if (status === "FAILED" || status === "CANCELLED") {
          navigate("/checkout?payment=cancelled");
          return;
        }

        attempts++;
        if (attempts < MAX_RETRIES) {
          setTimeout(verifyPayment, 2000);
        } else {
          navigate("/checkout?payment=pending");
        }
      } catch (err) {
        console.error("Payment verification failed:", err);
        navigate("/checkout?payment=error");
      }
    };

    verifyPayment();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg font-medium">
        Verifying your payment, please wait…
      </p>
    </div>
  );
};

export default PhonePeRedirectHandler;
