#!/bin/bash

# Capstone Test Runner Hook
# Runs tests before allowing todo items to be marked complete during capstone projects

# Read JSON input from stdin
INPUT=$(cat)

# Get working directory from the hook input
CWD=$(echo "$INPUT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('cwd', '.'))" 2>/dev/null)
if [ -z "$CWD" ]; then
  CWD="."
fi

# Check if any todos are being marked as "completed"
HAS_COMPLETED=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
todos = data.get('tool_input', {}).get('todos', [])
has_completed = any(t.get('status') == 'completed' for t in todos)
print('true' if has_completed else 'false')
" 2>/dev/null)

if [ "$HAS_COMPLETED" != "true" ]; then
  # Not marking anything complete, allow the operation
  exit 0
fi

# Check if we're in a capstone project (look for .capstone marker file)
if [ ! -f "$CWD/.capstone" ]; then
  # Not a capstone project, allow the operation
  exit 0
fi

# Read capstone config
CAPSTONE_CONFIG=$(cat "$CWD/.capstone" 2>/dev/null)
TEST_COMMAND=$(echo "$CAPSTONE_CONFIG" | grep "^test_command=" | cut -d'=' -f2-)

# Default test commands based on common patterns
if [ -z "$TEST_COMMAND" ]; then
  if [ -f "$CWD/package.json" ]; then
    TEST_COMMAND="npm test"
  elif [ -f "$CWD/requirements.txt" ] || [ -f "$CWD/pyproject.toml" ]; then
    TEST_COMMAND="pytest"
  elif [ -f "$CWD/Gemfile" ]; then
    TEST_COMMAND="bundle exec rspec"
  elif [ -f "$CWD/go.mod" ]; then
    TEST_COMMAND="go test ./..."
  elif [ -f "$CWD/Cargo.toml" ]; then
    TEST_COMMAND="cargo test"
  else
    # No recognizable test setup, allow the operation
    exit 0
  fi
fi

echo "Running capstone tests before marking todo complete..."
echo "Command: $TEST_COMMAND"
echo "Directory: $CWD"
echo "---"

# Run the tests in the project directory
cd "$CWD" && eval $TEST_COMMAND
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "---"
  echo "All tests passed! Todo item can be marked complete."
  exit 0
else
  echo "---"
  echo "Tests failed. Please fix the failing tests before marking this item complete."
  echo "Run '$TEST_COMMAND' to see detailed output."
  exit 1
fi
