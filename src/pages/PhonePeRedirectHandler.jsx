import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const PhonePeRedirectHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("merchantOrderId");

    if (!orderId) {
      navigate("/checkout");
      return;
    }

    const verifyPayment = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/phonepe/status/${orderId}`
        );

        const status = res.data.status;

        if (status === "SUCCESS") {
          navigate(`/order-summary/${orderId}`);
        } else if (status === "FAILED" || status === "CANCELLED") {
          navigate("/checkout?payment=cancelled");
        } else {
          navigate("/checkout?payment=pending");
        }
      } catch (err) {
        navigate("/checkout?payment=error");
      }
    };

    verifyPayment();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Verifying your payment...</p>
    </div>
  );
};

export default PhonePeRedirectHandler;
