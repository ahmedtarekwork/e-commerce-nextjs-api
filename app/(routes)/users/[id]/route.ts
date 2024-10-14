// nextjs
import { NextResponse, type NextRequest } from "next/server";

// models
import User from "@/app/lib/models/user";

// utils
import { isEmail } from "validator";
import { validateToken } from "@/app/lib/utils";

type Params = {
  id: string;
};

export const GET = async (
  _: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "user id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  try {
    if (isAuth?.role === "admin" || isAuth?._id === id) {
      const user = await User.findById(id).select("-password -__v");

      if (!user) {
        return NextResponse.json(
          { message: "user with given id not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...user._doc,
        isAdmin: user._doc.role === "admin",
        role: undefined,
      });
    }

    return NextResponse.json(
      { message: "you don't have access to this data" },
      { status: 401 }
    );
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { message: "something went wrong while fetching the user" },
      { status: 500 }
    );
  }
};

export const DELETE = async (
  _: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "user id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role === "user" && id !== isAuth._id) {
    return NextResponse.json(
      { message: "you don't have access to this data" },
      { status: 401 }
    );
  }

  try {
    const user = await User.deleteOne({ _id: id });

    if (!user) {
      return NextResponse.json(
        { message: "user with given id not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "user deleted successfully" });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while deleting the user" },
      { status: 500 }
    );
  }
};

export const PATCH = async (
  { json }: NextRequest,
  { params: { id } }: { params: Params }
) => {
  if (!id) {
    return NextResponse.json(
      { message: "user id is required" },
      { status: 400 }
    );
  }

  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (id !== isAuth?._id) {
    return NextResponse.json(
      { message: "you don't have access to this data" },
      { status: 401 }
    );
  }

  try {
    const newData = await json();

    if ("email" in newData) {
      if (!isEmail(newData.email)) {
        return NextResponse.json(
          { message: "please insert a valid email" },
          { status: 400 }
        );
      }

      if (await User.exists({ email: newData.email })) {
        return NextResponse.json(
          { message: "this email is already taken" },
          { status: 409 }
        );
      }
    }

    if ("username" in newData) {
      if (await User.exists({ username: newData.username })) {
        return NextResponse.json(
          { message: "this username is aleady taken" },
          { status: 409 }
        );
      }
    }

    const user = await User.findByIdAndUpdate(id, newData, {
      new: true,
    }).select("-password");

    if (!user) {
      return NextResponse.json(
        { message: "user with given id not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while updating your data" },
      { status: 500 }
    );
  }
};
