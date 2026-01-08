// nextjs
import { type NextRequest, NextResponse } from "next/server";

// stripe
import Stripe from "stripe";

// models
import User from "@/app/lib/models/user";

// utils
import submitOrder from "@/app/lib/submitOrder";

const stripe = new Stripe(process.env.STRIPE_SECRET!);

export const POST = async ({ text, headers }: NextRequest) => {
  const body = await text();

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      headers.get("Stripe-Signature")!,
      process.env.WEB_HOOK_SECRET!
    );

    switch (event.type) {
      case "checkout.session.completed": {
        if (event.data.object.mode === "payment") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userId = (event.data.object as any).metadata?.userId;
            if (!userId) {
              return NextResponse.json(
                {
                  message: `user id not found`,
                },
                { status: 500 }
              );
            }

            const paymentMethod = event.data.object.payment_method_types[0];

            await submitOrder(
              {
                method: `${paymentMethod[0].toUpperCase()}${paymentMethod.slice(
                  1
                )}`,
                currency: event.data.object.currency?.toUpperCase(),
                userId,
              },
              false
            );
          } catch (err) {
            console.log(err);

            return NextResponse.json(
              { message: "something went wrong while submiting the order" },
              { status: 500 }
            );
          }
        }

        break;
      }

      case "customer.subscription.created": {
        const donationId = event.data.object.id;

        const metadata = event.data.object.metadata;

        if (metadata.isUpdateMode) {
          await stripe.subscriptions.cancel(metadata.oldSubscriptionId);
        }

        const donationPlan = metadata.donationPlan
          .toLowerCase()
          .replace("plan", "")
          .trim();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (event.data.object as any).metadata?.userId;

        if (!userId) {
          return NextResponse.json(
            { message: `user id not found` },
            { status: 500 }
          );
        }

        await User.updateOne({ _id: userId }, { donationPlan, donationId });
        break;
      }
    }

    return NextResponse.json({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(err);

    return NextResponse.json(
      { message: `something went wrong while process the payment` },
      { status: 500 }
    );
  }
};
