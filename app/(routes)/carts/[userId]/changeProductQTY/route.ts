// nextjs
import { NextResponse, type NextRequest } from "next/server";

// models
import Cart from "@/app/lib/models/cart";
import Product from "@/app/lib/models/product";

// utiles
import { extractProducts, validateToken } from "@/app/lib/utils";
import { Types } from "mongoose";

type Params = { userId: string };

const validateCartModification = (
  productData: Record<"productId" | "newWantedQTY" | "oldQTY", string>,
) => {
  return ["productId", "newWantedQTY", "oldQTY"]
    .map((key) => {
      if (!productData[key as keyof typeof productData]) {
        return NextResponse.json(
          { message: `${key} must be provided` },
          { status: 400 },
        );
      }
    })
    .filter(Boolean)[0];
};

export const PATCH = async (
  { json }: NextRequest,
  { params: { userId } }: { params: Params },
) => {
  if (!userId) {
    return NextResponse.json(
      { message: "user id must be provided" },
      { status: 400 },
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (userId !== isAuth?._id) {
    return NextResponse.json(
      { message: "you don't have Authority to modify this cart" },
      { status: 401 },
    );
  }

  try {
    const productData = await json();

    const error = validateCartModification(productData);
    if (error instanceof NextResponse) return error;

    if (!Types.ObjectId.isValid(productData.productId)) {
      return NextResponse.json(
        { message: "please insert a valid product id" },
        { status: 400 },
      );
    }

    try {
      const isProductExist = await Product.exists({
        _id: productData.productId,
      });

      if (!isProductExist) {
        return NextResponse.json(
          { message: "this product not found" },
          { status: 404 },
        );
      }
    } catch (err) {
      console.log(err);

      return NextResponse.json(
        { message: "something went wrong while modifying your cart" },
        { status: 500 },
      );
    }

    const isCartExists = await Cart.findOne({ orderby: userId }).select(
      "products",
    );

    if (!isCartExists) {
      return NextResponse.json(
        { message: "you don't have items in your cart" },
        { status: 404 },
      );
    }

    const isProductExist = isCartExists.products.find(
      (product: { productId?: string }) =>
        product.productId?.toString() === productData.productId,
    );

    if (!isProductExist) {
      return NextResponse.json(
        { message: "this product isn't in your cart" },
        { status: 404 },
      );
    }

    const cart = await Cart.findOneAndUpdate(
      { "products.productId": productData.productId },
      {
        $set: {
          "products.$.wantedQty": productData.newWantedQTY,
        },
        $inc: {
          totalItemsLength: productData.newWantedQTY - productData.oldQTY,
        },
      },
      { new: true },
    ).populate({
      path: "products.productId",
      populate: {
        path: "category brand",
        select: "name",
      },
    });

    return NextResponse.json({
      ...cart._doc,
      products: extractProducts(cart._doc).products,
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: "something went wrong while modifying your cart",
      },
      { status: 500 },
    );
  }
};
