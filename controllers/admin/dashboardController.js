const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');


const getDashboardData = async (req, res) => {
    try {
        if (req.session.admin){
            let { filterType } = req.query;

        
        let startDate, endDate, groupByFormat;
        const now = new Date();
        switch (filterType) {
            case 'daily':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                endDate = new Date(now.setHours(23, 59, 59, 999));
                groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
                break;
            case 'weekly':
                startDate = new Date(now.setDate(now.getDate() - now.getDay())); 
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now.setDate(startDate.getDate() + 6)); 
                endDate.setHours(23, 59, 59, 999);
                groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                endDate.setHours(23, 59, 59, 999);
                groupByFormat = { $dateToString: { format: "%Y-%m", date: "$orderDate" } };
                break;
            default: 
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
                filterType = 'monthly';
        }

        
        const salesData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    paymentStatus: 'Paid', 
                    deliveryStatus: { $ne: 'Cancelled' } 
                }
            },
            {
                $group: {
                    _id: groupByFormat,
                    totalSales: { $sum: '$total' }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        
        const salesLabels = salesData.map(data => data._id);
        const salesValues = salesData.map(data => data.totalSales);

        
        const topProducts = await Order.aggregate([
            { $match: { paymentStatus: 'Paid', deliveryStatus: { $ne: 'Cancelled' } } },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.productId',
                    totalSold: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' }
        ]);

        
        const topCategories = await Order.aggregate([
            { $match: { paymentStatus: 'Paid', deliveryStatus: { $ne: 'Cancelled' } } },
            { $unwind: '$products' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product.category',
                    totalSold: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' }
        ]);

        
        const topBrands = await Order.aggregate([
            { $match: { paymentStatus: 'Paid', deliveryStatus: { $ne: 'Cancelled' } } },
            { $unwind: '$products' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product.brand',
                    totalSold: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        res.render('admin/dashboard', {
            filterType,
            salesLabels: JSON.stringify(salesLabels),
            salesValues: JSON.stringify(salesValues),
            topProducts,
            topCategories,
            topBrands
        });
        }
        
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).send('Internal Server Error');
    }
    
};


module.exports = { 
    getDashboardData 
};