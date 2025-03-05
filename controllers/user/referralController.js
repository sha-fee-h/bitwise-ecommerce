const User = require('../../models/userSchema');
const Coupon = require('../../models/couponSchema');
const { v4: uuidv4 } = require('uuid');

const generateReferralCode = () => {
    return 'REF' + uuidv4().slice(0, 8).toUpperCase(); 
  };
  
  
  const createReferralCoupon = async (referrerId) => {
    const couponCode = 'COUPON' + uuidv4().slice(0, 8).toUpperCase();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  
    const coupon = new Coupon({
      code: couponCode,
      discount: 100, 
      expiryDate,
      usageLimit: 1, 
      usedCount: 0,
      minimumSpend: 500, 
      isActive: true,
      userId: referrerId
    });
  
    await coupon.save();
    return coupon;
  };

  const getReferralDetails = async (req, res) => {
    try {
      const userId = req.session?.userData?._id || req.user?._id;
      const user = await User.findById(userId).populate('redeemedUsers', 'userName email');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      const coupons = await Coupon.find({ userId, isActive: true });
      res.json({
        success: true,
        referralCode: user.referralCode,
        redeemedUsers: user.redeemedUsers,
        coupons,
      });
    } catch (error) {
      console.error('Error fetching referral details:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch referral details' });
    }
  };

  module.exports = {  getReferralDetails, createReferralCoupon,generateReferralCode };