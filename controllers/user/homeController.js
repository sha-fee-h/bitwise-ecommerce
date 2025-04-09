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
        
        const newArrivals = await Products.find({ status: 'listed' })
            .sort({ createdAt: -1 }) 
            .limit(4);

        
        const cacheKey = 'bestSellers';
        let bestSellers = null;

        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log('Best sellers fetched from cache');
                bestSellers = JSON.parse(cachedData); 
            }
        } catch (redisError) {
            console.error('Redis error, falling back to database:', redisError);
            
        }

        if (!bestSellers) {
            console.log('Best sellers not in cache, calculating...');

            
            const bestSellersAggregation = await Order.aggregate([
                
                {
                    $match: {
                        deliveryStatus: { $ne: 'Cancelled' },
                    },
                },
                
                {
                    $unwind: '$products',
                },
                
                {
                    $match: {
                        'products.itemDeliveryStatus': { $ne: 'Cancelled' },
                    },
                },
                
                {
                    $group: {
                        _id: '$products.productId',
                        totalSold: { $sum: '$products.quantity' },
                    },
                },
                
                {
                    $sort: { totalSold: -1 },
                },
                
                {
                    $limit: 4,
                },
            ]);

            
            const bestSellerProductIds = bestSellersAggregation.map(item => item._id);

            
            bestSellers = await Products.find({
                _id: { $in: bestSellerProductIds },
                status: 'listed', 
            });

            
            bestSellers = bestSellerProductIds.map(productId =>
                bestSellers.find(product => product._id.toString() === productId.toString())
            ).filter(product => product); 

            
            try {
                await redisClient.setEx(cacheKey, 3600, JSON.stringify(bestSellers));
                console.log('Best sellers cached in Redis');
            } catch (redisError) {
                console.error('Redis error while caching:', redisError);
                
            }
        }

        return { bestSellers, newArrivals };
    } catch (error) {
        console.error('Error in getHomeData:', error);
        throw error; 
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

    
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    
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