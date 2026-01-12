// nextjs
import { type NextRequest, NextResponse } from "next/server";

// models
import brandModel from "@/app/lib/category&brand/models/brandModel";
import categoryModel from "@/app/lib/category&brand/models/categoryModel";
import Product from "../../../lib/models/product";

// utils
import connectDb from "@/app/lib/db";
import { deleteImg, uploadImg, validateToken } from "@/app/lib/utils";
import { Types } from "mongoose";

// cloudinary
import { v2 as cloudinary } from "cloudinary";

type Params = {
  id: string;
};

export const GET = async (
  _: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "product id is required" },
      { status: 400 }
    );
  }

  await connectDb();

  try {
    const product = await Product.findById(id).populate({
      path: "category brand",
      select: "name",
    });

    if (!product) {
      return NextResponse.json(
        { message: "product with given id not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (err) {
    return NextResponse.json(
      { message: "something went wrong while fetching the product" },
      { status: 500 }
    );
  }
};

export const PATCH = async (
  { formData }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "product id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role !== "admin") {
    return NextResponse.json(
      { message: "you don't have authorization to edit products" },
      { status: 401 }
    );
  }

  try {
    const isProductExists = await Product.exists({ _id: id });

    if (!isProductExists) {
      return NextResponse.json(
        { message: "product not found" },
        { status: 404 }
      );
    }

    const newData = await formData();

    if (!Object.keys(Object.fromEntries(newData.entries())).length) {
      return NextResponse.json(
        { message: "you must provide new data" },
        { status: 400 }
      );
    }

    const imgs = newData.getAll("imgs[]") as File[];
    const title = newData.get("title") as string;
    const price = newData.get("price") as string;
    const brand = newData.get("brand") as string;
    const color = newData.get("color") as string;
    const category = newData.get("category") as string;
    const quantity = newData.get("quantity") as string;
    const sold = newData.get("sold") as string;
    const description = newData.get("description") as string;

    const numbersValues = (key: string, value: FormDataEntryValue | null) => {
      if (!["null", "undefined"].includes(typeof value)) {
        if (isNaN(+value!)) {
          return NextResponse.json(
            { message: `${key} must be a nubmer` },
            { status: 400 }
          );
        }

        if ((value as unknown as number) < 0) {
          return NextResponse.json(
            { message: `${key} mustn't be less than zero` },
            { status: 400 }
          );
        }
      }
    };

    const reason = [
      numbersValues("sold", sold),
      numbersValues("price", price),
    ].find((reason) => reason);

    if (reason) return reason;

    const promises = [];

    if (category) {
      if (!Types.ObjectId.isValid(category)) {
        return NextResponse.json(
          { message: "category id is invalid" },
          { status: 400 }
        );
      }

      promises.push(categoryModel.exists({ _id: category }));
    } else promises.push([]);

    if (brand) {
      if (!Types.ObjectId.isValid(brand)) {
        return NextResponse.json(
          { message: "brand not found" },
          { status: 404 }
        );
      }

      promises.push(brandModel.exists({ _id: brand }));
    } else promises.push([]);

    if (title) {
      promises.push(Product.exists({ title: title }));
    } else promises.push([]);

    const [promise_category, promise_brand, promise_title] =
      await Promise.allSettled(promises);

    const categoryOrBrandError = (
      type: "category" | "brand",
      model: typeof promise_category | typeof promise_brand | []
    ) => {
      if (Array.isArray(model)) return;

      if (model?.status === "rejected") {
        return NextResponse.json(
          { message: "something went wrong while updating product info" },
          { status: 500 }
        );
      }

      if (model?.status === "fulfilled" && !model.value) {
        return NextResponse.json(
          { message: `${type} not found` },
          { status: 404 }
        );
      }
    };
    const brandErr = categoryOrBrandError("brand", promise_brand);
    const categoryErr = categoryOrBrandError("category", promise_category);

    if (brandErr || categoryErr) return brandErr || categoryErr;

    if (promise_title.status === "rejected") {
      return NextResponse.json(
        { message: "something went wrong while updating product info" },
        { status: 500 }
      );
    }

    if (
      !Array.isArray(promise_title.value) &&
      promise_title.status === "fulfilled" &&
      promise_title.value
    ) {
      return NextResponse.json(
        { message: "title is already taken" },
        { status: 409 }
      );
    }

    let finalProductData = {
      title,
      price: +price,
      brand,
      color,
      category,
      sold: +sold,
      description,
    } as Record<string, unknown>;

    if (typeof +quantity === "number" && !isNaN(+quantity)) {
      finalProductData.$inc = { quantity: +quantity };
    }

    finalProductData = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(finalProductData).filter(([_key, value]) => value)
    );

    const imgsPromises: Promise<unknown>[] = [];

    if (imgs?.length) {
      const oldImgs = imgs.filter((img) => typeof img === "string");
      const newImgs = imgs.filter((img) => img instanceof File);

      if (newImgs.length) {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const results = await Promise.allSettled(
          imgs
            .map(
              (img, i) => img instanceof File && uploadImg(img, undefined, i)
            )
            .filter(Boolean)
        );

        const finalImgs = results.map((imgData) => {
          if (imgData.status === "fulfilled") {
            return Object.fromEntries(
              Object.entries(imgData.value as Record<string, unknown>).filter(
                ([key]) => ["public_id", "secure_url", "order"].includes(key)
              )
            );
          }
        });

        finalProductData["$push"] = { imgs: finalImgs };
      }

      if (oldImgs.length) {
        const productImgs = (await Product.findById(id).select("imgs"))?.imgs;

        imgs.forEach((img, i) => {
          if (typeof img === "string") {
            if (
              productImgs.find((img: { public_id: string }) => img.public_id)
                ?.order !== i
            ) {
              imgsPromises.push(
                Product.updateOne(
                  { _id: id, "imgs.public_id": img },
                  {
                    $set: {
                      "imgs.$.order": i,
                    },
                  }
                )
              );
            }
          }
        });
      }
    }

    const product = await Product.findByIdAndUpdate(id, finalProductData, {
      new: true,
    }).populate({
      path: "category brand",
      select: "name",
    });

    if (!product) {
      return NextResponse.json(
        { message: "product with given id not found" },
        { status: 404 }
      );
    }

    const categoryAndBrandPromises = [];

    if (category) {
      categoryAndBrandPromises.push(
        categoryModel.findByIdAndUpdate(category, {
          $push: {
            products: id,
          },
        })
      );
    }
    if (brand) {
      categoryAndBrandPromises.push(
        brandModel.findByIdAndUpdate(brand, {
          $push: {
            products: id,
          },
        })
      );
    }

    await Promise.allSettled([...categoryAndBrandPromises, ...imgsPromises]);

    return NextResponse.json(product);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while updating the product" },
      { status: 500 }
    );
  }
};

export const DELETE = async (
  _: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "product id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role !== "admin") {
    return NextResponse.json(
      { message: "you don't have authorization to edit products" },
      { status: 401 }
    );
  }

  try {
    const product = await Product.findByIdAndDelete({ _id: id });

    if (!product) {
      return NextResponse.json(
        { message: "product with given id not found" },
        { status: 404 }
      );
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const imgsIDs = (product.imgs as { public_id: string }[]).map(
      ({ public_id }) => public_id
    );
    await deleteImg(imgsIDs);

    return NextResponse.json({ message: "product deleted successfully" });
  } catch (err) {
    return NextResponse.json(
      { message: "something went wrong while deleting the product" },
      { status: 500 }
    );
  }
};
