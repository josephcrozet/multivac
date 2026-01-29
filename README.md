# Multivac

_A Claude Code Learning System_

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║               ░█▄░▄█░█░█░█░░▀█▀░█░█░█░█▀█░█▀▀░               ║
║               ░█░▀░█░█░█░█░░░█░░█░▀▄▀░█▀█░█░░░               ║
║               ░▀░░░▀░▀▀▀░▀▀▀░▀░░▀░░▀░░▀░▀░▀▀▀░               ║
║                                                              ║
║              Learn with AI-guided lessons,                   ║
║       quizzes, mock interviews, and capstone projects        ║
║                                                              ║
║                  ▶ INSERT TOKEN TO START ◀                   ║
║                       (run /tutorial)                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

Transform Claude Code into a structured learning environment. Pick any topic — Python, JavaScript, French, Chemistry — and get a complete curriculum with progress tracking, spaced repetition, and assessments.

## What You Get

### Structured Curriculum

Every tutorial is organized into **3 parts** (Part I → Part II → Part III), each with **4 chapters** of **4 lessons**. That's 48 lessons total, designed to take you from zero to proficient.

### Interactive Lessons

Each lesson follows a proven learning flow:

```
┌─────────────────────────────────────────────────────────────┐
│  1. THEORY        Claude explains the concept with examples │
│  2. HANDS-ON      You write code with guidance              │
│  3. REVIEW        Socratic dialogue to deepen understanding │
│  4. QUIZ          12 questions to test retention            │
└─────────────────────────────────────────────────────────────┘
```

### Spaced Repetition

Completed lessons enter a review queue. At the start of each new chapter, you'll answer quick review questions on past material. Get it right? It's cleared. Get it wrong? It goes back in the queue. This isn't date-based — it works whether you finish in a day or a month.

### Mock Interviews

At the end of each chapter, face an 8-question interview:

**For programming topics:**
- 4 **code writing** challenges (write your solution in a scratch file)
- 4 **code analysis** questions (debug, refactor, test, or explain)

**For general topics:**
- 4 **knowledge demonstration** questions (explain, describe, apply)
- 4 **analysis** questions (interpret, compare, evaluate, problem-solve)

Scored 0-5 per question with detailed feedback.

### Capstone Projects (Programming Tutorials)

Each part ends with a hands-on project. You'll build something real with test-driven milestones — tests are written incrementally and run automatically as you complete each part. Works with any language and test framework.

General tutorials (French, Chemistry, etc.) skip capstones since they require automated test verification.

### Progress Tracking

Your progress persists across sessions via a local SQLite database. Pick up exactly where you left off, see your stats, and track your improvement over time.

```
╔══════════════════════════════════════════════════════════════╗
║  STATS                        │  REVIEW QUEUE                ║
║  ─────────────────────────────│───────────────────────────── ║
║  Lessons:     22/48  (46%)    │  4 lessons pending           ║
║  Quizzes Avg: 88%             │  • list comprehensions       ║
║  Interviews:  6/12            │  • dictionary methods        ║
║  Capstones:   1/3             │  • exception handling        ║
╚══════════════════════════════════════════════════════════════╝
```

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/josephcrozet/multivac/main/install.sh | bash
```

### Manual Install

```bash
git clone https://github.com/josephcrozet/multivac
cd multivac
./install.sh
```

The installer will:
- Install the MCP server and build it
- Install commands, prompts, agents, and hooks to `~/.claude/`
- Install the `multivac` command to `~/.local/bin/`

If `~/.local/bin` isn't in your PATH, the installer will show you how to add it.

## Quick Start

```bash
multivac python
cd ~/multivac/python && claude
```

This:
1. Creates a tutorial project at `~/multivac/python/`
2. You launch Claude Code in the project directory
3. When prompted, approve the MCP server — this enables progress tracking and is required for tutorials to work
4. Claude will offer to start your tutorial automatically (or run `/tutorial` manually)

Claude generates a full curriculum on the fly and guides you through it.

### Other Examples

```bash
multivac                         # Creates ~/multivac/tutorial/
multivac javascript              # Creates ~/multivac/javascript/
multivac french                  # Creates ~/multivac/french/ (general tutorial)
multivac 'organic chemistry'     # Creates ~/multivac/organic-chemistry/
multivac python --new            # Creates ~/multivac/python-2 if python exists
multivac python --launch         # Creates project and opens Claude Code
multivac rust --dir ~/Desktop    # Creates ~/Desktop/rust/ (one-time override)
```

### Continuing a Tutorial

Just run the same command again:

```bash
multivac python
# "Found tutorial: python (Python)"
# [c]ontinue this tutorial
# [n]ew tutorial (creates python-2, python-3, etc.)
# [q]uit
```

## How It Works (For the Curious)

This project demonstrates Claude Code's extensibility:

| Feature             | Implementation                                     |
| ------------------- | -------------------------------------------------- |
| Progress tracking   | MCP server with SQLite database                    |
| `/tutorial` command | Slash command that loads tutorial-session.md       |
| `/quiz` command     | Batched multiple-choice questions (3 prompts of 4) |
| Mock interviews     | Agent spawned via Task tool                        |
| Capstone tests      | PreToolUse hook that runs your test suite          |
| Auto-prompt         | SessionStart hook offers to start/continue         |
| Token management    | Session restarts at chapter boundaries             |

### File Structure

```
~/.claude/
├── agents/
│   └── interview-agent.md      # Mock interview (8 questions, scratch file)
├── commands/
│   ├── quiz.md                 # /quiz - 12 MC questions in 3 batches
│   └── tutorial.md             # /tutorial - start, continue, or manage
├── hooks/
│   ├── capstone-test-runner.sh # Runs tests on capstone todo completion
│   └── tutorial-prompt.sh      # Offers to start/continue tutorial on session start
├── prompts/
│   └── tutorial-session.md     # Full tutorial session instructions
└── mcp-servers/
    └── learning-tracker/       # SQLite-backed progress tracking

~/.local/bin/
└── multivac                    # CLI command to create tutorial projects

~/multivac/                     # Your tutorial projects (created by multivac command)
├── python/
│   ├── .mcp.json               # MCP server config
│   ├── .claude/settings.json   # Hook config
│   ├── .multivac/learning.db   # Tutorial progress (SQLite)
│   └── CLAUDE.md               # Tutorial mode marker
└── javascript/
    └── ...
```

### MCP Server Tools

| Tool                   | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `create_tutorial`      | Generate a new curriculum                |
| `get_tutorial`         | Get full structure + progress (or `tutorial: null` if none) |
| `start_tutorial`       | Begin a tutorial                         |
| `get_current_position` | Current lesson/chapter/part              |
| `advance_position`     | Move to next lesson, add to review queue |
| `log_quiz_result`      | Record quiz scores                       |
| `log_interview_result` | Record interview performance             |
| `log_capstone_result`  | Record capstone completion               |
| `get_review_queue`     | Get lessons pending review               |
| `log_review_result`    | Mark review correct/incorrect            |
| `reset_progress`       | Reset progress while keeping curriculum  |

## Requirements

- macOS or Linux (Windows users: use WSL)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [Node.js](https://nodejs.org/) 18+ (for MCP server)
- Claude Pro subscription (recommended for longer sessions)

## Tutorial Types

Multivac supports two tutorial types:

| Feature    | Programming (Python, JS, etc.) | General (French, Chemistry, etc.) |
|------------|-------------------------------|-----------------------------------|
| Lessons    | ✓                             | ✓                                 |
| Quizzes    | ✓                             | ✓                                 |
| Reviews    | ✓                             | ✓                                 |
| Interviews | Code-focused                   | Knowledge-focused                 |
| Capstones  | ✓ (test-driven projects)      | —                                 |

The type is automatically detected based on your chosen topic.

## License

MIT
