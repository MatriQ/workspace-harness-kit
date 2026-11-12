#!/usr/bin/env python3
"""Request a greeting from the example API."""

import argparse
import json
from pathlib import Path
import subprocess
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", nargs="?")
    parser.add_argument("--version", action="store_true", help="Report this fixture checkout's source revision")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    arguments = parser.parse_args()
    if arguments.version:
        print(subprocess.check_output(["git", "-C", str(Path(__file__).resolve().parent), "rev-parse", "HEAD"], text=True).strip())
        return
    if arguments.name is None:
        parser.error("name is required unless --version is used")
    query = urlencode({"name": arguments.name})
    endpoint = f"{arguments.base_url.rstrip('/')}/v1/greetings?{query}"
    try:
        with urlopen(endpoint, timeout=5) as response:
            greeting = json.load(response)
    except (URLError, TimeoutError) as error:
        parser.exit(1, f"Greeting request failed: {error}\n")
    print(greeting["message"])


if __name__ == "__main__":
    main()
