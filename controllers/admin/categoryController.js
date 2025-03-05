const Category = require('../../models/categorySchema')



const categoryInfo = async (req, res) => {
    try {

        
        let search = req.query.search ? req.query.search.trim().toLowerCase() : "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({
            name: { $regex: search, $options: "i" },
            status:"listed" //only show listed categories
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        const totalCategories = await Category.countDocuments({status:"listed"});
        const totalPages = Math.ceil(totalCategories / limit)
        res.render('admin/category', {
            category: categoryData,
            currentPage: page,
            totalPages: totalPages,
            error_msg: null,
            success_msg: null,
            search: search


        })
    } catch (error) {
        console.log("Error loading category management page:", error);
        res.redirect("/admin/pageerror");
    }
}



const addCategory = async (req, res) => {
    try {
        let { name, description } = req.body;
        name = name.trim().toLowerCase(); 

        
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            req.flash("error", "Category already exists!");
            return res.redirect("/admin/category-management");
        }

        
        const newCategory = new Category({ name, description });
        await newCategory.save();

        req.flash("success", "Category added successfully!");
        res.redirect("/admin/category-management");
    } catch (error) {
        console.error("Error adding category:", error);
        req.flash("error", "Failed to add category.");
        res.redirect("/admin/category-management");
    }

}


const editCategory = async (req, res) => {
    try {
        const { id, name, description } = req.body;

        
        const categoryName = name.trim().toLowerCase();

        
        const existingCategory = await Category.findOne({ name: categoryName, _id: { $ne: id } });
        if (existingCategory) {
            req.flash("error", "Category name already exists!");
            return res.redirect("/admin/category-management");
        }

        
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description },
            { new: true } 
        );

        if (!updatedCategory) {
            req.flash("error", "Category not found.");
            return res.redirect("/admin/category-management");
        }

        req.flash("success", "Category updated successfully!");
        res.redirect("/admin/category-management");
    } catch (error) {
        console.error("Error updating category:", error);
        req.flash("error", "Failed to update category.");
        res.redirect("/admin/category-management");
    }
};

const listCategory = async (req, res) => {
    try {
        const { status } = req.body;
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!category) {

            req.flash("error", "Category not found!");

            return res.status(404).json({ success: false, message: "Category not found" });

        }
        req.flash("success", "Category unlisted successfully!");
        
        res.status(200).json({ success: true, newStatus: category.status });
    } catch (error) {
        console.error("Error updating category status:", error);
        req.flash("error", "Error listing category");
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};







module.exports = { categoryInfo, addCategory ,editCategory , listCategory}