# Tutorial Command

Start, continue, or manage a structured tutorial.

## Step 1: Check Tutorial State

Call `get_tutorial_metadata` from the learning-tracker MCP server.

**If the call fails or the MCP server is not available:**

This isn't a Multivac tutorial project. Tell the user:

"This directory isn't set up as a tutorial project. To start a tutorial:

1. Exit Claude Code (`/exit`)
2. Run: `multivac <topic> --launch` (e.g., `multivac python --launch`)
3. This creates a tutorial project and launches Claude Code
4. You'll be prompted to start automatically"

**If the call succeeds:**

- **Metadata exists (not null):** Go to Step 3 (Resume Tutorial)
- **No metadata (`metadata: null`):** Go to Step 2 (New Tutorial Setup)

## Step 2: New Tutorial Setup

No tutorial exists in this project yet.

1. Read the topic from the CLAUDE.md file (look for `<!-- topic: X -->` or `**Topic:** X`)
2. Read and follow the complete tutorial instructions from: `~/.claude/prompts/session.md`

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

**Book Feature:**

Use `AskUserQuestion` to ask: "Would you like to save your lessons to a book for offline review?"

**Options:**

1. **Yes, build my book** — "Each lesson gets saved to a `book/` folder"
2. **No thanks** — "I'll just use the interactive lessons"

- If yes: Create the `book/` directory. The lesson flow will automatically save content there.
- If no: Skip. (They can create the `book/` directory later to enable this.)

## Step 3: Resume Tutorial

A tutorial already exists in this project. Read and follow the complete tutorial instructions from: `~/.claude/prompts/session.md`

This will check the current position and resume from where the user left off.
