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

No tutorial exists in this project yet. Read and follow the complete tutorial instructions from: `~/.claude/prompts/session.md`

## Step 3: Resume Tutorial

A tutorial already exists in this project. Read and follow the complete tutorial instructions from: `~/.claude/prompts/session.md`

This will check the current position and resume from where the user left off.
