import { MongoClient, ObjectId } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI!);

async function getCollection() {
  await client.connect();
  const db = client.db(process.env.MONGO_DB || "reddit_monitor");
  const col = db.collection("reddit_keywords");
  await col.createIndex({ keyword: 1 });
  return col;
}

function serialize(doc: Record<string, unknown> & { _id?: ObjectId; created_at?: unknown }) {
  const { _id, created_at, ...rest } = doc;
  return {
    ...rest,
    id: _id?.toString(),
    created_at: created_at instanceof Date ? created_at.toISOString() : created_at,
  };
}

function errorResponse(e: unknown) {
  const message = e instanceof Error ? e.message : "Unknown error";
  console.error(e);
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const col = await getCollection();
    const docs = await col.find({}).sort({ created_at: 1 }).toArray();
    return Response.json(docs.map(serialize));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { keyword, subreddit } = await req.json();
    if (!keyword?.trim()) {
      return Response.json({ error: "keyword required" }, { status: 400 });
    }
    const col = await getCollection();
    const doc = {
      keyword:    keyword.trim(),
      subreddit:  subreddit?.trim().replace(/^r\//, "") || null,
      active:     true,
      created_at: new Date(),
    };
    const result = await col.insertOne(doc);
    return Response.json(serialize({ ...doc, _id: result.insertedId }), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const { active } = await req.json();
    const col = await getCollection();
    await col.updateOne({ _id: new ObjectId(id) }, { $set: { active } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const col = await getCollection();
    await col.deleteOne({ _id: new ObjectId(id) });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
