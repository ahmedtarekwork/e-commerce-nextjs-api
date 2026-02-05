// nextjs
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// utils
import { jwtVerify } from "jose";
import connectDb from "./db";

// models
import User from "./models/user";

// cloudinary
import { v2 as cloudinary } from "cloudinary";

export const extractProducts = (orderData: Record<string, unknown>) => {
  let removedProductsCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterd = (orderData.products as unknown[])?.filter((p: any) => {
    if (p.productId) return true;
    else {
      removedProductsCount += 1;
      return false;
    }
  });

  return {
    ...orderData,
    removedProductsCount,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: filterd.map(({ _doc: product }: any) => {
      const mainPrd =
        "_doc" in product.productId
          ? product.productId._doc
          : product.productId;

      const quantity = mainPrd.quantity;
      delete mainPrd.quantity;

      return {
        ...mainPrd,
        count: quantity,
        wantedQty: product.wantedQty,
      };
    }),
  };
};

export const validateToken = async () => {
  "use server";

  const token = cookies().get("ahmed-e-commerce-user-token");

  if (token?.value) {
    const { payload } = await jwtVerify(
      token.value,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    try {
      if (payload.id) {
        await connectDb();
        const user = await User.findById(payload.id).select("-__v -password");

        return { ...user._doc, _id: user._doc._id.toString() };
      }
    } catch (err) {
      console.log(err);

      return NextResponse.json(
        { message: "something went wrong while checking your authority" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: "you need to login first" });
};

export const uploadImg = async (
  img: File,
  public_id?: string,
  order?: number
) => {
  const arrayBuffer = await img.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  return new Promise((res, rej) => {
    const editData = {} as Partial<{ public_id: string; invalidate: boolean }>;

    if (public_id) {
      editData.public_id = public_id;
      editData.invalidate = true;
    }

    cloudinary.uploader
      .upload_stream(editData, (err, resault) => {
        if (err) {
          rej(err);
          return;
        }

        if (typeof order === "number" && !isNaN(order))
          res({ ...resault, order });
        else res(resault);
      })
      .end(buffer);
  });
};

export const deleteImg = async (public_id: string[]) => {
  const res = await cloudinary.api.delete_resources(public_id, {
    type: "upload",
    resource_type: "image",
  });

  return (
    Object.entries(res.deleted)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, value]) => value === "deleted")
      .map(([key]) => key)
  );
};
