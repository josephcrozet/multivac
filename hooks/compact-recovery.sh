#!/bin/bash

# Compact Recovery (SessionStart with matcher: compact)
# Recovers tutorial context after context compaction

cat << EOF
Context was just compacted. To resume the tutorial correctly:
1. Read ~/.claude/prompts/session.md for full instructions
2. Call get_current_position to verify where the user left off
3. Resume the lesson flow from that point
EOF

exit 0
