const User = require('../../models/userSchema')
const Products = require('../../models/productSchema')
const Category = require('../../models/categorySchema');
const Offer = require('../../models/offerSchema')


const getProductDetail = async (req, res) => {
    try {
        const productId = req.params.productId;
        console.log(productId)

        const product = await Products.findOne({ _id: productId }).populate("category");

        const currentDate = new Date();
        console.log('current date is ', currentDate)
        const startOfDay = new Date(currentDate.setUTCHours(0, 0, 0, 0));
        const endOfDay = new Date(currentDate.setUTCHours(23, 59, 59, 999));
        const productOffer = await Offer.findOne({
            type: 'Product',
            productId,
            startDate: { $lte: currentDate },
            endDate: { $gte: startOfDay },
            isActive: true,
        });
        const categoryOffer = await Offer.findOne({
            type: 'Category',
            categoryId: product.category._id,
            startDate: { $lte: currentDate },
            endDate: { $gte: startOfDay },
            isActive: true,
        });
        console.log(`product ${productOffer} and category offer is ${categoryOffer}   `)
        // Determine best offer
        const bestDiscount = Math.max(
            productOffer ? productOffer.discountPercentage : 0,
            categoryOffer ? categoryOffer.discountPercentage : 0,
        );
        console.log('best discount is', bestDiscount)

        const discountAmount = bestDiscount > 0 ? (product.price * bestDiscount) / 100 : 0;
        product.bestOffer = bestDiscount > 0 ? { discountPercentage: bestDiscount, discountAmount } : null;

        const relatedProducts = await Products.find({ category: product.category._id, _id: { $ne: productId } }).limit(5);

        const userId = req.session?.userData?._id || req.user?._id;
        const user = await User.findById(userId);

        res.render("user/product-detail", { user, product, relatedProducts ,cartCount:0, wishlistCount:0});
    } catch (error) {
        console.error("Error from get product detail page : \n", error);
        res.redirect('/pageNotFound')
    }
};

const getProducts = async (req, res) => {
  try {
    const userId = req.session?.userData?._id || req.user?._id;
    const user = await User.findById(userId);
      let {
          search = "",
          categories = [],
          brands = [],
          priceRange = "",
          sort = "",
          page = 1
      } = req.query;

      // Convert page to integer
      page = parseInt(page);
      const limit = 6; // Increased limit to match front-end (12 products per page)
      const skip = (page - 1) * limit;

      // Fetch listed categories
      const listedCategories = await Category.find({ status: "listed" }, "_id name");
      const listedCategoryIds = listedCategories.map(cat => cat._id);

      // Build the filter query
      let filter = { status: "listed" };

      // Search filter (for product name and category name)
      if (search) {
          const matchingCategories = listedCategories.filter(cat =>
              cat.name.toLowerCase().includes(search.toLowerCase())
          );
          const categoryIds = matchingCategories.map(cat => cat._id);
          filter.$or = [
              { name: { $regex: search, $options: "i" } },
              { category: { $in: categoryIds } }
          ];
      }

      // Category filter
      const selectedCategories = Array.isArray(categories) ? categories : categories ? [categories] : [];
      if (selectedCategories.length > 0) {
          filter.category = { $in: selectedCategories };
      } else {
          // Ensure only listed categories are shown if no specific category is selected
          filter.category = { $in: listedCategoryIds };
      }

      // Brand filter (assuming products have a brand field)
      const selectedBrands = Array.isArray(brands) ? brands : brands ? [brands] : [];
      if (selectedBrands.length > 0) {
          filter.brand = { $in: selectedBrands };
      }

      // Price range filter
      if (priceRange) {
          const [min, max] = priceRange.split('-');
          if (max) {
              filter.price = { $gte: parseInt(min), $lte: parseInt(max) };
          } else if (priceRange === '0-30000') {
              filter.price = { $lte: 30000 };
          } else if (priceRange === '70000-') {
              filter.price = { $gte: 70000 };
          }
      }

      // Sorting options
      let sortOptions = {};
      switch (sort) {
          case "priceLowHigh":
              sortOptions.price = 1;
              break;
          case "priceHighLow":
              sortOptions.price = -1;
              break;
          case "nameAZ":
              sortOptions.name = 1;
              break;
          case "nameZA":
              sortOptions.name = -1;
              break;
          case "newArrivals":
              sortOptions.createdAt = -1;
              break;
          default:
              sortOptions.createdAt = -1;
      }

      // Fetch total products and paginate
      const totalProducts = await Products.countDocuments(filter);
      const totalPages = Math.ceil(totalProducts / limit);

      const products = await Products.find(filter)
          .populate("category")
          .sort(sortOptions)
          .skip(skip)
          .limit(limit);

      // Fetch active offers
      const currentDate = new Date();
      const startOfDay = new Date(currentDate.setUTCHours(0, 0, 0, 0));

      const activeOffers = await Offer.find({
          startDate: { $lte: currentDate },
          endDate: { $gte: startOfDay },
          isActive: true,
      });

      const productOfferMap = new Map();
      const categoryOfferMap = new Map();

      activeOffers.forEach(offer => {
          if (offer.type === 'Product') {
              productOfferMap.set(offer.productId.toString(), offer.discountPercentage);
          } else if (offer.type === 'Category') {
              categoryOfferMap.set(offer.categoryId.toString(), offer.discountPercentage);
          }
      });

      // Enrich products with best offer
      const enrichedProducts = products.map(product => {
          const productOfferDiscount = productOfferMap.get(product._id.toString()) || 0;
          const categoryOfferDiscount = categoryOfferMap.get(product.category._id.toString()) || 0;
          const bestDiscount = Math.max(productOfferDiscount, categoryOfferDiscount, product.discount || 0);
          const discountAmount = bestDiscount > 0 ? (product.price * bestDiscount) / 100 : 0;
          product.bestOffer = bestDiscount > 0 ? { discountPercentage: bestDiscount, discountAmount } : null;
          return product;
      });

      // Fetch categories and brands for filters
      const categoriesList = await Category.find({ status: "listed" });
      const brandsList = [...new Set(await Products.distinct('brand', { status: "listed" }))]; // Assumes a brand field

      // Fetch cart and wishlist counts (if user is logged in)
      
      

      // Render the shop page
      res.render("user/shop", {
          user,
          products: enrichedProducts,
          categories: categoriesList,
          brands: brandsList,
          search,
          selectedCategories,
          selectedBrands,
          priceRange,
          sort,
          pagination: {
              currentPage: page,
              totalPages,
              totalProducts,
              hasNext: page < totalPages,
              hasPrevious: page > 1
          },
          cartCount:0,
          wishlistCount:0
      });

  } catch (error) {
      console.error("Error fetching products:", error);
      res.redirect("/error");
  }
};

module.exports = { getProducts, getProductDetail }