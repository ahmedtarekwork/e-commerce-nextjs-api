// nextjs
import { NextResponse, type NextRequest } from "next/server";

// utils
import { validateToken } from "@/app/lib/utils";

// models
import Cart from "@/app/lib/models/cart";

type Params = { userId: string };

export const DELETE = async (
  _: NextRequest,
  { params: { userId } }: { params: Params }
) => {
  try {
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

    await Cart.deleteOne({ orderby: userId });

    return NextResponse.json({
      message: "your cart has been cleared successfully",
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while clearing your cart" },
      { status: 500 }
    );
  }
};
