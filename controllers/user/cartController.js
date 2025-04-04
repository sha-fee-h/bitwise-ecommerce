const Cart = require('../../models/cartSchema');
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product= require('../../models/productSchema')
const Offer=require('../../models/offerSchema')
const Wishlist = require('../../models/wishlistSchema');
const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes');


async function applyDiscounts(cart) {
    let total = 0;
    let discount = 0;

    
    const currentDate = new Date();
    const startOfDay = new Date(currentDate.setUTCHours(0, 0, 0, 0));
    const activeOffers = await Offer.find({
        startDate: { $lte: currentDate },
        endDate: { $gte: startOfDay },
        isActive: true,
    });
    // console.log('Active offers:', activeOffers);

    
    const productOfferMap = new Map();
    const categoryOfferMap = new Map();

    activeOffers.forEach(offer => {
        if (offer.type === 'Product') {
            productOfferMap.set(offer.productId.toString(), offer.discountPercentage);
        } else if (offer.type === 'Category') {
            categoryOfferMap.set(offer.categoryId.toString(), offer.discountPercentage);
        }
    });
    console.log('Product offer map:', [...productOfferMap]);
    console.log('Category offer map:', [...categoryOfferMap]);

    
    for (let item of cart.products) {
        
        const product = item.productId;

        
        const productOfferDiscount = productOfferMap.get(product._id.toString()) || 0;
        const categoryOfferDiscount = categoryOfferMap.get(product.category._id.toString()) || 0;
        console.log(`Item ${product._id}: Product discount=${productOfferDiscount}, Category discount=${categoryOfferDiscount}`);

        const staticDiscount = product.discount || 0;

        
        const appliedDiscountPercentage = Math.max(productOfferDiscount, categoryOfferDiscount, staticDiscount);
        const appliedDiscountAmount = (product.price * appliedDiscountPercentage) / 100;

        
        item.originalPrice = product.price; 
        item.offerDiscount = appliedDiscountAmount * item.quantity; 
        item.discountedPrice = product.price - appliedDiscountAmount; 
        item.productTotal = item.discountedPrice * item.quantity; 

        total += item.productTotal;
        discount += item.offerDiscount;
    }

    cart.cartTotal = total;
    cart.cartDiscount = discount;

    return cart;
}

const loadCartPage = async (req, res, next) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        if (!userId) {
            return res.redirect("/auth/login");
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");

        if (!cart || cart.products.length === 0) {
            return res.render("user/cart-management", {
                user,
                cart: null,
                subTotal: 0,
                cartDiscount: 0,
                finalTotal: 0,
                cartCount:0,
                wishlistCount:0
            });
        }

        let subTotal = cart.products.reduce((sum,item)=>sum+(item.price*item.quantity),0)
        cart = await applyDiscounts(cart);

        res.render("user/cart-management", {
            user,
            cart,
            subTotal: subTotal,
            cartDiscount: cart.cartDiscount,
            finalTotal: cart.cartTotal,
            cartCount:1,
            wishlistCount:0
        });
    } catch (error) {
        console.error("Error loading cart page:", error);
        next(error);
    }
};


const getCartData = async (req,res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");

        if (!cart || cart.products.length === 0) {
            return res.json({ cart: null, subTotal: 0, cartDiscount: 0, finalTotal: 0 });
        }

        let subTotal = cart.products.reduce((sum,item)=>sum+(item.price*item.quantity),0)
        cart = await applyDiscounts(cart);
        console.log('from get cart data , cart.originalPrice is ',cart)
        res.json({
            cart,
            subTotal: subTotal,
            cartDiscount: cart.cartDiscount,
            finalTotal: cart.cartTotal,
        });
    } catch (error) {
        console.error('Error fetching cart data:', error);
        res.status(500).json({ error: 'Failed to fetch cart data' });
    }
}

const clearCart = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ error: "Cart not found" });
        }

        cart.products = [];
        cart.cartTotal = 0;
        cart.cartDiscount = 0;
        await cart.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
};

const addToCart = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        let { productId, quantity } = req.body;

        quantity = parseInt(quantity, 10);
        if (isNaN(quantity) || quantity <= 0) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: MESSAGES.INVALID_QUANTITY });
        }

        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, error: MESSAGES.USER_NOT_AUTHENTICATED });
        }

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, error: MESSAGES.PRODUCT_NOT_FOUND });
        }

        if (product.stock < quantity) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: MESSAGES.NOT_ENOUGH_STOCK });
        }

        if (product.status==='unlisted' || product.category.status==='unlisted') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: MESSAGES.PRODUCT_NOT_AVAILABLE });
        }
        
        let wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            const productIndex = wishlist.products.findIndex((p) => p.toString() === productId);
            if (productIndex !== -1) {
                wishlist.products.splice(productIndex, 1);
                await wishlist.save();
                console.log("Product removed from wishlist");
            }
        }

        
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, products: [], cartTotal: 0, cartDiscount: 0 });
        }

        let existingProduct = cart.products.find((p) => p.productId.toString() === productId);
        if (existingProduct) {
            if (existingProduct.quantity >= product.stock) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: MESSAGES.NOT_ENOUGH_STOCK });
            }
            if (existingProduct.quantity >= 5) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, error: MESSAGES.MAX_QUANTITY_EXCEEDED });
            }
            existingProduct.quantity += quantity;
            existingProduct.productTotal = existingProduct.quantity * product.price;

        } else {
            cart.products.push({
                productId: product._id,
                price: product.price,
                quantity: quantity,
                productTotal: product.price * quantity,
                offerDiscount: 0
            });
        }
        cart = await Cart.populate(cart, { path: 'products.productId', populate: { path: 'category' } });
        await applyDiscounts(cart);
        await cart.save();

        console.log("Product added to cart:", cart);
        res.status(STATUS_CODES.OK).json({ success: true, message: MESSAGES.PRODUCT_ADDED_TO_CART, cart });
    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: MESSAGES.INTERNAL_SERVER_ERROR });
    }
};



const   updateCartQuantity = async (req, res) => {
    try {
        const { productId } = req.params;
        const { change } = req.body;
        const userId = req.session?.userData?._id || req.user?._id;

        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, error: "User not authenticated" });
        }

        
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'products.productId',
                populate: { path: 'category' } 
            });

        if (!cart) return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, error: "Cart not found" });

        const product = cart.products.find(p => p.productId._id.toString() === productId);
        if (!product) return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, error: "Product not found in cart" });

        product.quantity += change;

        if (product.quantity <= 0 || product.quantity > 5) {
            product.quantity = 1;
        } else if (product.productId.stock < product.quantity && change>=0) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, error: "Exceeded Stock Limit" });
        } else {
            product.productTotal = product.quantity * product.price;
        }

        await applyDiscounts(cart);
        await cart.save();
        res.json({ success: true, message: "Quantity updated", cart });
    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: "Internal server error" });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { productId } = req.params;

        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, error: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, error: "Cart not found" });
        }

        
        cart.products = cart.products.filter(product => product.productId.toString() !== productId);

        
        cart.cartTotal = cart.products.reduce((sum, item) => sum + item.productTotal, 0);
        cart.cartDiscount = cart.products.reduce((sum, item) => sum + (item.offerDiscount || 0), 0);

        await cart.save();

        return res.status(STATUS_CODES.OK).json({ success: true, message: "Product removed from cart", cart });
    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: "Internal server error" });
    }
};


const moveToWishlist = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { productId } = req.params; 

        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: "User not authenticated" });
        }

        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Product not found" });
        }

        
        let cart = await Cart.findOne({ userId });
        if (cart) {
            cart.products = cart.products.filter(p => !p.productId.equals(productId));
            await cart.save();
        }

        
        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [productId] });
        } else {
            if (!wishlist.products.some(p => p.equals(productId))) {
                wishlist.products.push(productId);
            }
        }

        await wishlist.save();

        res.status(STATUS_CODES.OK).json({ success: true, message: "Product moved to wishlist" });

    } catch (error) {
        console.error("Error moving product to wishlist:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
};

const validateStock = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.USER_NOT_AUTHENTICATED,
            });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'products.productId',
            populate: { path: 'category' }, 
        });

        if (!cart || cart.products.length === 0) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.CART_EMPTY,
            });
        }

        
        for (const item of cart.products) {
            const product = item.productId; 

            
            if (!product) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    success: false,
                    message: MESSAGES.PRODUCT_NOT_FOUND,
                });
            }

            
            if (product.stock < item.quantity) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    success: false,
                    message: MESSAGES.PRODUCT_OUT_OF_STOCK.replace('{product}', product.name || product._id),
                });
            }

            
            if (product.status === 'unlisted') {
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    success: false,
                    message: MESSAGES.PRODUCT_UNLISTED.replace('{product}', product.name || product._id),
                });
            }

            
            if (product.category && product.category.status === 'unlisted') {
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    success: false,
                    message: MESSAGES.CATEGORY_UNLISTED.replace('{category}', product.category.name || product.category._id),
                });
            }
        }

        res.status(STATUS_CODES.OK).json({ success: true });
    } catch (error) {
        console.error("Error validating cart for checkout:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.INTERNAL_SERVER_ERROR,
        });
    }
};

module.exports = { loadCartPage ,getCartData, clearCart, addToCart, updateCartQuantity, removeFromCart, moveToWishlist, validateStock};