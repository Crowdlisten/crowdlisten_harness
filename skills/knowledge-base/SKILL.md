# Knowledge Base — Capture-Compile-Synthesize Loop

Your knowledge base lives at `~/.crowdlisten/context/`. Start by reading `INDEX.md` to see what's stored.

## Capture

Save insights as you work. Use `save()` with these tags:

| Tag | When to use |
|-----|-------------|
| `decision` | Architectural or product choices made |
| `pattern` | Recurring code or workflow patterns |
| `insight` | Key findings from research or analysis |
| `preference` | User/team preferences (tools, style, process) |
| `learning` | Lessons learned from debugging or experimentation |
| `principle` | Guiding rules or constraints |
| `synthesis` | Compiled topic summaries (output of compile loop) |

**Rule**: After every analysis or research task, save 2-3 key takeaways.

## Compile

Run `compile_context()` to organize the knowledge base. Do this:
- After 20+ new entries accumulate
- Before starting a new project
- Weekly as maintenance

The compile tool returns a report with:
- **Tag groups** — how entries distribute across tags
- **Topic candidates** — tags with 3+ entries worth synthesizing
- **Duplicates** — near-duplicate titles to merge or prune

## Synthesize

When compile identifies topic candidates:

1. Read the entries for that topic (follow INDEX.md links)
2. Write a distilled summary covering the key points
3. Save the synthesis: `save({ title: "Topic: Authentication", content: "...", tags: ["synthesis", "auth"] })`
4. Delete or update superseded entries

Syntheses go in `~/.crowdlisten/context/topics/` and appear in INDEX.md's Topics section.

## Prune

Handle duplicates from the compile report:
- If same insight, keep the better-written one, delete the other
- If contradictory, investigate which is current, update and save
- If complementary, merge into a single entry

## Browse

To navigate the knowledge base:
1. Read `~/.crowdlisten/context/INDEX.md` — overview with all entries and tags
2. Follow paths to specific entries: `~/.crowdlisten/context/entries/{id}.md`
3. Read topic syntheses: `~/.crowdlisten/context/topics/{topic}.md`

## Sync

Run `sync_context()` to pull the latest from cloud and rebuild local files. Use after:
- Web uploads via the dashboard
- Switching machines
- Another agent saved context

## Publish

Share valuable context with teammates using `publish_context({ memory_id, team_id })`. Published items appear in teammates' INDEX.md under `## Shared` after they sync.
