const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/user/wishlistController')
const {userAuth , adminAuth, isLoggedIn,userAuthJson} = require('../middlewares/auth')


router.get('/user/counts',userAuthJson , wishlistController.checkCount)


module.exports = router;