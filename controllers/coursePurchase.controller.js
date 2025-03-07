import Chapa from 'chapa';
import { Course } from "../models/course.model.js";
import { CoursePurchase } from "../models/coursePurchase.model.js";
import { Lecture } from "../models/lecture.model.js";
import { User } from "../models/user.model.js";

// Initialize Chapa with your secret key
const chapa = new Chapa(process.env.CHAPA_SECRET_KEY);

// Create a checkout session (payment link)
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.id;
    const { courseId } = req.body;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found!" });

    // Create a new course purchase record
    const newPurchase = new CoursePurchase({
      courseId,
      userId,
      amount: course.coursePrice,
      status: "pending",
    });

    // Create a Chapa payment link (checkout session)
    const paymentLink = await chapa.createPaymentLink({
      amount: course.coursePrice * 100, // Amount in lowest denomination (kobo)
      currency: 'NGN', // or INR, depending on your region
      email: req.user.email, // User's email address
      phone_number: req.user.phone, // Optional: User's phone number
      order_id: `course_${courseId}_${userId}`,
      metadata: {
        courseId: courseId,
        userId: userId,
      },
      callback_url: `${process.env.BASE_URL}/api/payment/callback`, // Your webhook/callback URL for Chapa
      success_url: `http://localhost:5173/course-progress/${courseId}`,
      cancel_url: `http://localhost:5173/course-detail/${courseId}`,
    });

    if (!paymentLink || !paymentLink.link) {
      return res.status(400).json({ success: false, message: "Error while creating payment link" });
    }

    // Save the purchase record with the payment link
    newPurchase.paymentId = paymentLink.id;
    await newPurchase.save();

    return res.status(200).json({
      success: true,
      url: paymentLink.link, // Return the Chapa checkout URL
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Chapa webhook callback handler
export const chapaWebhook = async (req, res) => {
  let event;

  try {
    // Chapa provides an endpoint secret to verify webhook authenticity
    const secret = process.env.CHAPA_WEBHOOK_SECRET;
    const signature = req.headers['x-chapa-signature'];

    // Verify the webhook signature (Chapa has a different way of verifying webhooks)
    chapa.verifyWebhook(req.body, secret, signature);

    event = req.body; // The event data received from Chapa
  } catch (error) {
    console.error("Webhook error:", error.message);
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  if (event.status === "successful") {
    const { metadata, amount } = event.data;

    try {
      const purchase = await CoursePurchase.findOne({
        paymentId: metadata.payment_id,
      }).populate({ path: "courseId" });

      if (!purchase) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      // Update the purchase status to "completed"
      purchase.amount = amount / 100; // Convert from kobo to NGN or your appropriate currency
      purchase.status = "completed";

      // Make all lectures visible by setting `isPreviewFree` to true
      if (purchase.courseId && purchase.courseId.lectures.length > 0) {
        await Lecture.updateMany(
          { _id: { $in: purchase.courseId.lectures } },
          { $set: { isPreviewFree: true } }
        );
      }

      await purchase.save();

      // Update user's enrolledCourses
      await User.findByIdAndUpdate(
        purchase.userId,
        { $addToSet: { enrolledCourses: purchase.courseId._id } },
        { new: true }
      );

      // Update course to add user ID to enrolledStudents
      await Course.findByIdAndUpdate(
        purchase.courseId._id,
        { $addToSet: { enrolledStudents: purchase.userId } },
        { new: true }
      );
    } catch (error) {
      console.error("Error handling event:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  res.status(200).send(); // Always return a 200 status to acknowledge receipt
};

// Get Course Detail with Purchase Status
export const getCourseDetailWithPurchaseStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.id;

    const course = await Course.findById(courseId)
      .populate({ path: "creator" })
      .populate({ path: "lectures" });

    const purchased = await CoursePurchase.findOne({ userId, courseId });

    if (!course) {
      return res.status(404).json({ message: "course not found!" });
    }

    return res.status(200).json({
      course,
      purchased: !!purchased, // true if purchased, false otherwise
    });
  } catch (error) {
    console.log(error);
  }
};

// Get All Purchased Courses
export const getAllPurchasedCourse = async (_, res) => {
  try {
    const purchasedCourse = await CoursePurchase.find({
      status: "completed",
    }).populate("courseId");

    if (!purchasedCourse) {
      return res.status(404).json({
        purchasedCourse: [],
      });
    }
    return res.status(200).json({
      purchasedCourse,
    });
  } catch (error) {
    console.log(error);
  }
};
