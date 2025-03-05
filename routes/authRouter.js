const express = require('express');
const router = express.Router();
const authController = require('../controllers/user/authController')
const passport = require('passport')
const { userAuth, adminAuth, isLoggedIn } = require('../middlewares/auth')

router.get('/login',isLoggedIn, authController.loadSignIn);

router.post('/login', authController.login)

router.post('/signUp', authController.signUp)

router.get('/signUp/enter-otp', authController.loadOtp)

router.post('/signUp/enter-otp', authController.verifyOtp)

router.post('/signUp/resend-otp', authController.resendOtp)

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: 'auth/login' }), authController.googleAuth);

router.post('/logout', authController.logout)


//reset password 

router.get("/forgot-password", (req, res) => {
    res.render("user/forgot-password"); 
});


router.post("/forgot-password", authController.forgotPassword);


router.get("/verify-otp", (req, res) => {
    const email = req.query.email;
    res.render("user/verify-otp",{email});
});


router.post("/verify-otp", authController.verifyOTP);


router.get("/reset-password", (req, res) => {
    const email = req.query.email
    res.render("user/reset-password",{email});
});

router.post("/reset-password", authController.resetPassword);

module.exports = router