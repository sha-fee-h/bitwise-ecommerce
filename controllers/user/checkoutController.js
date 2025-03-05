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
                appliedCoupon: null
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
        const totalDiscount = enrichedCart.offerDiscount;
        const shippingCharge = subtotal - totalDiscount > 1000 ? 0 : 50; 
        const finalTotal = subtotal - totalDiscount + shippingCharge;
        const isStockAvailable = checkoutProducts.every(p => p.stock >= p.quantity);

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
            appliedCoupon: null
        });
    } catch (error) {
        console.error("Error loading checkout:", error);
        res.status(500).send("Internal Server Error");
    }
};

const getCheckoutCartData = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(404).json({ success: false, message: "Cart is empty" });
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
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        cart = await offerController.applyOffersToCart(cart);
        const subtotal = cart.updatedProducts.reduce((acc, item) => acc + (item.productId.price * item.quantity), 0);
        const offerDiscount = cart.offerDiscount;

        const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
        if (!coupon) {
            return res.status(400).json({ success: false, message: "Invalid or inactive coupon" });
        }

        if (coupon.expiryDate < new Date()) {
            return res.status(400).json({ success: false, message: "Coupon has expired" });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        }

        if (subtotal < coupon.minimumSpend) {
            return res.status(400).json({ success: false, message: `Minimum spend of ₹${coupon.minimumSpend} required` });
        }

        const orderWithCoupon = await Order.findOne({ userId, couponCode });
        if (orderWithCoupon) {
            return res.status(400).json({ success: false, message: "Coupon already used" });
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
        res.status(500).json({ success: false, message: "Failed to apply coupon" });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
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
        res.status(500).json({ success: false, message: "Failed to remove coupon" });
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { selectedAddress, paymentMethod, couponCode, razorpayOrderId, paymentId, razorpaySignature } = req.body;

        if (paymentMethod === "Razorpay") {
            if (!razorpayOrderId || !paymentId || !razorpaySignature) {
                return res.status(400).json({ success: false, message: "Missing Razorpay payment details" });
            }

            const generatedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(razorpayOrderId + '|' + paymentId)
                .digest('hex');

            if (generatedSignature !== razorpaySignature) {
                return res.status(400).json({ success: false, message: "Invalid payment signature" });
            }
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty!" });
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
                } else {
                    return res.status(400).json({ success: false, message: "Coupon already used" });
                }
            } else {
                return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
            }
        }

        const shippingCost = subtotal > 1000 ? 0 : 50;
        const total = subtotal - offerDiscount - couponDiscount + shippingCost;

        if(paymentMethod === 'Cash on Delivery' && total >1000){
            return res.status(403).json({
                success:false,
                message:'COD not allowed for orders above 1000'
            })
        }

        const orderProducts = cart.updatedProducts.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.productId.price,
            offerDiscount: item.offerDiscount || 0
        }));

        const order = new Order({
            orderId: uuidv4(),
            userId,
            address: selectedAddress,
            products: orderProducts,
            orderDate: new Date(),
            deliveryStatus: "Pending",
            paymentMethod,
            paymentStatus: paymentMethod === "Cash on Delivery" ? "Pending" : "Pending", // Set to Pending initially
            total,
            orderTime: new Date(),
            shippingCost,
            couponCode: couponCode || null,
            couponDiscount,
            offerDiscount,
            paymentId: paymentMethod === "Razorpay" ? paymentId : null,
            razorpayOrderId: paymentMethod === "Razorpay" ? razorpayOrderId : null,
            transactionDate: paymentMethod === "Razorpay" ? new Date() : null,
        });

        await order.save();

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

        await User.findByIdAndUpdate(userId, { $push: { orders: order._id } });
        await Cart.findOneAndDelete({ userId });

        if (paymentMethod === "Razorpay") {
            order.paymentStatus = "Paid"; 
            await order.save();
        }

        res.json({ success: true, orderId: order.orderId });
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

const getUserAddresses = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated" });
        }

        const addresses = await Address.find({ userId });
        res.json({ success: true, addresses });
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
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
            return res.status(400).json({ success: false, message: "Your cart is empty!" });
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
                if (!orderWithCoupon) {
                    couponDiscount = coupon.discount;
                    
                } else {
                    return res.status(400).json({ success: false, message: "Coupon already used" });
                }
            } else {
                return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
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
        res.status(500).json({ success: false, message: "Failed to create order" });
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

        
        const order = await Order.findOne({ orderId })
            .populate('products.productId') 
            .populate('address'); 

        if (!order) {
            return res.redirect("/"); 
        }

        res.render("user/order-success", { order,user });
    } catch (error) {
        console.error("Error fetching order success:", error);
        res.status(500).send("Internal Server Error");
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

        
        const order = await Order.findOne({ razorpayOrderId: orderId })
            .populate('products.productId')
            .populate('address');
        console.log('Order in order failure:', order);

        
        res.render("user/order-failure", { 
            order, 
            user, 
            razorpayOrderId: orderId, 
            amount: req.session.failedOrderAmount || 0 
        });
    } catch (error) {
        console.error("Error fetching order failure:", error);
        res.status(500).send("Internal Server Error");
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
    getOrderSuccess, 
    applyCoupon, 
    removeCoupon,
    getOrderFailure 
};