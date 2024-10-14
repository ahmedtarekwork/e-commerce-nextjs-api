import { Schema, model, models } from "mongoose";

const orderSchema = new Schema(
  {
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Products",
        },
        wantedQty: {
          type: Number,
        },
      },
    ],
    method: {
      type: String,
      enum: ["Cash on Delivery", "Card"],
      default: "Cash on Delivery",
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    currency: { type: String, default: "USD" },
    orderStatus: {
      type: String,
      default: "Processing",
      enum: ["Processing", "Dispatched", "Cancelled", "Delivered"],
    },
    orderby: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
  },
  { timestamps: true }
);

export default models["Orders"] ?? model("Orders", orderSchema);
