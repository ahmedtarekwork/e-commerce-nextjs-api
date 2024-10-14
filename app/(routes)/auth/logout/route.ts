import { validateToken } from "@/app/lib/utils";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const POST = async () => {
  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  cookies().delete("ahmed-e-commerce-user-token");

  return NextResponse.json({});
};
