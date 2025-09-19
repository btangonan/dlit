# CLAUDE.md — Project Contract

**Purpose**: Follow this in every session for this repo. Keep memory sharp. Keep outputs concrete. Cut rework.

## 🧠 Project Memory (Chroma)

Use server `chroma`. Collection `project_memory`.

Log after any confirmed fix, decision, gotcha, or preference.

**Schema:**
- **documents**: 1–2 sentences. Under 300 chars.
- **metadatas**: `{ "type":"decision|fix|tip|preference", "tags":"comma,separated", "source":"file|PR|spec|issue" }`
- **ids**: stable string if updating the same fact.

Always reply after writes: **Logged memory: <id>**.

Before proposing work, query Chroma for prior facts.

### Chroma Calls
```javascript
// Create once:
mcp__chroma__chroma_create_collection { "collection_name": "project_memory" }

// Add:
mcp__chroma__chroma_add_documents {
  "collection_name": "project_memory",
  "documents": ["<text>"],
  "metadatas": [{"type":"<type>","tags":"a,b,c","source":"<src>"}],
  "ids": ["<stable-id>"]
}

// Query:
mcp__chroma__chroma_query_documents {
  "collection_name": "project_memory",
  "query_texts": ["<query>"],
  "n_results": 5
}
```

## 🧩 Deterministic Reasoning

Default: concise, action oriented.

Auto-propose sequential-thinking when a task has 3+ dependent steps or multiple tradeoffs. Enable for one turn, then disable.

If I say "reason stepwise", enable for one turn, then disable.

## 🔍 Retrieval Checklist Before Coding

1. Query Chroma for related memories
2. Check repo files that match the task
3. List open PRs or issues that touch the same area
4. Only then propose changes

## 🏷️ Memory Taxonomy

- **type**: `decision`, `fix`, `tip`, `preference`
- **tags**: short domain keywords (e.g., `video,encode,preview`)
- **id rule**: stable handle per fact (e.g., `encode-preview-policy`)

### Memory Examples
```javascript
documents: ["Use NVENC for H.264 previews; fallback x264 if GPU is busy"]
metadatas: [{ "type":"tip","tags":"video,encode,preview","source":"PR#142" }]
ids: ["encode-preview-policy"]

documents: ["Adopt Conventional Commits and run tests on pre-push"]
metadatas: [{ "type":"decision","tags":"repo,workflow,testing","source":"spec" }]
ids: ["repo-commit-policy"]
```

## 📁 Output Policy

- For code: return a unified diff or a patchable file set
- For scripts: include exact commands and paths
- Save long outputs in `./backups/`. Use readable names. Echo paths in the reply

## 🛡️ Safety

- No secrets in `.chroma` or transcripts
- Note licenses and third party terms when adding dependencies
- Respect rate limits. Propose batching if needed

## ⚡ Activation

Read this file at session start.

Acknowledge: **Contract loaded. Using Chroma project_memory.**

If tools are missing, name them and stop before continuing.

---
*Note: If you had existing CLAUDE.md instructions, they are preserved in `CLAUDE.md.original`*