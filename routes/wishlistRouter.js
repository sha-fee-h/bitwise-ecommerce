const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/user/wishlistController');
const {userAuth , adminAuth, isLoggedIn} = require('../middlewares/auth');



router.get('/',userAuth,wishlistController.loadWishlistPage)

router.get("/data",userAuth, wishlistController.getWishlistData);

router.post("/add",userAuth, wishlistController.addToWishlist);

router.delete("/remove/:productId",userAuth, wishlistController.removeFromWishlist);

router.patch('/move-to-cart/:productId',userAuth, wishlistController.moveToCart)


module.exports = router