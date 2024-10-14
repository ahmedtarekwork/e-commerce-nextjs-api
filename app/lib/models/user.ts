import { Schema, model, models } from "mongoose";
import { isEmail } from "validator";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "email is required"],
      unique: true,
      validate: [
        (val: string) => {
          return isEmail(val);
        },
        "please insert a valid email",
      ],
    },

    username: {
      type: String,
      required: [true, "username is required"],
      unique: true,
    },

    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Products",
      },
    ],

    password: { type: String, required: [true, "password is required"] },
    address: { type: String },
    role: { type: String, default: "user" },
    donationPlan: { type: String },
    donationId: { type: String },
  },
  { timestamps: true }
);

export default models?.["Users"] || model("Users", userSchema);
