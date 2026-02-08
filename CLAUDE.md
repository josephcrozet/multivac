# Multivac

*A Claude Code Learning System — Development Context*

This is a Claude Code extension toolkit project. When working in this directory, you are likely:
1. Developing/modifying the tutorial system itself
2. Preparing it for distribution
3. Testing components

## Project Structure

```
multivac/
├── agents/interview-agent.md     # Mock interview agent (8 questions, dual format)
├── bin/multivac                  # CLI command to create tutorial projects
├── commands/
│   ├── menu.md                   # /menu - pause menu (progress, curriculum, restart options)
│   ├── quiz.md                   # /quiz - 12 MC questions in 3 batches
│   └── tutorial.md               # /tutorial - start or resume a tutorial
├── hooks/
│   ├── capstone-test-runner.sh   # PreToolUse hook on TodoWrite
│   ├── compact-hook.sh           # SessionStart (compact) to recover after compaction
│   └── tutorial-prompt.sh        # SessionStart (startup/resume/clear) to offer /tutorial
├── prompts/
│   └── session.md                # Lesson flow: teach, quiz, interview, advance
├── mcp-servers/learning-tracker/ # SQLite-backed progress tracker
├── install.sh                    # Installation script
├── uninstall.sh                  # Uninstallation script
└── README.md                     # User documentation
```

## Key Design Decisions

**Project Structure**
1. **Local Project Data** — Each tutorial project stores its own data in `.multivac/learning.db`; MCP server configured per-project via `.mcp.json`
2. **Local CLAUDE.md** — Created in tutorial project directories to survive compaction
3. **Per-Lesson Exercise Directories** — Each lesson's code goes in `exercises/{part}/{chapter}/{lesson}/`; created when starting the exercise (not upfront); keeps modules, tests, and config isolated between lessons; scaffolding created as needed based on lesson goals
4. **Version Management** — Projects embed `<!-- multivac-version: X.X.X -->` in CLAUDE.md; session.md checks this against the installed version on startup and runs `multivac upgrade` if outdated; database has `schema_version` table for migration support

**Session Management**
5. **Token Management** — Sessions restart at chapter boundaries; MCP server persists progress
6. **Auto-Prompt on Session Start** — SessionStart hook detects tutorial projects and offers to start/continue; checks for `learning.db` to determine which

**Curriculum & Content**
7. **Tutorial Types** — `programming` (code interviews + capstones) vs `general` (knowledge interviews, no capstones); type auto-detected from topic
8. **Current Information Verification** — Before curriculum creation, Claude searches for current versions/best practices and caches findings in `.multivac/current-info.md`; cache persists across context compaction and is checked before each lesson to short-circuit redundant searches and prevent fallback to stale training data
9. **Fact Verification for General Topics** — Programming has a natural safety net (code runs or doesn't); general topics don't. For specific technical claims (terminology, formulas, linguistic rules), verify against authoritative sources rather than relying on training data
10. **Generic Commands** — /quiz and interview-agent work outside tutorials; session.md adds MCP integration

**Learning Flow**
11. **Separated Commands** — /tutorial starts new tutorials; /menu is the pause menu for existing tutorials (view progress, curriculum, restart, exit); single responsibility per command
12. **Batched Quizzes** — 3 prompts of 4 questions, not 12 individual prompts
13. **Queue-Based Spaced Repetition** — Completed lessons added to review queue; reviewed at chapter start; correct answers remove from queue, incorrect answers move to end
14. **Incremental Capstone Tests** — Tests written per-milestone, not all at once (programming only)

## Interview Agent Details

Two formats based on tutorial type:

**Programming format:**
- 4 code writing + 4 code analysis questions
- Creates scratch file (e.g., `interview_scratch.py`) for code writing
- User writes code in their editor, says "ready" when done
- Agent reads and evaluates the file
- Scratch file deleted after interview

**General format:**
- 4 knowledge demonstration + 4 analysis questions
- No scratch file needed — written/verbal responses

**Both formats:**
- Scoring: 0-5 per question (0 = pass/skip, 5 = excellent)
- Output presented verbatim to user (no summarization)

## MCP Server Tools

| Tool | Purpose |
|------|---------|
| `create_tutorial` | Generate new curriculum (with type and difficulty_level) |
| `get_tutorial` | Full structure + stats (heavy — use for progress screen, certificate) |
| `get_tutorial_metadata` | Lightweight: name, type, status, difficulty_level, dates (quick checks) |
| `start_tutorial` | Begin a tutorial |
| `get_current_position` | Current lesson/chapter/part, is_chapter_start |
| `advance_position` | Move forward, add lesson to review queue |
| `log_quiz_result` | Record quiz scores |
| `log_interview_result` | Record interview performance |
| `log_capstone_result` | Record capstone completion |
| `get_review_queue` | Get lessons pending review |
| `log_review_result` | Correct removes from queue, incorrect moves to end |
| `reset_progress` | Reset progress while keeping curriculum structure |

## Installation Target

Files install to `~/.claude/`:
- Agents, commands, hooks, prompts go to their respective directories
- MCP server goes to `~/.claude/mcp-servers/learning-tracker/`
- `multivac` command goes to `~/.local/bin/`

Per-project configuration (created by `multivac` command, updated by `multivac upgrade`):
- `CLAUDE.md` — Tutorial marker with version stamp (`<!-- multivac-version: X.X.X -->`) and topic
- `.mcp.json` — MCP server config with `MULTIVAC_DATA_DIR` pointing to local data
- `.claude/settings.json` — Hook config (SessionStart for tutorial prompt, PreToolUse for capstone tests)
- `.multivac/` — Local data directory containing:
  - `learning.db` — Tutorial progress and curriculum (SQLite)
  - `current-info.md` — Cached version/API verification (created during curriculum setup)

## Testing

To test components:
- **MCP Server**: `cd ~/.claude/mcp-servers/learning-tracker && npm run build && npm start`
- **Hook**: Echo mock JSON to the hook script
- **Commands**: Run `/quiz`, `/tutorial`, or `/menu` in Claude Code
- **Interview Agent**: Use Task tool to spawn with agent instructions

## Secret Feature

There's an easter egg in session.md. Don't mention it.
