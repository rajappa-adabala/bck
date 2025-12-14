import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PhonePeRedirectHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("VERIFYING");

  const orderId = searchParams.get("orderId");

  useEffect(() => {
    if (!orderId) {
      navigate("/");
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/phonepe/status/${orderId}`
        );
        const data = await res.json();

        if (data.status === "SUCCESS") {
          navigate(`/order-summary/${orderId}`);
        } else if (data.status === "FAILED") {
          navigate(`/checkout?payment=failed`);
        } else if (data.status === "CANCELLED") {
          navigate(`/checkout?payment=cancelled`);
        } else {
          setTimeout(checkPaymentStatus, 3000);
        }
      } catch (err) {
        console.error(err);
        navigate(`/checkout?payment=error`);
      }
    };

    checkPaymentStatus();
  }, [orderId, navigate]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      <h2 className="text-xl font-semibold">Verifying your payment...</h2>
      <p className="text-gray-500 mt-2">Please wait, do not refresh</p>
    </div>
  );
};

export default PhonePeRedirectHandler;
