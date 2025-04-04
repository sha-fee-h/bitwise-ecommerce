const User=require('../../models/userSchema')
const env = require('dotenv').config()
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const Products= require('../../models/productSchema')
const Category=require('../../models/categorySchema')
const referralController = require('../../controllers/user/referralController')
const MESSAGES = require('../../constants/messages')
const STATUS_CODES = require('../../constants/statusCodes');
const passport = require('passport');

let otpStore = {};


//to load signin page
const loadSignIn = async (req,res)=>{
    try{

        if(!req.session.userData){
            return res.render('user/login',{message:null})
        }
        else{
            return res.redirect('/')
        }
    }catch(err){
        console.log('error loading login page', err);
        res.redirect('/pageNotFound')
    }
    
}

//to generate otp
function generateOtp(){
    return Math.floor(100000+ Math.random()*900000).toString();
}

//to send verification email
async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from    : process.env.NODEMAILER_EMAIL,
            to      : email,
            subject : 'verify your account',
            text    : `your otp is ${otp}`,
            html    : `<div style="font-family: Arial, sans-serif; text-align: center;">
                        <h2 style="color: #333;">Verify Your Account</h2>
                        <p>Your One-Time Password (OTP) is:</p>
                        <h3 style="color: blue; font-size: 24px;">${otp}</h3>
                        <p>This OTP is valid for 10 minutes.</p>
                        <p>If you didn’t request this, please ignore this email.</p>
                       </div>`
        })

        return info.accepted.length > 0
    }catch(err){
        console.error('error sending verification mail',err)
        return false;
    }
}


//to signup 
const signUp=async (req,res)=>{
    try{
        
        const {userName,email,password,confirm_password,referralCode}= req.body
        if(password != confirm_password){
            return res.render('user/login',{message:MESSAGES.PASSWORD_MISMATCH})
        }
        const findUser = await User.findOne({email});
        if(findUser){
            return res.render('user/login',{message:MESSAGES.EXISTING_NAME('User')})
        }

        const otp = generateOtp()
        const emailSent = await sendVerificationEmail(email,otp)

        if(!emailSent){
            return res.json({
                "success": false,
                "message": "Email error"
            }
            )
        }
        //save otp and user data in session
        req.session.userOtp  = otp;
        req.session.userData = {userName,email,password,referralCode}

        // console.log(newUser)
        console.log(otp)
        return res.redirect("/auth/signUp/enter-otp");

    } catch(error){
        console.log('error sending otp', error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send(MESSAGES.INTERNAL_SERVER_ERROR);
    }
}

//to load otp page
const loadOtp=async (req,res)=>{
    try{
        return res.render('user/otpVerify',{message:null})
    }catch(error){
        console.log('cant get otp',error)
    }
}

//to secure password
const securePassword = async (password)=>{
    try{
        const hashedPassword = await bcrypt.hash(password,10)
        return hashedPassword
    }catch(error){
        console.log("error hashing password: ",error)
    }
}

//to verify otp 
const verifyOtp = async (req,res)=>{
    try{


        const {otp} = req.body;
        console.log(otp)
        if(req.session.userOtp===otp){
            const user = req.session.userData;
            const referralCode = user.referralCode
            const newReferralCode = referralController.generateReferralCode();
            console.log('new referal code is ',newReferralCode)
            const passwordHash = await securePassword(user.password)
            const saveUserData = new User({
                userName  : user.userName,
                email : user.email,
                password : passwordHash,
                referralCode:newReferralCode,
            })
            if (referralCode) {
                const referrer = await User.findOne({ referralCode });
                if (referrer && !referrer.redeemedUsers.includes(saveUserData._id)) {
                  referrer.redeemedUsers.push(saveUserData._id);
                  await referrer.save();
          
                  
                  const coupon = await referralController.createReferralCoupon(referrer._id);
                  
                } else if (!referrer) {
                  return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: MESSAGES.INVALID_REFERRAL});
                }
              }
            await saveUserData.save()
            req.session.userData = saveUserData;
            return res.json({success:true, redirectUrl: "/"})
        }
        else{
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                success:false,
                message:MESSAGES.INVALID_OTP
            })
        }
    }catch(error){
        console.error("Error Verifying OTP",error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success:false,
            message:MESSAGES.INTERNAL_SERVER_ERROR
        })

    }
}

//to resend otp
const resendOtp = async (req,res)=>{
    try{

        const {email} = req.session.userData;
        if(!email){
            return res.status(STATUS_CODES.NOT_FOUND).json({success:false,message:MESSAGES.NOT_FOUND('Email in session')})
        }
        const otp = generateOtp()
        req.session.userOtp = otp
        const emailSent = await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log('Resend otp: ',otp);
            return res.status(STATUS_CODES.OK).json({success:true,message:MESSAGES.RESEND_OTP_SUCCESS})
        }
        else{
            return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, message:MESSAGES.RESEND_OTP_FAILURE})
        }

    }catch(error){
        console.log("error resending otp",error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false, message:MESSAGES.INTERNAL_SERVER_ERROR})
    }
}

const login = async (req,res)=>{
    try{

        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:false,email:email});
        // console.log(findUser);
        
        if(!findUser){
            return res.render("user/login", {message:MESSAGES.NOT_FOUND('User')})
        }
        if(findUser.isBlocked){
            return res.render('user/login',{message: MESSAGES.BLOCKED_USER})
        }
        
        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render('user/login',{message:MESSAGES.INCORRECT_PASSWORD});
        }

        req.session.userData = findUser
        // console.log("user is "+req.session.user) //to checck
        res.redirect('/')

    }catch(error){
        console.error('login error', error);
        res.render('user/login',{message:MESSAGES.FAILED_LOGIN})
    }
}

// const logout = async (req,res)=>{
//     try{
//         req.session.destroy((err)=>{

//             if(err){
//                 console.log("Session destruction error",err.message)
//                 return res.redirect('/pageNotFound');
//             }
//             // return res.redirect('/auth/login')
//         })
        
//         return res.redirect('/auth/login')


//     }catch(error){
//         console.log("logout error",error);
//         res.redirect('/pageNotFound')
//     }
// }

const logout = async (req, res) => {
    try {
        
        if (req.session.userData) {
            delete req.session.userData; 
        }
        req.user = null;

        
        if (req.session.passport) {
            delete req.session.passport; 
        }
        
        return res.redirect('/auth/login');
    } catch (error) {
        console.log("Logout error:", error);
        res.redirect('/pageNotFound');
    }
};

//resetPassword

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            console.log('hello guys')
            req.flash("error", MESSAGES.NOT_FOUND('email'));
            // return res.render("user/forgot-password",{message:"Email not Found"});
            return res.redirect('/auth/forgot-password')
        }

        const otp = generateOtp()

        console.log(otp)
        
        otpStore[email] = otp;

        
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from    : process.env.NODEMAILER_EMAIL,
            to      : email,
            subject : 'Password Reset',
            text    : `your otp is ${otp}`,
            html    : `<div style="font-family: Arial, sans-serif; text-align: center;">
                        <h2 style="color: #333;">Reset Your Password</h2>
                        <p>Your One-Time Password (OTP) is:</p>
                        <h3 style="color: blue; font-size: 24px;">${otp}</h3>
                        <p>This OTP is valid for 10 minutes.</p>
                        <p>If you didn’t request this, please ignore this email.</p>
                       </div>`
        })
        req.flash("success", MESSAGES.SEND_OTP);
        res.redirect(`/auth/verify-otp?email=${email}`);
    }catch(err){
        console.error("Error sending OTP:", err);
        req.flash("error", MESSAGES.FAILED_SEND_OTP);
        res.redirect("/auth/forgot-password");
    }
}


const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log('otp store ',otpStore[email]);
        console.log('otp ', otp)
        if (otpStore[email] != parseInt(otp)) {
            req.flash("error", MESSAGES.INVALID_OTP);
            return res.redirect(`/auth/verify-otp?email=${email}`);
        }

        
        delete otpStore[email];
        req.flash("success", MESSAGES.OTP_VERIFIED);
        res.redirect(`/auth/reset-password?email=${email}`);

    } catch (error) {
        console.error("OTP verification error:", error);
        req.flash("error", MESSAGES.INTERNAL_SERVER_ERROR);
        res.redirect(`/auth/verify-otp?email=${email}`);
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });

        // req.flash("success", "Password reset successful! You can now log in.");
        res.render("user/login",{message:MESSAGES.RESET_PASSWORD_SUCCESS});

    } catch (error) {
        console.error("Error resetting password:", error);
        req.flash("error", MESSAGES.RESET_PASSWORD_FAILED);
        res.redirect(`/auth/reset-password?email=${email}`);
    }
};

// const googleAuth = (req, res) => {
//     if (req.user.isBlocked) {
//         console.log('here')
        
//         req.logout((err) => {
//             if (err) {
//                 console.log("Logout error:", err);
//                 return res.redirect('/pageNotFound');
//             }
//             res.render("user/login",{message:MESSAGES.BLOCKED_USER});
//         });
//     } else {

//         req.session.userData = 
//         res.redirect("/"); 
//     }
// }

const googleAuth = (req, res, next) => {
    const preservedAdmin = req.session.admin; // 🧷 Step 1: Save admin before Passport messes with session

    passport.authenticate('google', { failureRedirect: '/auth/login' }, (err, user, info) => {
        if (err || !user) return res.redirect('/auth/login');

        if (user.isBlocked) {
            return req.logout((err) => {
                if (err) {
                    console.log("Logout error:", err);
                    return res.redirect('/pageNotFound');
                }

                // Restore admin session if it existed
                if (preservedAdmin) req.session.admin = preservedAdmin;

                return res.render("user/login", { message: MESSAGES.BLOCKED_USER });
            });
        }

        req.login(user, (err) => {
            if (err) return next(err);

            req.session.userData = user; // ✅ Save user info in session
            if (preservedAdmin) req.session.admin = preservedAdmin; // 🔁 Restore admin session

            return res.redirect('/');
        });
    })(req, res, next);
};



module.exports = {loadSignIn, signUp , loadOtp, resendOtp, verifyOtp, login, logout, forgotPassword, verifyOTP, resetPassword ,googleAuth , sendVerificationEmail, securePassword, generateOtp
}