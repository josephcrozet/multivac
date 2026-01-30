# Tutorial Command

Start, continue, or manage a structured tutorial.

## Step 1: Check Tutorial State

Call `get_tutorial_metadata` from the learning-tracker MCP server.

**If the call fails or the MCP server is not available:**

This isn't a Multivac tutorial project. Tell the user:

"This directory isn't set up as a tutorial project. To start a tutorial:

1. Exit Claude Code (`/exit`)
2. Run: `multivac <topic>` (e.g., `multivac python`)
3. This creates a tutorial project and launches Claude Code
4. Then run `/tutorial` to begin"

**If the call succeeds:**

- **Metadata exists (not null):** Go to Step 3 (Tutorial Menu) — pass the metadata along
- **No metadata (`metadata: null`):** Go to Step 2 (New Tutorial Setup)

## Step 2: New Tutorial Setup

No tutorial exists in this project yet.

1. Read the topic from the CLAUDE.md file (look for `<!-- topic: X -->` or `**Topic:** X`)
2. Read and follow the complete tutorial instructions from: `~/.claude/prompts/tutorial-session.md`

**Topic Selection:**

Present topic options using `AskUserQuestion`:

- **First option:** The topic from CLAUDE.md (e.g., "Python") marked as "(Recommended)"
- **Additional options:** 3 related topics based on the directory name. Generate suggestions that would naturally follow from or complement studying that topic (e.g., a web framework after a language, advanced topics in the same domain, or complementary skills). Don't just suggest random popular topics.
- **For generic names like "tutorial":** Python, JavaScript, Web Development, Data Analysis
- User can always enter a custom topic

**After topic selection:**

If the user selects a different topic than what's in CLAUDE.md, update the file:

1. Replace `<!-- topic: X -->` with the new topic
2. Replace `**Topic:** X` with the new topic

## Step 3: Tutorial Menu

A tutorial exists in this project. Use the metadata from Step 1 to check status:
- `status === 'completed'` → Tutorial is completed
- `status === 'in_progress'` → Tutorial is in progress

### If Tutorial is Completed

Use `AskUserQuestion` to present options:

**Question:** "You've completed this tutorial! What would you like to do?"

**Options (in this order):**

1. **Review** — "Work through your spaced repetition queue"
2. **View progress** — "See your final stats, get certificate, and see suggested topics"
3. **Start over** — "Clear all progress and restart from the beginning"
4. **Exit** — "Return to regular Claude Code"

#### If "Review" selected

Start a review session using the same mechanics as midgame review:

1. Call `get_review_queue` with `limit: 4`
2. If `queue_replenished` is true, tell the user: "Starting a fresh review cycle with all 48 lessons!"
3. Follow the "Review Queue" instructions in `~/.claude/prompts/tutorial-session.md` to review the returned lessons (ask questions, log results)
4. After reviewing, report progress using `total_in_queue` from the response:
   - If 0: "Review complete! Your queue is empty. Come back anytime to start a fresh cycle."
   - Otherwise: "Session complete! {N} lessons remaining in your queue."
5. Return to this menu.

#### If "View progress" selected (completed)

1. Display the Progress Screen (see format below) — call `get_tutorial` for full stats
2. Use `AskUserQuestion` to ask: "Would you like me to save a copy of your completion certificate?"
   - If yes: Generate the certificate (see `tutorial-session.md` for template), save to `{topic}-certificate.txt`, confirm save
   - If no: Continue
3. Generate and display topic suggestions (see `tutorial-session.md` for the "Suggest Next Topics" instructions) — use `difficulty_level` from metadata
4. Return to this menu

### If Tutorial is In Progress

First, call `get_current_position` to check if `is_chapter_start` is true.

**If at chapter start:** Display a tip before showing the menu:
> Tip: Run `/rename {Topic}-{Part}-{Chapter}` to keep your sessions organized.

Example: "Tip: Run `/rename Python-II-1` to keep your sessions organized."

Then use `AskUserQuestion` to present options:

**Question:** "You have a tutorial in progress. What would you like to do?"

**Options (in this order):**

1. **Continue** — "Resume learning from your current position"
2. **View progress** — "See your stats and progress in detail"
3. **Start over** — "Clear all progress and restart from the beginning"
4. **Exit tutorial** — "Leave tutorial mode and return to regular Claude Code"

#### If "Continue" selected

Read and follow `~/.claude/prompts/tutorial-session.md` to resume the lesson flow.

#### If "View progress" selected (in progress)

Display the Progress Screen (see format below) — call `get_tutorial` for full stats. Then return to this menu.

### If "Start over" selected

Use `AskUserQuestion` to ask: "How would you like to restart?"

**Options:**

1. **Restart this curriculum** — "Reset your progress but keep the same lesson structure"
2. **Change topics and start fresh** — "Delete everything and create a new curriculum"

**If "Restart this curriculum":**

- Call `reset_progress` from the MCP server
- Tell the user: "Progress reset. For a fresh learning experience, run `/clear` to reset the conversation context, then `/tutorial` to begin."
- End the command (do not auto-start the tutorial)

**If "Change topics and start fresh":**

- Delete the `.multivac/learning.db` file
- Tell the user: "Tutorial deleted. Run `/clear` to reset the conversation context, then `/tutorial` to set up your new topic."
- End the command (do not auto-start the tutorial)

### If "Exit tutorial" selected

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

Check `tutorial.type` from the `get_tutorial` response to determine which template to use. Include the difficulty level (Beginner/Intermediate/Advanced).

**For programming tutorials (`type: "programming"`):**

```
╔══════════════════════════════════════════════════════════════╗
║  ░█▀█░█▀▄░█▀█░█▀▀░█▀▄░█▀▀░█▀▀░█▀▀                            ║
║  ░█▀▀░█▀▄░█░█░█░█░█▀▄░█▀▀░▀▀█░▀▀█                            ║
║  ░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀                            ║
╠══════════════════════════════════════════════════════════════╣
║  {DIFFICULTY} {NAME}                    PART {N}: {part_name}║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  CURRENT POSITION                                            ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  ► Chapter {C}: {chapter_name}                         │  ║
║  │    Lesson {L}: {lesson_name}                           │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  PART PROGRESS                                               ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  Chapter 1  {progress_bar}  {status}                   │  ║
║  │  Chapter 2  {progress_bar}  {status}                   │  ║
║  │  Chapter 3  {progress_bar}  {status}    ◄── YOU        │  ║
║  │  Chapter 4  {progress_bar}  {status}                   │  ║
║  │  Capstone   {progress_bar}  {status}                   │  ║
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

**For general tutorials (`type: "general"`):**

```
╔══════════════════════════════════════════════════════════════╗
║  ░█▀█░█▀▄░█▀█░█▀▀░█▀▄░█▀▀░█▀▀░█▀▀                            ║
║  ░█▀▀░█▀▄░█░█░█░█░█▀▄░█▀▀░▀▀█░▀▀█                            ║
║  ░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀                            ║
╠══════════════════════════════════════════════════════════════╣
║  {DIFFICULTY} {NAME}                    PART {N}: {part_name}║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  CURRENT POSITION                                            ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  ► Chapter {C}: {chapter_name}                         │  ║
║  │    Lesson {L}: {lesson_name}                           │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  PART PROGRESS                                               ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  Chapter 1  {progress_bar}  {status}                   │  ║
║  │  Chapter 2  {progress_bar}  {status}                   │  ║
║  │  Chapter 3  {progress_bar}  {status}    ◄── YOU        │  ║
║  │  Chapter 4  {progress_bar}  {status}                   │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  STATS                        │  REVIEW QUEUE                ║
║  ─────────────────────────────│───────────────────────────── ║
║  Lessons:     {X}/{Y} ({Z}%)  │  {N} lessons pending         ║
║  Quizzes Avg: {Q}%            │  ┌─────────────────────────┐ ║
║  Interviews:  {I}/{J}         │  │ • {concept_1}           │ ║
║                               │  │ • {concept_2}           │ ║
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
╔══════════════════════════════════════════════════════════════╗
║  ░█▀█░█▀▄░█▀█░█▀▀░█▀▄░█▀▀░█▀▀░█▀▀                            ║
║  ░█▀▀░█▀▄░█░█░█░█░█▀▄░█▀▀░▀▀█░▀▀█                            ║
║  ░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀                            ║
╠══════════════════════════════════════════════════════════════╣
║  Intermediate Python                       PART II: {name}   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  CURRENT POSITION                                            ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  ► Chapter 3: Object-Oriented Programming              │  ║
║  │    Lesson 2: Inheritance                               │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  PART PROGRESS                                               ║
║  ┌────────────────────────────────────────────────────────┐  ║
║  │  Chapter 1  ████████████████████  CLEAR                │  ║
║  │  Chapter 2  ████████████████████  CLEAR                │  ║
║  │  Chapter 3  █████████░░░░░░░░░░░  45%    ◄── YOU       │  ║
║  │  Chapter 4  ░░░░░░░░░░░░░░░░░░░░  LOCKED               │  ║
║  │  Capstone   ░░░░░░░░░░░░░░░░░░░░  LOCKED               │  ║
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

For general tutorials, omit the "Capstone" row in PART PROGRESS and the "Capstones" line in STATS.
