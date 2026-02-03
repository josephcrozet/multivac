#!/bin/bash

# Multivac Installer
# Installs the MCP server, commands, and multivac CLI tool
#
# Usage:
#   Local:  ./install.sh
#   Remote: curl -fsSL https://raw.githubusercontent.com/josephcrozet/multivac/main/install.sh | bash

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

CLAUDE_DIR="$HOME/.claude"
BIN_DIR="$HOME/.local/bin"
CLEANUP_TEMP=""

# Check for existing installation (any Multivac file)
EXISTING_INSTALL=""
[ -f "$CLAUDE_DIR/agents/interview-agent.md" ] && EXISTING_INSTALL="yes"
[ -f "$CLAUDE_DIR/commands/quiz.md" ] && EXISTING_INSTALL="yes"
[ -f "$CLAUDE_DIR/commands/tutorial.md" ] && EXISTING_INSTALL="yes"
[ -f "$CLAUDE_DIR/hooks/capstone-test-runner.sh" ] && EXISTING_INSTALL="yes"
[ -f "$CLAUDE_DIR/hooks/tutorial-prompt.sh" ] && EXISTING_INSTALL="yes"
[ -f "$CLAUDE_DIR/prompts/session.md" ] && EXISTING_INSTALL="yes"
[ -d "$CLAUDE_DIR/mcp-servers/learning-tracker" ] && EXISTING_INSTALL="yes"
[ -f "$BIN_DIR/multivac" ] && EXISTING_INSTALL="yes"

if [[ -n "$EXISTING_INSTALL" ]]; then
    echo "Existing Multivac installation detected."
    echo ""
    read -p "Update to latest version? (Y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    echo ""
fi

# Determine source directory (local clone or remote download)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || SCRIPT_DIR=""

if [[ -z "$SCRIPT_DIR" ]] || [[ ! -f "$SCRIPT_DIR/bin/multivac" ]]; then
    # Running from curl or script dir doesn't have expected files
    # Download the repo to a temp directory
    echo "Downloading Multivac..."

    if ! command -v curl &> /dev/null; then
        echo "ERROR: curl is not installed."
        echo ""
        echo "Install curl using your package manager:"
        echo "  macOS:  curl is pre-installed"
        echo "  Ubuntu: sudo apt install curl"
        echo "  Fedora: sudo dnf install curl"
        echo ""
        echo "Or clone the repo manually:"
        echo "  git clone https://github.com/josephcrozet/multivac.git"
        echo "  cd multivac && ./install.sh"
        exit 1
    fi

    TEMP_DIR=$(mktemp -d)
    CLEANUP_TEMP="$TEMP_DIR"

    curl -fsSL https://github.com/josephcrozet/multivac/archive/main.tar.gz | tar xz -C "$TEMP_DIR"
    SCRIPT_DIR="$TEMP_DIR/multivac-main"

    if [[ ! -f "$SCRIPT_DIR/bin/multivac" ]]; then
        echo "ERROR: Failed to download Multivac files."
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    echo ""
fi

# Cleanup function
cleanup() {
    if [[ -n "$CLEANUP_TEMP" ]] && [[ -d "$CLEANUP_TEMP" ]]; then
        rm -rf "$CLEANUP_TEMP"
    fi
}
trap cleanup EXIT

# Ask where to store tutorials
echo "Where would you like to store tutorials?"
echo "(Press Enter for default: ~/multivac)"
echo ""
read -p "Directory: " CUSTOM_HOME

# Use default if empty, expand ~ if present
if [[ -z "$CUSTOM_HOME" ]]; then
    CUSTOM_HOME="$HOME/multivac"
else
    # Expand ~ to $HOME
    CUSTOM_HOME="${CUSTOM_HOME/#\~/$HOME}"
fi

echo ""
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

# Copy agents
echo ""
echo "Installing agents..."
cp "$SCRIPT_DIR/agents/interview-agent.md" "$CLAUDE_DIR/agents/interview-agent.md"
echo "  interview-agent.md"

# Copy commands
echo ""
echo "Installing commands..."
cp "$SCRIPT_DIR/commands/quiz.md" "$CLAUDE_DIR/commands/quiz.md"
echo "  quiz.md"
cp "$SCRIPT_DIR/commands/tutorial.md" "$CLAUDE_DIR/commands/tutorial.md"
echo "  tutorial.md"

# Copy hooks
echo ""
echo "Installing hooks..."
cp "$SCRIPT_DIR/hooks/capstone-test-runner.sh" "$CLAUDE_DIR/hooks/capstone-test-runner.sh"
chmod +x "$CLAUDE_DIR/hooks/capstone-test-runner.sh"
echo "  capstone-test-runner.sh"
cp "$SCRIPT_DIR/hooks/tutorial-prompt.sh" "$CLAUDE_DIR/hooks/tutorial-prompt.sh"
chmod +x "$CLAUDE_DIR/hooks/tutorial-prompt.sh"
echo "  tutorial-prompt.sh"

# Copy prompts
echo ""
echo "Installing prompts..."
cp "$SCRIPT_DIR/prompts/session.md" "$CLAUDE_DIR/prompts/session.md"
echo "  session.md"

# Copy MCP server source
echo ""
echo "Installing MCP server..."
cp -r "$SCRIPT_DIR/mcp-servers/learning-tracker/src" "$CLAUDE_DIR/mcp-servers/learning-tracker/"
cp "$SCRIPT_DIR/mcp-servers/learning-tracker/package.json" "$CLAUDE_DIR/mcp-servers/learning-tracker/"
cp "$SCRIPT_DIR/mcp-servers/learning-tracker/tsconfig.json" "$CLAUDE_DIR/mcp-servers/learning-tracker/"
echo "  learning-tracker/"

# Build MCP server
echo ""
echo "Building MCP server..."
cd "$CLAUDE_DIR/mcp-servers/learning-tracker"
npm install --silent
npm run build --silent
echo "  Build complete"

# Install multivac command
echo ""
echo "Installing CLI..."
cp "$SCRIPT_DIR/bin/multivac" "$BIN_DIR/multivac"
chmod +x "$BIN_DIR/multivac"
echo "  multivac -> $BIN_DIR/"

# If custom directory was chosen, insert it into the script after "set -e"
if [[ "$CUSTOM_HOME" != "$HOME/multivac" ]]; then
    sed -i '' '/^set -e$/a\
\
# Custom default directory (set during installation)\
MULTIVAC_HOME="${MULTIVAC_HOME:-'"$CUSTOM_HOME"'}"
' "$BIN_DIR/multivac"
fi

echo ""
echo "Tutorials will be stored in: $CUSTOM_HOME"

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
echo "  multivac <topic> --launch"
echo ""
echo "Examples: multivac python --launch, multivac javascript --launch"
echo ""
echo "This creates a project at $CUSTOM_HOME/<topic>/ and opens Claude Code."
echo "When prompted, approve the MCP server to enable progress tracking."
echo "You'll be prompted to start your tutorial automatically."
echo ""
