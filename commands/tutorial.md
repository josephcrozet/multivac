# Tutorial Command

Start, continue, or manage a structured programming tutorial.

## Step 1: Check Tutorial State

Call `list_tutorials` from the learning-tracker MCP server.

**If the call fails or the MCP server is not available:**

Diagnose the issue by running:
```bash
jq -r --arg cwd "$PWD" 'if .projects[$cwd].mcpServers then "project-specific" else "none" end' ~/.claude.json 2>/dev/null || echo "none"
```

- **If "project-specific":** Ask: "The learning-tracker MCP server isn't available because this project has custom MCP servers. Would you like me to add it to this project's settings?" If yes, run:
  ```bash
  jq --arg cwd "$PWD" --arg path "$HOME/.claude/mcp-servers/learning-tracker/dist/index.js" \
    '.projects[$cwd].mcpServers["learning-tracker"] = {"type": "stdio", "command": "node", "args": [$path], "env": {}}' \
    ~/.claude.json > /tmp/claude.json.tmp && mv /tmp/claude.json.tmp ~/.claude.json
  ```
  Then: "Done! Please restart Claude Code and run /tutorial again."

- **If "none":** "The learning-tracker MCP server is required. Please run the Multivac installer: `bash install.sh`"

**If the call succeeds:**

- **Active tutorial exists (status: in_progress):** Go directly to Step 3 (Active Tutorial Menu)
- **No tutorials exist (or all completed):** Go to Step 2 (New Tutorial Flow)

## Step 2: New Tutorial Flow

No active tutorial found. First, check for optional components:

```bash
missing=""; [ ! -f ~/.claude/commands/quiz.md ] && missing="$missing quiz"; [ ! -f ~/.claude/agents/interview-agent.md ] && missing="$missing interview"; [ ! -f ~/.claude/hooks/capstone-test-runner.sh ] && missing="$missing hook"; echo "${missing:-ok}"
```

- If output is "ok": Continue silently.
- If output lists missing components: Warn the user, then ask "Continue anyway?"

Then proceed with setup:

1. Inform the user: "For the best learning experience, please run `/output-style learning` if you haven't already."
2. Read and follow the complete tutorial instructions from: `~/.claude/prompts/tutorial-session.md`

## Step 3: Active Tutorial Menu

An active tutorial exists. Use `AskUserQuestion` to present options:

**Question:** "You have an active tutorial in progress. What would you like to do?"

**Options (in this order):**
1. **Continue** — "Resume learning from your current position"
2. **View progress** — "See your stats and progress in detail"
3. **Start over** — "Clear all progress and restart from the beginning"
4. **Exit tutorial** — "Leave tutorial mode and return to regular Claude Code"

### If "Continue" selected:
Read and follow `~/.claude/prompts/tutorial-session.md` to resume the lesson flow.

### If "View progress" selected:
Display the Progress Screen (see format below), then return to this menu.

### If "Start over" selected:
**Requires confirmation.** Ask: "This will erase all your progress in this tutorial. Are you sure?"
- If confirmed: Clear the tutorial progress (delete and recreate, or reset to initial state) and go to Step 2.
- If cancelled: Return to menu.

### If "Exit tutorial" selected:
**Requires confirmation.** Ask: "Exit tutorial mode? Your progress is saved and you can resume anytime with /tutorial."
- If confirmed: End the command. Do not load tutorial-session.md.
- If cancelled: Return to menu.

---

## Progress Screen Format

Display tutorial progress in a retro video game-style ASCII art format.

### Data Collection
1. Call `get_tutorial` with the tutorial_id to get full stats
2. Call `get_review_queue` to see pending reviews
3. Call `get_current_position` to get current location

### Screen Template

```
╔══════════════════════════════════════════════════════════════╗
║  ░█▀█░█▀▄░█▀█░█▀▀░█▀▄░█▀▀░█▀▀░█▀▀                            ║
║  ░█▀▀░█▀▄░█░█░█░█░█▀▄░█▀▀░▀▀█░▀▀█                            ║
║  ░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀                            ║
╠══════════════════════════════════════════════════════════════╣
║  TUTORIAL: {name}                     LEVEL {N}: {level_name}║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  CURRENT POSITION                                            ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  ► Module {M}: {module_name}                           │  ║
║  │    Lesson {L}: {lesson_name}                           │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  LEVEL PROGRESS                                              ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  Module 1  {progress_bar}  {status}                    │  ║
║  │  Module 2  {progress_bar}  {status}                    │  ║
║  │  Module 3  {progress_bar}  {status}    ◄── YOU         │  ║
║  │  Module 4  {progress_bar}  {status}                    │  ║
║  │  Capstone  {progress_bar}  {status}                    │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  STATS                        │  REVIEW QUEUE                ║
║  ─────────────────────────────│───────────────────────────── ║
║  Lessons:     {X}/{Y} ({Z}%)  │  {N} lessons pending         ║
║  Quizzes Avg: {Q}%            │  ┌─────────────────────────┐ ║
║  Interviews:  {I}/{J}         │  │ • {concept_1}           │ ║
║  Capstones:   {C}/{D}         │  │ • {concept_2}           │ ║
║                               │  │ • {concept_3}           │ ║
║                               │  │ • {concept_4}           │ ║
║                               │  └─────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════╣
║                    ▶ CONTINUE ◀                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Progress Bar Format

Use block characters to show progress (20 characters wide):
- `████████████████████` = 100%
- `██████████░░░░░░░░░░` = 50%
- `░░░░░░░░░░░░░░░░░░░░` = 0%

Calculate proportionally: `filled_chars = round(percentage / 100 * 20)`

### Status Labels

- `CLEAR` — Module completed
- `{X}%` — Module in progress (show percentage)
- `LOCKED` — Module not yet started (previous not complete)

### Review Queue Display

For each lesson in the queue:
- Pick one representative concept name to display
- If queue is empty, show "Queue empty - great work!"
- If queue has more than 4 items, show first 4 with "+ N more"

### Example with Real Data

```
╔══════════════════════════════════════════════════════════════╗
║  ░█▀█░█▀▄░█▀█░█▀▀░█▀▄░█▀▀░█▀▀░█▀▀                            ║
║  ░█▀▀░█▀▄░█░█░█░█░█▀▄░█▀▀░▀▀█░▀▀█                            ║
║  ░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀                            ║
╠══════════════════════════════════════════════════════════════╣
║  TUTORIAL: Python                   LEVEL 2: Intermediate    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  CURRENT POSITION                                            ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  ► Module 3: Object-Oriented Programming               │  ║
║  │    Lesson 2: Inheritance                               │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  LEVEL PROGRESS                                              ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  Module 1  ████████████████████  CLEAR                 │  ║
║  │  Module 2  ████████████████████  CLEAR                 │  ║
║  │  Module 3  █████████░░░░░░░░░░░  45%    ◄── YOU        │  ║
║  │  Module 4  ░░░░░░░░░░░░░░░░░░░░  LOCKED                │  ║
║  │  Capstone  ░░░░░░░░░░░░░░░░░░░░  LOCKED                │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  STATS                        │  REVIEW QUEUE                ║
║  ─────────────────────────────│───────────────────────────── ║
║  Lessons:     22/48  (46%)    │  4 lessons pending           ║
║  Quizzes Avg: 88%             │  ┌─────────────────────────┐ ║
║  Interviews:  6/12            │  │ • list comprehensions   │ ║
║  Capstones:   1/3             │  │ • dictionary methods    │ ║
║                               │  │ • exception handling    │ ║
║                               │  │ • lambda functions      │ ║
║                               │  └─────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════╣
║                    ▶ CONTINUE ◀                              ║
╚══════════════════════════════════════════════════════════════╝
```
