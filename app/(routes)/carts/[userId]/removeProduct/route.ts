// nextjs
import { type NextRequest, NextResponse } from "next/server";

// utils
import { extractProducts, validateToken } from "@/app/lib/utils";
import { Types } from "mongoose";

// models
import Product from "@/app/lib/models/product";
import Cart from "@/app/lib/models/cart";

type Params = { userId: string };

export const DELETE = async (
  { json }: NextRequest,
  { params: { userId } }: { params: Params }
) => {
  if (!userId) {
    return NextResponse.json(
      { message: "user id must be provided" },
      { status: 400 }
    );
  }

  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    if (isAuth?.role !== "admin" && userId !== isAuth?._id) {
      return NextResponse.json(
        { message: "you don't have Authority to get this cart" },
        { status: 401 }
      );
    }

    const isCartExists = await Cart.findOne({ orderby: userId }).select(
      "products"
    );

    if (!isCartExists) {
      return NextResponse.json(
        { message: "you don't have items in your cart to remove" },
        { status: 400 }
      );
    }

    const productData = await json();

    if (!("productId" in productData)) {
      return NextResponse.json(
        { message: "product id is required" },
        { status: 400 }
      );
    }

    if (!Types.ObjectId.isValid(productData.productId)) {
      return NextResponse.json(
        { message: "please insert a valid product id" },
        { status: 400 }
      );
    }

    try {
      const isProductExist = await Product.exists({
        _id: productData.productId,
      });

      if (!isProductExist) {
        return NextResponse.json(
          { message: "this product not found" },
          { status: 404 }
        );
      }
    } catch (err) {
      console.log(err);

      return NextResponse.json(
        { message: "something went wrong while modifying your cart" },
        { status: 500 }
      );
    }

    const isProductExist = isCartExists.products.some(
      (product: { productId?: string }) =>
        product.productId?.toString() === productData.productId
    );

    if (!isProductExist) {
      return NextResponse.json(
        { message: "this product not in your cart" },
        { status: 404 }
      );
    }

    if (isCartExists.products.length === 1 && isProductExist) {
      await Cart.deleteOne({ _id: isCartExists._id });
      return NextResponse.json({ orderby: userId, products: [] });
    }

    const cart = await Cart.findOneAndUpdate(
      { orderby: userId },
      {
        $pull: {
          products: { productId: productData.productId },
        },
      },
      { new: true }
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
      { message: "something went wronge while removeing product from cart" },
      { status: 500 }
    );
  }
};
