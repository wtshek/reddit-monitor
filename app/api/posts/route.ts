import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minScore = parseInt(searchParams.get("minScore") || "6");
  const intent   = searchParams.get("intent");
  const limit    = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const query: Record<string, unknown> = { relevance_score: { $gte: minScore } };
  if (intent && intent !== "all") query.intent = intent;

  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB || "reddit_monitor");
    const posts = await db
      .collection("reddit_posts")
      .find(query, { projection: { _id: 0 } })
      .sort({ posted_at: -1 })
      .limit(limit)
      .toArray();

    const serialized = posts.map(p => ({
      ...p,
      posted_at:  p.posted_at instanceof Date  ? p.posted_at.toISOString()  : p.posted_at,
      created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
    }));

    return Response.json(serialized);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
