#!/usr/bin/env bash
# Download a temporary checkout, then use the bundled ownership-aware Node installer.
set -euo pipefail

whk_work_dir=''
whk_cleanup() {
  if [ -n "$whk_work_dir" ]; then rm -rf -- "$whk_work_dir"; fi
}
trap whk_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

whk_fail() { printf 'install: %s\n' "$*" >&2; exit 1; }

whk_main() {
  local whk_ref='main' whk_source='' whk_ref_set='' whk_option
  local -a whk_arguments=(setup)
  while [ "$#" -gt 0 ]; do
    whk_option=$1
    case "$whk_option" in
      --help|-h)
        cat <<'USAGE'
Usage: bash install.sh [--agent codex|claude|both | --destination PATH]
                       [--skill NAME ...] [--dry-run]
                       [--ref BRANCH|TAG|COMMIT | --source DIRECTORY]

Defaults: main, all five Skills, Codex user directory (~/.agents/skills).
Requires Node.js 24+ and Git. Re-run the same command to update.
--dry-run prints plans without changing Skill directories.
--source uses an existing checkout without downloading. No npm install is needed.
USAGE
        return 0 ;;
      --ref|--source|--agent|--destination|--skill)
        [ "$#" -ge 2 ] && [ -n "$2" ] && [[ "$2" != --* ]] || whk_fail "$whk_option needs a value"
        case "$whk_option" in
          --ref) whk_ref=$2; whk_ref_set=1 ;;
          --source) whk_source=$2 ;;
          *) whk_arguments+=("$whk_option" "$2") ;;
        esac
        shift 2 ;;
      --dry-run) whk_arguments+=("$whk_option"); shift ;;
      *) whk_fail "Unknown option: $whk_option. Use --help for usage." ;;
    esac
  done

  [ -z "$whk_source" ] || [ -z "$whk_ref_set" ] || whk_fail 'Use either --ref or --source, not both'
  case "$whk_ref" in
    ''|-*|*[!a-zA-Z0-9._/-]*) whk_fail 'Expected a Git branch, tag or commit for --ref' ;;
  esac
  command -v node >/dev/null 2>&1 || whk_fail 'Node.js 24+ is required. Install it from https://nodejs.org/en/download and re-run.'
  node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' ||
    whk_fail 'Node.js 24+ is required. Check node --version and re-run with a supported runtime.'

  if [ -z "$whk_source" ]; then
    command -v git >/dev/null 2>&1 || whk_fail 'Git is required to download the Kit.'
    whk_work_dir=$(mktemp -d "${TMPDIR:-/tmp}/workspace-harness-kit.XXXXXXXX")
    whk_source="$whk_work_dir/checkout"
    printf 'Downloading Workspace Harness Kit (%s)...\n' "$whk_ref" >&2
    git -c core.hooksPath=/dev/null init --quiet --template= "$whk_source"
    GIT_TERMINAL_PROMPT=0 git -c core.hooksPath=/dev/null -C "$whk_source" fetch --quiet --depth=1 \
      https://github.com/MatriQ/workspace-harness-kit.git "$whk_ref"
    git -c core.hooksPath=/dev/null -C "$whk_source" checkout --quiet --detach FETCH_HEAD
    printf 'Source commit: %s\n' "$(git -C "$whk_source" rev-parse HEAD)" >&2
  fi

  [ -f "$whk_source/scripts/install.mjs" ] && [ -f "$whk_source/VERSION" ] ||
    whk_fail 'The source directory must contain VERSION and scripts/install.mjs.'
  node "$whk_source/scripts/install.mjs" "${whk_arguments[@]}"
}

# Defining the whole entry point first also supports execution from a download pipe.
whk_main "$@"
