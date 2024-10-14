// nextjs
import { NextResponse, type NextRequest } from "next/server";

// models
import Cart from "@/app/lib/models/cart";
import Product from "@/app/lib/models/product";

// utiles
import { extractProducts, validateToken } from "@/app/lib/utils";
import { Types } from "mongoose";

type Params = { userId: string };

export const GET = async (
  _: NextRequest,
  { params: { userId } }: { params: Params }
) => {
  if (!userId) {
    return NextResponse.json(
      { message: "user id must be provided" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role !== "admin" && userId !== isAuth?._id) {
    return NextResponse.json(
      { message: "you don't have Authority to get this cart" },
      { status: 401 }
    );
  }

  try {
    const cart = await Cart.findOne({ orderby: userId }).populate({
      path: "products.productId",
      populate: {
        path: "category brand",
        select: "name",
      },
    });

    if (!cart) {
      return NextResponse.json({ orderby: userId, products: [] });
    }

    return NextResponse.json({
      ...cart._doc,
      products: extractProducts(cart._doc).products,
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: `something went wrong while fetching ${
          isAuth?._id !== userId ? "user" : "your"
        } cart`,
      },
      { status: 500 }
    );
  }
};

export const POST = async (
  { json }: NextRequest,
  { params: { userId } }: { params: Params }
) => {
  if (!userId) {
    return NextResponse.json(
      { message: "user id must be provided" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (userId !== isAuth?._id) {
    return NextResponse.json(
      { message: "you don't have Authority to modify this cart" },
      { status: 401 }
    );
  }

  try {
    const productData = await json();

    if ("productId" in productData) {
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
    } else {
      return NextResponse.json(
        { message: "product id must be provided" },
        { status: 400 }
      );
    }

    if (!("wantedQty" in productData)) {
      return NextResponse.json(
        { message: "quantity must be provided" },
        { status: 400 }
      );
    }

    const isCartExists = await Cart.findOne({ orderby: userId }).select(
      "products"
    );

    if (!isCartExists) {
      await Cart.create({
        orderby: userId,
        products: [productData],
      });

      const product = await Product.findById(productData.productId).populate({
        path: "category brand",
        select: "name",
      });

      return NextResponse.json({
        orderby: userId,
        products: [{ ...product._doc, wantedQty: productData.wantedQty }],
      });
    }

    const isProductExist = isCartExists.products.find(
      (product: { productId?: string }) =>
        product.productId?.toString() === productData.productId
    );

    if (isProductExist) {
      const cart = await Cart.findOneAndUpdate(
        { "products.productId": productData.productId },
        {
          $set: {
            "products.$.wantedQty":
              productData.wantedQty + isProductExist.wantedQty,
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
    }

    const cart = await Cart.findOneAndUpdate(
      { orderby: userId },
      { $push: { products: productData } },
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
      {
        message: "something went wrong while modifying your cart",
      },
      { status: 500 }
    );
  }
};
