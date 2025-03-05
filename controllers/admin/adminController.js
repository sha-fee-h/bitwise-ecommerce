const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const loadLogin = (req,res)=>{

    if(req.session.admin){
        return res.redirect('admin/dashboard');
    }
    res.render('admin/login',{'error_msg':null});
}

const login = async (req,res)=>{
    try{

        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true});
        // console.log(admin)
        // console.log(password)
        // console.log(email)

        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin = true;
                return res.redirect('/admin/dashboard');
            }else{
                return res.render('admin/login',{'error_msg':'Incorrect Password'})
            }

        }else {
            return res.render('admin/login',{'error_msg':'Invalid Email'})
        }
        

    }catch(error){
        console.log("login error",error)
        return res.redirect('admin/pageerror')
    }
}

// const loadDashboard = async (req,res)=>{
//     if(req.session.admin){
//         try{
//             res.render('admin/dashboard',{search:null});
//         }catch(error){
//             res.redirect('admin/pageerror')
//         }
//     }
// }

const pageerror = async (req,res)=>{
    res.render('admin/pageerror')
}

const logout = async (req,res)=>{
    try{

        req.session.destroy(err=>{
            if(err){
                console.log('Error destroying session',err);
                return res.redirect('/admin/pageerror');
            }
            res.redirect('/admin/login');
        })

    }catch(error){

        console.log('unexpected error during logout',error);
        res.redirect('admin/pageerror')

    }
}

module.exports = {loadLogin, login,  pageerror ,logout}