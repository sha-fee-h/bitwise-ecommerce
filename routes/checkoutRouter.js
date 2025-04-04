const express = require("express");
const router = express.Router();
const checkoutController = require("../controllers/user/checkoutController");
const { userAuth, adminAuth, isLoggedIn,userAuthJson } = require('../middlewares/auth')


router.get("/",userAuth, checkoutController.getCheckout);
router.get("/addresses",userAuth, checkoutController.getUserAddresses);
router.get("/cart-data",userAuth, checkoutController.getCheckoutCartData);
router.post('/place-order',userAuthJson, checkoutController.placeOrder)
router.post('/create-razorpay-order', userAuthJson, checkoutController.createRazorpayOrder);

router.get('/address/:id',userAuth,checkoutController.getSingleAddress);
router.post('/add-address',userAuth,checkoutController.addAddress)
router.put('/address/:id',userAuth,checkoutController.updateAddress)

router.post('/apply-coupon', userAuthJson,checkoutController.applyCoupon);
router.post('/remove-coupon',userAuthJson, checkoutController.removeCoupon);

router.get('/order-success',userAuth, checkoutController.getOrderSuccess);
router.get('/order-failure',userAuth, checkoutController.getOrderFailure);
router.post('/retry-payment',userAuth, checkoutController.retryPayment);


module.exports = router;
