// File: src/app.js
require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

// ROUTES
import sendEmailRouter from './routes/sendEmail.js';


const adminRoutes = require("./routes/adminRoutes");
const orderRoutes = require("./routes/orderRoutes");
const phonepeRoutes = require("./routes/phonepeRoutes");
const phonepeWebhook = require("./routes/phonepeWebhook");

const app = express();
const PORT = process.env.PORT || 5000;

/* ===========================
   ✅ SUPABASE INITIALIZATION
=========================== */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Supabase credentials missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log("✅ Supabase client initialized");

/* ===========================
   ✅ MIDDLEWARE
=========================== */
app.use(cors({
  origin: [
    "https://www.adhyaapickles.in",
    process.env.FRONTEND_URL
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use(express.json());

/* ===========================
   ✅ ROUTES
=========================== */

// ✅ EMAIL ROUTE (THIS FIXES 404)

app.use('/api', sendEmailRouter);
// ✅ ORDERS
app.use("/api/orders", orderRoutes(supabase, null));

// ✅ ADMIN
app.use("/api/admin", authenticateAdmin, adminRoutes(supabase, null));

// ✅ PHONEPE PAYMENT
app.use("/api/payment/phonepe", phonepeRoutes(supabase));

// ✅ PHONEPE CALLBACK (RAW BODY REQUIRED)
app.use(
  "/api/payment/phonepe/callback",
  express.raw({ type: "*/*" }),
  phonepeWebhook(supabase)
);

/* ===========================
   ✅ ROOT HEALTH CHECK
=========================== */
app.get("/", (req, res) => {
  res.send("✅ ADHYAA PICKLES Backend is running");
});

/* ===========================
   ✅ SERVER + SOCKET.IO
=========================== */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`🔌 WebSocket connected: ${socket.id}`);

  socket.on("subscribe", async ({ email }) => {
    try {
      if (!email || !email.includes("@")) {
        return socket.emit("subscribed", {
          success: false,
          message: "Invalid email address",
        });
      }

      const { error } = await supabase
        .from("emails")
        .insert([{ email }]);

      if (error) {
        return socket.emit("subscribed", {
          success: false,
          message: error.message,
        });
      }

      socket.emit("subscribed", {
        success: true,
        message: "Subscribed successfully",
      });
    } catch (err) {
      console.error("❌ Subscription error:", err.message);
      socket.emit("subscribed", {
        success: false,
        message: "Server error",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 WebSocket disconnected: ${socket.id}`);
  });
});

/* ===========================
   ✅ ADMIN AUTH MIDDLEWARE
=========================== */
function authenticateAdmin(req, res, next) {
  const adminApiKey = req.headers["x-admin-api-key"];
  if (!adminApiKey || adminApiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

/* ===========================
   ✅ START SERVER
=========================== */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
