import { connect, connection } from "mongoose";
import { NextResponse } from "next/server";

const connectDb = async () => {
  "use server";

  const connectCode = connection?.readyState;

  switch (connectCode) {
    case 1: {
      console.log("connected alreay");
      return;
    }
    case 2: {
      console.log("connecting...");
      return;
    }
  }

  try {
    await connect(process.env.MONGO_CONNECTION_URI!, {
      dbName: "E-commerce",
      bufferCommands: true,
    });

    console.log("connected");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.log(e);

    return NextResponse.json(
      { message: "can't get your order at the momment" },
      { status: 500 }
    );
  }
};

export default connectDb;
