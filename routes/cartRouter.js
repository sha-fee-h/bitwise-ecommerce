const express = require('express');
const router = express.Router();
const cartController = require('../controllers/user/cartController');
const {userAuth , adminAuth, isLoggedIn, userAuthJson} = require('../middlewares/auth')



router.get("/",userAuth, cartController.loadCartPage);

router.get("/data",userAuthJson, cartController.getCartData);

router.delete('/clear',userAuthJson, cartController.clearCart)

router.get('/validate-stock',userAuthJson, cartController.validateStock);

router.post("/add",userAuthJson, cartController.addToCart);

router.patch("/update/:productId",userAuthJson, cartController.updateCartQuantity);

router.delete("/remove/:productId",userAuthJson, cartController.removeFromCart);

router.patch("/move-to-wishlist/:productId",userAuthJson, cartController.moveToWishlist);

module.exports = router