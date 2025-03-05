const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const {userAuth, adminAuth}= require('../middlewares/auth')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController')
const inventoryController = require('../controllers/admin/inventoryController')
const offerController = require('../controllers/admin/offerController')
const couponController = require('../controllers/admin/couponController')
const salesController = require('../controllers/admin/salesController')
const transactionController = require('../controllers/admin/transactionController');
const dashboardController = require('../controllers/admin/dashboardController')
const productImageUpload = require("../config/multer");



//----------- dashboard -----------------//


router.get('/login',adminController.loadLogin)

router.post('/login',adminController.login)

router.get('/dashboard',adminAuth,dashboardController.getDashboardData)

router.get('/pageerror',adminAuth,adminController.pageerror)

router.post('/dashboard/logout',adminAuth,adminController.logout)


//----------- User management -----------------//

router.get('/user-management',adminAuth,customerController.customerInfo)

router.patch('/update-status/:id',adminAuth,customerController.blockCustomer)



//----------- Catogery management -----------------//

router.get('/category-management',adminAuth , categoryController.categoryInfo)

router.post('/category-management/add-category',adminAuth, categoryController.addCategory)

router.post('/category-management/edit-category',adminAuth , categoryController.editCategory)

router.patch('/category-management/update-status/:id',adminAuth, categoryController.listCategory)



//----------- Product management -----------------//
router.get("/product-management", adminAuth, productController.getProducts);

router.get("/product-management/add-product", adminAuth, productController.getAddProduct);

router.post('/product-management/add-product',adminAuth, productImageUpload.array("croppedImage[]", 10), productController.postAddProduct)

router.get("/product-management/edit-product/:id", adminAuth, productController.getEditProduct);

router.post("/product-management/edit-product/:id", adminAuth, productImageUpload.array("croppedImage[]", 10), productController.postEditProduct);

router.patch("/product-management/update-status/:id", adminAuth, productController.updateProductStatus);



//----------- order management -----------------//

router.get('/orders/manage', adminAuth, orderController.getOrderManagement);
router.get('/orders/details/:orderId', adminAuth, orderController.getOrderDetails);
router.post('/orders/status/:orderId', adminAuth, orderController.updateOrderStatus);
router.post('/orders/verify-return/:orderId', adminAuth, orderController.verifyReturn);



//----------- inventory management -----------------//

router.get('/inventory', adminAuth, inventoryController.getInventoryManagement);
router.post('/inventory/update-stock/:productId', adminAuth, inventoryController.updateStock);


//----------- offer management -----------------//
router.get('/offer-management',adminAuth, offerController.renderOfferManagement);
router.get('/offers',adminAuth, offerController.getAllOffers);
router.post('/offers/product',adminAuth, offerController.createProductOffer);
router.post('/offers/category',adminAuth, offerController.createCategoryOffer);
router.put('/offers/toggle/:offerId',adminAuth, offerController.toggleOfferStatus);


//----------- coupon management -----------------//
router.get('/coupon-management',adminAuth, couponController.renderCouponManagement);
router.get('/coupons',adminAuth, couponController.getAllCoupons);
router.post('/coupons',adminAuth, couponController.createCoupon);
router.put('/coupons/toggle/:couponId',adminAuth, couponController.toggleCouponStatus);


//----------- sales management -----------------//

router.get('/sales-report',adminAuth, salesController.getSalesReport);
router.get('/download-sales-report',adminAuth, salesController.downloadSalesReport);


//----------- transaction management -----------------//

router.get('/transactions', transactionController.getTransactions);
router.get('/transactions/:transactionId', transactionController.getTransactionDetails);



module.exports = router