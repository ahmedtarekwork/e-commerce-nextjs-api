// nextjs
import { NextResponse } from "next/server";

// utils
import { validateToken } from "@/app/lib/utils";

// models
import Product from "@/app/lib/models/product";
import User from "@/app/lib/models/user";
import Order from "@/app/lib/models/order";
import categoryModel from "@/app/lib/category&brand/models/categoryModel";
import brandModel from "@/app/lib/category&brand/models/brandModel";

export const GET = async () => {
  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    if (isAuth?.role !== "admin") {
      return NextResponse.json(
        {
          message: "you don't have Authority to put images in home page slider",
        },
        { status: 401 }
      );
    }

    const status = await Order.find().select("orderStatus");
    const availableStatus = [
      ...new Set(status.map(({ orderStatus }) => orderStatus)),
    ];
    const finalOrdersLength = {} as Record<string, unknown>;

    const getOrderSingleStatusCount = async (status: string) => {
      const count = await Order.countDocuments({
        orderStatus: status,
      });
      finalOrdersLength[status] = count;
    };

    const [
      // products
      promise_outOfStockCount,
      promise_inStockCount,
      promise_bestSell,

      // users
      promise_admins,
      promise_nonAdmins,

      // categories
      promise_allCategories,
      promise_mostProductsCategories,

      // brands
      promise_allBrands,
      promise_mostProductsBrands,
    ] = await Promise.allSettled([
      // products
      Product.countDocuments({ quantity: { $eq: 0 } }),
      Product.countDocuments({ quantity: { $gt: 0 } }),
      Product.find().limit(5).select("_id title sold").sort({ sold: -1 }),

      // users
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "user" }),

      // categories
      categoryModel.countDocuments(),
      categoryModel
        .find()
        .sort({ productsCount: 1 })
        .limit(10)
        .select("name productsCount"),

      // brands
      brandModel.countDocuments(),
      brandModel
        .find()
        .sort({ productsCount: 1 })
        .limit(10)
        .select("name productsCount"),

      // orders
      ...availableStatus.map((status) => getOrderSingleStatusCount(status)),
    ]);

    const {
      outOfStockCount,
      inStockCount,
      bestSell,
      admins,
      nonAdmins,
      allCategories,
      mostProductsCategories,
      allBrands,
      mostProductsBrands,
    } = ((): Record<
      | "outOfStockCount"
      | "inStockCount"
      | "bestSell"
      | "admins"
      | "nonAdmins"
      | "allCategories"
      | "mostProductsCategories"
      | "allBrands"
      | "mostProductsBrands",
      number | Record<string, unknown>
    > => {
      return Object.fromEntries(
        [
          { key: "outOfStockCount", val: promise_outOfStockCount },
          { key: "inStockCount", val: promise_inStockCount },
          { key: "bestSell", val: promise_bestSell },
          { key: "admins", val: promise_admins },
          { key: "nonAdmins", val: promise_nonAdmins },
          { key: "allCategories", val: promise_allCategories },
          {
            key: "mostProductsCategories",
            val: promise_mostProductsCategories,
          },
          { key: "allBrands", val: promise_allBrands },
          { key: "mostProductsBrands", val: promise_mostProductsBrands },
        ].map(({ key, val }) => {
          if (val.status === "fulfilled") {
            return [key, val.value];
          }

          return [key, "can't get this value at the momment"];
        })
      );
    })();

    return NextResponse.json({
      products: {
        all:
          ((outOfStockCount as number) || 0) + ((inStockCount as number) || 0),
        outOfStock: outOfStockCount,
        inStock: inStockCount,
        bestSell,
      },

      users: {
        insights: {
          admins,
          nonAdmins,
        },
        all: (admins as number) + (nonAdmins as number),
      },

      orders: {
        all: (Object.values(finalOrdersLength) as number[]).reduce(
          (a, b) => a + b,
          0
        ),
        insights: finalOrdersLength,
      },

      categories: {
        all: allCategories,
        insights: mostProductsCategories,
      },

      brands: {
        all: allBrands,
        insights: mostProductsBrands,
      },
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "can't get insights at the momment" },
      { status: 500 }
    );
  }
};
