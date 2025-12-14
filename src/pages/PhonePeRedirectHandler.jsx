import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PhonePeRedirectHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const orderId = params.get("merchantOrderId");
    const code = params.get("code");

    if (code === "PAYMENT_SUCCESS") {
      navigate(`/order-summary/${orderId}`);
    } else {
      navigate("/checkout?payment=cancelled");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Verifying your payment...</p>
    </div>
  );
};

export default PhonePeRedirectHandler;
