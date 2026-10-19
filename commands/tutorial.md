# Tutorial Command

Start, continue, or manage a structured tutorial.

## Step 1: Check Tutorial State

Call `get_tutorial_metadata` from the learning-tracker MCP server.

**If the call fails or the MCP server is not available:**

Check whether this is a tutorial project: its `CLAUDE.md` contains a `<!-- multivac-version: ... -->` marker.

**If it is**, the tutorial exists but its learning tracker isn't running — usually because the prompt to approve the `learning-tracker` server was declined, which Claude Code remembers. Tell the user:

"Your learning tracker isn't enabled for this project, so I can't load your tutorial. This usually means the prompt to approve it was declined. To turn it on:

1. Exit Claude Code (`/exit`)
2. In this folder, run: `claude mcp reset-project-choices`
3. Start Claude Code again (`claude`) and approve `learning-tracker` when asked

If you already approved it and still see this, run `multivac upgrade` and then restart Claude Code."

**If it isn't**, this isn't a Multivac tutorial project. Tell the user:

"This directory isn't set up as a tutorial project. To start a tutorial:

1. Exit Claude Code (`/exit`)
2. Run: `multivac <topic> --launch` (e.g., `multivac python --launch`)
3. This creates a tutorial project and launches Claude Code
4. You'll be prompted to start automatically"

**If the call succeeds:**

- **Metadata exists (not null):** Go to Step 3 (Resume Tutorial)
- **No metadata (`metadata: null`):** Go to Step 2 (New Tutorial Setup)

## Step 2: New Tutorial Setup

No tutorial exists in this project yet. Read and follow the complete tutorial instructions from: `~/.claude/prompts/session.md`

## Step 3: Resume Tutorial

A tutorial already exists in this project. Read and follow the complete tutorial instructions from: `~/.claude/prompts/session.md`

This will check the current position and resume from where the user left off.
