const User =  require('../models/userSchema');
const homeController = require('../controllers/user/homeController')
const MESSAGES = require('../constants/messages')
const STATUS_CODES = require('../constants/statusCodes');

const userAuth = async (req, res, next) => {
    if (req.session?.userData || req.user) {
        console.log("User Email:", req.user?.email || req.session?.userData?.email);

        User.findOne({ email: req.session?.userData?.email || req.user?.email })
            .then(data => {
                if (data && !data.isBlocked) {
                    return next(); 
                } else {
                    
                    // req.session.destroy((err) => {
                    //     if (err) {
                    //         console.error("Error destroying session:", err);
                    //     }
                    //     return res.render("user/login", { message: "You are blocked by admin" });
                    // });
                    if (req.session.userData) {
                        delete req.session.userData; 
                    }
                    req.user = null;
            
                    
                    if (req.session.passport) {
                        delete req.session.passport; 
                    }
                    return res.render("user/login", { message: MESSAGES.BLOCKED_USER });
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware:", error);
                return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR);
            });

    } else {
        console.log("User not logged in.");
        const {bestSellers , newArrivals } = await homeController.getHomeData();
        return res.render("user/home", {  user: false, cartCount:0, wishlistCount:0, newArrivals, bestSellers  });
    }
};

const userAuthJson = async (req, res, next) => {
    if (req.session?.userData || req.user) {
        

        User.findOne({ email: req.session?.userData?.email || req.user?.email })
            .then(data => {
                if (data && !data.isBlocked) {
                    return next(); 
                } else {
                    
                    
                    if (req.session.userData) {
                        delete req.session.userData; 
                    }
                    req.user = null;
            
                    
                    if (req.session.passport) {
                        delete req.session.passport; 
                    }
                    res.status(STATUS_CODES.UNAUTHORIZED).json({ error: MESSAGES.BLOCKED_USER})
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware:", error);
                res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.INTERNAL_SERVER_ERROR })
            });

    } else {
        console.log("User not logged in.");
        const {bestSellers , newArrivals } = await homeController.getHomeData();
        next();
    }
};

const isLoggedIn = (req, res, next) => {
    if (req.user || (req.session?.userData && !req.session.userData.isBlocked)) {
        // console.log("User is logged in:", req.session?.userData);
        return res.redirect('/');
    }
    next();
};


const adminAuth = (req,res,next)=>{
    if(req.session.admin){
        next()
    }
    else{
        res.render('admin/login',{error_msg:'You are not logged in'})
    }
    
}

module.exports = {userAuth, adminAuth ,isLoggedIn , userAuthJson}


    