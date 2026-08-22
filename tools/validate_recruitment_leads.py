#!/usr/bin/env python3
"""Validate the JobRadar company-level recruitment lead pool."""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LEADS = ROOT / "recruitment_leads.json"

REQUIRED_STRINGS = (
    "id",
    "company",
    "recruitment_name",
    "recruitment_type",
    "discovered_at",
    "published_at",
    "deadline",
    "company_type",
    "official_url",
    "source_url",
    "source_type",
    "evidence_grade",
    "status",
    "urgency",
)
REQUIRED_ARRAYS = ("cities", "directions", "cohort")
ENUMS = {
    "recruitment_type": {"秋招", "提前批", "补招", "校园招聘", "Graduate/New Grad"},
    "evidence_grade": {"A", "B", "C"},
    "status": {
        "discovered",
        "verified_recruitment",
        "needs_role_review",
        "converted",
        "rejected",
    },
    "company_type": {"私企", "央国企事业单位", "外企"},
    "urgency": {"high", "medium", "low"},
}


def normalized_text(value: Any) -> str:
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
    urls: dict[str, set[int]] = defaultdict(set)
    lead_keys: dict[tuple[str, str, str], list[int]] = defaultdict(list)

    for index, lead in enumerate(data, start=1):
        label = f"record {index}"
        if not isinstance(lead, dict):
            errors.append(f"{label}: must be an object")
            continue

        for field in REQUIRED_STRINGS:
            value = lead.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label}: missing or empty string field '{field}'")

        for field in REQUIRED_ARRAYS:
            value = lead.get(field)
            if not isinstance(value, list):
                errors.append(f"{label}: field '{field}' must be an array")
            elif any(not isinstance(item, str) or not item.strip() for item in value):
                errors.append(
                    f"{label}: field '{field}' must contain only non-empty strings"
                )

        if not isinstance(lead.get("notes"), str):
            errors.append(f"{label}: field 'notes' must be a string")

        lead_id = lead.get("id")
        if isinstance(lead_id, str) and lead_id.strip():
            ids[lead_id.strip()].append(index)

        for field, allowed in ENUMS.items():
            value = lead.get(field)
            if value not in allowed:
                choices = ", ".join(sorted(allowed))
                errors.append(
                    f"{label} ({lead_id or 'unknown id'}): invalid {field}={value!r}; "
                    f"allowed: {choices}"
                )

        score = lead.get("match_score")
        if (
            isinstance(score, bool)
            or not isinstance(score, (int, float))
            or not math.isfinite(score)
            or not 0 <= score <= 100
        ):
            errors.append(
                f"{label} ({lead_id or 'unknown id'}): match_score must be a number from 0 to 100"
            )

        if not isinstance(lead.get("is_new_company"), bool):
            errors.append(
                f"{label} ({lead_id or 'unknown id'}): is_new_company must be a boolean"
            )

        for field in ("official_url", "source_url"):
            url = lead.get(field)
            if isinstance(url, str) and url.strip():
                clean_url = url.strip()
                urls[clean_url].add(index)
                if not clean_url.startswith(("http://", "https://")):
                    errors.append(
                        f"{label} ({lead_id or 'unknown id'}): {field} must start with "
                        "http:// or https://"
                    )

        company = normalized_text(lead.get("company"))
        recruitment_name = normalized_text(lead.get("recruitment_name"))
        published_at = normalized_text(lead.get("published_at"))
        if company and recruitment_name and published_at:
            lead_keys[(company, recruitment_name, published_at)].append(index)

    for lead_id, records in ids.items():
        if len(records) > 1:
            errors.append(f"duplicate id {lead_id!r} in records {records}")

    for url, records in urls.items():
        if len(records) > 1:
            warnings.append(f"shared URL in records {sorted(records)}: {url}")

    for key, records in lead_keys.items():
        if len(records) > 1:
            company, recruitment_name, published_at = key
            errors.append(
                "duplicate company + recruitment_name + published_at "
                f"in records {records}: {company} | {recruitment_name} | {published_at}"
            )

    return errors, warnings, len(data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=DEFAULT_LEADS,
        help="lead JSON file to validate (default: repository recruitment_leads.json)",
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

    print(f"Validation passed: {count} record(s), {len(warnings)} warning(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
