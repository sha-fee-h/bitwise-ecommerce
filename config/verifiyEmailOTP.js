const User = require('../models/userSchema'); // Your Mongoose User model
const securePassword = require('../controllers/user/authController'); // A function to hash passwords

/**
 * Verify the email OTP and update the user's profile.
 * Expects the following in req.body:
 *  - otp: The OTP entered by the user.
 *
 * Assumes that req.session.userOtp contains the OTP that was sent,
 * and req.session.userData contains the new user data (e.g., new email, new userName, new phone, and possibly new password)
 */
const verifyEmailOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;
    console.log('Provided OTP:', otp);
    
    // Check if the OTP stored in session matches the one provided by the user.
    if (req.session.userOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP, please try again."
      });
    }

    // Determine the user's ID (either stored in the session or available from an authentication middleware)
    const userId = req.session?.userData?._id || req.user?._id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User data is missing."
      });
    }

    // Retrieve the user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    // Retrieve the updated user details from session (this data should have been set previously when the user edited their profile)
    const updatedData = req.session.userData;

    // Update user fields if provided
    if (updatedData.userName) {
      user.userName = updatedData.userName;
    }
    if (updatedData.email) {
      user.email = updatedData.email;
    }
    if (updatedData.phone) {
      user.phone = updatedData.phone;
    }

    // Handle password update if a new password is provided.
    // Note: In many cases, password changes are handled in a separate workflow.
    if (updatedData.password) {
      user.password = await securePassword(updatedData.password);
    }

    // Save the updated user to the database
    await user.save();

    // Clear the OTP and temporary user data from the session
    req.session.userOtp = null;
    req.session.userData = null; // Or update this with the latest user data if needed

    // Optionally, update req.session.user with the user's ID or details
    req.session.user = user._id;

    return res.json({ success: true, redirectUrl: "/" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during OTP verification."
    });
  }
};

module.exports = verifyEmailOTP;
