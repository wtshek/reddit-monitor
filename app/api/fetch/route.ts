import { MongoClient } from "mongodb";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

let clientPromise: Promise<MongoClient> | null = null;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is not set");
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function GET() {
  try {
    const client = await getClient();
    const db = client.db(process.env.MONGO_DB || "reddit_monitor");

    const keywords = await db
      .collection("reddit_keywords")
      .find({ active: true })
      .toArray();

    const feeds = keywords.map(k => {
      const encoded = k.keyword.replace(/ /g, "+").replace(/"/g, "%22");
      const url = k.subreddit
        ? `https://www.reddit.com/r/${k.subreddit}/search.rss?q=${encoded}&sort=new&restrict_sr=on`
        : `https://www.reddit.com/search.rss?q=${encoded}&sort=new`;
      return { url, keyword: k.keyword, subreddit: k.subreddit || null };
    });

    const fetched = await Promise.all(
      feeds.map(async f => {
        const res = await fetch(f.url, {
          headers: { "User-Agent": "reddit-monitor/2.0" },
        });
        if (!res.ok) return { ...f, xml: null };
        return { ...f, xml: await res.text() };
      })
    );

    const posts = fetched.flatMap(f => (f.xml ? parseAtom(f.xml, f.keyword) : []));

    const ids = posts.map(p => p.id);
    const existing = new Set(
      (await db
        .collection("reddit_posts")
        .find({ id: { $in: ids } }, { projection: { id: 1, _id: 0 } })
        .toArray()
      ).map(p => p.id)
    );
    const newPosts = posts.filter(p => !existing.has(p.id));

    return Response.json(newPosts);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(e);
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseAtom(xml: string, keyword: string) {
  const posts: Array<Record<string, string>> = [];
  const entryRe = /<entry\b[\s\S]*?<\/entry>/g;
  for (const entry of xml.match(entryRe) ?? []) {
    const link = entry.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
    const idMatch = link.match(/\/comments\/([a-z0-9]+)\//);
    if (!idMatch) continue;

    const title = stripTags(pick(entry, "title"));
    const author = stripTags(entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1] ?? "");
    const subreddit =
      entry.match(/<category[^>]*term="([^"]+)"/)?.[1] ??
      link.match(/\/r\/([^/]+)\//)?.[1] ?? "unknown";
    const body = stripTags(pick(entry, "content")).slice(0, 1000);
    const published = pick(entry, "published") || pick(entry, "updated");

    posts.push({
      id: `t3_${idMatch[1]}`,
      title,
      url: link,
      author: author || "unknown",
      subreddit,
      body,
      posted_at: published || new Date().toISOString(),
      matched_keyword: keyword,
    });
  }
  return posts;
}

const pick = (s: string, tag: string) =>
  s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? "";
const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
