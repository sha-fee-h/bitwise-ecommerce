const express = require('express');
const router = express.Router();
const orderController = require('../controllers/user/orderController');
const { userAuth, adminAuth, isLoggedIn, userAuthJson } = require('../middlewares/auth')



router.get('/history',userAuth, orderController.getOrderHistory);
router.get('/details/:orderId',userAuth, orderController.getOrderDetails);
router.post('/cancel/:orderId', userAuthJson, orderController.cancelOrder);
router.post('/cancel-item/:orderId/:productId',userAuthJson, orderController.cancelItem);
router.post('/return/:orderId',userAuth, orderController.returnOrder);
router.get('/invoice/:orderId',userAuth, orderController.downloadInvoice);

module.exports = router;