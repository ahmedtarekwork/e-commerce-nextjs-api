// nextjs
import { NextResponse } from "next/server";

// controllers
import { POST as makePayment } from "../../../lib/makePayment";

// models
import User from "@/app/lib/models/user";

// stripe
import Stripe from "stripe";

// utils
import { validateToken } from "@/app/lib/utils";

export const POST = makePayment;

export const PATCH = makePayment;

export const DELETE = async () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET!);

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (!isAuth) {
    return NextResponse.json(
      { message: "you need to login to continue this operation" },
      { status: 403 }
    );
  }

  const userId = isAuth?._id;

  const donationId = (await User.findById(userId))?.donationId;

  if (!donationId) {
    return NextResponse.json(
      { message: "you don't have a subscription to cancel" },
      { status: 400 }
    );
  }

  try {
    await stripe.subscriptions.cancel(donationId);

    const user = (
      await User.findByIdAndUpdate(
        userId,
        {
          donationPlan: "",
          donationId: "",
        },
        {
          new: true,
        }
      )
    )._doc;

    return NextResponse.json({ ...user, password: undefined });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message:
          "something went wrong while trying to delete your subscription",
      },
      { status: 500 }
    );
  }
};
