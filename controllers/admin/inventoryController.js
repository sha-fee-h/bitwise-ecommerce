const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')



const getInventoryManagement = async (req, res) => {
    try {
        const { page = 1, search = '', category = '', stock = '' } = req.query;
        const limit = 10; 
        let query = {};

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        if (category) {
            query.category = category;
        }
        if (stock === 'low') {
            query.stock = { $lt: 10, $gt: 0 };
        } else if (stock === 'out') {
            query.stock = 0;
        }

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find(query)
            .populate('category')
            .sort({ name: 1 }) // 
            .skip((page - 1) * limit)
            .limit(limit);

        const categories = await Category.find(); 

        res.render('admin/inventory-management', {
            products,
            categories,
            page: parseInt(page),
            totalPages,
            query: { search, category, stock }
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).send('Internal Server Error');
    }
};


const updateStock = async (req, res) => {
    try {
        const productId = req.params.productId;
        const { stockChange } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        
        const newStock = product.stock + stockChange;
        if (newStock < 0) {
            return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
        }

        
        const updateResult = await Product.updateOne(
            { _id: productId },
            { $set: { stock: newStock } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(500).json({ success: false, message: 'Failed to update stock' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getInventoryManagement,
    updateStock
};