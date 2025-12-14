import { Toaster as ShadToaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

// ✅ Page components
import Head from "./components/Head";
import Index from "./pages/Index";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import CheckoutPage from "./pages/CheckoutPage";
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage";
import NotFound from "./pages/NotFound";
import DashboardPage from "./pages/DashboardPage";
import AuthPage from "./pages/AuthPage";
import ShippingPolicy from "./pages/ShippingPolicy";
import ReturnPolicy from "./pages/ReturnPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import FAQ from "./pages/FAQ";
import AdminDashboard from "./pages/AdminDashboard";
import PaymentSuccess from "./pages/PaymentSuccess";
import PhonePeRedirectHandler from "./pages/PhonePeRedirectHandler";
import OrderSummary from "./pages/OrderSummary";

// ✅ React Query setup
const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Head />
          <ShadToaster /> {/* shadcn ui Toaster */}
          <Sonner /> {/* Optional Sonner Toaster */}
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/checkout-success" element={<CheckoutSuccessPage />} />
              <Route path="/shipping-policy" element={<ShippingPolicy />} />
              <Route path="/return-policy" element={<ReturnPolicy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/success/:orderId" element={<CheckoutSuccessPage />} />
              <Route path="/phonepe-redirect" element={<PhonePeRedirectHandler />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/order-summary/:orderId" element={<OrderSummary />} />

              {/* Admin & Auth */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/sign-in/*" element={<AuthPage />} />
              <Route path="/sign-up/*" element={<AuthPage />} />

              {/* Protected User Dashboard */}
              <Route
                path="/dashboard"
                element={
                  <>
                    <SignedIn>
                      <DashboardPage />
                    </SignedIn>
                    <SignedOut>
                      <RedirectToSignIn />
                    </SignedOut>
                  </>
                }
              />

              {/* 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
