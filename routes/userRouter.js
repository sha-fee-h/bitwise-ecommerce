const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController')
const { userAuth, adminAuth, isLoggedIn, userAuthJson } = require('../middlewares/auth');
const productImageUpload = require('../config/multer');


router.get('/profile',userAuth,userController.getDashboard)

router.post('/update-profile-image', userAuth, productImageUpload.single('croppedImage'), userController.updateImage);

router.get('/profile/edit',userAuth,userController.getEditProfile)

router.post('/profile/edit',userAuthJson,userController.updateProfile)

router.post('/profile/edit/send-otp',userAuthJson,userController.sendEmailOtp)

router.get('/profile/address',userAuth,userController.getUserAddresses);

router.post("/profile/address/add",userAuthJson, userController.addAddress);

router.put("/profile/address/edit/:id",userAuthJson, userController.editAddress);

router.get("/profile/address/:addressId",userAuth, userController.fetchAddress)

router.delete("/profile/address/delete/:id",userAuthJson, userController.deleteAddress);

router.patch("/profile/address/set-primary/:addressId",userAuthJson, userController.setPrimaryAddress)

router.get('/wallet', userAuth,userController.getWalletDetails);

router.get('/coupons', userAuth,userController.getCoupons);




module.exports = router
