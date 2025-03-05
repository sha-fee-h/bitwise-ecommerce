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

        const user = req.session.userData || req.user

        res.render("user/product-detail", { user, product, relatedProducts });
    } catch (error) {
        console.error("Error from get product detail page : \n", error);
        res.redirect('/pageNotFound')
    }
};

const getProducts = async (req, res) => {
    try {

        const user = req.session.userData || req.user
        // const userLoggedIn = req.session.user ? true : false;

        let { search = "", category = "", minPrice = 0, maxPrice = 1000000, sort = "" } = req.query;


        const listedCategories = await Category.find({ status: "listed" }, "_id name");
        const listedCategoryIds = listedCategories.map(cat => cat._id);


        let filter = { status: "listed", category: { $in: listedCategoryIds } };


        if (search) {

            const matchingCategories = listedCategories.filter(cat =>
                cat.name.toLowerCase().includes(search.toLowerCase())
            );
            const categoryIds = matchingCategories.map(cat => cat._id);


            filter.$or = [
                { name: { $regex: search, $options: "i" } }, // Search by product name
                { category: { $in: categoryIds } } // Search by category name
            ];
        }


        if (category && listedCategoryIds.includes(category)) {
            filter.category = category;
        }


        filter.price = { $gte: Number(minPrice), $lte: Number(maxPrice) };


        let sortOptions = {};
        switch (sort) {
            case "priceLowHigh": sortOptions.price = 1; break;
            case "priceHighLow": sortOptions.price = -1; break;
            case "nameAZ": sortOptions.name = 1; break;
            case "nameZA": sortOptions.name = -1; break;
            case "newArrivals": sortOptions.createdAt = -1; break;
            default: sortOptions.createdAt = -1;
        }


        const products = await Products.find(filter).populate("category").sort(sortOptions);

        
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

        
        const enrichedProducts = products.map(product => {
            const productOfferDiscount = productOfferMap.get(product._id.toString()) || 0;
            const categoryOfferDiscount = categoryOfferMap.get(product.category._id.toString()) || 0;

            const bestDiscount = Math.max(productOfferDiscount, categoryOfferDiscount, product.discount);
            const discountAmount = bestDiscount > 0 ? (product.price * bestDiscount) / 100 : 0;

            product.bestOffer = bestDiscount > 0 ? { discountPercentage: bestDiscount, discountAmount } : null;
            return product;
        });

        const categories = await Category.find({ status: "listed" });

        res.render("user/product-list", { user, products: enrichedProducts, categories, search, category, minPrice, maxPrice, sort });

    } catch (error) {
        console.error("Error fetching products:", error);
        res.redirect("/error");
    }
};

module.exports = { getProducts, getProductDetail }