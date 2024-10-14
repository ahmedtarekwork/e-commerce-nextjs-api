import { model, models } from "mongoose";
import schema from "../category&brand_Shema";

export default models["Brands"] ?? model("Brands", schema);
