"""Copy the shared docs from titan117-web to the other repos (decisions §6).

    python scripts/sync-docs.py                 # sync titan117-desktop and titan117-pop (those that exist next to this repo)
    python scripts/sync-docs.py --check         # only report differences; exit 1 if any repo is out of date (for CI)
    python scripts/sync-docs.py --repo ../titan117-pop

Shared: everything in docs/ except progress.md (each repo keeps its own), plus CLAUDE.md.
Files a target has but this repo doesn't are removed with `git rm` (they stay in its history). Nothing is committed.
"""
import argparse
import filecmp
import shutil
import subprocess
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
TARGETS = ["titan117-desktop", "titan117-pop"]
OWN = {"docs/progress.md"}  # each repo keeps its own


def shared_files(repo: Path):
    files = {p.relative_to(repo).as_posix() for p in (repo / "docs").rglob("*") if p.is_file()} if (repo / "docs").exists() else set()
    if (repo / "CLAUDE.md").exists():
        files.add("CLAUDE.md")
    return {f for f in files if f not in OWN}


def diff(target: Path):
    web_files = shared_files(WEB)
    changed = sorted(f for f in web_files if not (target / f).exists() or not filecmp.cmp(WEB / f, target / f, shallow=False))
    extra = sorted(shared_files(target) - web_files)
    return changed, extra


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", action="append", help="target repo path (repeatable); default: the sibling repos that exist")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    targets = [Path(r).resolve() for r in args.repo] if args.repo else [WEB.parent / t for t in TARGETS if (WEB.parent / t).exists()]
    if not targets:
        sys.exit("no target repos found")

    stale = False
    for target in targets:
        if not (target / ".git").exists():
            sys.exit(f"not a git repo: {target}")
        changed, extra = diff(target)
        name = target.name
        if args.check:
            for f in changed:
                print(f"{name}: out of date: {f}")
            for f in extra:
                print(f"{name}: not in web: {f}")
            stale |= bool(changed or extra)
            continue
        for f in changed:
            (target / f).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(WEB / f, target / f)
        if extra:
            subprocess.run(["git", "rm", "-q", "--", *extra], cwd=target, check=True)
        print(f"{name}: {len(changed)} copied, {len(extra)} removed")
    if args.check:
        print("out of date" if stale else "all in sync")
        sys.exit(1 if stale else 0)
    print("done; nothing committed")


if __name__ == "__main__":
    main()
