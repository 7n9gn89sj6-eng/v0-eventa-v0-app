import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_PSE_ID;

  if (!apiKey || !cx) {
    return NextResponse.json(
      { error: "Missing GOOGLE_API_KEY or GOOGLE_PSE_ID environment variables" },
      { status: 500 }
    );
  }

  const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
    query
  )}`;

  try {
    const result = await fetch(googleUrl);
    const data = await result.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || "Google API error", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: data.items || [],
      source: "google",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch Google search results",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
