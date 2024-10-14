import { model, models } from "mongoose";
import schema from "../category&brand_Shema";

export default models["Categories"] ?? model("Categories", schema);
