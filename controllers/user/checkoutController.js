const Address = require("../../models/addressSchema");
const Cart = require('../../models/cartSchema');
const Product = require("../../models/productSchema");
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Coupon = require('../../models/couponSchema'); 
const { v4: uuidv4 } = require("uuid");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const offerController = require('../../controllers/admin/offerController');
const Wallet = require('../../models/walletSchema')
const generateOrderId = require('../../config/generateOrderId');
const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCheckout = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        if (!userId) {
            return res.redirect("/auth/login");
        }

        const addresses = await Address.find({ userId });
        let cart = await Cart.findOne({ userId }).populate("products.productId");
        
        let wallet = await Wallet.findOne({ userId });
        console.log('wallet is',wallet);

        
              const ordersWithCoupons = await Order.find(
                  { userId, couponCode: { $ne: null } },
                  { couponCode: 1, _id: 0 } 
              );
        
              
              const usedCouponCodes = ordersWithCoupons.map(order => order.couponCode);
              console.log('Used coupon codes:', usedCouponCodes);
        
              
              const globalCoupons = await Coupon.find({
                  isActive: true,
                  expiryDate: { $gte: new Date() },
                  userId: null,
                  code: { $nin: usedCouponCodes }, 
              });
              console.log('Global coupons (after filtering):', globalCoupons);
        
              
              const userCoupons = await Coupon.find({
                  isActive: true,
                  expiryDate: { $gte: new Date() },
                  userId: userId,
                  code: { $nin: usedCouponCodes }, 
              });
              console.log('User coupons (after filtering):', userCoupons);

        if (!cart || cart.products.length === 0) {
            return res.render("user/checkout", {
                user,
                addresses: [],
                checkoutProducts: [],
                subtotal: 0,
                totalDiscount: 0,
                couponDiscount: 0,
                shippingCharge: 0,
                finalTotal: 0,
                isStockAvailable: true,
                appliedCoupon: null,
                wallet,
                cartCount:0,
                wishlistCount:0,
                userCoupons:null,
                globalCoupons:null
            });
        }

        
        const enrichedCart = await offerController.applyOffersToCart(cart);
        const checkoutProducts = enrichedCart.updatedProducts.map(item => ({
            _id: item.productId._id,
            name: item.productId.name,
            image: item.productId.images[0],
            price: item.productId.price,
            quantity: item.quantity,
            productTotal: item.productTotal,
            offerDiscount: item.offerDiscount || 0,
            stock: item.productId.stock
        }));
        const subtotal = enrichedCart.updatedProducts.reduce((acc, item) => acc + (item.productId.price * item.quantity), 0);
        console.log('sub total is ',subtotal)
        
        const totalDiscount = enrichedCart.offerDiscount;
        const shippingCharge = subtotal - totalDiscount > 1000 ? 0 : 50; 
        const finalTotal = subtotal - totalDiscount + shippingCharge;
        const isStockAvailable = checkoutProducts.every(p => p.stock >= p.quantity);
        console.log('stock availability',isStockAvailable)
        res.render("user/checkout", {
            user,
            addresses,
            checkoutProducts,
            subtotal,
            totalDiscount,
            couponDiscount: 0,
            shippingCharge,
            finalTotal,
            isStockAvailable,
            appliedCoupon: null,
            wallet,
            cartCount:0,
            wishlistCount:0,
            userCoupons,
            globalCoupons
        });
    } catch (error) {
        console.error("Error loading checkout:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("Internal Server Error");
    }
};

const getCheckoutCartData = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, error: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Cart is empty" });
        }

        
        const enrichedCart = await offerController.applyOffersToCart(cart);
        const checkoutProducts = enrichedCart.updatedProducts.map((item) => {
            console.log('your product is ', item.productId);
            return {
                _id: item.productId._id,
                name: item.productId.name,
                image: item.productId.images[0],
                price: item.productId.price,
                quantity: item.quantity,
                productTotal: item.productTotal,
                offerDiscount: item.offerDiscount || 0,
                stock: item.productId.stock
            };
        });

        const subtotal = enrichedCart.updatedProducts.reduce((acc, item) => acc + (item.productId.price * item.quantity), 0);
        const totalDiscount = enrichedCart.offerDiscount;
        const shippingCharge = subtotal - totalDiscount > 1000 ? 0 : 50;
        const finalTotal = subtotal - totalDiscount + shippingCharge;
        const isStockAvailable = checkoutProducts.every(p => p.stock >= p.quantity);

        res.json({
            success: true,
            checkoutProducts,
            subtotal,
            totalDiscount,
            shippingCharge,
            finalTotal,
            isStockAvailable
        });
    } catch (error) {
        console.error("Error fetching checkout cart data:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: "Internal server error" });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Cart is empty" });
        }

        cart = await offerController.applyOffersToCart(cart);
        const subtotal = cart.updatedProducts.reduce((acc, item) => acc + (item.productId.price * item.quantity), 0);
        const offerDiscount = cart.offerDiscount;

        const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
        if (!coupon) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Invalid or inactive coupon" });
        }

        if (coupon.expiryDate < new Date()) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Coupon has expired" });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Coupon usage limit reached" });
        }

        if (subtotal < coupon.minimumSpend) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: `Minimum spend of ₹${coupon.minimumSpend} required` });
        }

        if (subtotal < coupon.discount) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: `subtotal is less than the discount amount` });
        }

        const orderWithCoupon = await Order.findOne({ userId, couponCode });
        if (orderWithCoupon) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Coupon already used" });
        }

        const shippingCharge = subtotal > 1000 ? 0 : 50;
        const couponDiscount = coupon.discount;
        const finalTotal = subtotal - offerDiscount - couponDiscount + shippingCharge;

        res.json({
            success: true,
            message: "Coupon applied successfully",
            subtotal,
            totalDiscount: offerDiscount,
            couponDiscount,
            shippingCharge,
            finalTotal,
            appliedCoupon: couponCode
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to apply coupon" });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;

        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Cart is empty" });
        }

        cart = await offerController.applyOffersToCart(cart);
        const subtotal = cart.updatedProducts.reduce((acc, item) => acc + (item.productId.price * item.quantity), 0);
        const offerDiscount = cart.offerDiscount;
        const shippingCharge = subtotal > 1000 ? 0 : 50;
        const finalTotal = subtotal - offerDiscount + shippingCharge;

        res.json({
            success: true,
            message: "Coupon removed successfully",
            subtotal,
            totalDiscount: offerDiscount,
            couponDiscount: 0,
            shippingCharge,
            finalTotal,
            appliedCoupon: null
        });
    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to remove coupon" });
    }
};

const placeOrder = async (req, res) => {
    try {
      const userId = req.session?.userData?._id || req.user?._id;
      const { selectedAddress, paymentMethod, couponCode, razorpayOrderId, paymentId, razorpaySignature, orderId: existingOrderId } = req.body;
  
      if (!["Razorpay", "Cash on Delivery", "Wallet"].includes(paymentMethod)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Invalid payment method" });
      }
  
      
      if (existingOrderId && paymentMethod === "Razorpay" && razorpayOrderId && paymentId && razorpaySignature) {
        const order = await Order.findById(existingOrderId);
        if (!order) {
          return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Order not found" });
        }
  
        
        const generatedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(razorpayOrderId + '|' + paymentId)
          .digest('hex');
  
        if (generatedSignature !== razorpaySignature) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Invalid payment signature" });
        }
  
        
        order.paymentId = paymentId;
        order.razorpayOrderId = razorpayOrderId;
        order.transactionDate = new Date();
        order.paymentStatus = "Paid";
        await order.save();
  
        
        await Cart.findOneAndDelete({ userId });
  
        return res.status(STATUS_CODES.OK).json({ success: true, orderId: order._id });
      }
  
      
      let cart = await Cart.findOne({ userId }).populate("products.productId");
      if (!cart || cart.products.length === 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Your cart is empty!" });
      }
  
      cart = await offerController.applyOffersToCart(cart);
      const subtotal = cart.updatedProducts.reduce((acc, item) => acc + (item.productId.price * item.quantity), 0);
      const offerDiscount = cart.offerDiscount;
      let couponDiscount = 0;
  
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
        if (coupon && coupon.expiryDate >= new Date() && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) && subtotal >= coupon.minimumSpend) {
          const orderWithCoupon = await Order.findOne({ userId, couponCode });
          if (!orderWithCoupon) {
            couponDiscount = coupon.discount;
            coupon.usedCount += 1;
            if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) coupon.isActive = false;
            await coupon.save();
          } 
        } else {
          return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Invalid or expired coupon" });
        }
      }
  
      const shippingCost = subtotal > 1000 ? 0 : 50;
      const total = subtotal - offerDiscount - couponDiscount + shippingCost;
  
      if (paymentMethod === 'Cash on Delivery' && total > 1000) {
        return res.status(403).json({
          success: false,
          message: 'COD not allowed for orders above 1000'
        });
      }
  
      let wallet = null;
      if (paymentMethod === "Wallet") {
        wallet = await Wallet.findOne({ userId });
        if (!wallet) {
          wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }
        if (wallet.balance < total) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Insufficient wallet balance" });
        }
      }

      for (const item of cart.updatedProducts) {
        const product = await Product.findById(item.productId._id);
        if (!product || product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product: ${product?.name || item.productId._id}`);
        }
        const updateResult = await Product.updateOne(
          { _id: item.productId._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );
        if (updateResult.modifiedCount === 0) {
          throw new Error(`Failed to update stock for product: ${product.name}`);
        }
      }
  
      const orderProducts = cart.updatedProducts.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.price,
        offerDiscount: item.offerDiscount || 0
      }));
  
      
      const orderId = await generateOrderId();
      const order = new Order({
        orderId,
        userId,
        address: selectedAddress,
        products: orderProducts,
        orderDate: new Date(),
        deliveryStatus: "Pending",
        paymentMethod,
        paymentStatus: paymentMethod === "Razorpay" ? "Failed" : "Pending", 
        total,
        orderTime: new Date(),
        shippingCost,
        couponCode: couponCode || null,
        couponDiscount,
        offerDiscount,
        paymentId: null,
        razorpayOrderId: null,
        transactionDate: null,
      });
  
      await order.save();
  
  
      await User.findByIdAndUpdate(userId, { $push: { orders: order._id } });
  
      
      if (paymentMethod === "Cash on Delivery") {
        order.paymentStatus = "Pending";
        await order.save();
        await Cart.findOneAndDelete({ userId });
        return res.status(STATUS_CODES.OK).json({ success: true, orderId: order._id });
      }
  
      if (paymentMethod === "Wallet") {
        const transactionId = uuidv4();
        wallet.balance -= total;
        wallet.transactions.push({
          id:transactionId,
          type: 'debit',
          amount: total,
          description: `Payment for order ${order.orderId}`
        });
        await wallet.save();
        order.paymentStatus = "Paid";
        await order.save();
        await Cart.findOneAndDelete({ userId });
        return res.status(STATUS_CODES.OK).json({ success: true, orderId: order._id });
      }
  
      
      return res.status(STATUS_CODES.OK).json({ success: false, orderId: order._id, message: 'Payment pending' });
    } catch (error) {
      console.error("Error placing order:", error);
      res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message || "Internal Server Error" });
    }
  };


const getUserAddresses = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, error: "User not authenticated" });
        }

        const addresses = await Address.find({ userId });
        res.json({ success: true, addresses });
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: "Internal server error" });
    }
};


const getSingleAddress = async (req, res) => {
    const address = await Address.findById(req.params.id);
    res.json({ address });
}

const addAddress = async (req, res) => {
    const userId = req.session?.userData?._id || req.user?._id;
    const addressData = req.body;
    const newAddress = new Address({ userId, ...addressData });
    await newAddress.save();
    if (newAddress.isDefault) {
        await Address.updateMany(
            { userId, _id: { $ne: newAddress._id } }, 
            { $set: { isDefault: false } }
        );
    }
    await User.findByIdAndUpdate(userId, { $push: { addresses: newAddress._id } });
    res.json({ success: true });
}

const updateAddress = async (req, res) => {
    const userId = req.session?.userData?._id || req.user?._id;
    const updatedAddress = await Address.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (updatedAddress.isDefault) {
        await Address.updateMany(
            { userId, _id: { $ne: updatedAddress._id } }, 
            { $set: { isDefault: false } }
        );
    }
    res.json({ success: true, address: updatedAddress });
}




const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { couponCode } = req.body; 

        const cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Your cart is empty!" });
        }

        const { updatedProducts, offerDiscount } = await offerController.applyOffersToCart(cart);
        let subtotal = updatedProducts.reduce((acc, item) => acc + (item.discountedPrice * item.quantity), 0);
        const shippingCost = subtotal > 1000 ? 0 : 50;
        let total = subtotal + shippingCost;
        let couponDiscount = 0;

        
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
            if (coupon && coupon.expiryDate >= new Date() && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) && subtotal >= coupon.minimumSpend) {
                const orderWithCoupon = await Order.findOne({ userId, couponCode });
                
                    couponDiscount = coupon.discount;
                     
            } else {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Invalid or expired coupon" });
            }
        }

        total = total - couponDiscount; 
        console.log('Subtotal:', subtotal, 'Offer Discount:', offerDiscount, 'Shipping:', shippingCost, 'Coupon Discount:', couponDiscount, 'Final Total:', total);

        const options = {
            amount: total * 100, 
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            razorpayOrderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to create order" });
    }
};




let razorpayInstance;


const initializeRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay key_id and key_secret are required. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.');
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};


try {
  razorpayInstance = initializeRazorpay();
  console.log('Razorpay initialized successfully');
} catch (error) {
  console.error('Failed to initialize Razorpay:', error.message);
  
  process.exit(1); 
}

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    
    if (!orderId || typeof orderId !== 'string') {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid order ID' });
    }

    
    const userId = req.session?.userData?._id || req.user?._id;
    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'User not authenticated' });
    }

    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    
    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    
    if (order.paymentStatus === "Paid") {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Order is already paid' });
    }

    
    if (order.paymentMethod !== "Razorpay") {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Retry is only available for Razorpay payments' });
    }

    
    if (!order.total || typeof order.total !== 'number' || order.total <= 0) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid order total' });
    }

    
    if (!razorpayInstance) {
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Razorpay service unavailable' });
    }

    
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(order.total * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${order.orderId}`,
    });

    
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    
    res.status(STATUS_CODES.OK).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      razorpayOrderId: razorpayOrder.id,
      orderId: order._id
    });
  } catch (error) {
    console.error('Error in retryPayment:', error.message, error.stack);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to retry payment: ' + error.message });
  }
};



const getOrderSuccess = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId)
        if(!user)return res.redirect('/')
        const { orderId } = req.query;
        if (!orderId) {
            return res.redirect("/");
        }

        
        const order = await Order.findById(orderId)
            .populate('products.productId') 
            .populate('address'); 

        if (!order) {
            return res.redirect("/"); 
        }

        res.render("user/order-success", { order,user,wishlistCount:0, cartCount:0 });
    } catch (error) {
        console.error("Error fetching order success:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("Internal Server Error");
    }
};


const getOrderFailure = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);
        if (!user) return res.redirect('/');

        const { orderId } = req.query; 
        console.log('Razorpay order ID in order failure page:', orderId);
        if (!orderId) {
            return res.redirect("/");
        }

        
        const order = await Order.findById(orderId)
            .populate('products.productId')
            .populate('address');
        console.log('Order in order failure:', order);

        
        res.render("user/order-failure", { 
            order, 
            user,
            wishlistCount:0,
            cartCount:0
        });
    } catch (error) {
        console.error("Error fetching order failure:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("Internal Server Error");
    }
};


module.exports = { 
    getCheckout, 
    getUserAddresses, 
    getSingleAddress, 
    addAddress, 
    updateAddress, 
    getCheckoutCartData, 
    placeOrder, 
    createRazorpayOrder,
    retryPayment, 
    getOrderSuccess, 
    applyCoupon, 
    removeCoupon,
    getOrderFailure
};