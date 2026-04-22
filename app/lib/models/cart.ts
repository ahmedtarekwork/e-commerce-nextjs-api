import { Schema, model, models } from "mongoose";

const cartSchema = new Schema(
  {
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Products",
        },
        wantedQty: { type: Number },
      },
    ],

    totalItemsLength: { type: Number, default: 0 },

    orderby: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
  },
  { timestamps: true },
);

export default models["Carts"] ?? model("Carts", cartSchema);
