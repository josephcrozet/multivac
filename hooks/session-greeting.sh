#!/bin/bash

# Session Greeting (SessionStart: startup, resume, clear)
# Greets the user and offers to start or continue their tutorial

# Check if the learning database exists to determine start vs continue
if [ -f "$CLAUDE_PROJECT_DIR/.multivac/learning.db" ]; then
    ACTION="continue"
else
    ACTION="start"
fi

# Output context for Claude to see
cat << EOF
This is a Multivac tutorial project. Ask the user: "Would you like to $ACTION your tutorial?" If they agree, use the Skill tool to run the tutorial skill.
EOF

exit 0
