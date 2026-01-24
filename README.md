# Multivac

_A Claude Code Learning System_

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║               ░█▄░▄█░█░█░█░░▀█▀░█░█░█░█▀█░█▀▀░               ║
║               ░█░▀░█░█░█░█░░░█░░█░▀▄▀░█▀█░█░░░               ║
║               ░▀░░░▀░▀▀▀░▀▀▀░▀░░▀░░▀░░▀░▀░▀▀▀░               ║
║                                                              ║
║          Learn programming with AI-guided lessons,           ║
║       quizzes, mock interviews, and capstone projects        ║
║                                                              ║
║                  ▶ INSERT TOKEN TO START ◀                   ║
║                       (run /tutorial)                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

Transform Claude Code into a structured learning environment. Pick any programming topic — Python, JavaScript, Rust, system design — and get a complete curriculum with progress tracking, spaced repetition, and assessments.

## What You Get

### Structured Curriculum

Every tutorial is organized into **3 levels** (Beginner → Intermediate → Advanced), each with **4 modules** of **4 lessons**. That's 48 lessons total, designed to take you from zero to proficient.

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

Completed lessons enter a review queue. At the start of each new module, you'll answer quick review questions on past material. Get it right? It's cleared. Get it wrong? It goes back in the queue. This isn't date-based — it works whether you finish in a day or a month.

### Mock Interviews

At the end of each module, face an 8-question technical interview:

- 4 **code writing** challenges (write your solution in a scratch file)
- 4 **code analysis** questions (debug, refactor, test, or explain)

Scored 0-5 per question with detailed feedback.

### Capstone Projects

Each level ends with a hands-on project. You'll build something real with test-driven milestones — tests are written incrementally and run automatically as you complete each part. Works with any language and test framework.

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
# Then run /tutorial inside Claude Code
```

This:
1. Creates a tutorial project at `~/multivac/python/`
2. You launch Claude Code in the project directory
3. When prompted, approve the MCP server — this enables progress tracking and is required for tutorials to work
4. Run `/tutorial` to begin learning

Claude generates a full curriculum on the fly and guides you through it.

### Other Examples

```bash
multivac                         # Creates ~/multivac/tutorial/
multivac javascript              # Creates ~/multivac/javascript/
multivac 'data science'          # Creates ~/multivac/data-science/
multivac python --new            # Creates ~/multivac/python-2 if python exists
multivac --home ~/Desktop rust   # Creates ~/Desktop/rust/
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
| Token management    | Session restarts at module boundaries              |

### File Structure

```
~/.claude/
├── agents/
│   └── interview-agent.md      # Mock interview (8 questions, scratch file)
├── commands/
│   ├── quiz.md                 # /quiz - 12 MC questions in 3 batches
│   └── tutorial.md             # /tutorial - start, continue, or manage
├── hooks/
│   └── capstone-test-runner.sh # Runs tests on capstone todo completion
├── prompts/
│   └── tutorial-session.md     # Full tutorial session instructions
└── mcp-servers/
    └── learning-tracker/       # SQLite-backed progress tracking

~/.local/bin/
└── multivac                    # CLI command to create tutorial projects

~/multivac/                     # Your tutorial projects (created by multivac command)
├── python/
│   ├── .claude/settings.json   # Local MCP + hook config
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
| `get_current_position` | Current lesson/module/level              |
| `advance_position`     | Move to next lesson, add to review queue |
| `log_quiz_result`      | Record quiz scores                       |
| `log_interview_result` | Record interview performance             |
| `log_capstone_result`  | Record capstone completion               |
| `get_review_queue`     | Get lessons pending review               |
| `log_review_result`    | Mark review correct/incorrect            |

## Requirements

- macOS or Linux (Windows users: use WSL)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [Node.js](https://nodejs.org/) 18+ (for MCP server)
- Claude Pro subscription (recommended for longer sessions)

## Limitations

This system is designed for **programming tutorials**. The lesson delivery, quizzes, and spaced repetition work for any topic, but:

- **Interviews** are code-focused (writing and analyzing code)
- **Capstones** require coding projects with tests

For non-programming topics like chemistry or French, the core learning flow works but assessments would need adaptation.

## License

MIT
