const User=require('../../models/userSchema')
const env = require('dotenv').config()
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const Products= require('../../models/productSchema')
const Category=require('../../models/categorySchema')
const redisClient = require('../../config/redis');
const MESSAGES = require('../../constants/messages')
const STATUS_CODES = require('../../constants/statusCodes');
const Order = require('../../models/orderSchema')

const getHome = async (req, res) => {
    try {

        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        const {bestSellers , newArrivals} = await getHomeData() ;
        
            
        res.render("user/home", { user , cartCount:0, wishlistCount:0 , newArrivals, bestSellers});
    } catch (error) {
        console.error("Error from get Guest login page : \n", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR)
    }
};

const pageNotFound=async (req,res)=>{
    try{
        res.render('admin/404')
    }catch(err){
        res.redirect('/pageNotFound')
    }
}

const getHomeData = async () => {
    try {
        // Fetch new arrivals (latest 4 products)
        const newArrivals = await Products.find({ status: 'listed' })
            .sort({ createdAt: -1 }) // Sort by creation date (newest first)
            .limit(4);

        // Check Redis cache for best sellers
        const cacheKey = 'bestSellers';
        let bestSellers = null;

        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log('Best sellers fetched from cache');
                bestSellers = JSON.parse(cachedData); // Parse the cached JSON string
            }
        } catch (redisError) {
            console.error('Redis error, falling back to database:', redisError);
            // Continue without cache if Redis fails
        }

        if (!bestSellers) {
            console.log('Best sellers not in cache, calculating...');

            // Fetch best sellers using aggregation
            const bestSellersAggregation = await Order.aggregate([
                // Step 1: Exclude cancelled orders
                {
                    $match: {
                        deliveryStatus: { $ne: 'Cancelled' },
                    },
                },
                // Step 2: Unwind the products array
                {
                    $unwind: '$products',
                },
                // Step 3: Exclude cancelled items within orders
                {
                    $match: {
                        'products.itemDeliveryStatus': { $ne: 'Cancelled' },
                    },
                },
                // Step 4: Group by productId and sum the quantities
                {
                    $group: {
                        _id: '$products.productId',
                        totalSold: { $sum: '$products.quantity' },
                    },
                },
                // Step 5: Sort by totalSold in descending order
                {
                    $sort: { totalSold: -1 },
                },
                // Step 6: Limit to top 4 best sellers
                {
                    $limit: 4,
                },
            ]);

            // Extract product IDs from the aggregation result
            const bestSellerProductIds = bestSellersAggregation.map(item => item._id);

            // Fetch product details for the best sellers
            bestSellers = await Products.find({
                _id: { $in: bestSellerProductIds },
                status: 'listed', // Ensure only listed products are shown
            });

            // Sort bestSellers to match the order of bestSellerProductIds
            bestSellers = bestSellerProductIds.map(productId =>
                bestSellers.find(product => product._id.toString() === productId.toString())
            ).filter(product => product); // Filter out any null values

            // Cache the result for 1 hour (3600 seconds)
            try {
                await redisClient.setEx(cacheKey, 3600, JSON.stringify(bestSellers));
                console.log('Best sellers cached in Redis');
            } catch (redisError) {
                console.error('Redis error while caching:', redisError);
                // Continue without caching if Redis fails
            }
        }

        return { bestSellers, newArrivals };
    } catch (error) {
        console.error('Error in getHomeData:', error);
        throw error; // Let the caller handle the error
    }
};

const getAbout = async (req,res)=>{
    try {

        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        
        
            
        res.render("user/about", { user , cartCount:0, wishlistCount:0});
    } catch (error) {
        
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR)
    }
}

const getContact = async (req,res)=>{
    try {

        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        
        
            
        res.render("user/contact", { user , cartCount:0, wishlistCount:0});
    } catch (error) {
        
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR)
    }
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
    }
});

const postContact = async (req, res) => {
    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Email options for admin notification
    const mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: process.env.ADMIN_EMAIL || process.env.NODEMAILER_EMAIL,
        subject: `New Contact Form Submission: ${subject}`,
        text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${message}</pre>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        if (info.accepted.length > 0) {
            res.status(200).json({ message: 'Message sent successfully' });
        } else {
            throw new Error('Email not accepted');
        }
    } catch (error) {
        console.error('Error sending contact email:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};


module.exports = {getHome, pageNotFound, getHomeData, getAbout, getContact, postContact}