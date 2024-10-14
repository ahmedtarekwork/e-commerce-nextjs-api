import { Schema } from "mongoose";

const schema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    image: {
      type: { public_id: String, secure_url: String },
      required: [true, "image is required"],
    },
    products: [{ type: Schema.Types.ObjectId, ref: "Products" }],
    productsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default schema;
