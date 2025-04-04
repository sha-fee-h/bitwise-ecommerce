const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/user/wishlistController')
const {userAuth , adminAuth, isLoggedIn} = require('../middlewares/auth')


router.get('/user/counts',userAuth , wishlistController.checkCount)


module.exports = router;