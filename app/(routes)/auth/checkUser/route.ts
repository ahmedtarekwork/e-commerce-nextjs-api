// nextjs
import { NextResponse } from "next/server";

// utils
import { validateToken } from "@/app/lib/utils";

export const GET = async () => {
  try {
    const isAuth = await validateToken();

    if (isAuth instanceof NextResponse) return isAuth;

    return NextResponse.json({
      ...isAuth,
      isAdmin: isAuth.role === "admin",
      role: undefined,
    });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while checking user authenticated" },
      { status: 500 }
    );
  }
};
