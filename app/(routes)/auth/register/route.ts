// nextjs
import { NextResponse, type NextRequest } from "next/server";

// models
import user from "@/app/lib/models/user";

// utils
import connectDb from "@/app/lib/db";
import bcrypt from "bcrypt";

export const POST = async ({ json }: NextRequest) => {
  await connectDb();

  const { email, password, username, address, isAdmin } = await json();

  if (!email || !password || !username)
    return NextResponse.json(
      { message: "email, username and password is required" },
      { status: 400 }
    );

  const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt());

  const userData = {
    email,
    password: hashedPassword,
    username,
    role: isAdmin ? "admin" : "user",
  } as Record<string, unknown>;

  if (address) userData.address = address;

  try {
    const newUser = await user.create(userData);

    return Response.json({ ...newUser._doc, password: undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(err);

    let status = 500;

    let message =
      err?.message || "something went wrong while registering the user";

    if (err.name === "ValidationError") {
      message = (Object.values(err.errors)[0] as { message: string })?.message;
    }

    if (err.code === 11000) {
      message = `${Object.keys(err.keyPattern).join(", ")} is already taken`;
      status = 409;
    }

    return Response.json({ message }, { status });
  }
};
