import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./database/db.js";
import userRoute from "./routes/user.route.js";
import courseRoute from "./routes/course.route.js";
import mediaRoute from "./routes/media.route.js";
import purchaseRoute from "./routes/purchaseCourse.route.js";
import courseProgressRoute from "./routes/courseProgress.route.js";
import axios from "axios";
dotenv.config({});

// call database connection here
connectDB();
const app = express();

const PORT = process.env.PORT || 8080;

// default middleware
app.use(express.json());
app.use(cookieParser());

app.use(cors({
    origin:"http://localhost:5173",
    credentials:true
}));
 
// apis
app.use("/api/v1/media", mediaRoute);
app.use("/api/v1/user", userRoute);
app.use("/api/v1/course", courseRoute);
app.use("/api/v1/purchase", purchaseRoute);
app.use("/api/v1/progress", courseProgressRoute);
 

const CHAPA_AUTH_KEY = "CHASECK_TEST-HgKQ35Wyp5cz8ajB9mmGGaCLYPvWQecE"; // Use environment variable in production

app.post("/accept-payment", async (req, res) => {
  try {
    const { amount, currency, email, first_name, last_name, phone_number } = req.body;

    if (!amount || !currency || !email || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    const tx_ref = `chapa-${Date.now()}`; // Generate unique transaction reference

    const headers = {
      Authorization: `Bearer ${CHAPA_AUTH_KEY}`,
      "Content-Type": "application/json",
    };

    const body = {
      amount,
      currency: currency.toUpperCase(),
      email,
      first_name,
      last_name,
      phone_number,
      tx_ref,
      return_url: `http://localhost:5173/payment-success?tx_ref=${tx_ref}`, // Ensure frontend is using this URL
    };

    const response = await axios.post(
      "https://api.chapa.co/v1/transaction/initialize",
      body,
      { headers }
    );

    res.status(200).json({ success: true, checkout_url: response.data.data.checkout_url, tx_ref });
  } catch (error) {
    console.error("Payment Error:", error.response?.data || error.message);
    res.status(400).json({ success: false, message: "Something went wrong with payment initialization" });
  }
});

app.get("/verify-payment/:tx_ref", async (req, res) => {
  try {
    const { tx_ref } = req.params;

    const headers = {
      Authorization: `Bearer ${CHAPA_AUTH_KEY}`,
      "Content-Type": "application/json",
    };

    const response = await axios.get(
      `https://api.chapa.co/v1/transaction/verify/${tx_ref}`,
      { headers }
    );

    res.json(response.data);
  } catch (error) {
    res.status(400).json({ success: false, message: "Verification failed!" });
  }
});


 
app.listen(PORT, () => {
    console.log(`Server listen at port ${PORT}`);
})


