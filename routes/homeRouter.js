const express = require('express');
const router = express.Router();
const homeController = require('../controllers/user/homeController')
const passport = require('passport')
const { userAuth, adminAuth, isLoggedIn } = require('../middlewares/auth')


router.get('/',userAuth ,homeController.getHome)

router.get('/pageNotFound', homeController.pageNotFound);


module.exports = router