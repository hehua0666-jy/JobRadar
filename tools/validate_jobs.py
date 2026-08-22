#!/usr/bin/env python3
"""Validate the JobRadar jobs database without modifying it."""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JOBS = ROOT / "jobs.json"

REQUIRED_FIELDS = ("id", "company", "role", "city", "url", "etype")
ENUMS = {
    "evidence_grade": {"A", "B", "C"},
    "level": {"position", "project"},
    "status": {"open", "verify", "closed"},
    "display_status": {"active", "watch"},
}


def normalized_text(value: Any) -> str:
    """Normalize text for conservative duplicate detection."""
    return " ".join(str(value or "").split()).casefold()


def validate(path: Path) -> tuple[list[str], list[str], int]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"file not found: {path}"], warnings, 0
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return [f"cannot parse {path}: {exc}"], warnings, 0

    if not isinstance(data, list):
        return ["top-level JSON value must be an array"], warnings, 0

    ids: dict[str, list[int]] = defaultdict(list)
    urls: dict[str, list[int]] = defaultdict(list)
    job_keys: dict[tuple[str, str, str], list[int]] = defaultdict(list)

    for index, job in enumerate(data):
        label = f"record {index + 1}"
        if not isinstance(job, dict):
            errors.append(f"{label}: must be an object")
            continue

        for field in REQUIRED_FIELDS:
            value = job.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label}: missing or empty string field '{field}'")

        job_id = job.get("id")
        if isinstance(job_id, str) and job_id.strip():
            ids[job_id.strip()].append(index + 1)

        url = job.get("url")
        if isinstance(url, str) and url.strip():
            clean_url = url.strip()
            urls[clean_url].append(index + 1)
            if not clean_url.startswith(("http://", "https://")):
                errors.append(
                    f"{label} ({job_id or 'unknown id'}): URL must start with http:// or https://"
                )

        for field, allowed in ENUMS.items():
            value = job.get(field)
            if value not in allowed:
                choices = ", ".join(sorted(allowed))
                errors.append(
                    f"{label} ({job_id or 'unknown id'}): invalid {field}={value!r}; allowed: {choices}"
                )

        company = normalized_text(job.get("company"))
        role = normalized_text(job.get("role"))
        city = normalized_text(job.get("city"))
        if company and role and city:
            job_keys[(company, role, city)].append(index + 1)

    for job_id, records in ids.items():
        if len(records) > 1:
            errors.append(f"duplicate id {job_id!r} in records {records}")

    for url, records in urls.items():
        if len(records) > 1:
            warnings.append(f"shared URL in records {records}: {url}")

    for key, records in job_keys.items():
        if len(records) > 1:
            company, role, city = key
            errors.append(
                "duplicate company + role + city "
                f"in records {records}: {company} | {role} | {city}"
            )

    return errors, warnings, len(data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=DEFAULT_JOBS,
        help="jobs JSON file to validate (default: repository jobs.json)",
    )
    args = parser.parse_args()

    errors, warnings, count = validate(args.path)
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)

    if errors:
        print(
            f"Validation failed: {len(errors)} error(s), {len(warnings)} warning(s), "
            f"{count} record(s).",
            file=sys.stderr,
        )
        return 1

    print(
        f"Validation passed: {count} record(s), {len(warnings)} warning(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
