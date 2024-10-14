// nextjs
import { NextResponse, type NextRequest } from "next/server";

// utils
import { extractProducts, validateToken } from "@/app/lib/utils";
import { Types } from "mongoose";

// models
import Order from "@/app/lib/models/order";

type Params = { id: string };

export const GET = async (
  _: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "order id is required" },
      { status: 400 }
    );
  }

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { message: "order id is invalid" },
      { status: 400 }
    );
  }

  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    const order = await Order.findById(id).populate([
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

    if (!order) {
      return NextResponse.json(
        { message: "order with given id not found" },
        { status: 404 }
      );
    }

    if (isAuth?.role !== "admin" && isAuth?._id !== order.orderby._id) {
      return NextResponse.json(
        {
          message: "you don't have authority to access this order informations",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(extractProducts(order._doc));
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "can't get the order at the momment" },
      { status: 500 }
    );
  }
};

export const PATCH = async (
  { json }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "order id is required" },
      { status: 400 }
    );
  }

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { message: "please insert a valid order id" },
      { status: 400 }
    );
  }

  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    if (isAuth?.role !== "admin") {
      return NextResponse.json(
        { message: "you don't have authority to change this order status" },
        { status: 401 }
      );
    }

    const newStatus = (await json()).newStatus;
    if (!newStatus) {
      return NextResponse.json(
        { message: "new order status is required" },
        { status: 400 }
      );
    }

    if (
      !["Processing", "Dispatched", "Cancelled", "Delivered"].includes(
        newStatus
      )
    ) {
      return NextResponse.json(
        {
          message: `order status must be one of these types 
          ["Processing", "Dispatched", "Cancelled", "Delivered"]`,
        },
        { status: 400 }
      );
    }

    const editableOrder = await Order.findByIdAndUpdate(
      id,
      {
        orderStatus: newStatus,
      },
      { new: true }
    ).populate([
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

    if (!editableOrder) {
      return NextResponse.json(
        { message: "order with given id not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(extractProducts(editableOrder._doc));
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "can't change order status at the momment" },
      { status: 500 }
    );
  }
};
