// nextjs
import { type NextRequest, NextResponse } from "next/server";

// model
import homePageImgModel from "@/app/lib/models/homePageImgModel";

// cloudinary
import { v2 as cloudinary } from "cloudinary";

// utils
import connectDb from "@/app/lib/db";
import { uploadImg, validateToken } from "@/app/lib/utils";

export const GET = async () => {
  try {
    await connectDb();
    const imgs = await homePageImgModel.find();
    return NextResponse.json(imgs);
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { message: "can't get home page slider images at the momment" },
      { status: 500 }
    );
  }
};

export const POST = async ({ formData }: NextRequest) => {
  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    if (isAuth?.role !== "admin") {
      return NextResponse.json(
        {
          message: "you don't have Authority to put images in home page slider",
        },
        { status: 401 }
      );
    }

    const theFormData = await formData();
    const images = theFormData.getAll("images[]");

    if (!images?.length) {
      return NextResponse.json(
        { message: "you must send at least one image" },
        { status: 401 }
      );
    }

    if ((images as File[])?.some((img) => !img.type.startsWith("image"))) {
      return NextResponse.json(
        { message: "must be provide an images only" },
        { status: 401 }
      );
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const results = await Promise.allSettled(
      (images as File[]).map((img) => uploadImg(img))
    );

    const successCount = results.filter(({ status }) => status === "fulfilled");

    const finalData = results.map((imgData) => {
      if (imgData.status === "fulfilled") {
        return Object.fromEntries(
          Object.entries(imgData.value as Record<string, unknown>).filter(
            ([key]) => ["public_id", "secure_url"].includes(key)
          )
        );
      }
    });

    await homePageImgModel.insertMany(finalData);

    if (successCount.length !== results.length) {
      return NextResponse.json({
        message: `uploaded ${successCount.length} from ${results.length} images successfully`,
        images: finalData,
      });
    }

    return NextResponse.json({ images: finalData });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { message: "can't put new images in home page slider at the momment" },
      { status: 500 }
    );
  }
};
