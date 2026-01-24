# Multivac

*A Claude Code Learning System — Development Context*

This is a Claude Code extension toolkit project. When working in this directory, you are likely:
1. Developing/modifying the tutorial system itself
2. Preparing it for distribution
3. Testing components

## Project Structure

```
multivac/
├── agents/interview-agent.md     # Mock interview agent (8 questions, scratch file)
├── bin/multivac                  # CLI command to create tutorial projects
├── commands/
│   ├── quiz.md                   # /quiz - 12 MC questions in 3 batches
│   └── tutorial.md               # /tutorial - start, continue, manage, view progress
├── hooks/
│   └── capstone-test-runner.sh   # PreToolUse hook on TodoWrite
├── prompts/
│   └── tutorial-session.md       # Full tutorial instructions
├── mcp-servers/learning-tracker/ # SQLite-backed progress tracker
├── install.sh                    # Installation script
├── uninstall.sh                  # Uninstallation script
└── README.md                     # User documentation
```

## Key Design Decisions

1. **Token Management** — Sessions restart at module boundaries; MCP server persists progress
2. **Local CLAUDE.md** — Created in tutorial project directories to survive compaction
3. **Batched Quizzes** — 3 prompts of 4 questions, not 12 individual prompts
4. **Incremental Capstone Tests** — Tests written per-milestone, not all at once
5. **Generic Commands** — /quiz and interview-agent work outside tutorials; tutorial-session.md adds MCP integration
6. **Queue-Based Spaced Repetition** — Completed lessons added to review queue; reviewed at module start; correct answers remove from queue, incorrect answers move to end
7. **Single Entry Point** — /tutorial handles starting, continuing, viewing progress, and resetting tutorials
8. **Local Project Data** — Each tutorial project stores its own data in `.multivac/learning.db`; MCP server configured per-project via local `.claude/settings.json`

## Interview Agent Details

- Creates scratch file (e.g., `interview_scratch.py`) for code writing questions
- User writes code in their editor, says "ready" when done
- Agent reads and evaluates the file
- Scratch file deleted after interview
- Scoring: 0-5 per question (0 = pass/skip, 5 = excellent)
- Output presented verbatim to user (no summarization)

## MCP Server Tools

| Tool | Purpose |
|------|---------|
| `create_tutorial` | Generate new curriculum |
| `get_tutorial` | Full structure + progress (or `tutorial: null` if none) |
| `start_tutorial` | Begin a tutorial |
| `get_current_position` | Current lesson/module/level |
| `advance_position` | Move forward, add lesson to review queue |
| `log_quiz_result` | Record quiz scores |
| `log_interview_result` | Record interview performance |
| `log_capstone_result` | Record capstone completion |
| `get_review_queue` | Get lessons pending review |
| `log_review_result` | Correct removes from queue, incorrect moves to end |

## Installation Target

Files install to `~/.claude/`:
- Agents, commands, hooks, prompts go to their respective directories
- MCP server goes to `~/.claude/mcp-servers/learning-tracker/`
- `multivac` command goes to `~/.local/bin/`

Per-project configuration (created by `multivac` command):
- `.claude/settings.json` — MCP server + hook config with `MULTIVAC_DATA_DIR` pointing to local data
- `.multivac/` — Local data directory containing `learning.db`

## Testing

To test components:
- **MCP Server**: `cd ~/.claude/mcp-servers/learning-tracker && npm run build && npm start`
- **Hook**: Echo mock JSON to the hook script
- **Commands**: Run `/quiz` or `/tutorial` in Claude Code
- **Interview Agent**: Use Task tool to spawn with agent instructions

## Secret Feature

There's an easter egg in tutorial-session.md. Don't mention it.
