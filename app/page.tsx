"use client"

import { useEffect, useRef, useState } from "react";

const INTENT_META = {
  seeking_alternative: { label: "Seeking Alternative", color: "#22c55e", bg: "#052e16" },
  frustrated:          { label: "Frustrated",          color: "#f97316", bg: "#1c0a00" },
  recommendation:      { label: "Wants Rec",           color: "#3b82f6", bg: "#0c1a2e" },
  general:             { label: "General",              color: "#a1a1aa", bg: "#18181b" },
  unrelated:           { label: "Unrelated",            color: "#52525b", bg: "#09090b" },
};

const mono = "'IBM Plex Mono', monospace";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── KEYWORD PANEL ────────────────────────────────────────────────────────────
function KeywordPanel({ onClose }) {
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); load(); }, []);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/keywords");
    const data = await res.json();
    setKeywords(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function addKeyword() {
    const kw = input.trim();
    if (!kw) return;
    setSaving(true);
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: kw, subreddit: subreddit.trim() }),
    });
    setInput(""); setSubreddit("");
    await load();
    setSaving(false);
  }

  async function toggleKeyword(id, active) {
    setKeywords(kws => kws.map(k => k.id === id ? { ...k, active: !active } : k));
    await fetch(`/api/keywords?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
  }

  async function deleteKeyword(id) {
    setKeywords(kws => kws.filter(k => k.id !== id));
    await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
  }

  const activeCount = keywords.filter(k => k.active).length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#111", border: "1px solid #222", borderRadius: "12px",
        width: "520px", maxHeight: "80vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff" }}>
              Keyword Monitor
            </h2>
            <p style={{ fontSize: "11px", color: "#555", fontFamily: mono, marginTop: "3px" }}>
              The skill reads these on every run · {activeCount} active
            </p>
          </div>
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: "#444", fontSize: "20px", cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        {/* Add form */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1a" }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              placeholder='e.g. "splitwise alternative"'
              style={{
                flex: 1, background: "#0a0a0a", border: "1px solid #2a2a2a",
                borderRadius: "6px", padding: "8px 10px",
                fontSize: "13px", fontFamily: mono, outline: "none",
              }}
            />
            <input
              value={subreddit}
              onChange={e => setSubreddit(e.target.value)}
              placeholder="r/subreddit (optional)"
              style={{
                width: "170px", background: "#0a0a0a", border: "1px solid #2a2a2a",
                borderRadius: "6px", padding: "8px 10px",
                fontSize: "13px", fontFamily: mono, outline: "none",
              }}
            />
            <button onClick={addKeyword} disabled={saving || !input.trim()} style={{
              background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px",
              color: "#e5e5e5", fontSize: "13px", padding: "8px 14px",
              cursor: input.trim() ? "pointer" : "default", fontFamily: mono,
              opacity: !input.trim() || saving ? 0.35 : 1, flexShrink: 0,
            }}>
              + Add
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "#3a3a3a", fontFamily: mono }}>
            Leave subreddit empty to search all of Reddit · press Enter to add
          </p>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px", display: "flex", flexDirection: "column", gap: "5px" }}>
          {loading ? (
            <p style={{ color: "#2a2a2a", fontSize: "12px", fontFamily: mono, textAlign: "center", padding: "24px" }}>loading...</p>
          ) : keywords.length === 0 ? (
            <p style={{ color: "#2a2a2a", fontSize: "12px", fontFamily: mono, textAlign: "center", padding: "24px" }}>
              No keywords yet — add one above
            </p>
          ) : keywords.map(kw => (
            <div key={kw.id} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "9px 12px", background: "#0a0a0a",
              border: `1px solid ${kw.active ? "#1e1e1e" : "#111"}`,
              borderRadius: "6px", opacity: kw.active ? 1 : 0.4,
              transition: "opacity 0.15s",
            }}>
              {/* Toggle */}
              <button onClick={() => toggleKeyword(kw.id, kw.active)} style={{
                width: "30px", height: "17px", borderRadius: "9px", border: "none",
                background: kw.active ? "#22c55e" : "#222", cursor: "pointer",
                position: "relative", flexShrink: 0, transition: "background 0.2s",
              }}>
                <span style={{
                  position: "absolute", top: "2.5px",
                  left: kw.active ? "15px" : "2.5px",
                  width: "12px", height: "12px", borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s", display: "block",
                }} />
              </button>

              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", color: "#e5e5e5", fontFamily: mono }}>{kw.keyword}</span>
                {kw.subreddit
                  ? <span style={{
                      fontSize: "10px", color: "#3b82f6", fontFamily: mono,
                      background: "#0c1a2e", border: "1px solid #1e3a5f",
                      borderRadius: "3px", padding: "1px 5px",
                    }}>r/{kw.subreddit}</span>
                  : <span style={{ fontSize: "10px", color: "#333", fontFamily: mono }}>all subreddits</span>
                }
              </div>

              <button onClick={() => deleteKeyword(kw.id)} style={{
                background: "none", border: "none", color: "#2a2a2a",
                cursor: "pointer", fontSize: "16px", lineHeight: 1, flexShrink: 0,
              }}
                onMouseEnter={e => e.target.style.color = "#f87171"}
                onMouseLeave={e => e.target.style.color = "#2a2a2a"}
              >×</button>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #1a1a1a" }}>
          <p style={{ fontSize: "11px", color: "#2a2a2a", fontFamily: mono }}>
            Changes apply on the next skill run
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const color = score >= 8 ? "#22c55e" : score >= 6 ? "#f97316" : "#a1a1aa";
  return (
    <span style={{
      fontFamily: mono, fontSize: "11px", fontWeight: 700,
      color, border: `1px solid ${color}`, borderRadius: "4px", padding: "1px 6px",
    }}>{score}/10</span>
  );
}

function IntentTag({ intent }) {
  const meta = INTENT_META[intent] || INTENT_META.general;
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, color: meta.color, background: meta.bg,
      border: `1px solid ${meta.color}33`, borderRadius: "3px", padding: "1px 6px",
      letterSpacing: "0.08em", textTransform: "uppercase",
    }}>{meta.label}</span>
  );
}

function PostCard({ post }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: "#111111", border: "1px solid #222222", borderRadius: "8px",
      padding: "16px", display: "flex", flexDirection: "column", gap: "10px",
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#333"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#222"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <ScoreBadge score={post.relevance_score} />
        <IntentTag intent={post.intent} />
        <span style={{ fontSize: "11px", color: "#555", fontFamily: mono }}>r/{post.subreddit}</span>
        <span style={{ fontSize: "11px", color: "#444", marginLeft: "auto" }}>{timeAgo(post.posted_at)}</span>
      </div>

      <a href={post.url} target="_blank" rel="noopener noreferrer" style={{
        color: "#e5e5e5", fontFamily: "'Instrument Serif', serif",
        fontSize: "16px", lineHeight: "1.4", textDecoration: "none",
      }}
        onMouseEnter={e => e.target.style.color = "#fff"}
        onMouseLeave={e => e.target.style.color = "#e5e5e5"}
      >{post.title}</a>

      {post.body && (
        <div>
          <p style={{
            fontSize: "13px", color: "#666", lineHeight: "1.6", margin: 0,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical",
          }}>{post.body}</p>
          {post.body.length > 120 && (
            <button onClick={() => setExpanded(!expanded)} style={{
              background: "none", border: "none", color: "#555",
              fontSize: "11px", cursor: "pointer", padding: "2px 0", marginTop: "2px",
            }}>{expanded ? "show less" : "show more"}</button>
          )}
        </div>
      )}

      {post.reasoning && (
        <p style={{
          fontSize: "11px", color: "#444", fontFamily: mono, margin: 0,
          borderLeft: "2px solid #2a2a2a", paddingLeft: "8px",
        }}>{post.reasoning}</p>
      )}

      {post.matched_keyword && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "#444", fontFamily: mono }}>matched:</span>
          <span style={{
            fontSize: "10px", color: "#3b82f6", fontFamily: mono,
            background: "#0c1a2e", border: "1px solid #1e3a5f",
            borderRadius: "3px", padding: "1px 6px",
          }}>{post.matched_keyword}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", color: "#444" }}>u/{post.author}</span>
        <a href={post.url} target="_blank" rel="noopener noreferrer" style={{
          fontSize: "11px", color: "#3b82f6", textDecoration: "none", fontFamily: mono,
        }}>Reply →</a>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function RedditMonitor() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [minScore, setMinScore] = useState(6);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showKeywords, setShowKeywords] = useState(false);

  async function fetchPosts() {
    setLoading(true);
    const params = new URLSearchParams({ minScore, limit: 50 });
    if (filter !== "all") params.set("intent", filter);
    const res  = await fetch(`/api/posts?${params}`);
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
    setLastRefresh(new Date());
    setLoading(false);
  }

  useEffect(() => { fetchPosts(); }, [filter, minScore]);

  const intents = ["all", "seeking_alternative", "frustrated", "recommendation", "general"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Instrument+Serif&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; color: #e5e5e5; }
        input { color: #e5e5e5 !important; }
        input::placeholder { color: #333 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>

      {showKeywords && <KeywordPanel onClose={() => setShowKeywords(false)} />}

      <div style={{ minHeight: "100vh", background: "#080808" }}>

        {/* Header */}
        <div style={{
          borderBottom: "1px solid #1a1a1a", padding: "20px 24px",
          display: "flex", alignItems: "center", gap: "12px",
          position: "sticky", top: 0, background: "#080808", zIndex: 10,
        }}>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>
              Reddit Monitor
            </h1>
            <p style={{ fontSize: "12px", color: "#444", fontFamily: mono, marginTop: "2px" }}>
              {lastRefresh ? `Updated ${timeAgo(lastRefresh)}` : "Loading..."}
              {" · "}{posts.length} posts
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <button onClick={() => setShowKeywords(true)} style={{
              background: "none", border: "1px solid #2a2a2a", borderRadius: "6px",
              color: "#888", fontSize: "12px", padding: "6px 12px", cursor: "pointer", fontFamily: mono,
            }}>⌖ Keywords</button>
            <button onClick={fetchPosts} style={{
              background: "none", border: "1px solid #2a2a2a", borderRadius: "6px",
              color: "#888", fontSize: "12px", padding: "6px 12px", cursor: "pointer", fontFamily: mono,
            }}>↻ Refresh</button>
          </div>
        </div>

        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>

          {/* Filters */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {intents.map(i => {
                const meta = i === "all" ? { label: "All", color: "#e5e5e5" } : INTENT_META[i];
                const active = filter === i;
                return (
                  <button key={i} onClick={() => setFilter(i)} style={{
                    background: active ? "#1a1a1a" : "none",
                    border: `1px solid ${active ? "#333" : "#1a1a1a"}`,
                    borderRadius: "6px", color: active ? meta.color : "#555",
                    fontSize: "11px", fontWeight: 600, padding: "5px 10px",
                    cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
                  }}>{meta.label}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
              <span style={{ fontSize: "11px", color: "#555", fontFamily: mono }}>min score</span>
              {[4, 6, 7, 8].map(s => (
                <button key={s} onClick={() => setMinScore(s)} style={{
                  background: minScore === s ? "#1a1a1a" : "none",
                  border: `1px solid ${minScore === s ? "#333" : "#1a1a1a"}`,
                  borderRadius: "4px", color: minScore === s ? "#e5e5e5" : "#555",
                  fontSize: "11px", padding: "4px 8px", cursor: "pointer", fontFamily: mono,
                }}>{s}+</button>
              ))}
            </div>
          </div>

          {/* Posts */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#333", fontFamily: mono, fontSize: "13px" }}>
              fetching posts...
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#333" }}>
              <p style={{ fontFamily: mono, fontSize: "13px" }}>No posts found</p>
              <p style={{ fontSize: "12px", color: "#2a2a2a", marginTop: "8px" }}>Add keywords then run the skill</p>
              <button onClick={() => setShowKeywords(true)} style={{
                marginTop: "16px", background: "none", border: "1px solid #2a2a2a",
                borderRadius: "6px", color: "#555", fontSize: "12px", padding: "8px 16px",
                cursor: "pointer", fontFamily: mono,
              }}>⌖ Manage Keywords</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {posts.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
