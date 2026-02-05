/* eslint-disable @typescript-eslint/no-explicit-any */
// nextjs
import { NextRequest, NextResponse } from "next/server";

// models
import Order from "@/app/lib/models/order";
import User from "@/app/lib/models/user";

// utils
import { extractProducts, validateToken } from "@/app/lib/utils";

export const GET = async ({ nextUrl }: NextRequest) => {
  const withOrders = nextUrl.searchParams.get("withOrders") === "true";

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  try {
    if (isAuth?.role === "admin") {
      const promises = [User.find().select("-password -__V")];

      if (withOrders) promises.push(Order.find());

      const dataArr = await Promise.allSettled([
        User.find().select("-password -__V"),
        Order.find(),
      ]);

      if (dataArr.some((promise) => promise.status === "rejected")) {
        return NextResponse.json(
          { message: "something went wrong while fetching users" },
          { status: 500 }
        );
      }

      const users = (dataArr[0] as { value: any[] }).value || [];

      let finalResponseData = users.map(({ _doc: user }) => ({
        ...user,
        isAdmin: user.role === "admin",
        role: undefined,
      }));

      if (withOrders) {
        const orders = (dataArr[1] as { value: any[] }).value || [];

        finalResponseData = finalResponseData.map((user) => {
          const userOrders = orders.filter(
            ({ _doc: order }) =>
              user._id.toString() === order.orderby.toString()
          );

          return {
            ...user,
            orders: userOrders
              .map(({ _doc: order }) => ({
                ...order,
                ...extractProducts(order),
              }))
              .sort((order) => new Date(order.createdAt).getTime())
              .reverse(),
          };
        });
      }

      return NextResponse.json(finalResponseData);
    }

    return NextResponse.json(
      { message: "you don't have access to this data" },
      { status: 401 }
    );
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { message: "something went wrong while fetching the users" },
      { status: 500 }
    );
  }
};
