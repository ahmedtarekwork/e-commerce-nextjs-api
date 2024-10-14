// nextjs
import { NextResponse } from "next/server";

// models
import Cart from "./models/cart";
import Order from "./models/order";
import Products from "./models/product";

// utils
import { extractProducts, validateToken } from "./utils";

const submitOrder = async (body: Record<string, unknown>, checkAuth = true) => {
  try {
    let userId = !checkAuth ? body.userId : "";

    if (checkAuth) {
      const isAuth = await validateToken();
      userId = isAuth._id;

      if (isAuth instanceof NextResponse) return isAuth;
    }

    const userCart = await Cart.findOne({ orderby: userId })
      .select("products")
      .populate({ path: "products.productId", select: "quantity price" });

    if (!userCart || !userCart.products.length) {
      return NextResponse.json(
        { message: "you don't have products in your cart" },
        { status: 404 }
      );
    }

    const orderData = {
      products: userCart.products
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((prd: any) => prd.productId.quantity)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((prd: any) => ({
          productId: prd.productId?._id,
          wantedQty: prd.wantedQty,
        })),
      orderby: userId,
      totalPrice: userCart.products
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((prd: any) => prd.wantedQty * prd.productId.price)
        .reduce((a: number, b: number) => a + b),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    if (
      "method" in body &&
      ["Cash on Delivery", "Card"].includes(body.method as string)
    ) {
      orderData.method = body.method;
    }

    if ("currency" in body) orderData.currency = body.currency;

    const createOrder = await Order.create(orderData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateProductsQTY = userCart.products.map((item: any) => {
      return {
        updateOne: {
          filter: { _id: item.productId._id },
          update: {
            $inc: { quantity: -item.wantedQty, sold: +item.wantedQty },
          },
        },
      };
    });

    const order = await createOrder.populate({
      path: "products.productId",
      populate: { path: "category brand", select: "name" },
    });

    if (!order) {
      return NextResponse.json(
        { message: "something went wrong while submiting the order" },
        { status: 500 }
      );
    }

    await Promise.allSettled([
      Cart.deleteOne({ orderby: userId }),
      Products.bulkWrite(updateProductsQTY),
    ]);

    return NextResponse.json(extractProducts(order._doc));
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "can't submit the order at the momment" },
      { status: 500 }
    );
  }
};

export default submitOrder;
