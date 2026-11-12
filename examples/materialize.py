#!/usr/bin/env python3
"""Create independent example Git repositories in an empty directory."""

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


FIXTURES = Path(__file__).resolve().parent / "workspace"
REPOSITORIES = ("api", "client", "worker", "e2e", "product-docs")


def git(repo, *arguments):
    subprocess.run(
        ["git", "-C", str(repo), *arguments],
        check=True,
    )


def materialize(destination):
    destination.mkdir(parents=True, exist_ok=True)
    if any(destination.iterdir()):
        raise ValueError(f"Choose an empty destination directory: {destination}")

    # Prepare the repositories first so a Git error cannot leave partial fixtures.
    with tempfile.TemporaryDirectory(prefix=".fixture-", dir=destination) as temporary:
        staging = Path(temporary)
        for name in REPOSITORIES:
            repository = staging / name
            shutil.copytree(
                FIXTURES / name,
                repository,
                ignore=shutil.ignore_patterns(".git", "__pycache__", "*.pyc"),
            )
            git(repository, "init", "--quiet", "--initial-branch=main", "--template=")
            git(repository, "-c", f"core.excludesFile={os.devnull}", "add", "--all")
            git(
                repository,
                "-c", "user.name=Example Workspace",
                "-c", "user.email=example@example.invalid",
                "-c", "commit.gpgsign=false",
                "-c", f"core.hooksPath={os.devnull}",
                "commit", "--quiet", "-m", "Initialize example repository",
            )
        for name in REPOSITORIES:
            (staging / name).rename(destination / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path, help="new or empty directory")
    arguments = parser.parse_args()
    destination = arguments.destination.expanduser().resolve()
    try:
        materialize(destination)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Created {', '.join(REPOSITORIES)} under {destination}")


if __name__ == "__main__":
    main()
