#!/usr/bin/env bash
# PostToolUse hook (Edit|Write). Reads the tool payload on stdin; if the edited file is UI code,
# injects a reminder to regenerate screenshots before the change is committed.
set -u
f="$(jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)"
[ -z "$f" ] && exit 0
rel="${f#"$PWD"/}"
case "$rel" in
  src/app/*|src/features/*/screens/*|src/features/*/components/*|src/ui/*)
    # only .tsx/.ts files render UI; skip tests
    case "$rel" in *__tests__*|*.test.*|*.spec.*) exit 0;; esac
    case "$rel" in *.tsx|*.ts) ;; *) exit 0;; esac
    jq -n --arg f "$rel" '{
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: ("UI file changed: " + $f + ". Before committing, run `npm run screenshots` and commit the updated images under docs/screenshots/. Reference the changed screens (before/after) in the commit message or PR. See CLAUDE.md > Screenshots.")
      }
    }'
    ;;
esac
exit 0
