const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require("../models/userSchema")
const env = require('dotenv').config();
const referralController = require('../controllers/user/referralController')

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://bitwise.shafeeh.shop/auth/google/callback"
},
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      // console.log('here')
      let user = await User.findOne({ googleId: profile.id });
      if (user) {
        // console.log('here also')
        // if(user.isBlocked)return done(null,false,{message:"Your Account has been blocked"})
        return done(null, user)
      } else {
        const newReferralCode = referralController.generateReferralCode();
        user = new User({
          userName: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          referralCode: newReferralCode
        });
        await user.save();
        return done(null, user)
      }

    } catch (error) {
      return done(error, null)
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id)
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (user.isBlocked) {
      return done(null, false);
    }

    const userData = user
    done(null, userData);
  } catch (error) {
    done(error, false);
  }
});
module.exports = passport