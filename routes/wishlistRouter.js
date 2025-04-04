const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/user/wishlistController');
const {userAuth , adminAuth, isLoggedIn, userAuthJson} = require('../middlewares/auth');



router.get('/',userAuth,wishlistController.loadWishlistPage)

router.get("/data",userAuth, wishlistController.getWishlistData);

router.post("/add",userAuthJson, wishlistController.addToWishlist);

router.delete("/remove/:productId",userAuthJson, wishlistController.removeFromWishlist);

router.patch('/move-to-cart/:productId',userAuthJson, wishlistController.moveToCart)


module.exports = router