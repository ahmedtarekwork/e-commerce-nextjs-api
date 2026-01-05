// nextjs
import { type NextRequest, NextResponse } from "next/server";

// utils
import connectDb from "@/app/lib/db";
import bcrypt from "bcrypt";
import { SignJWT } from "jose";

// models
import User from "@/app/lib/models/user";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : "https://ahmed-e-commerce.netlify.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export const POST = async ({ json }: NextRequest) => {
  const { username, password } = await json();

  if (!username || !password) {
    return NextResponse.json(
      { message: "username or password in missing" },
      { status: 401 }
    );
  }

  try {
    await connectDb();

    const user = await User.findOne({ username });

    console.log(username, user);

    if (!user) {
      return NextResponse.json({ message: "user not found" }, { status: 404 });
    }

    const checkPassword = await bcrypt.compare(
      password as string,
      user.password
    );

    if (checkPassword) {
      const token = await new SignJWT({
        id: user._doc._id,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

      const response = NextResponse.json({
        ...user._doc,
        password: undefined,
        isAdmin: user._doc.role === "admin",
        role: undefined,
      });

      response.cookies.set("ahmed-e-commerce-user-token", token, {
        httpOnly: true,
        secure: true,
        path: "/",
        sameSite: "none",
        maxAge: 30 * 24 * 60 * 60,
      });

      return response;
    }

    return NextResponse.json(
      { message: "password incorrect" },
      { status: 400 }
    );
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      {
        message: "something went wrong while signin you",
      },
      { status: 500 }
    );
  }
};
