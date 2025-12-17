import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json(
      { error: "Missing 'query' parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_PSE_ID || process.env.GOOGLE_CSE_ID; // Support both names

  if (!apiKey || !cseId) {
    return NextResponse.json(
      { error: "Google Search is not configured on server" },
      { status: 500 }
    );
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    return NextResponse.json({ results: data.items || [] });
  } catch (err) {
    return NextResponse.json(
      { error: "Google search request failed" },
      { status: 500 }
    );
  }
}

