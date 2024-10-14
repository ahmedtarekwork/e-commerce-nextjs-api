// nextjs
import { type NextRequest, NextResponse } from "next/server";

// models
import User from "@/app/lib/models/user";
import Product from "@/app/lib/models/product";

// utils
import { Types } from "mongoose";
import { validateToken } from "@/app/lib/utils";

type Params = {
  id: string;
};

export const GET = async (
  _: NextRequest,
  { params: { id /* user id */ } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "user id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth._id !== id && isAuth.role !== "admin") {
    return NextResponse.json(
      { message: "you don't have access to this data" },
      { status: 401 }
    );
  }

  try {
    const wishlist = await User.findById(id)
      .populate({
        path: "wishlist",
        populate: {
          path: "category brand",
          select: "name",
        },
      })
      .select("wishlist");

    if (!wishlist) {
      return NextResponse.json(
        { message: "user with given id not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(wishlist.wishlist);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: `something went wrong while fetching ${
          isAuth._id === id ? "your" : "user"
        } wishlist`,
      },
      { status: 500 }
    );
  }
};

export const POST = async (
  { json }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "user id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?._id !== id) {
    return NextResponse.json(
      { message: "you don't have access to this data" },
      { status: 401 }
    );
  }

  const body = await json();

  if (
    !("product" in body) ||
    typeof body?.product !== "string" ||
    !Types.ObjectId.isValid(body.product)
  ) {
    return NextResponse.json(
      { message: "please insert a valid product id" },
      { status: 400 }
    );
  }

  try {
    const productId = body.product;
    const isExist = await Product.exists({ _id: productId });

    if (!isExist) {
      return NextResponse.json(
        { message: "product with given id not found" },
        { status: 404 }
      );
    }

    const userWishlist = (await User.findById(id).select("wishlist")).wishlist;

    const newWishlist = await User.findByIdAndUpdate(
      id,
      {
        [`$${userWishlist.includes(productId) ? "pull" : "push"}`]: {
          wishlist: productId,
        },
      },
      { new: true }
    ).select("wishlist");

    return NextResponse.json(newWishlist.wishlist);
  } catch (err) {
    return NextResponse.json(
      { message: "something went wrong while updating your wishlist" },
      { status: 500 }
    );
  }
};

export const DELETE = async (
  _: NextRequest,
  {
    params: { id /* user id */ },
  }: {
    params: Params;
  }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "user id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth._id !== id) {
    return NextResponse.json(
      { message: "you can't modify other users wishlists" },
      { status: 403 }
    );
  }

  try {
    await User.updateOne({ _id: id }, { wishlist: [] });

    return NextResponse.json({
      message: "your wishlist deleted successfully",
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while reseting your wishlist" },
      { status: 500 }
    );
  }
};
