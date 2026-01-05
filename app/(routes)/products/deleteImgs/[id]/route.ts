// nextjs
import { type NextRequest, NextResponse } from "next/server";

// utils
import { deleteImg, validateToken } from "@/app/lib/utils";

// cloudinary
import Product from "@/app/lib/models/product";
import { v2 as cloudinary } from "cloudinary";

type Params = {
  id: string;
};

export const DELETE = async (
  { json }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "product id is required" },
      { status: 400 }
    );
  }

  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    if (isAuth?.role !== "admin") {
      return NextResponse.json(
        { message: "you don't have authorization to edit products" },
        { status: 401 }
      );
    }

    const imgsIDs = (await json())?.imgs;

    if (!imgsIDs.length) {
      return NextResponse.json(
        { message: "you must provide some images to delete" },
        { status: 400 }
      );
    }

    const imgsCount = await Product.findById(id).select("imgs");

    if (imgsIDs.length === imgsCount.imgs.length) {
      return NextResponse.json(
        { message: "product must have at least one image" },
        { status: 400 }
      );
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const results = await deleteImg(imgsIDs);

    const product = await Product.findByIdAndUpdate(id, {
      $pull: {
        imgs: {
          public_id: {
            $in: results,
          },
        },
      },
    }).populate({
      path: "category brand",
      select: "name",
    });

    return NextResponse.json({
      data: product,
      message: `deleted ${results.length} from ${imgsIDs.length} images successfully`,
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while deleteing product images" },
      { status: 500 }
    );
  }
};
