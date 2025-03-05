const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');



const createProductOffer = async (req, res) => {
  try {
    const { productId, discountPercentage, startDate, endDate } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const offer = new Offer({
      type: 'Product',
      discountPercentage,
      productId,
      startDate,
      endDate,
    });

    await offer.save();
    res.status(201).json({ success: true, message: 'Product offer created', offer });
  } catch (error) {
    console.error('Error creating product offer:', error);
    res.status(500).json({ success: false, message: 'Failed to create offer' });
  }
};


const createCategoryOffer = async (req, res) => {
  try {
    const { categoryId, discountPercentage, startDate, endDate } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const offer = new Offer({
      type: 'Category',
      discountPercentage,
      categoryId,
      startDate,
      endDate,
    });

    await offer.save();
    res.status(201).json({ success: true, message: 'Category offer created', offer });
  } catch (error) {
    console.error('Error creating category offer:', error);
    res.status(500).json({ success: false, message: 'Failed to create offer' });
  }
};


const getProductOffer = async (productId) => {
  const currentDate = new Date();
  const offer = await Offer.findOne({
    type: 'Product',
    productId,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate },
    isActive: true,
  });
  return offer ? offer.discountPercentage : 0;
};


const getCategoryOffer = async (categoryId) => {
  const currentDate = new Date();
  const offer = await Offer.findOne({
    type: 'Category',
    categoryId,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate },
    isActive: true,
  });
  return offer ? offer.discountPercentage : 0;
};


const applyOffersToCart = async (cart) => {
  let offerDiscount = 0;
  const updatedProducts = await Promise.all(cart.products.map(async (item) => {
    const product = item.productId; 
    const productOffer = await getProductOffer(product._id);
    const categoryOffer = await getCategoryOffer(product.category);

    // Apply the largest offer
    const maxDiscount = Math.max(productOffer, categoryOffer);
    const discount = maxDiscount > 0 ? (product.price * item.quantity * maxDiscount) / 100 : 0;
    offerDiscount += discount;

    return {
      ...item._doc,
      offerDiscount: discount,
      discountedPrice: product.price - (product.price * maxDiscount) / 100,
      appliedOfferType: maxDiscount > 0 ? (productOffer > categoryOffer ? 'Product' : 'Category') : null,
    };
  }));

  return { updatedProducts, offerDiscount };
};

const getAllOffers = async (req, res) => {
    try {
      const offers = await Offer.find()
        .populate('productId', 'name') 
        .populate('categoryId', 'name'); 
      res.json({ success: true, offers });
    } catch (error) {
      console.error('Error fetching offers:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch offers' });
    }
  };

  const toggleOfferStatus = async (req, res) => {
    try {
      const { offerId } = req.params;
      const offer = await Offer.findById(offerId);
      if (!offer) {
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }
  
      offer.isActive = !offer.isActive; 
      await offer.save();
  
      const action = offer.isActive ? 'listed' : 'unlisted';
      res.json({ success: true, message: `Offer ${action} successfully`, offer });
    } catch (error) {
      console.error('Error toggling offer status:', error);
      res.status(500).json({ success: false, message: 'Failed to toggle offer status' });
    }
  };

  const renderOfferManagement = async (req, res) => {
    try {
      const products = await Product.find({ status: 'listed' }, 'name');
      const categories = await Category.find({ status: 'listed' }, 'name');
      res.render('admin/offerManagement', { products, categories });
    } catch (error) {
      console.error('Error rendering offer management:', error);
      res.status(500).send('Server Error');
    }
  };

module.exports = { createProductOffer, createCategoryOffer, applyOffersToCart ,getAllOffers, renderOfferManagement , toggleOfferStatus};