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

    orderby: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
  },
  { timestamps: true }
);

export default models["Carts"] ?? model("Carts", cartSchema);
