# Menu Command

Show navigation options for an in-progress or completed tutorial.

## Step 1: Check Tutorial State

Call `get_tutorial_metadata` from the learning-tracker MCP server.

**If the call fails or the MCP server is not available:**

This isn't a Multivac tutorial project. Tell the user:

"The `/menu` command only works in Multivac tutorial projects. To create one:

1. Exit Claude Code (`/exit`)
2. Run: `multivac <topic> --launch` (e.g., `multivac python --launch`)
3. This creates a tutorial project and launches Claude Code
4. You'll be prompted to start automatically"

**If the call succeeds:**

- **Metadata exists (not null):** Go to Step 2 (Show Menu) — pass the metadata along
- **No metadata (`metadata: null`):** Tell the user: "No tutorial created yet. Run `/tutorial` to set one up."

## Step 2: Show Menu

Use the metadata from Step 1 to check status:
- `status === 'completed'` → Tutorial is completed
- `status === 'in_progress'` → Tutorial is in progress

### If Tutorial is Completed

Use `AskUserQuestion` to present options:

**Question:** "You've completed this tutorial! What would you like to do?"

**Options (in this order):**

1. **Review** — "Work through your spaced repetition queue"
2. **View curriculum** — "See the full table of contents"
3. **View progress** — "See your final stats, get certificate, and see suggested topics"
4. **More...** — "Credits, start over, or quit"

#### If "Review" selected

Start a review session using the same mechanics as midgame review:

1. Call `get_review_queue` with `limit: 4`
2. If `queue_replenished` is true, tell the user: "Starting a fresh review cycle with all 48 lessons!"
3. Follow the "Review Queue" instructions in `~/.claude/prompts/session.md` to review the returned lessons (ask questions, log results)
4. After reviewing, report progress using `total_in_queue` from the response:
   - If 0: "Review complete! Your queue is empty. Come back anytime to start a fresh cycle."
   - Otherwise: "Session complete! {N} lessons remaining in your queue."
5. Return to this menu.

#### If "View curriculum" selected (completed)

Display the Curriculum Tree (see format below). Then return to this menu.

#### If "View progress" selected (completed)

1. Display the Progress Screen (see format below) — call `get_tutorial` for full stats
2. Use `AskUserQuestion` to ask: "Would you like me to save a copy of your completion certificate?"
   - If yes: Generate the certificate (see `session.md` for template), save to `{topic}-certificate.txt`, confirm save
   - If no: Continue
3. Generate and display topic suggestions (see `session.md` for the "Suggest Next Topics" instructions) — use `difficulty_level` from metadata
4. Return to this menu

### If Tutorial is In Progress

First, call `get_current_position` to check if `is_chapter_start` is true.

**If at chapter start:** Display a tip before showing the menu:
> Tip: Run `/rename {Topic}-{Part}-{Chapter}` to keep your sessions organized.

Example: "Tip: Run `/rename Python-II-1` to keep your sessions organized."

Then use `AskUserQuestion` to present options:

**Question:** "What would you like to do?"

**Options (in this order):**

1. **Continue** — "Resume learning from your current position"
2. **View curriculum** — "See the full table of contents"
3. **View progress** — "See your stats and progress in detail"
4. **More...** — "Credits, start over, or quit"

#### If "Continue" selected

Read and follow `~/.claude/prompts/session.md` to resume the lesson flow.

#### If "View curriculum" selected (in progress)

Display the Curriculum Tree (see format below). Say "Take your time." Then use `AskUserQuestion` with the question "What next?" and these options:

- "Continue" (Recommended) — Resume the lesson
- "Back to menu" — Return to the main menu

If they choose "Continue", resume the lesson flow from the current position. If "Back to menu", return to the main menu.

#### If "View progress" selected (in progress)

Display the Progress Screen (see format below) — call `get_tutorial` for full stats. Say "Here's where you stand." Then use `AskUserQuestion` with the question "What next?" and these options:

- "Continue" (Recommended) — Resume the lesson
- "Back to menu" — Return to the main menu

If they choose "Continue", resume the lesson flow from the current position. If "Back to menu", return to the main menu.

### If "More..." selected

Use `AskUserQuestion` with the question "More options:" and these options:

1. **Back to menu** — "Return to the main menu"
2. **Credits** — "See who made this"
3. **Start over** — "Clear all progress and restart"
4. **Quit** — "Return to normal Claude Code"

#### If "Back to menu" selected

Return to the main menu (completed or in-progress, whichever state applies).

#### If "Credits" selected

Display the credits screen:

```
═══════════════════════════════════
          C R E D I T S
═══════════════════════════════════

  Created by Joseph Crozet
  lastquestion.dev

  Powered by Claude
  Built with Claude Code

  github.com/josephcrozet/multivac

═══════════════════════════════════
```

Then return to the main menu.

#### If "Start over" selected

Use `AskUserQuestion` to ask: "How would you like to restart?"

**Options:**

1. **Restart this curriculum** — "Reset your progress but keep the same lesson structure"
2. **Change topics and start fresh** — "Delete everything and create a new curriculum"
3. **Cancel** — "Go back without changing anything"

**If "Cancel":** Return to the main menu.

**If "Restart this curriculum":**

- Call `reset_progress` from the MCP server
- Tell the user: "Progress reset. For a fresh learning experience, run `/clear` to reset the conversation context, then `/tutorial` to begin."
- End the command (do not auto-start the tutorial)

**If "Change topics and start fresh":**

- Delete the `.multivac/learning.db` file
- Tell the user: "Tutorial deleted. Run `/clear` to reset the conversation context, then `/tutorial` to set up your new topic."
- End the command (do not auto-start the tutorial)

#### If "Quit" selected

Say "Progress saved. Run `/tutorial` anytime to pick up where you left off." Then stop the tutorial flow.

---

## Progress Screen Format

Display tutorial progress in a retro video game-style ASCII art format.

### Data Collection

1. Call `get_tutorial` to get full stats
2. Call `get_review_queue` to see pending reviews
3. Call `get_current_position` to get current location

### Screen Template

Include the difficulty level (Beginner/Intermediate/Advanced).

```
╔══════════════════════════════════════════════════════════════════════╗
║  ░█▀█░█▀▄░█▀█░█▀▀░█▀▄░█▀▀░█▀▀░█▀▀                                    ║
║  ░█▀▀░█▀▄░█░█░█░█░█▀▄░█▀▀░▀▀█░▀▀█                                    ║
║  ░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀                                    ║
╠══════════════════════════════════════════════════════════════════════╣
║  {DIFFICULTY} {NAME}                        PART {N}: {part_name}    ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  CURRENT POSITION                                                    ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │  ► Chapter {C}: {chapter_name}                                 │  ║
║  │    Lesson {L}: {lesson_name}                                   │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  PART PROGRESS                                                       ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │  Chapter 1  {progress_bar}  {status}                           │  ║
║  │  Chapter 2  {progress_bar}  {status}                           │  ║
║  │  Chapter 3  {progress_bar}  {status}    ◄── YOU                │  ║
║  │  Chapter 4  {progress_bar}  {status}                           │  ║
║  │  Capstone   {progress_bar}  {status}                           │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  STATS                            │  REVIEW QUEUE                    ║
║  ─────────────────────────────────│───────────────────────────────── ║
║  Lessons:     {X}/{Y} ({Z}%)      │  {N} lessons pending             ║
║  Quizzes Avg: {Q}%                │  ┌─────────────────────────────┐ ║
║  Interviews:  {I}/{J}             │  │ • {concept_1}               │ ║
║  Capstones:   {C}/{D}             │  │ • {concept_2}               │ ║
║                                   │  │ • {concept_3}               │ ║
║                                   │  │ • {concept_4}               │ ║
║                                   │  └─────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════╣
║                             ▶ CONTINUE ◀                             ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Progress Bar Format

Use block characters to show progress (20 characters wide):

- `████████████████████` = 100%
- `██████████░░░░░░░░░░` = 50%
- `░░░░░░░░░░░░░░░░░░░░` = 0%

Calculate proportionally: `filled_chars = round(percentage / 100 * 20)`

### Status Labels

- `CLEAR` — Chapter completed
- `{X}%` — Chapter in progress (show percentage)
- `LOCKED` — Chapter not yet started (previous not complete)

### Review Queue Display

For each lesson in the queue:

- Pick one representative concept name to display
- If queue is empty, show "Queue empty - great work!"
- If queue has more than 4 items, show first 4 with "+ N more"

### Example with Real Data (Programming Tutorial)

```
╔══════════════════════════════════════════════════════════════════════╗
║  ░█▀█░█▀▄░█▀█░█▀▀░█▀▄░█▀▀░█▀▀░█▀▀                                    ║
║  ░█▀▀░█▀▄░█░█░█░█░█▀▄░█▀▀░▀▀█░▀▀█                                    ║
║  ░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀                                    ║
╠══════════════════════════════════════════════════════════════════════╣
║  Intermediate Python                            PART II: {name}      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  CURRENT POSITION                                                    ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │  ► Chapter 3: Object-Oriented Programming                      │  ║
║  │    Lesson 2: Inheritance                                       │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  PART PROGRESS                                                       ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │  Chapter 1  ████████████████████  CLEAR                        │  ║
║  │  Chapter 2  ████████████████████  CLEAR                        │  ║
║  │  Chapter 3  █████████░░░░░░░░░░░  45%    ◄── YOU               │  ║
║  │  Chapter 4  ░░░░░░░░░░░░░░░░░░░░  LOCKED                       │  ║
║  │  Capstone   ░░░░░░░░░░░░░░░░░░░░  LOCKED                       │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  STATS                            │  REVIEW QUEUE                    ║
║  ─────────────────────────────────│───────────────────────────────── ║
║  Lessons:     22/48  (46%)        │  4 lessons pending               ║
║  Quizzes Avg: 88%                 │  ┌─────────────────────────────┐ ║
║  Interviews:  6/12                │  │ • list comprehensions       │ ║
║  Capstones:   1/3                 │  │ • dictionary methods        │ ║
║                                   │  │ • exception handling        │ ║
║                                   │  │ • lambda functions          │ ║
║                                   │  └─────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════╣
║                             ▶ CONTINUE ◀                             ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## Curriculum Tree Format

Display the full curriculum as a tree diagram showing all parts, chapters, and lessons with progress indicators.

### Data Collection

Call `get_tutorial` to get the full curriculum structure including:
- Parts (with completion status)
- Chapters (with completion status)
- Lessons (with completion status)

Also call `get_current_position` to identify the current lesson.

### Tree Structure

```
{TOPIC} - Full Curriculum
══════════════════════════

PART I: {part_name}
├─ Chapter 1: {chapter_name}
│  ├─ ✓ Lesson 1: {lesson_name}
│  ├─ ✓ Lesson 2: {lesson_name}
│  ├─ ► Lesson 3: {lesson_name}  ◄── YOU ARE HERE
│  ├─ ○ Lesson 4: {lesson_name}
│  └─ ○ Mock Interview
├─ Chapter 2: {chapter_name}
│  ├─ ○ Lesson 1: {lesson_name}
│  ├─ ○ Lesson 2: {lesson_name}
│  ├─ ○ Lesson 3: {lesson_name}
│  ├─ ○ Lesson 4: {lesson_name}
│  └─ ○ Mock Interview
├─ Chapter 3: {chapter_name}
│  └─ ...
├─ Chapter 4: {chapter_name}
│  └─ ...
└─ ◆ Capstone Project

PART II: {part_name}
├─ Chapter 1: {chapter_name}
│  └─ ...
...

PART III: {part_name}
...

──────────────────────────
Legend: ✓ completed  ► current  ○ upcoming  ◆ capstone
```

### Progress Indicators

- `✓` — Lesson or mock interview completed
- `►` — Current lesson (with `◄── YOU ARE HERE` marker)
- `○` — Upcoming lesson or mock interview (not yet started)
- `◆` — Capstone project (programming tutorials only)

### Display Rules

1. Show ALL parts, chapters, and lessons (the full 48-lesson curriculum)
2. Show `Mock Interview` at the end of each chapter (after the 4 lessons)
3. For programming tutorials, show `◆ Capstone Project` at the end of each part
4. For general tutorials, omit capstone projects (they don't have them)
5. Use tree-drawing characters (`├─`, `│`, `└─`) for clean hierarchy
6. Mark the current lesson with `►` and append `◄── YOU ARE HERE`
7. For completed tutorials, all items show `✓` and omit the "YOU ARE HERE" marker
