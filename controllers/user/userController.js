const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const bcrypt = require('bcrypt');
// const verifyEmailOTP=require('../../config/verifiyEmailOTP')
const authController = require('../../controllers/user/authController')
const Wallet = require('../../models/walletSchema');
const Coupon = require('../../models/couponSchema')


const getDashboard = async (req, res) => {
  try {
    const userId = req.session?.userData?._id || req.user?._id;

    
    const user = await User.findById(userId).populate("addresses").exec();


    if (!user) {
      return res.status(404).render("user/dashboard", { message: "User not found", user: null, orders: [] });
    }

    
    const recentOrders = await Order.find({ userId: userId })
      .sort({ orderDate: -1 })  
      .limit(5)  
      .populate('products.productId')  
      .populate('address');  

    // console.log('recent order is ',recentOrders)
    res.render('user/dashboard', {
      user: user,
      recentOrders: recentOrders,
      page: 'dashboard'
    });

  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).send("Internal Server Error");
  }
};

const updateImage = async (req, res) => {
  try {

    const userId = req.session?.userData?._id || req.user?._id;

    
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    
    if (req.file) {
      
      user.profileImage = `/uploads/${req.file.filename}`;
      await user.save();
    }

    
    return res.redirect('/user/profile');
  } catch (error) {
    console.error('Error updating profile image:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getEditProfile = async (req, res, next) => {
  try {

    const userId = req.session?.userData?._id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found.');
    }
    
    res.render('user/edit-profile', { user });
  } catch (error) {
    next(error);
  }
};




const updateProfile = async (req, res, next) => {
  try {
    const userId = req.session?.userData?._id || req.user?._id;
    console.log('req body is ',req.body)
    const {
      userName,
      email,
      phone,
      otp,
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    
    if (userName && userName !== user.userName) {
      user.userName = userName;
    }

    
    if (email && email !== user.email) {
      if (!otp) {
        return res.status(400).json({
          success: false,
          error: "OTP required for email verification."
        });
      }

      const isOtpValid = req.session.userOtp === otp ? true : false;
      if (!isOtpValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired OTP. Please request a new one."
        });
      }




      user.email = email;
      
    }

    // Update phone number
    if (phone !== undefined) {
      if (phone === "") {
        user.phone = null;
      } else {
        user.phone = phone;
      }
    }

    // Handle password change
    if (currentPassword || newPassword || confirmPassword) {
      if (!user.password) {
        return res.status(400).json({
          success: false,
          error: "Password change not available for social login users."
        });
      }

      if (!(currentPassword && newPassword && confirmPassword)) {
        return res.status(400).json({
          success: false,
          error: "All password fields are required."
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: "Current password is incorrect."
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "New password and confirmation do not match."
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters long."
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    // Update session data if email was changed
    if (req.session?.userData && email) {
      req.session.userData.email = email;
    }

    res.json({
      success: true,
      message: "Profile updated successfully.",
      updatedFields: {
        userName: user.userName,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (error) {
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
      });
    }
    next(error);
  }
};



const sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        error: "This email is already registered."
      });
    }

    
    const otp = authController.generateOtp();

    
    const emailSent = await authController.sendVerificationEmail(email, otp)

    if (!emailSent) {
      return res.json({
        "success": false,
        "message": "Email error"
      }
      )
    }
    
    req.session.userOtp = otp;
    console.log(req.session.userOtp)
    // req.session.userData = {userName,email,password}
    req.session.otpEmail = email;

    return res.json({ success: true, message: "OTP sent successfully!" });

  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ success: false, message: "Failed to send OTP." });
  }
};





const addAddress = async (req, res) => {
  try {
    const userId = req.session?.userData?._id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized access" });
    }

    const { firstName, lastName, phoneNumber, street, city, state, postalCode, country, isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false }); 
    }

    const newAddress = new Address({
      userId,
      firstName,
      lastName,
      phoneNumber,
      street,
      city,
      state,
      postalCode,
      country,
      isDefault
    });

    await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: newAddress._id } }
    );

    await newAddress.save();
    res.json({ success: true, message: "Address added successfully" });

  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, error: "Server error, please try again." });
  }
};


const editAddress = async (req, res) => {
  try {

    const userId = req.session?.userData?._id || req.user?._id;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized access" });
    }

    const { firstName, lastName, phoneNumber, street, city, state, postalCode, country, isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false }); // Ensure only one primary address
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { firstName, lastName, phoneNumber, street, city, state, postalCode, country, isDefault },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({ success: false, error: "Address not found" });
    }

    res.json({ success: true, message: "Address updated successfully" });

  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ success: false, error: "Server error, please try again." });
  }
};


const getUserAddresses = async (req, res) => {
  try {

    const userId = req.session?.userData?._id || req.user?._id;
    console.log('userId is ',userId)
    const user = await User.findById({_id:userId});
    console.log('user is ',user)
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized access" });
    }

    const userAddresses = await Address.find({ userId }).sort({ isDefault: -1 });
    res.render("user/address", { userAddresses,user });

  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).send("Internal server error");
  }
};


const deleteAddress = async (req, res) => {
  try {

    const userId = req.session?.userData?._id || req.user?._id;
    const addressId = req.params.id;
    console.log(addressId)

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized access" });
    }

    const address = await Address.findOneAndDelete({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({ success: false, error: "Address not found" });
    }

    res.json({ success: true, message: "Address deleted successfully" });

  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ success: false, error: "Server error, please try again." });
  }
};


const setPrimaryAddress = async (req, res) => {
  try {

    const userId = req.session?.userData?._id || req.user?._id;
    const addressId = req.params.addressId;
    // console.log(addressId)
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized access" });
    }

    await Address.updateMany({ userId }, { isDefault: false });
    const address = await Address.findByIdAndUpdate(addressId, { isDefault: true });

    if(!address)return res.json({success:false, message:"cannot set primary address"})

    res.json({ success: true, error: "Primary address set successfully" });

  } catch (error) {
    console.error("Error setting primary address:", error);
    res.status(500).json({ success: false, error: "Server error, please try again." });
  }
};

const fetchAddress = async (req, res) => {
  try {
      const address = await Address.findById(req.params.addressId);
      if (!address) {
          return res.status(404).json({ error: "Address not found" });
      }
      res.json(address);
  } catch (error) {
      console.error("Error fetching address:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};


const getWalletDetails = async (req, res) => {
  try {
      const userId = req.session?.userData?._id || req.user?._id;
      const user = await User.findById(userId);
      if (!user) return res.redirect('/');

      let wallet = await Wallet.findOne({ userId }).populate('userId', 'firstName lastName email');
      if (!wallet) {
          wallet = new Wallet({ userId, balance: 0, transactions: [] });
          await wallet.save();
      }

      res.render("user/wallet-details", { user, wallet });
  } catch (error) {
      console.error("Error fetching wallet details:", error);
      res.status(500).send("Internal Server Error");
  }
};

const getCoupons = async (req, res) => {
  try {
      const userId = req.session?.userData?._id || req.user?._id;
      const user = await User.findById(userId);
      if (!user) return res.redirect('/auth/login');

      
      const globalCoupons = await Coupon.find({
          isActive: true,
          expiryDate: { $gte: new Date() },
          userId: null
      });
      console.log('global coupons', globalCoupons)
      
      const userCoupons = await Coupon.find({
          isActive: true,
          expiryDate: { $gte: new Date() },
          userId: userId 
      });

      res.render("user/coupon", { 
          user, 
          globalCoupons, 
          userCoupons 
      });
  } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).send("Internal Server Error");
  }
};

module.exports = { getDashboard, updateImage, getEditProfile, updateProfile, sendEmailOtp, addAddress, editAddress, getUserAddresses, deleteAddress, setPrimaryAddress, fetchAddress ,getWalletDetails, getCoupons};
