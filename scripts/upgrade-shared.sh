#!/usr/bin/env bash
# upgrade-shared.sh — 把 apps/web 固定的共享包（@szyyw/design、@szyyw/auth）升到上游最新的正式 tag（vX.Y.Z）。
# 两者都是 codeload tarball 地址；改完 package.json 后用 npm 刷新根目录的 package-lock.json（npm workspaces）。
# 有改动时打印一行摘要（给提交信息用），没有就什么都不打印。
# CI（.github/workflows/upgrade-shared.yml，checkout feat/monorepo-v6）和本地都能跑。
set -euo pipefail
cd "$(dirname "$0")/.."

f=apps/web/package.json
changes=()

latest() { # <仓库> -> v0.8.0
  git ls-remote --tags --refs "https://github.com/Szyoo/$1.git" 'v*' | sed 's#.*refs/tags/##' \
    | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n1
}

for repo in szyyw-design szyyw-auth; do
  cur=$(grep -oE "Szyoo/$repo/tar\.gz/refs/tags/v[0-9.]+" "$f" | sed 's#.*/##' || true)
  [ -n "$cur" ] || { echo "$f 里找不到 $repo 的 tarball 地址" >&2; exit 1; }
  new=$(latest "$repo")
  [ -n "$new" ] || { echo "取不到 $repo 的 tag" >&2; exit 1; }
  if [ "$cur" != "$new" ] && [ "$(printf '%s\n%s\n' "$cur" "$new" | sort -V | tail -n1)" = "$new" ]; then
    sed -i.bak "s#Szyoo/$repo/tar.gz/refs/tags/$cur#Szyoo/$repo/tar.gz/refs/tags/$new#" "$f" && rm -f "$f.bak"
    changes+=("$repo $cur → $new")
  fi
done

[ ${#changes[@]} -gt 0 ] || exit 0

# 只刷新锁文件（resolved + integrity），不装依赖；npm 的输出全部丢到 stderr，保持 stdout 只有摘要
npm install --package-lock-only --no-audit --no-fund >&2

summary=$(printf '%s，' "${changes[@]}")
echo "${summary%，}"
