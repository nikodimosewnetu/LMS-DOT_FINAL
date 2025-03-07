import express from 'express';
import { createCheckoutSession,getAllPurchasedCourse, chapaWebhook, getCourseDetailWithPurchaseStatus } from '../controllers/coursePurchase.controller.js'; // Adjust the path as needed

const router = express.Router();

// Route to create a new checkout session
router.post('/create-checkout-session', createCheckoutSession);

// Route to handle Chapa webhook callback
router.post('/callback', chapaWebhook);
router.get("/", getAllPurchasedCourse);
// Route to get course details with purchase status
router.get('/course/:courseId/detail-with-status', getCourseDetailWithPurchaseStatus);

export default router;
