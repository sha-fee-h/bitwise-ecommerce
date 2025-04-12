const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');
const { v4: uuidv4 } = require('uuid');
const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes');


const createCoupon = async (req, res) => {
  try {
    const { userId, discount, expiryDate, usageLimit, minimumSpend } = req.body;

    const discountNum = Number(discount);
    const minimumSpendNum = Number(minimumSpend)

    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: MESSAGES.NOT_FOUND('User') });
      }
    }
    if (minimumSpendNum < discountNum) {
      console.log(`minimumSpendNum: ${minimumSpendNum} (${typeof minimumSpendNum}), discountNum: ${discountNum} (${typeof discountNum})`);
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.COUPON_MIN_SPEND,
      });
    }

    const couponCode = 'COUPON' + uuidv4().slice(0, 8).toUpperCase();

    const coupon = new Coupon({
      code: couponCode,
      userId: userId || null,
      discount: discountNum, 
      expiryDate,
      usageLimit: usageLimit || undefined,
      minimumSpend: minimumSpendNum, 
    });

    await coupon.save();
    res.status(STATUS_CODES.CREATED).json({ success: true, message: MESSAGES.ADD_SUCCESS('Coupon'), coupon });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: MESSAGES.ADD_FAILED('Coupon') });
  }
};


const getAllCoupons = async (req, res) => {
  try {
      
      const page = parseInt(req.query.page) || 1; 
      const limit = parseInt(req.query.limit) || 5; 
      const skip = (page - 1) * limit;

      
      const totalCoupons = await Coupon.countDocuments();

      
      const totalPages = Math.ceil(totalCoupons / limit);

      
      const coupons = await Coupon.find()
          .populate('userId', 'userName') 
          .sort({ createdAt: -1 }) 
          .skip(skip)
          .limit(limit);

      res.json({
          success: true,
          coupons,
          currentPage: page,
          totalPages,
          limit,
          totalCoupons
      });
  } catch (error) {
      console.error('Error fetching coupons:', error);
      res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: MESSAGES.COUPON_FETCH_FAILED });
  }
};


const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: MESSAGES.NOT_FOUND('Coupon') });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    const action = coupon.isActive ? 'listed' : 'unlisted';
    res.json({ success: true, message: `Coupon ${action} successfully`, coupon });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: MESSAGES.COUPON_TOGGLE_FAILED });
  }
};

const renderCouponManagement = async (req, res) => {
  try {
    const users = await User.find({}, 'userName email');
    res.render('admin/couponManagement', { users });
  } catch (error) {
    console.error('Error rendering coupon management:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};

module.exports = { createCoupon, getAllCoupons, toggleCouponStatus, renderCouponManagement };