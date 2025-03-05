const express = require('express');
const router = express.Router();
const productController = require('../controllers/user/productController')
const passport = require('passport')
const { userAuth, adminAuth, isLoggedIn } = require('../middlewares/auth');
const { updateCartQuantity } = require('../controllers/user/cartController');


router.get("/product-detail/:productId", productController.getProductDetail);

router.get('/shop',productController.getProducts)


module.exports = router