// nextjs
import { type NextRequest, NextResponse } from "next/server";

// models
import Product from "../../lib/models/product";
import categoryModel from "@/app/lib/category&brand/models/categoryModel";
import brandModel from "@/app/lib/category&brand/models/brandModel";

// utils
import { uploadImg, validateToken } from "@/app/lib/utils";
import connectDb from "@/app/lib/db";

// cloudinary
import { v2 as cloudinary } from "cloudinary";

export const GET = async ({ nextUrl }: NextRequest) => {
  try {
    await connectDb();

    const {
      bestSell,
      limit: reqLimit,
      category,
      page,
      titleStartsWith,
      categories,
      brands,
      priceMin,
      priceMax,
      availability,
    } = Object.fromEntries(nextUrl.searchParams.entries());

    const searchQueries = {} as Record<string, unknown>;
    const additionalResponseData = {} as Record<string, unknown>;

    if (availability && availability !== "both") {
      searchQueries.quantity =
        availability === "in stock" ? { $gt: 0 } : { $eq: 0 };
    }

    const brandAndCategoryPromises = [];

    if (categories || category) {
      brandAndCategoryPromises.push(categoryModel.find().select("name"));
    } else brandAndCategoryPromises.push([]);
    if (brands) {
      brandAndCategoryPromises.push(brandModel.find().select("name"));
    } else brandAndCategoryPromises.push([]);

    const [awaitedCatsWithId, awaitedBrandsWithIds] =
      brandAndCategoryPromises.length
        ? await Promise.allSettled(brandAndCategoryPromises)
        : [undefined, undefined];

    if (category || categories) {
      if (awaitedCatsWithId?.status === "rejected") {
        return NextResponse.json(
          {
            message:
              "can't get products with provided categories at the momment",
          },
          { status: 500 }
        );
      }

      const catsWithId = awaitedCatsWithId?.value || [];
      const cats = catsWithId.map((cat) => cat.name);

      if (category) {
        const searchCat = cats?.find((c: string) =>
          c.toLowerCase().toLowerCase() === category.toLowerCase().toLowerCase()
            ? c
            : undefined
        );

        if (searchCat) {
          searchQueries.category = catsWithId.find(
            (cat) => searchCat === cat.name
          )._id;
        } else {
          return NextResponse.json(
            { message: `There is no Category with name of ${category}` },
            { status: 400 }
          );
        }
      } else if (categories) {
        const formatedCategories = categories.split(",");

        const invalidCats = formatedCategories.filter((c) => {
          return cats.every(
            (cat: string) => cat.toLowerCase().trim() !== c.toLowerCase().trim()
          );
        });

        if (invalidCats.length) {
          return NextResponse.json(
            {
              message: `This categories not found => ${invalidCats.join(", ")}`,
            },
            { status: 400 }
          );
        }

        const searchCats = cats.filter((c: string) => {
          return formatedCategories.some(
            (cat) => cat.toLowerCase().trim() === c.toLowerCase().trim()
          );
        });

        if (searchCats.length) {
          const catsIds = catsWithId
            .filter((cat) => searchCats.includes(cat.name))
            .map((cat) => cat._id);

          searchQueries.category = { $in: catsIds };
        }
      }
    }

    if (brands) {
      if (awaitedBrandsWithIds?.status === "rejected") {
        return NextResponse.json(
          {
            message:
              "can't get products with provided categories at the momment",
          },
          { status: 500 }
        );
      }

      const brandsWithIds = awaitedBrandsWithIds?.value || [];
      const availableBrands = brandsWithIds.map((brand) => brand.name);

      const formatedBrands = brands.split(",");

      const invalidBrands = formatedBrands.filter((b) => {
        return availableBrands.every(
          (brand: string) =>
            brand.toLowerCase().trim() !== b.toLowerCase().trim()
        );
      });

      if (invalidBrands.length) {
        return NextResponse.json(
          {
            message: `This brands not available => ${invalidBrands.join(", ")}`,
          },
          { status: 404 }
        );
      }

      const searchBrands = availableBrands.filter((b: string) => {
        return formatedBrands.some(
          (brand) => brand.toLowerCase().trim() === b.toLowerCase().trim()
        );
      });

      if (searchBrands.length) {
        const searchBrandsWithIds = brandsWithIds
          .filter((brand) => searchBrands.includes(brand.name))
          .map((brand) => brand._id);

        searchQueries.brand = { $in: searchBrandsWithIds };
      }
    }

    if (priceMin) searchQueries.price = { $gte: +priceMin };

    if (priceMax) {
      searchQueries.price = { ...(searchQueries.price || {}), $lte: +priceMax };
    }

    if (titleStartsWith) {
      searchQueries.title = {
        $regex: `^${titleStartsWith.replaceAll("\\", "")}`,
        $options: "i",
      };
    }

    let promise = Product.find(searchQueries);

    try {
      const minPrice = Product.find(searchQueries)
        .select("price")
        .sort({ price: 1 })
        .limit(1);
      const maxPrice = Product.find(searchQueries)
        .select("price")
        .sort({ price: -1 })
        .limit(1);

      const [awaitedMinPrice, awaitedMaxPrice] = await Promise.allSettled([
        minPrice,
        maxPrice,
      ]);

      if (
        awaitedMaxPrice.status === "rejected" ||
        awaitedMinPrice.status === "rejected"
      ) {
        return NextResponse.json(
          {
            message: "something went wrong while trying to filter products",
          },
          { status: 400 }
        );
      }

      additionalResponseData.priceRange = {
        min: awaitedMinPrice.value[0]?.price,
        max: awaitedMaxPrice.value[0]?.price,
      };
    } catch (err) {
      console.log(err);

      return NextResponse.json(
        {
          message: `can't get products at the moment`,
        },
        { status: 400 }
      );
    }

    if (JSON.parse(bestSell || "false")) {
      promise = promise.sort({ sold: -1 });
    }

    const limit = +reqLimit;

    if (limit) {
      let pagesCount;
      if (!titleStartsWith) {
        pagesCount = (await Product.countDocuments(searchQueries)) / limit;
      } else {
        pagesCount =
          (await Product.countDocuments({
            title: { $regex: `^${titleStartsWith}`, $options: "i" },
            ...searchQueries,
          })) / limit;
      }

      promise = promise.skip(limit * (Math.ceil(+page) - 1 || 0)).limit(limit);

      additionalResponseData.pagesCount = Math.ceil(+pagesCount);
    }

    const products = await promise.populate({
      path: "category brand",
      select: "name",
    });

    return NextResponse.json({ products, ...additionalResponseData });
  } catch (err) {
    console.log(err);

    return NextResponse.json(
      { message: "something went wrong while fetching products" },
      { status: 500 }
    );
  }
};

export const POST = async ({ formData }: NextRequest) => {
  const isAuth = await validateToken();

  if (isAuth instanceof NextResponse) return isAuth;

  if (isAuth?.role !== "admin") {
    return NextResponse.json(
      { message: "you don't have Authority to add new product" },
      { status: 401 }
    );
  }

  try {
    const productData = await formData();

    const imgs = productData.getAll("imgs[]");
    const title = productData.get("title");
    const price = productData.get("price");
    const brand = productData.get("brand");
    const color = productData.get("color");
    const category = productData.get("category");
    const quantity = productData.get("quantity");
    const description = productData.get("description");

    const numbersValues = (key: string, value: FormDataEntryValue | null) => {
      if (!["null", "undefined"].includes(typeof value)) {
        if (isNaN(+value!)) {
          return NextResponse.json(
            { message: `${key} must be a nubmer` },
            { status: 400 }
          );
        }

        if ((value as unknown as number) < 0) {
          return NextResponse.json(
            { message: `${key} mustn't be less than zero` },
            { status: 400 }
          );
        }

        return;
      }

      return NextResponse.json(
        { message: `${key} is required` },
        { status: 400 }
      );
    };

    const reason = [
      numbersValues("quantity", quantity),
      numbersValues("price", price),
    ].find((reason) => reason);

    if (reason) return reason;

    if (!imgs || !imgs.length) {
      return NextResponse.json(
        { message: "product must have at least one image" },
        { status: 400 }
      );
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const results = await Promise.allSettled(
      imgs.map((img) => uploadImg(img as File))
    );

    const finalData = results
      .map((imgData) => {
        if (imgData.status === "fulfilled") {
          return Object.fromEntries(
            Object.entries(imgData.value as Record<string, unknown>).filter(
              ([key]) => ["public_id", "secure_url"].includes(key)
            )
          );
        }
      })
      .filter((data) => data); // remove rejected promises

    const product = await Product.create({
      title,
      price: +price!,
      brand,
      category,
      color,
      quantity: +quantity!,
      description,
      imgs: finalData,
    });

    const [awaited_category, awaited_brand] = await Promise.allSettled([
      categoryModel.findById(category).select("name"),
      brandModel.findById(brand).select("name"),
    ]);

    const finalCategory =
      awaited_category.status === "fulfilled"
        ? awaited_category.value
        : undefined;
    const finalBrand =
      awaited_brand.status === "fulfilled" ? awaited_brand.value : undefined;

    return NextResponse.json({
      ...product._doc,
      category: finalCategory,
      brand: finalBrand,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.log(err);

    let status = 500;
    let message: string = "";

    if (err.code === 11000) {
      message = `${Object.keys(err.keyValue)[0]} is already taken`;
      status = 409;
    }

    message = err.errors
      ? (Object.values(err.errors)[0] as { message: string })?.message
      : message;

    return NextResponse.json(
      { message: message || "something went wrong while creating the product" },
      { status }
    );
  }
};
