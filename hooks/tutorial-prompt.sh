#!/bin/bash

# Tutorial Prompt Hook (SessionStart)
# Prompts Claude to offer starting or continuing the tutorial when entering a Multivac project

# Check if the learning database exists to determine start vs continue
if [ -f "$CLAUDE_PROJECT_DIR/.multivac/learning.db" ]; then
    ACTION="continue"
else
    ACTION="start"
fi

# Output context for Claude to see
cat << EOF
This is a Multivac tutorial project. Offer to $ACTION the tutorial by asking the user: "Would you like to $ACTION your tutorial? I can run /tutorial for you." If they agree, use the Skill tool to run the tutorial skill.
EOF

exit 0
