#!/usr/bin/env bash
# 双语变体防漂移：中文目录是唯一编辑点，templates/scripts 同步为逐字节副本并校验。
set -euo pipefail
cd "$(dirname "$0")/.."
rsync -a --delete --exclude node_modules skills/architecture-wiki/templates/ skills/architecture-wiki-en/templates/
rsync -a --delete --exclude node_modules skills/architecture-wiki/scripts/ skills/architecture-wiki-en/scripts/
diff -r -x node_modules skills/architecture-wiki/templates skills/architecture-wiki-en/templates
diff -r -x node_modules skills/architecture-wiki/scripts skills/architecture-wiki-en/scripts
echo "变体同步一致 ✓"
