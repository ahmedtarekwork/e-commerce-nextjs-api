// nextjs
import { NextResponse } from "next/server";

// models
import Cart from "@/app/lib/models/cart";

// utiles
import { validateToken } from "@/app/lib/utils";

export const GET = async () => {
  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  try {
    const cart = await Cart.findOne({ orderby: isAuth._id }).select(
      "totalItemsLength",
    );

    if (!cart) {
      return NextResponse.json({ totalItemsLength: 0 });
    }

    return NextResponse.json(cart._doc);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: "something went wrong while getting your cart items count",
      },
      { status: 500 },
    );
  }
};
