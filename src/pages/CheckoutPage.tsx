import { useState, useEffect } from "react";
import Head from "@/components/Head";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/sonner";
import { formatPrice } from "@/lib/utils";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

// Import the Loader2 icon from lucide-react
import { Loader2 } from "lucide-react";

const checkoutFormSchema = z.object({
  fullName: z.string().min(3, "Full Name is required"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(5, "Postal Code is required").max(6, "Postal Code should not exceed 6 digits"), // Assuming Indian Pincode
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  paymentMethod: z.enum(["phonepe", "cod"], {
  errorMap: () => ({ message: "Please select a payment method" }),
}),

  savedAddressId: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

const TAX_RATE = 0; // 10% tax for example
const ADDITIONAL_FEES = 0; // Flat additional fees example

// Define your coupons here. In a real application, these would likely come from a database.
const COUPONS = [
  { code: "ADH5", discountPercent: 0.05 }, // 5% discount
  { code: "ADH10", discountPercent: 0.10 }, // 10% discount
  { code: "FIRSTORDER", discountPercent: 0.12 }, // 12% discount
  { code: "QWERTYUIOPASDFGHJKL", discountPercent: 0.98 }, // 96% discount
];


const CheckoutPage = () => {
  const { user, isSignedIn } = useUser();
  const { items, updateItemQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  // State for coupon management
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      phoneNumber: "",
      paymentMethod: "cod", // Default to COD
      savedAddressId: undefined,
    },
  });

  // Populate form fields if user is signed in and has saved addresses
  useEffect(() => {
    if (user) {
      const addresses = (user.publicMetadata?.addresses as any[]) || [];
      setSavedAddresses(addresses);

      if (addresses.length > 0) {
        const addr = addresses[0]; // Pre-fill with the first saved address
        form.reset({
          fullName: addr.fullName || user.fullName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
          address: addr.address || "",
          city: addr.city || "",
          state: addr.state || "",
          postalCode: addr.postalCode || "",
          phoneNumber: addr.phoneNumber || "",
          paymentMethod: "cod", // Keep default COD or set from user preference
          savedAddressId: addr.id,
        });
      } else {
        // If no saved addresses, just pre-fill name and email from Clerk
        form.setValue("fullName", user.fullName || user.firstName + " " + user.lastName || "");
        form.setValue("email", user.primaryEmailAddress?.emailAddress || "");
      }
    }
  }, [user, form]);

  // Handle changing saved addresses dropdown
  const handleSavedAddressChange = (addressId: string) => {
    const addr = savedAddresses.find((a) => a.id === addressId);
    if (addr) {
      form.setValue("fullName", addr.fullName || user?.fullName || "");
      form.setValue("email", user?.primaryEmailAddress?.emailAddress || "");
      form.setValue("address", addr.address || "");
      form.setValue("city", addr.city || "");
      form.setValue("state", addr.state || "");
      form.setValue("postalCode", addr.postalCode || "");
      form.setValue("phoneNumber", addr.phoneNumber || "");
      form.setValue("savedAddressId", addressId);
    } else {
      // If "Select saved address" or an invalid ID is chosen, clear address fields
      form.setValue("savedAddressId", "");
      form.setValue("address", "");
      form.setValue("city", "");
      form.setValue("state", "");
      form.setValue("postalCode", "");
      form.setValue("phoneNumber", "");
      // Optionally reset name/email if they were from the saved address
      form.setValue("fullName", user?.fullName || user?.firstName + " " + user?.lastName || "");
      form.setValue("email", user?.primaryEmailAddress?.emailAddress || "");
    }
  };

  // If cart is empty, redirect or show message
  if (items.length === 0) {
    return (
      <>
        <Head title="Cart Empty | ADHYAA PICKLES" />
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-24 text-center">
            <h1 className="text-4xl font-bold mb-4">Your Cart is Empty!</h1>
            <p className="text-muted-foreground mb-6">
              Looks like your cart is empty. Please add some delicious pickles before proceeding to checkout.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => navigate("/")}>Go to Home</Button>
              <Button variant="outline" onClick={() => navigate("/products")}>
                Browse Products
              </Button>
            </div>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  // --- START: ORDER CALCULATION LOGIC ---
  // 1. Calculate Subtotal (sum of item prices)
  const subtotal = items.reduce((acc, item) => {
    const unitPrice = item.product.pricePerWeight?.[item.weight] || 0;
    return acc + unitPrice * item.quantity;
  }, 0);

  // 2. Calculate Discount Amount (applied to subtotal)
  const discountAmount = appliedCoupon ? subtotal * appliedCoupon.discountPercent : 0;

  // 3. Calculate Subtotal After Discount
  const discountedSubtotal = subtotal - discountAmount;

  // 4. Calculate Shipping Cost based on original subtotal for thresholds
  let shippingCost = 0;
  if (subtotal > 1000) {
    shippingCost = 100; // Free shipping over ₹1000
  } else if (subtotal < 250) {
    shippingCost = 0;
  } else if (subtotal < 500) {
    shippingCost = 59;
  } else {
    shippingCost = 79; // For subtotals between ₹500 and ₹1000 (inclusive)
  }

  // 5. Calculate Taxes (applied to discounted subtotal)
  const taxes = discountedSubtotal * TAX_RATE;

  // 6. Calculate Final Total
  const finalTotal = discountedSubtotal + taxes + shippingCost + ADDITIONAL_FEES;
  // --- END: ORDER CALCULATION LOGIC ---

  const handleApplyCoupon = () => {
    const codeToApply = couponCode.trim().toUpperCase();
    const foundCoupon = COUPONS.find(c => c.code === codeToApply);

    if (foundCoupon) {
      setAppliedCoupon(foundCoupon);
      toast.success(`Coupon "${foundCoupon.code}" applied successfully! You got ${foundCoupon.discountPercent * 100}% off.`);
    } else {
      setAppliedCoupon(null);
      toast.error("Invalid coupon code. Please try again.");
    }
  };

  // Function to remove the currently applied coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode(""); // Clear the input field
    toast.info("Coupon removed.");
  };

  // Function to send order data to backend (and trigger email from backend)
  const sendOrderToBackend = async (data: CheckoutFormValues, paymentId?: string) => {
    const newOrderId = `ADH-${Date.now()}`; // Generate orderId here if not already generated

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/orders`, { // *** CHANGED ENDPOINT HERE ***
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Applied-Coupon": appliedCoupon?.code || ""
        },
        body: JSON.stringify({
          orderId: newOrderId, // Pass the generated orderId
          customerInfo: {
            fullName: data.fullName,
            email: data.email,
            address: data.address,
            city: data.city,
            state: data.state,
            postalCode: data.postalCode,
            phoneNumber: data.phoneNumber,
          },
          orderedItems: items.map(item => ({
            // This is the crucial change: Nest product details under a 'product' key
            product: {
              id: item.product.id,
              name: item.product.name,
              image: item.product.image,
              // Ensure pricePerWeight is an object, even if it has only one entry
              pricePerWeight: item.product.pricePerWeight || { [item.weight]: item.unitPrice }
            },
            weight: item.weight,
            quantity: item.quantity,
            // You can remove unitPrice here if it's already part of pricePerWeight
            // or keep it if your backend specifically expects it at this level for other reasons
            // unitPrice: item.product.pricePerWeight?.[item.weight] || 0,
          })),
          orderDetails: {
            subtotal,
            discountAmount,
            taxes,
            shippingCost,
            additionalFees: ADDITIONAL_FEES,
            finalTotal,
          },
          totalAmount: finalTotal, // This is the total amount used in the backend
          paymentMethod: data.paymentMethod,
          paymentId: paymentId || null,
          appliedCoupon: appliedCoupon, // Pass the applied coupon object directly
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Backend order submission failed:", responseData);
        toast.error(responseData.message || "Failed to place order.");
        return; // Stop further execution on error
      }

      toast.success("Order placed successfully!");
      clearCart();
      navigate("/checkout-success", {
        state: {
          customerInfo: { ...data, orderId: newOrderId },
          orderedItems: items,
          orderTotal: finalTotal,
          orderId: newOrderId,
        },
      });

    } catch (error) {
      console.error("Network or unexpected error during order submission:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false); // Re-enable button
    }
  };

  // Handle form submission
  const onSubmit = async (data: CheckoutFormValues) => {
    setIsSubmitting(true);

    if (data.paymentMethod === "cod") {
      // For COD, directly send the order to the backend
      await sendOrderToBackend(data);
    } else if (data.paymentMethod === "phonepe") {
      // For PhonePe, initiate payment process
      await initiatePhonePePayment(data);
    }
  };

  // Initiate PhonePe payment
const initiatePhonePePayment = async (formData) => {
  const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payment/phonepe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: finalTotal * 100, // in paise
      customer: {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phoneNumber,
      }
    }),
  });

  const result = await response.json();
  if (response.ok && result.paymentUrl) {
    window.location.href = result.paymentUrl;
  } else {
    toast.error(result.message || "Payment failed.");
  }
};

  return (
    <>
      <Head title="Checkout - ADHYAA PICKLES" />
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8 md:py-16">
          <h1 className="text-3xl font-display font-bold mb-8">Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2 order-1 lg:order-1">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Saved Addresses Dropdown */}
                  {savedAddresses.length > 0 && (
                    <FormField
                      control={form.control}
                      name="savedAddressId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saved Addresses</FormLabel>
                          <select
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleSavedAddressChange(e.target.value);
                            }}
                            className="w-full border rounded px-3 py-2 h-10 bg-background"
                          >
                            <option value="">Select a saved address</option>
                            {savedAddresses.map((addr) => (
                              <option key={addr.id} value={addr.id}>
                                {addr.address}, {addr.city}, {addr.state}, {addr.postalCode}
                              </option>
                            ))}
                          </select>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Full Name */}
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Address */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* City */}
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Mumbai" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* State */}
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="Maharashtra" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Postal Code */}
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="400001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone Number */}
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 9876543210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Payment Method */}
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex space-x-6"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="phonepe" id="phonepe" />
                              </FormControl>
                              <FormLabel htmlFor="phonepe" className="cursor-pointer">
                                PhonePe (UPI, Cards, Wallets)
                              </FormLabel>
                            </FormItem>

                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="cod" id="cod" />
                              </FormControl>
                              <FormLabel htmlFor="cod" className="cursor-pointer">
                                Cash on Delivery (COD)
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                          
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button with animation */}
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Place Order"
                    )}
                  </Button>
                </form>
              </Form>

              {/* Coupon Code Section */}
              <div className="mt-8 p-4 bg-card rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-3">Have a coupon code?</h3>
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-grow"
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={isSubmitting || !couponCode.trim()}
                  >
                    Apply
                  </Button>
                </div>
                {appliedCoupon && (
                  <p className="text-sm text-green-600 mt-2">
                    Coupon "{appliedCoupon.code}" applied! You save {formatPrice(discountAmount)}.
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="text-red-500 hover:text-red-700 ml-2 h-auto p-0 text-xs"
                    >
                      Remove
                    </Button>
                  </p>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1 order-2 lg:order-2">
              <div className="bg-muted p-6 rounded-lg sticky top-24">
                <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

                <div className="space-y-4 mb-4">
                  {items.map((item) => {
                    const weight = item.weight;
                    const price = item.product.pricePerWeight?.[weight] || 0;
                    const total = price * item.quantity;

                    return (
                      <div
                        key={`${item.product.id}-${item.weight}`}
                        className="flex justify-between items-center"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} × {weight}g × {formatPrice(price)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = Number(e.target.value);
                              if (qty > 0 && qty <= 99) {
                                updateItemQuantity(item.product.id, qty, item.weight);
                              }
                            }}
                            className="w-16 border rounded px-2 py-1 text-center"
                          />
                          <p className="font-medium w-20 text-right">
                            {formatPrice(total)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.product.id, item.weight)}
                            aria-label={`Remove ${item.product.name} (${item.weight}g) from cart`}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                <div className="space-y-2 mt-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-green-600">
                      <span>Coupon Discount ({appliedCoupon.discountPercent * 100}%)</span>
                      <span>- {formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Tax ({TAX_RATE * 100}%)</span>
                    <span>{formatPrice(taxes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{shippingCost === 0 ? "Free" : formatPrice(shippingCost)}</span>
                  </div>
                  {ADDITIONAL_FEES > 0 && (
                    <div className="flex justify-between">
                      <span>Additional Fees</span>
                      <span>{formatPrice(ADDITIONAL_FEES)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatPrice(finalTotal)}</span>
                  </div>
                </div>

                {/* Continue Shopping Button */}
                <div className="mt-6">
                  <Button variant="outline" className="w-full" onClick={() => navigate("/products")}>
                    Continue Shopping / Add More Items
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default CheckoutPage;
