const User =  require('../models/userSchema');

const userAuth = (req, res, next) => {
    if (req.session?.userData || req.user) {
        // console.log("User Email:", req.user?.email || req.session?.userData?.email);

        User.findOne({ email: req.session?.userData?.email || req.user?.email })
            .then(data => {
                if (data && !data.isBlocked) {
                    return next(); 
                } else {
                    
                    req.session.destroy((err) => {
                        if (err) {
                            console.error("Error destroying session:", err);
                        }
                        return res.render("user/login", { message: "You are blocked by admin" });
                    });
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware:", error);
                return res.status(500).send("Internal Server Error");
            });

    } else {
        // console.log("User not logged in.");
        return res.render("user/home", { userLoggedIn: false, user: false });
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

module.exports = {userAuth, adminAuth ,isLoggedIn}


    