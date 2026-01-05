// nextjs
import { type NextRequest, NextResponse } from "next/server";

// model
import homePageImgModel from "@/app/lib/models/homePageImgModel";

// cloudinary
import { deleteImg, validateToken } from "@/app/lib/utils";
import { v2 as cloudinary } from "cloudinary";

type Params = {
  id: string;
};

export const DELETE = async (
  _: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "image id is required" },
      { status: 401 }
    );
  }

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

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const result = await deleteImg([id]);

    if (result[0] === id) {
      await homePageImgModel.deleteOne({ public_id: id });

      return NextResponse.json({
        imgId: id,
      });
    }

    return NextResponse.json({ message: "image not found" }, { status: 404 });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "can't delete this image at the momment" },
      { status: 500 }
    );
  }
};
