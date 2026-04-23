import { MongoClient } from "mongodb";

export const dynamic = "force-dynamic";

let clientPromise: Promise<MongoClient> | null = null;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is not set");
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minScore = parseInt(searchParams.get("minScore") || "6");
  const intent   = searchParams.get("intent");
  const limit    = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const query: Record<string, unknown> = { relevance_score: { $gte: minScore } };
  if (intent && intent !== "all") query.intent = intent;

  try {
    const client = await getClient();
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.id || typeof body.id !== "string") {
      return Response.json({ error: "id required" }, { status: 400 });
    }
    if (!body.title || typeof body.title !== "string") {
      return Response.json({ error: "title required" }, { status: 400 });
    }

    const client = await getClient();
    const db = client.db(process.env.MONGO_DB || "reddit_monitor");
    const col = db.collection("reddit_posts");
    await col.createIndex({ id: 1 }, { unique: true });

    const now = new Date();
    const doc = {
      id:                body.id,
      title:             body.title,
      body:              body.body ?? "",
      url:               body.url ?? "",
      author:            body.author ?? "",
      subreddit:         body.subreddit ?? "",
      posted_at:         body.posted_at ? new Date(body.posted_at) : now,
      relevance_score:   typeof body.relevance_score === "number" ? body.relevance_score : 0,
      intent:            body.intent ?? "general",
      reasoning:         body.reasoning ?? "",
      matched_keyword:   body.matched_keyword ?? "",
    };

    const result = await col.updateOne(
      { id: doc.id },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true },
    );

    return Response.json(
      { ok: true, upserted: !!result.upsertedId, id: doc.id },
      { status: result.upsertedId ? 201 : 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
