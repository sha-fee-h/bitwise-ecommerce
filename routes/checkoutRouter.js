const express = require("express");
const router = express.Router();
const checkoutController = require("../controllers/user/checkoutController");
const { userAuth, adminAuth, isLoggedIn } = require('../middlewares/auth')


router.get("/",userAuth, checkoutController.getCheckout);
router.get("/addresses",userAuth, checkoutController.getUserAddresses);
router.get("/cart-data",userAuth, checkoutController.getCheckoutCartData);
router.post('/place-order',userAuth, checkoutController.placeOrder)
router.post('/create-razorpay-order', userAuth, checkoutController.createRazorpayOrder);

router.get('/address/:id',userAuth,checkoutController.getSingleAddress);
router.post('/add-address',userAuth,checkoutController.addAddress)
router.put('/address/:id',userAuth,checkoutController.updateAddress)

router.post('/apply-coupon', checkoutController.applyCoupon);
router.post('/remove-coupon', checkoutController.removeCoupon);

router.get('/order-success',userAuth, checkoutController.getOrderSuccess);
router.get('/order-failure',userAuth, checkoutController.getOrderFailure);


module.exports = router;
