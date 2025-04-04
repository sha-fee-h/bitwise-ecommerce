const express = require('express');
const router = express.Router();
const cartController = require('../controllers/user/cartController');
const {userAuth , adminAuth, isLoggedIn} = require('../middlewares/auth')



router.get("/",userAuth, cartController.loadCartPage);

router.get("/data",userAuth, cartController.getCartData);

router.delete('/clear',userAuth, cartController.clearCart)

router.get('/validate-stock',userAuth, cartController.validateStock);

router.post("/add",userAuth, cartController.addToCart);

router.patch("/update/:productId",userAuth, cartController.updateCartQuantity);

router.delete("/remove/:productId",userAuth, cartController.removeFromCart);

router.patch("/move-to-wishlist/:productId",userAuth, cartController.moveToWishlist);

module.exports = router