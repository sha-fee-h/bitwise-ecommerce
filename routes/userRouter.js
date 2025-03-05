const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController')
// const passport = require('passport')
const { userAuth, adminAuth, isLoggedIn } = require('../middlewares/auth');
const upload = require('../config/multer');

router.get('/profile',userAuth,userController.getDashboard)

router.post('/update-profile-image',userAuth ,upload.single('profileImage'), userController.updateImage);

router.get('/profile/edit',userAuth,userController.getEditProfile)

router.post('/profile/edit',userAuth,userController.updateProfile)

router.post('/profile/edit/send-otp',userAuth,userController.sendEmailOtp)

router.get('/profile/address',userAuth,userController.getUserAddresses);

router.post("/profile/address/add",userAuth, userController.addAddress);

router.put("/profile/address/edit/:id",userAuth, userController.editAddress);

router.get("/profile/address/:addressId",userAuth, userController.fetchAddress)

router.delete("/profile/address/delete/:id",userAuth, userController.deleteAddress);

router.patch("/profile/address/set-primary/:addressId",userAuth, userController.setPrimaryAddress)

router.get('/wallet', userAuth,userController.getWalletDetails);

router.get('/coupons', userAuth,userController.getCoupons);




module.exports = router
