const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');
const { v4: uuidv4 } = require('uuid');
const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes');


const createCoupon = async (req, res) => {
  try {
    const { userId, discount, expiryDate, usageLimit, minimumSpend } = req.body;


    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: MESSAGES.NOT_FOUND('User') });
      }
    }


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
    res.status(STATUS_CODES.CREATED).json({ success: true, message: MESSAGES.ADD_SUCCESS('Coupon'), coupon });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: MESSAGES.ADD_FAILED('Coupon') });
  }
};


const getAllCoupons = async (req, res) => {
  try {
      // Pagination parameters from query
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 5; // Default to 5 coupons per page
      const skip = (page - 1) * limit;

      // Count total coupons for pagination
      const totalCoupons = await Coupon.countDocuments();

      // Calculate total pages
      const totalPages = Math.ceil(totalCoupons / limit);

      // Fetch paginated coupons, sorted by createdAt (newest first)
      const coupons = await Coupon.find()
          .populate('userId', 'userName') // Populate userId to get userName
          .sort({ createdAt: -1 }) // Sort by createdAt in descending order (newest first)
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