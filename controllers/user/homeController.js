const User=require('../../models/userSchema')
const env = require('dotenv').config()
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const Products= require('../../models/productSchema')
const Category=require('../../models/categorySchema')



const getHome = async (req, res) => {
    try {
        const { search = "", page = 1 } = req.query;
        const limit = 12;
        const skip = (page - 1) * limit;
        const regex = new RegExp("^" + search, "i");

        const products = await Products.find({ status: "listed" }).sort({ updatedAt: -1 }).skip(skip).limit(limit);
        const categories = await Category.find({ status: "listed" });
        // console.log(categories)

        const totalProducts = await Products.countDocuments({ name: { $regex: search, $options: "i" } });
        const totalPages = Math.ceil(totalProducts / limit);

        const user= req.session.userData || req.user
        // const userLoggedIn = req.session.user ? true : false;
        // console.log('here is userdata' ,user.userName)
        res.render("user/home", { user ,products, currentPage: Number(page), totalPages ,categories});
    } catch (error) {
        console.error("Error from get Guest login page : \n", error);
    }
};

const pageNotFound=async (req,res)=>{
    try{
        res.render('admin/404')
    }catch(err){
        res.redirect('/pageNotFound')
    }
}

module.exports = {getHome, pageNotFound}