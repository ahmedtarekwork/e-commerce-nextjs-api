import { model, models, Schema, Types } from "mongoose";

// models
import brandModel from "../category&brand/models/brandModel";
import categoryModel from "../category&brand/models/categoryModel";

const productSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "product title is required"],
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: "price is required",
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Categories",
      required: [true, "category is required"],
      validate: [
        (val: string) => {
          if (Types.ObjectId.isValid(val))
            return categoryModel.exists({ _id: val });
        },
        "this category not found",
      ],
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brands",
      required: [true, "brand is required"],
      validate: [
        (val: string) => {
          if (Types.ObjectId.isValid(val))
            return brandModel.exists({ _id: val });
        },
        "this brand not found",
      ],
    },
    quantity: {
      type: Number,
      min: 0,
      required: [true, "quantity is required"],
    },
    sold: {
      min: 0,
      type: Number,
      default: 0,
    },
    imgs: {
      type: [
        {
          secure_url: String,
          public_id: String,
          order: Number,
        },
      ],
      require: "must be at least one image for the product",
    },
    color: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: "description is required",
    },
    ratings: [
      {
        star: Number,
        comment: String,
        postedby: {
          type: Schema.Types.ObjectId,
          ref: "Users",
        },
      },
    ],
  },
  { timestamps: true }
);

export default models["Products"] || model("Products", productSchema);
