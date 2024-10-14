// nextjs
import { type NextRequest, NextResponse } from "next/server";

// utils
import { extractProducts, validateToken } from "@/app/lib/utils";
import submitOrder from "@/app/lib/submitOrder";

// models
import Order from "@/app/lib/models/order";

export const GET = async ({ nextUrl }: NextRequest) => {
  const allOrders = nextUrl.searchParams.get("allOrders");

  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    if (isAuth?.role !== "admin" && allOrders) {
      return NextResponse.json(
        { message: "you don't have access to this data" },
        { status: 401 }
      );
    }

    const filters = allOrders ? {} : { orderby: isAuth?._id };

    const orders = await Order.find(filters)
      .sort("-createdAt")
      .populate([
        {
          path: "products.productId",
          populate: {
            path: "category brand",
            select: "name",
          },
        },
        {
          path: "orderby",
          select: "username",
        },
      ]);

    if (!orders) {
      return NextResponse.json(
        { message: "no orders has been founded" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orders.map(({ _doc: order }: any) => extractProducts(order))
    );
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while fetching orders" },
      { status: 500 }
    );
  }
};

export const POST = async ({ json }: NextRequest) => {
  return await submitOrder(await json());
};
