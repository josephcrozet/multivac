# Multivac

_A Claude Code Learning System_

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                   ░█▄░▄█░█░█░█░░▀█▀░█░█░█░█▀█░█▀▀░                   ║
║                   ░█░▀░█░█░█░█░░░█░░█░▀▄▀░█▀█░█░░░                   ║
║                   ░▀░░░▀░▀▀▀░▀▀▀░▀░░▀░░▀░░▀░▀░▀▀▀░                   ║
║                                                                      ║
║                    Learn with AI-guided lessons,                     ║
║           quizzes, mock interviews, and capstone projects            ║
║                                                                      ║
║                      ▶ INSERT TOKEN TO START ◀                       ║
║                           (run /tutorial)                            ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

Transform Claude Code into a structured learning environment. Pick any topic — Python, JavaScript, French, Chemistry — and get a complete curriculum with progress tracking, spaced repetition, and assessments.

## What You Get

### Structured Curriculum

Every tutorial is organized into **3 parts** (Part I → Part II → Part III), each with **4 chapters** of **4 lessons**. That's 48 lessons total, designed to take you from zero to proficient. Curricula are dynamically generated, so no two are identical — core fundamentals are consistent while advanced topics vary, giving each tutorial a unique perspective.

### Interactive Lessons

Each lesson follows a proven learning flow:

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. THEORY        Claude explains the concept with examples          │
│  2. HANDS-ON      You write code with guidance                       │
│  3. REVIEW        Socratic dialogue to deepen understanding          │
│  4. QUIZ          12 questions to test retention                     │
└──────────────────────────────────────────────────────────────────────┘
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
- Write answers in a scratch file or directly in the chat

Scored 0-5 per question with detailed feedback.

### Capstone Projects

Each part ends with a capstone project that synthesizes everything you learned in that part's 4 chapters.

**Programming tutorials:** Build something real with test-driven milestones — tests are written incrementally and run automatically as you complete each milestone, followed by a code review with improvement suggestions. Works with any language and test framework.

**General tutorials:** Complete a substantial written assignment (essay, problem set, composition, analysis) with specific criteria per milestone. Each milestone is checked against its requirements, then reviewed for quality and style.

All capstones are skippable if you'd rather keep learning. Skipped capstones show as ☆ on your completion certificate.

### Progress Tracking

Your progress persists across sessions via a local SQLite database. Pick up exactly where you left off, see your stats, and track your improvement over time. Complete the tutorial to earn a completion certificate with your quiz averages, interview scores, and capstone results.

```
╔══════════════════════════════════════════════════════════════════════╗
║  STATS                            │  REVIEW QUEUE                    ║
║  ─────────────────────────────────│───────────────────────────────── ║
║  Lessons:     22/48  (46%)        │  4 lessons pending               ║
║  Quizzes Avg: 88%                 │  • list comprehensions           ║
║  Interviews:  6/12                │  • dictionary methods            ║
║  Capstones:   1/3                 │  • exception handling            ║
╚══════════════════════════════════════════════════════════════════════╝
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
multivac                            # Creates ~/multivac/tutorial/
multivac javascript                 # Creates ~/multivac/javascript/
multivac french                     # Creates ~/multivac/french/ (general tutorial)
multivac 'organic chemistry'        # Creates ~/multivac/organic-chemistry/
multivac python --new               # Creates ~/multivac/python-2 if python exists
multivac python --launch            # Creates project and opens Claude Code
multivac rust --dir ~/Desktop       # Creates ~/Desktop/rust/ (one-time override)
multivac upgrade                    # Upgrades project in current directory
multivac upgrade ~/multivac/python  # Upgrades a specific project
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

Finished a tutorial? Repeating the same topic and level generates a fresh curriculum — same foundations, different advanced material. Great for reinforcement or exploring topics you didn't cover the first time.

## How It Works (For the Curious)

This project demonstrates Claude Code's extensibility:

| Feature             | Implementation                                     |
| ------------------- | -------------------------------------------------- |
| Progress tracking   | MCP server with SQLite database                    |
| `/tutorial` command | Slash command that loads session.md       |
| `/quiz` command     | Batched multiple-choice questions (3 prompts of 4) |
| Mock interviews     | Agent spawned via Task tool                        |
| Capstone tests      | PreToolUse hook that runs your test suite          |
| Auto-prompt         | SessionStart hook offers to start/continue         |
| `/menu` command     | Pause menu for progress, curriculum, restart       |
| Token management    | Run `/clear` at chapter boundaries to reset context|
| Project upgrades    | Version stamp in CLAUDE.md, auto-detected on start |

### File Structure

```
~/.claude/
├── agents/
│   └── interview-agent.md      # Mock interview (8 questions, scratch file)
├── commands/
│   ├── quiz.md                 # /quiz - 12 MC questions in 3 batches
│   ├── menu.md                 # /menu - pause menu (progress, curriculum, restart)
│   └── tutorial.md             # /tutorial - start or resume a tutorial
├── hooks/
│   ├── capstone-test-runner.sh # Runs tests on capstone todo completion
│   ├── compact-hook.sh         # Recovers state after context compaction
│   └── tutorial-prompt.sh      # Offers to start/continue tutorial on session start
├── prompts/
│   └── session.md              # Full tutorial session instructions
└── mcp-servers/
    └── learning-tracker/       # SQLite-backed progress tracking

~/.local/bin/
└── multivac                    # CLI command to create tutorial projects

~/multivac/                     # Your tutorial projects (created by multivac command)
├── python/
│   ├── .mcp.json               # MCP server config
│   ├── .claude/settings.json   # Hook config
│   ├── .multivac/
│   │   ├── learning.db         # Tutorial progress (SQLite)
│   │   └── current-info.md     # Verified version/API info cache
│   └── CLAUDE.md               # Tutorial mode marker
└── javascript/
    └── ...
```

### MCP Server Tools

| Tool                   | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `create_tutorial`      | Generate a new curriculum                |
| `get_tutorial`         | Get full structure + progress (heavy, use sparingly) |
| `get_tutorial_metadata`| Lightweight check for status, type, difficulty |
| `get_preferences`      | Get user preferences (book, language)    |
| `update_preferences`   | Update one or more preferences           |
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

## Any Topic

Multivac works with any subject — Python, French, Chemistry, you name it. The system automatically adapts based on your topic: programming tutorials get code-focused interviews and test-driven capstones, while other topics get knowledge-focused interviews and criteria-based capstones. You just pick a topic and start learning.

### A Note on General Topics

Programming tutorials have a built-in safety net: code either runs or it doesn't. Errors surface quickly.

General topics (languages, sciences, humanities) don't have this feedback loop. While the tutor is instructed to verify specific technical claims (terminology, formulas, linguistic rules) against authoritative sources, some errors may still slip through. If you're learning a topic where precision matters, cross-reference key facts with trusted sources.

## License

MIT
