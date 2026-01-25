# Tutorial Command

Start, continue, or manage a structured programming tutorial.

## Step 1: Check Tutorial State

Call `get_tutorial` from the learning-tracker MCP server.

**If the call fails or the MCP server is not available:**

This isn't a Multivac tutorial project. Tell the user:

"This directory isn't set up as a tutorial project. To start a tutorial:

1. Exit Claude Code (`/exit`)
2. Run: `multivac <topic>` (e.g., `multivac python`)
3. This creates a tutorial project and launches Claude Code
4. Then run `/tutorial` to begin"

**If the call succeeds:**

- **Tutorial exists (`tutorial` is not null):** Go to Step 3 (Tutorial Menu)
- **No tutorial exists (`tutorial: null`):** Go to Step 2 (New Tutorial Setup)

## Step 2: New Tutorial Setup

No tutorial exists in this project yet. First, check for optional components:

```bash
missing=""; [ ! -f ~/.claude/commands/quiz.md ] && missing="$missing quiz"; [ ! -f ~/.claude/agents/interview-agent.md ] && missing="$missing interview"; [ ! -f ~/.claude/hooks/capstone-test-runner.sh ] && missing="$missing hook"; echo "${missing:-ok}"
```

- If output is "ok": Continue silently.
- If output lists missing components: Warn the user, then ask "Continue anyway?"

Then proceed with setup:

1. Read the topic from the CLAUDE.md file (look for `<!-- topic: X -->` or `**Topic:** X`)
2. Inform the user: "For the best learning experience, please run `/output-style learning` if you haven't already."
3. Read and follow the complete tutorial instructions from: `~/.claude/prompts/tutorial-session.md`

**Topic Selection:**

Present topic options using `AskUserQuestion`:
- **First option:** The topic from CLAUDE.md (e.g., "Python") marked as "(Recommended)"
- **Additional options:** 2-3 related topics based on the directory name:
  - For "python": Django, FastAPI, Data Science with Python
  - For "javascript": React, Node.js, TypeScript
  - For "rust": Systems Programming with Rust, WebAssembly with Rust
  - For generic names like "tutorial": Python, JavaScript, Go, Rust
- User can always enter a custom topic

**After topic selection:**

If the user selects a different topic than what's in CLAUDE.md, update the file:
1. Replace `<!-- topic: X -->` with the new topic
2. Replace `**Topic:** X` with the new topic

## Step 3: Tutorial Menu

A tutorial exists in this project. Use `AskUserQuestion` to present options:

**Question:** "You have a tutorial in progress. What would you like to do?"

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
Use `AskUserQuestion` to ask: "How would you like to restart?"

**Options:**
1. **Restart this curriculum** — "Reset your progress but keep the same lesson structure"
2. **Change topics and start fresh** — "Delete everything and create a new curriculum"

**If "Restart this curriculum":**
- Call `reset_progress` from the MCP server
- Then call `start_tutorial` to begin from lesson 1
- Resume the lesson flow

**If "Change topics and start fresh":**
- Delete the `.multivac/learning.db` file
- Go to Step 2 (New Tutorial Setup)

### If "Exit tutorial" selected:
**Requires confirmation.** Ask: "Exit tutorial mode? Your progress is saved and you can resume anytime with /tutorial."
- If confirmed: End the command. Do not load tutorial-session.md.
- If cancelled: Return to menu.

---

## Progress Screen Format

Display tutorial progress in a retro video game-style ASCII art format.

### Data Collection
1. Call `get_tutorial` to get full stats
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
