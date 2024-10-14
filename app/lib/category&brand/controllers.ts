// nextjs
import { type NextRequest, NextResponse } from "next/server";

// models
import Brand from "@/app/lib/category&brand/models/brandModel";
import Category from "@/app/lib/category&brand/models/categoryModel";
import Product from "../models/product";

// utils
import connectDb from "@/app/lib/db";
import { deleteImg, uploadImg, validateToken } from "../utils";
import { Types } from "mongoose";

// cloudinary
import { v2 as cloudinary } from "cloudinary";

type Params = {
  id: string;
};

const isBrand = (pathname: string) => pathname.startsWith("/brands");

const Model = (pathname: string) => (isBrand(pathname) ? Brand : Category);

export const singleGet = async (
  { nextUrl: { pathname } }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  const modelName = isBrand(pathname) ? "brand" : "category";

  if (!id) {
    return NextResponse.json(
      { message: `${modelName} id is required` },
      { status: 400 }
    );
  }

  try {
    await connectDb();
    const model = await Model(pathname).findById(id);
    return NextResponse.json(model);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: `something went wrong while fetching the ${modelName}`,
      },
      { status: 500 }
    );
  }
};

export const GET = async ({
  nextUrl: { pathname, searchParams },
}: NextRequest) => {
  const limit =
    typeof searchParams.get("limit") === "string"
      ? +searchParams.get("limit")!
      : 0;

  try {
    await connectDb();
    const model = await Model(pathname).find().limit(limit);
    return NextResponse.json(model);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: `something went wrong while fetching ${
          isBrand(pathname) ? "brands" : "categories"
        }`,
      },
      { status: 500 }
    );
  }
};

export const POST = async ({
  formData,
  nextUrl: { pathname },
}: NextRequest) => {
  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role !== "admin") {
    return NextResponse.json(
      { message: "you don't have Authority to add new category" },
      { status: 401 }
    );
  }

  const mongooseModel = Model(pathname);
  const modelName = isBrand(pathname) ? "brand" : "category";

  try {
    const modelData = await formData();
    const name = modelData.get("name");
    const image = modelData.get("image");

    if (!name) {
      return NextResponse.json(
        { message: `${modelName} name is required` },
        { status: 400 }
      );
    }

    if (await mongooseModel.exists({ name })) {
      return NextResponse.json(
        { message: `this name is taken already for another ${modelName}` },
        { status: 409 }
      );
    }

    if (!image) {
      return NextResponse.json(
        { message: `${modelName} image is required` },
        { status: 400 }
      );
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const imgData = await uploadImg(image as File);

    const finalImgData = Object.fromEntries(
      Object.entries(imgData as Record<string, unknown>).filter(([key]) =>
        ["public_id", "secure_url"].includes(key)
      )
    );

    const model = await mongooseModel.create({ name, image: finalImgData });
    return NextResponse.json(model);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(err);

    if (err.code === 11000) {
      return NextResponse.json(
        {
          message: `${modelName} name is already taken`,
        },
        { status: 409 }
      );
    }

    const errorMsg = err.errors
      ? (Object.values(err.errors)[0] as { message: string })?.message || ""
      : "";

    return NextResponse.json(
      {
        message:
          errorMsg || `something went wrong while creating the ${modelName}`,
      },
      { status: 500 }
    );
  }
};

export const PATCH = async (
  { formData, nextUrl: { pathname } }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  const modelName = isBrand(pathname) ? "brand" : "category";
  const mongooseModel = Model(pathname);

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role !== "admin") {
    return NextResponse.json(
      {
        message: `you don't have Authority to modify ${modelName} info`,
      },
      { status: 401 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { message: `${modelName} id is required` },
      { status: 400 }
    );
  }

  try {
    const modelData = await formData();
    const name = modelData.get("name");
    const image = modelData.get("image");
    const initialImagePublicId = modelData.get("initialImagePublicId");

    if (!name && !image) {
      return NextResponse.json(
        { message: "no new data has been provided to update" },
        { status: 400 }
      );
    }

    const finalData: Partial<{
      image: Record<"public_id" | "secure_url", string>;
      name: string;
    }> = {};

    if (name) {
      if (await mongooseModel.exists({ name })) {
        return NextResponse.json(
          { message: `this name is already taken for another ${modelName}` },
          { status: 409 }
        );
      }
      finalData.name = name as string;
    }
    if (image) {
      if (!initialImagePublicId) {
        return NextResponse.json(
          {
            message: "old image public_id is required to change it",
          },
          { status: 400 }
        );
      }

      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const imgData = await uploadImg(
        image as File,
        initialImagePublicId as string
      ); // replace old image with new one

      finalData.image = Object.fromEntries(
        Object.entries(imgData as Record<string, unknown>).filter(([key]) =>
          ["public_id", "secure_url"].includes(key)
        )
      ) as (typeof finalData)["image"];
    }

    const model = await mongooseModel.findByIdAndUpdate(id, finalData, {
      new: true,
    });

    if (!model) {
      return NextResponse.json(
        { message: `${modelName} with given id not found` },
        { status: 406 }
      );
    }

    return NextResponse.json(model);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: `something went wrong while updating the ${modelName}`,
      },
      { status: 500 }
    );
  }
};

export const DELETE = async (
  { nextUrl: { pathname } }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  const modelName = isBrand(pathname) ? "brand" : "category";

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role !== "admin") {
    return NextResponse.json(
      {
        message: `you don't have authority to modify ${
          isBrand(pathname) ? "brands" : "categories"
        } info`,
      },
      { status: 401 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { message: `${modelName} id is required` },
      { status: 400 }
    );
  }

  try {
    const model = await Model(pathname)
      .findByIdAndDelete(id)
      .populate("products");

    if (!model) {
      return NextResponse.json(
        {
          message: `${modelName} with given id not found`,
        },

        { status: 404 }
      );
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const promises = [deleteImg(model.image.public_id)];

    if (model.products.length) {
      promises.push(
        Product.deleteMany({
          _id: {
            $in: model.products
              .filter(({ _id }: { _id: string }) => Types.ObjectId.isValid(_id))
              .map(({ _id }: { _id: string }) => _id),
          },
        })
      );

      const productsImgs = model.products
        .map((prd: { imgs: { public_id: string }[] }) =>
          prd.imgs.map((img) => img.public_id)
        )
        .flat(Infinity);

      promises.push(...productsImgs.map((img: string) => deleteImg(img)));
    }

    await Promise.allSettled(promises);

    return NextResponse.json({
      message: `${modelName} deleted successfully`,
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: `something went wrong while deleteing the ${modelName}`,
      },
      { status: 500 }
    );
  }
};
