const Cart = require('../../models/cartSchema');
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product= require('../../models/productSchema')
const Offer=require('../../models/offerSchema')
const Wishlist = require('../../models/wishlistSchema')


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
                cartTotal: 0,
                cartDiscount: 0,
                finalTotal: 0
            });
        }

        
        cart = await applyDiscounts(cart);

        res.render("user/cart-management", {
            user,
            cart,
            cartTotal: cart.cartTotal,
            cartDiscount: cart.cartDiscount,
            finalTotal: cart.cartTotal - cart.cartDiscount
        });
    } catch (error) {
        console.error("Error loading cart page:", error);
        next(error);
    }
};

const getCartData = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId }).populate("products.productId");

        if (!cart || cart.products.length === 0) {
            return res.json({ success: true, products: [], cartTotal: 0, cartDiscount: 0 });
        }

        cart = await applyDiscounts(cart);

        res.json({
            success: true,
            products: cart.products,
            cartTotal: cart.cartTotal,
            cartDiscount: cart.cartDiscount,
            finalTotal: cart.cartTotal - cart.cartDiscount
        });
    } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};



const addToCart = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        let { productId, quantity } = req.body;

        quantity = parseInt(quantity, 10);
        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ success: false, message: "Invalid quantity" });
        }

        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated" });
        }

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(404).json({ success: false, error: "Product not found" });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ success: false, error: "Not enough stock available" });
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
                return res.status(400).json({ success: false, error: "Not enough stock available" });
            }
            if (existingProduct.quantity >= 5) {
                return res.status(400).json({ success: false, error: "Cannot add more than 5" });
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
        res.status(200).json({ success: true, message: "Product added to cart", cart });
    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};



const updateCartQuantity = async (req, res) => {
    try {
        const { productId } = req.params;
        const { change } = req.body;
        const userId = req.session?.userData?._id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated" });
        }

        
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'products.productId',
                populate: { path: 'category' } 
            });

        if (!cart) return res.status(404).json({ success: false, error: "Cart not found" });

        const product = cart.products.find(p => p.productId._id.toString() === productId);
        if (!product) return res.status(404).json({ success: false, error: "Product not found in cart" });

        product.quantity += change;

        if (product.quantity <= 0 || product.quantity > 5) {
            product.quantity = 1;
        } else if (product.productId.stock < product.quantity) {
            return res.status(404).json({ success: false, error: "Exceeded Stock Limit" });
        } else {
            product.productTotal = product.quantity * product.price;
        }

        await applyDiscounts(cart);
        await cart.save();
        res.json({ success: true, message: "Quantity updated", cart });
    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { productId } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated" });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ success: false, error: "Cart not found" });
        }

        
        cart.products = cart.products.filter(product => product.productId.toString() !== productId);

        
        cart.cartTotal = cart.products.reduce((sum, item) => sum + item.productTotal, 0);
        cart.cartDiscount = cart.products.reduce((sum, item) => sum + (item.offerDiscount || 0), 0);

        await cart.save();

        return res.status(200).json({ success: true, message: "Product removed from cart", cart });
    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};


const moveToWishlist = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { productId } = req.params; 

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
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

        res.status(200).json({ success: true, message: "Product moved to wishlist" });

    } catch (error) {
        console.error("Error moving product to wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


module.exports = { loadCartPage , addToCart, getCartData, updateCartQuantity, removeFromCart, moveToWishlist};