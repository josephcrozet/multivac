#!/bin/bash

# Multivac Uninstaller
# Removes all Multivac components from ~/.claude/ and ~/.local/bin/
# Does NOT remove tutorial projects

set -e

CLAUDE_DIR="$HOME/.claude"
BIN_DIR="$HOME/.local/bin"

echo "Multivac Uninstaller"
echo ""
echo "This will remove:"
echo "  - ~/.claude/agents/interview-agent.md"
echo "  - ~/.claude/commands/quiz.md"
echo "  - ~/.claude/commands/tutorial.md"
echo "  - ~/.claude/commands/menu.md"
echo "  - ~/.claude/hooks/capstone-test-runner.sh"
echo "  - ~/.claude/hooks/session-greeting.sh"
echo "  - ~/.claude/hooks/compact-recovery.sh"
echo "  - ~/.claude/prompts/session.md"
echo "  - ~/.claude/mcp-servers/learning-tracker/"
echo "  - ~/.local/bin/multivac"
echo ""
echo "This will NOT remove:"
echo "  - Your tutorial projects (default: ~/multivac/)"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Removing Multivac components..."

# Remove agents
if [ -f "$CLAUDE_DIR/agents/interview-agent.md" ]; then
    rm "$CLAUDE_DIR/agents/interview-agent.md"
    echo "  Removed: agents/interview-agent.md"
fi

# Remove commands
if [ -f "$CLAUDE_DIR/commands/quiz.md" ]; then
    rm "$CLAUDE_DIR/commands/quiz.md"
    echo "  Removed: commands/quiz.md"
fi

if [ -f "$CLAUDE_DIR/commands/tutorial.md" ]; then
    rm "$CLAUDE_DIR/commands/tutorial.md"
    echo "  Removed: commands/tutorial.md"
fi

if [ -f "$CLAUDE_DIR/commands/menu.md" ]; then
    rm "$CLAUDE_DIR/commands/menu.md"
    echo "  Removed: commands/menu.md"
fi

# Remove hooks
if [ -f "$CLAUDE_DIR/hooks/capstone-test-runner.sh" ]; then
    rm "$CLAUDE_DIR/hooks/capstone-test-runner.sh"
    echo "  Removed: hooks/capstone-test-runner.sh"
fi

if [ -f "$CLAUDE_DIR/hooks/session-greeting.sh" ]; then
    rm "$CLAUDE_DIR/hooks/session-greeting.sh"
    echo "  Removed: hooks/session-greeting.sh"
fi

if [ -f "$CLAUDE_DIR/hooks/compact-recovery.sh" ]; then
    rm "$CLAUDE_DIR/hooks/compact-recovery.sh"
    echo "  Removed: hooks/compact-recovery.sh"
fi

# Remove prompts
if [ -f "$CLAUDE_DIR/prompts/session.md" ]; then
    rm "$CLAUDE_DIR/prompts/session.md"
    echo "  Removed: prompts/session.md"
fi

# Remove MCP server
if [ -d "$CLAUDE_DIR/mcp-servers/learning-tracker" ]; then
    rm -rf "$CLAUDE_DIR/mcp-servers/learning-tracker"
    echo "  Removed: mcp-servers/learning-tracker/"
fi

# Remove multivac command
if [ -f "$BIN_DIR/multivac" ]; then
    rm "$BIN_DIR/multivac"
    echo "  Removed: ~/.local/bin/multivac"
fi

echo ""
echo "Uninstall complete!"
echo ""
echo "Your tutorial projects were preserved."
echo "To remove them manually (default: ~/multivac): rm -rf ~/multivac"
echo ""
