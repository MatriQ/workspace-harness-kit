#!/usr/bin/env python3
"""Process one synthetic greeting and report the worker's declared source revision."""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--reject", action="store_true", help="Exercise the negative business fixture")
    args = parser.parse_args()
    greeting = json.load(sys.stdin)
    print(json.dumps({"revision": args.revision, "accepted": not args.reject,
                      "message": greeting["message"]}))


if __name__ == "__main__":
    main()
