#!/bin/bash

# Multivac Installer
# Safely installs files without overwriting existing ones
# Merges MCP server and hook config into settings.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

echo "Installing Multivac..."
echo ""

# Create directories
echo "Creating directories..."
mkdir -p "$CLAUDE_DIR/agents"
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/prompts"
mkdir -p "$CLAUDE_DIR/mcp-servers/learning-tracker"

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

# Merge settings.json
echo ""
echo "Configuring settings.json..."

SETTINGS_FILE="$CLAUDE_DIR/settings.json"
MCP_SERVER_PATH="$CLAUDE_DIR/mcp-servers/learning-tracker/dist/index.js"
HOOK_PATH="$CLAUDE_DIR/hooks/capstone-test-runner.sh"

# Create settings.json if it doesn't exist
if [ ! -f "$SETTINGS_FILE" ]; then
    echo '{}' > "$SETTINGS_FILE"
fi

# Check if jq is available
if command -v jq &> /dev/null; then
    # Use jq for proper JSON merging
    TEMP_FILE=$(mktemp)

    # Add MCP server if not present
    if ! jq -e '.mcpServers["learning-tracker"]' "$SETTINGS_FILE" > /dev/null 2>&1; then
        jq --arg path "$MCP_SERVER_PATH" '.mcpServers["learning-tracker"] = {"command": "node", "args": [$path]}' "$SETTINGS_FILE" > "$TEMP_FILE"
        mv "$TEMP_FILE" "$SETTINGS_FILE"
        echo "  Added learning-tracker MCP server"
    else
        echo "  SKIP: learning-tracker MCP server (already configured)"
    fi

    # Add hook if not present
    if ! jq -e '.hooks.PreToolUse[]? | select(.matcher == "TodoWrite")' "$SETTINGS_FILE" > /dev/null 2>&1; then
        jq --arg path "$HOOK_PATH" '.hooks.PreToolUse = ((.hooks.PreToolUse // []) + [{"matcher": "TodoWrite", "hooks": [{"type": "command", "command": $path}]}])' "$SETTINGS_FILE" > "$TEMP_FILE"
        mv "$TEMP_FILE" "$SETTINGS_FILE"
        echo "  Added capstone-test-runner hook"
    else
        echo "  SKIP: TodoWrite hook (already configured)"
    fi
else
    echo "  WARNING: jq not found. Please manually add to $SETTINGS_FILE:"
    echo ""
    echo '  "mcpServers": {'
    echo '    "learning-tracker": {'
    echo '      "command": "node",'
    echo "      \"args\": [\"$MCP_SERVER_PATH\"]"
    echo '    }'
    echo '  },'
    echo '  "hooks": {'
    echo '    "PreToolUse": [{'
    echo '      "matcher": "TodoWrite",'
    echo "      \"hooks\": [{\"type\": \"command\", \"command\": \"$HOOK_PATH\"}]"
    echo '    }]'
    echo '  }'
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code to load the MCP server"
echo "  2. Create a tutorial directory: mkdir ~/tutorials/python && cd ~/tutorials/python"
echo "  3. Run: /output-style learning"
echo "  4. Run: /tutorial"
echo ""
