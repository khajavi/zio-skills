#!/bin/bash

echo "📦 ZIO Skills Versions:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for plugin_json in plugins/*/.claude-plugin/plugin.json; do
  if [ -f "$plugin_json" ]; then
    name=$(jq -r '.name' "$plugin_json")
    version=$(jq -r '.version' "$plugin_json")
    echo "  $name: $version"
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
