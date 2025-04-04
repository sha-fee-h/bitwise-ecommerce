const Cart = require('../../models/cartSchema');
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product= require('../../models/productSchema')
const Offer=require('../../models/offerSchema')
const Wishlist = require('../../models/wishlistSchema');
const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes')


const loadWishlistPage = async (req, res, next) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;

        const user = await User.findById(userId)

        // console.log(user)
        if (!userId) {
            return res.redirect("/auth/login");
        }

        const wishlist = await Wishlist.findOne({ userId }).populate("products");

        res.render("user/wishlist", {
            user,
            wishlist: wishlist || { products: [] },
            cartCount:0,
            wishlistCount:0
        });
    } catch (error) {
        console.error("Error loading wishlist page:", error);
        next(error);
    }
};


const getWishlistData = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated" });
        }

        const wishlist = await Wishlist.findOne({ userId }).populate("products");

        if (!wishlist || wishlist.products.length === 0) {
            return res.json({ success: true, products: [] });
        }

        res.json({
            success: true,
            products: wishlist.products
        });
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { productId } = req.body;

        if (!userId) return res.status(401).json({ success: false, error: "User not authenticated" });

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        if (wishlist.products.includes(productId)) {
            return res.status(400).json({ success: false, error: "Product already in wishlist" });
        }

        wishlist.products.push(productId);
        await wishlist.save();

        res.status(200).json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error("Error adding product to wishlist:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};

const moveToCart = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { productId } = req.params;

        if (!userId) return res.status(401).json({ success: false, error: "User not authenticated" });

        let wishlist = await Wishlist.findOne({ userId });
        let cart = await Cart.findOne({ userId });

        if (!wishlist || !wishlist.products.includes(productId)) {
            return res.status(404).json({ success: false, error: "Product not in wishlist" });
        }

        if (!cart) {
            cart = new Cart({ userId, products: [], cartTotal: 0, cartDiscount: 0 });
        }

        let existingProduct = cart.products.find(p => p.productId.toString() === productId);
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, error: "Product not found" });

        if(product.stock==0){
            return res.status(404).json({ success: false, error: "Product is Out of Stock" });
        }
        if (product.status==='unlisted' || product.category.status==='unlisted') {
            return res.status(400).json({ success: false, error: "Product is not available" });
        }

        if (existingProduct ) {
            existingProduct.quantity += 1;
            existingProduct.productTotal = existingProduct.quantity * product.price;
        } 

        else {
            cart.products.push({
                productId,
                price: product.price,
                quantity: 1,
                productTotal: product.price,
                offerDiscount: 0,
            });
        }

        wishlist.products = wishlist.products.filter(id => id.toString() !== productId);

        await wishlist.save();
        await cart.save();

        res.status(200).json({ success: true, message: "Product moved to cart" });
    } catch (error) {
        console.error("Error moving product to cart:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};


const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;
        const { productId } = req.params;

        if (!userId) return res.status(401).json({ success: false, error: "User not authenticated" });

        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) return res.status(404).json({ success: false, error: "Wishlist not found" });

        wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
        await wishlist.save();

        res.status(200).json({ success: true, message: "Product removed from wishlist" });
    } catch (error) {
        console.error("Error removing product from wishlist:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};

const checkCount = async (req, res) => {
    try {
        const userId = req.session?.userData?._id || req.user?._id;

        if(!userId){
            console.log('here error is user logged out')
            return res.status(401).json({ error: "User not authenticated" });
        }

        // Initialize counts to 0 by default
        let cartCount = 0;
        let wishlistCount = 0;

        if (userId) {
            // Find the user's cart and wishlist documents in parallel
            const [cart, wishlist] = await Promise.all([
                Cart.findOne({ userId }, { products: 1 }),
                Wishlist.findOne({ userId }, { products: 1 })
            ]);

            // Count the number of items in the cart (length of products array)
            cartCount = cart && cart.products ? cart.products.length : 0;

            // Count the number of items in the wishlist (length of products array)
            wishlistCount = wishlist && wishlist.products ? wishlist.products.length : 0;

            console.log(`Cart: ${cartCount} and Wishlist: ${wishlistCount}`);

            return res.json({
                cartCount,
                wishlistCount
            });
        } else {
            // Use 401 Unauthorized for missing user authentication
            return res.status(401).json({ error: "User not authenticated" });
        }
    } catch (error) {
        console.error('Error fetching counts:', error);
        res.status(500).json({ error: 'Failed to fetch counts' });
    }
};



module.exports = { loadWishlistPage ,getWishlistData , addToWishlist, moveToCart, removeFromWishlist , checkCount};
