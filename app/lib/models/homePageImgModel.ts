import { Schema, model, models } from "mongoose";

const schema = new Schema({
  secure_url: {
    type: String,
    required: true,
  },
  public_id: { type: String, required: true },
});

export default models["HomepageSliderImgs"] ??
  model("HomepageSliderImgs", schema);
