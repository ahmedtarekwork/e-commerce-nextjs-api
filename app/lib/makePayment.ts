// nextjs
import { type NextRequest, NextResponse } from "next/server";

// stripe
import Stripe from "stripe";

// models
import User from "./models/user";

// utils
import { validateToken } from "./utils";

const stripe = new Stripe(process.env.STRIPE_SECRET!);

const POST = async ({ json, nextUrl, method }: NextRequest) => {
  const { line_items, customer_email } = await json();

  const type = nextUrl.pathname.includes("donate") ? "donate" : "pay";
  const sessionUrlPath = type === "donate" ? "/donate" : "";

  if (!line_items || !customer_email) {
    return NextResponse.json(
      { message: "customer_email and line_items is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  try {
    const customerData = {
      name: customer_email.split("@")[0],
      email: customer_email,
    };

    const customer = await stripe.customers.list({
      email: customerData.email,
    });

    if (!customer?.data?.[0]?.id) await stripe.customers.create(customerData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extraData = {} as any;
    if (type === "donate") {
      extraData.subscription_data = {
        metadata: {
          userId: isAuth._id,
          donationPlan: line_items[0].price_data.product_data.name,
        },
      };

      if (method === "PATCH") {
        const donationId = (await User.findById(isAuth._id)).donationId;
        extraData.subscription_data.metadata.isUpdateMode = true;
        extraData.subscription_data.metadata.oldSubscriptionId = donationId;
      }
    }

    const session = await stripe.checkout.sessions.create({
      ...extraData,
      success_url: `${process.env.CLIENT_APP_URL}/successPayment${sessionUrlPath}`,
      cancel_url: `${process.env.CLIENT_APP_URL}/failedPayment${sessionUrlPath}`,

      line_items,
      customer_email,

      mode: type === "donate" ? "subscription" : "payment",
      payment_method_types: ["card"],
      shipping_address_collection: { allowed_countries: ["EG"] },
      metadata: {
        userId: isAuth._id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: "something went wrong while trying to proccess the payment",
      },
      { status: 500 }
    );
  }
};

export { POST };
