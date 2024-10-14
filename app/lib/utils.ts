// nextjs
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// utils
import connectDb from "./db";
import { jwtVerify } from "jose";

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
      return {
        ...product.productId._doc,
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

export const uploadImg = async (img: File, public_id?: string) => {
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

        res(resault);
      })
      .end(buffer);
  });
};

export const deleteImg = async (public_id: string) => {
  return new Promise((res, rej) => {
    cloudinary.uploader.destroy(public_id, (err, resault) => {
      if (err) {
        rej(err);
        return;
      }

      res({ ...resault, public_id });
    });
  });
};
