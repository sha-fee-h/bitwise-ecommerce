const mongoose = require("mongoose");
const { Schema } = mongoose;
const offerSchema = new Schema({
    type: {
      type: String,
      enum: ['Product', 'Category'],
      required: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: function() { return this.type === 'Product'; },
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: function() { return this.type === 'Category'; },
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  }, { timestamps: true });

const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;