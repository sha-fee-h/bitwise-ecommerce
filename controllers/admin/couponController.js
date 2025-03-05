const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');
const { v4: uuidv4 } = require('uuid');



const createCoupon = async (req, res) => {
  try {
    const {  userId, discount, expiryDate, usageLimit, minimumSpend } = req.body;

    
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }

    
    // const existingCoupon = await Coupon.findOne({ code });
    // if (existingCoupon) {
    //   return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    // }
    const couponCode = 'COUPON' + uuidv4().slice(0, 8).toUpperCase();

    const coupon = new Coupon({
      code: couponCode,
      userId: userId || null, 
      discount,
      expiryDate,
      usageLimit: usageLimit || undefined, 
      minimumSpend: minimumSpend || 0, 
    });

    await coupon.save();
    res.status(201).json({ success: true, message: 'Coupon created successfully', coupon });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ success: false, message: 'Failed to create coupon' });
  }
};


const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().populate('userId', 'userName email');
    res.json({ success: true, coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};


const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    const action = coupon.isActive ? 'listed' : 'unlisted';
    res.json({ success: true, message: `Coupon ${action} successfully`, coupon });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle coupon status' });
  }
};

const renderCouponManagement = async (req, res) => {
    try {
      const users = await User.find({}, 'userName email'); 
      res.render('admin/couponManagement', { users });
    } catch (error) {
      console.error('Error rendering coupon management:', error);
      res.status(500).send('Server Error');
    }
  };

module.exports = { createCoupon, getAllCoupons, toggleCouponStatus , renderCouponManagement };