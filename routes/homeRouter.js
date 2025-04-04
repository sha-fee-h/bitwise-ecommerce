const express = require('express');
const router = express.Router();
const homeController = require('../controllers/user/homeController')
const passport = require('passport')
const { userAuth, adminAuth, isLoggedIn } = require('../middlewares/auth')


router.get('/' ,homeController.getHome)

router.get('/pageNotFound', homeController.pageNotFound);

router.get('/about',homeController.getAbout)

router.get('/contact',homeController.getContact)

router.post('/contact',homeController.postContact)


module.exports = router