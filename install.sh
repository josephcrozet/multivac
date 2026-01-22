#!/bin/bash

# Multivac Installer
# Installs the MCP server, commands, and multivac CLI tool

set -e

# Check prerequisites
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed."
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

if ! command -v claude &> /dev/null; then
    echo "WARNING: Claude Code CLI not found in PATH."
    echo "Multivac requires Claude Code to function."
    echo "Install it from: https://docs.anthropic.com/en/docs/claude-code"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
BIN_DIR="$HOME/.local/bin"

echo "Installing Multivac..."
echo ""

# Create directories
echo "Creating directories..."
mkdir -p "$CLAUDE_DIR/agents"
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/prompts"
mkdir -p "$CLAUDE_DIR/mcp-servers/learning-tracker"
mkdir -p "$BIN_DIR"

# Function to copy file if it doesn't exist
copy_if_not_exists() {
    src="$1"
    dest="$2"
    if [ -f "$dest" ]; then
        echo "  SKIP: $(basename "$dest") (already exists)"
        return 1
    else
        cp "$src" "$dest"
        echo "  COPY: $(basename "$dest")"
        return 0
    fi
}

# Copy agents
echo ""
echo "Installing agents..."
copy_if_not_exists "$SCRIPT_DIR/agents/interview-agent.md" "$CLAUDE_DIR/agents/interview-agent.md"

# Copy commands
echo ""
echo "Installing commands..."
copy_if_not_exists "$SCRIPT_DIR/commands/quiz.md" "$CLAUDE_DIR/commands/quiz.md"
copy_if_not_exists "$SCRIPT_DIR/commands/tutorial.md" "$CLAUDE_DIR/commands/tutorial.md"

# Copy hooks
echo ""
echo "Installing hooks..."
if copy_if_not_exists "$SCRIPT_DIR/hooks/capstone-test-runner.sh" "$CLAUDE_DIR/hooks/capstone-test-runner.sh"; then
    chmod +x "$CLAUDE_DIR/hooks/capstone-test-runner.sh"
fi

# Copy prompts
echo ""
echo "Installing prompts..."
copy_if_not_exists "$SCRIPT_DIR/prompts/tutorial-session.md" "$CLAUDE_DIR/prompts/tutorial-session.md"

# Copy MCP server source
echo ""
echo "Installing MCP server..."
cp -r "$SCRIPT_DIR/mcp-servers/learning-tracker/src" "$CLAUDE_DIR/mcp-servers/learning-tracker/"
cp "$SCRIPT_DIR/mcp-servers/learning-tracker/package.json" "$CLAUDE_DIR/mcp-servers/learning-tracker/"
cp "$SCRIPT_DIR/mcp-servers/learning-tracker/tsconfig.json" "$CLAUDE_DIR/mcp-servers/learning-tracker/"

# Build MCP server
echo ""
echo "Building MCP server..."
cd "$CLAUDE_DIR/mcp-servers/learning-tracker"
npm install --silent
npm run build --silent
echo "  MCP server built successfully"

# Install multivac command
echo ""
echo "Installing multivac command..."
cp "$SCRIPT_DIR/bin/multivac" "$BIN_DIR/multivac"
chmod +x "$BIN_DIR/multivac"
echo "  Installed to $BIN_DIR/multivac"

echo ""
echo "Installation complete!"
echo ""

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "NOTE: ~/.local/bin is not in your PATH."
    echo ""
    echo "Add this line to your shell profile (~/.bashrc or ~/.zshrc):"
    echo ""
    echo '  export PATH="$HOME/.local/bin:$PATH"'
    echo ""
    echo "Then restart your terminal or run:"
    echo "  source ~/.bashrc  (or ~/.zshrc)"
    echo ""
fi

echo "To start a tutorial, run:"
echo ""
echo "  multivac <topic>"
echo ""
echo "Examples: multivac python, multivac javascript, multivac rust"
echo ""
echo "This creates a project at ~/multivac/<topic>/ and launches Claude Code."
echo "When prompted, approve the MCP server to enable progress tracking."
echo "Then run /tutorial to begin learning!"
echo ""
