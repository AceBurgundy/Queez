#!/usr/bin/env python3
"""
better_image.py
---------------
Automated image enhancement script for Queez:
Milk Operations and Farm Management (Exam 1) & (Upcoming Exam / Part 2).

Calls `agy` through a subprocess using a fixed prompt:
"Turn an image from its current look to an image that looks like it was
created at its current time (if art) or by an expensive dlsr camera (if photo)
then replace the original image."

Strictly excludes:
- Portable milking machine images / diagrams
- Parts of cattle images / diagrams
- Daily activities and daily time schedule images
"""

import os
import sys
import time
import shutil
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple, Set

# Base directories
DEFAULT_QUEEZ_DATA = Path(r"D:/Documents/Programming/Languages/Javascript/Queez/data")
DEFAULT_MIRROR_DATA = Path(r"D:/Conversations/queez/quizzes")

# Target subdirectories
EXAM1_DIR_NAME = "milk-operation-quiz"
EXAM2_DIR_NAME = "milk-operation-part-2-quiz"

# Exact filename exclusions
EXCLUDED_FILENAMES: Set[str] = {
    # Part 2 diagrams & routines
    "body-parts-of-cattle-answer.jpg",
    "body-parts-of-cattle-question.jpg",
    "portable-milking-machine-answer.jpg",
    "portable-milking-machine-question.jpg",
    "daily-routine-activity-quiz.jpg",
    "daily-routine-time-quiz.jpg",
    "dairy-square-daily-routine-original.jpg",
    # Exam 1 anatomical / mechanical diagrams
    "p14_p14_img1.png",  # Body parts of cattle anatomical diagram
    "p40_p40_img2.png",  # Portable milking machine unit
    "p60_p60_img3.png",  # Portable milking machine diagram
    "p60_p60_img4.png",  # Milking cluster assembly detail
}

# Substring / pattern exclusions (case-insensitive)
EXCLUDED_PATTERNS: List[str] = [
    "portable-milking-machine",
    "milking-machine",
    "milking_machine",
    "milking-cluster",
    "milking_cluster",
    "body-parts-of-cattle",
    "parts-of-cattle",
    "parts_of_cattle",
    "daily-routine",
    "activity-quiz",
    "time-quiz",
    "daily-schedule",
    "dairy-square",
]

# Fixed prompt instruction template
FIXED_PROMPT_TEMPLATE = (
    'Turn the image at "{image_path}" from its current look to an image that '
    'looks like it was created at its current time (if art) or by an expensive '
    'dlsr camera (if photo) then replace the original image.'
)

def find_agy_binary() -> str:
    """Locate the agy CLI binary executable."""
    found = shutil.which("agy")
    if found:
        return found
    standard_loc = Path(os.environ.get("LOCALAPPDATA", "")) / "agy" / "bin" / "agy.exe"
    if standard_loc.is_file():
        return str(standard_loc)
    fallback_win = Path(r"C:\Users\samad\AppData\Local\agy\bin\agy.exe")
    if fallback_win.is_file():
        return str(fallback_win)
    return "agy"

def is_excluded_image(file_path: Path) -> Tuple[bool, str]:
    """
    Evaluates whether an image file is excluded based on:
    1. Portable milking machine
    2. Parts of the cattle
    3. Daily activities and daily time schedule
    """
    fname_lower = file_path.name.lower()
    
    # Check exact filename exclusions
    if fname_lower in EXCLUDED_FILENAMES:
        return True, f"Matched exact excluded filename '{file_path.name}'"
    
    # Check substring patterns
    for pat in EXCLUDED_PATTERNS:
        if pat in fname_lower:
            return True, f"Filename matched excluded pattern '{pat}'"
            
    # Check if file is card-image or other non-exam assets if necessary
    if fname_lower in {"card-image.png"}:
        return True, "Excluded card badge image"
        
    return False, ""

def build_prompt(image_path: Path) -> str:
    """Constructs the exact fixed prompt for agy."""
    abs_path = str(image_path.resolve()).replace("\\", "/")
    return FIXED_PROMPT_TEMPLATE.format(image_path=abs_path)

def discover_target_images(
    target_scope: str = "all",
    base_dir: Path = DEFAULT_QUEEZ_DATA
) -> List[Tuple[Path, bool, str]]:
    """
    Discovers all candidate image assets and determines inclusion/exclusion.
    Returns list of tuples: (image_path, is_excluded, exclusion_reason).
    """
    results: List[Tuple[Path, bool, str]] = []
    dirs_to_scan = []
    
    if target_scope in ("all", "exam1"):
        exam1_assets = base_dir / EXAM1_DIR_NAME / "assets"
        if exam1_assets.is_dir():
            dirs_to_scan.append(exam1_assets)
            
    if target_scope in ("all", "part2", "upcoming"):
        exam2_assets = base_dir / EXAM2_DIR_NAME / "assets"
        if exam2_assets.is_dir():
            dirs_to_scan.append(exam2_assets)
            
    for directory in dirs_to_scan:
        for f in sorted(directory.iterdir()):
            if f.is_file() and f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                excluded, reason = is_excluded_image(f)
                results.append((f, excluded, reason))
                
    return results

def sync_to_mirror(source_file: Path, base_data_dir: Path, mirror_dir: Path) -> bool:
    """Syncs modified file to mirror directory if it exists."""
    try:
        rel_path = source_file.relative_to(base_data_dir)
        dest_file = mirror_dir / rel_path
        if dest_file.parent.is_dir():
            shutil.copy2(source_file, dest_file)
            return True
    except Exception as e:
        print(f"  [Warning] Failed to sync {source_file.name} to mirror: {e}", file=sys.stderr)
    return False

def run_image_enhancement(
    image_path: Path,
    agy_bin: str,
    backup: bool = False,
    timeout: int = 180
) -> Tuple[bool, str]:
    """
    Invokes `agy` CLI via subprocess with the fixed prompt.
    """
    if backup:
        bak_path = image_path.with_suffix(image_path.suffix + ".bak")
        if not bak_path.exists():
            shutil.copy2(image_path, bak_path)

    prompt = build_prompt(image_path)
    cmd = [agy_bin, "-p", prompt, "--dangerously-skip-permissions"]

    initial_mtime = image_path.stat().st_mtime if image_path.exists() else 0

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False
        )
        output = (proc.stdout + "\n" + proc.stderr).strip()

        if proc.returncode != 0:
            return False, f"agy exited with code {proc.returncode}: {output[:300]}"

        # Check if file was modified
        current_mtime = image_path.stat().st_mtime if image_path.exists() else 0
        if current_mtime > initial_mtime:
            return True, "Image successfully updated."
        else:
            return True, f"agy finished successfully (output: {output[:150]})."
    except subprocess.TimeoutExpired:
        return False, f"Process timed out after {timeout} seconds."
    except Exception as e:
        return False, f"Execution error: {e}"

def main():
    parser = argparse.ArgumentParser(
        description="Enhance Milk Operations exam images via agy CLI subprocess calls."
    )
    parser.add_argument(
        "--target",
        choices=["all", "exam1", "part2", "upcoming"],
        default="all",
        help="Target exam visual assets (default: all)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and list candidates without invoking agy"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Process a single image file directly"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of images to process in this run"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=5.0,
        help="Delay in seconds between calls for 15 RPM protection (default: 5.0)"
    )
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Create .bak copy before replacing original image"
    )
    parser.add_argument(
        "--sync",
        action="store_true",
        default=True,
        help="Sync modified assets to conversation mirror directory (default: True)"
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=str(DEFAULT_QUEEZ_DATA),
        help="Path to Queez data directory"
    )

    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    mirror_dir = DEFAULT_MIRROR_DATA

    print("==================================================")
    print("           Queez Better Image Pipeline            ")
    print("==================================================")
    print(f"Target Scope:  {args.target}")
    print(f"Data Dir:      {data_dir}")
    print(f"Dry Run Mode:  {args.dry_run}")
    print(f"Pacing Delay:  {args.delay}s (15 RPM compliance)")
    print("--------------------------------------------------")

    # Discover images
    if args.file:
        single_path = Path(args.file)
        if not single_path.is_file():
            print(f"[Error] Specified file does not exist: {single_path}", file=sys.stderr)
            sys.exit(1)
        excluded, reason = is_excluded_image(single_path)
        items = [(single_path, excluded, reason)]
    else:
        items = discover_target_images(target_scope=args.target, base_dir=data_dir)

    included_items = [(p, r) for p, excl, r in items if not excl]
    excluded_items = [(p, r) for p, excl, r in items if excl]

    print(f"Total Discovered: {len(items)}")
    print(f"Eligible Images:  {len(included_items)}")
    print(f"Excluded Images:  {len(excluded_items)}")
    print("--------------------------------------------------")

    if args.dry_run:
        print("\n[EXCLUDED ASSETS]:")
        for p, r in excluded_items:
            print(f"  [SKIP] {p.name:<35} -> Reason: {r}")

        print("\n[ELIGIBLE CANDIDATE ASSETS]:")
        candidate_sample = included_items if args.limit is None else included_items[:args.limit]
        for idx, (p, _) in enumerate(candidate_sample, 1):
            print(f"  [{idx:03d}/{len(candidate_sample):03d}] {p.parent.name}/{p.name}")
        
        if args.limit and len(included_items) > args.limit:
            print(f"  ... and {len(included_items) - args.limit} more images (capped by --limit {args.limit})")

        print("\n[Dry Run Completed] No modifications or subprocess calls made.")
        return 0

    # Active Execution Mode
    agy_bin = find_agy_binary()
    print(f"Using agy binary: {agy_bin}")
    
    candidates = included_items if args.limit is None else included_items[:args.limit]
    total_candidates = len(candidates)
    
    if total_candidates == 0:
        print("No eligible candidate images to process.")
        return 0

    print(f"\nBeginning execution for {total_candidates} images...")
    success_count = 0
    failure_count = 0

    for idx, (img_path, _) in enumerate(candidates, 1):
        print(f"\n[{idx}/{total_candidates}] Processing: {img_path.name}")
        print(f"  Path: {img_path}")
        
        start_time = time.time()
        success, message = run_image_enhancement(
            image_path=img_path,
            agy_bin=agy_bin,
            backup=args.backup
        )
        elapsed = time.time() - start_time

        if success:
            success_count += 1
            print(f"  [SUCCESS] {message} ({elapsed:.1f}s)")
            if args.sync:
                synced = sync_to_mirror(img_path, data_dir, mirror_dir)
                if synced:
                    print(f"  [SYNC] Mirrored to {mirror_dir.name}")
        else:
            failure_count += 1
            print(f"  [FAILED] {message} ({elapsed:.1f}s)", file=sys.stderr)

        # Enforce rate limiting between turns
        if idx < total_candidates and args.delay > 0:
            print(f"  [Pacing] Waiting {args.delay}s to respect 15 RPM rate limits...")
            time.sleep(args.delay)

    print("\n==================================================")
    print("                 Execution Summary                ")
    print("==================================================")
    print(f"Total Processed: {total_candidates}")
    print(f"Successful:      {success_count}")
    print(f"Failed:          {failure_count}")
    print(f"Excluded:        {len(excluded_items)}")
    print("==================================================")

    return 0 if failure_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
