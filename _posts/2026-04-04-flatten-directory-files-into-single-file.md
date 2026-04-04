---
title: Flattening a Codebase into a Single File (for Review, LLMs, and Sanity)
layout: post
header-img: "img/spring5.jpg"
---

When working on a non-trivial codebase—especially something like a layered Spring Boot application — you eventually hit this problem:

> I want to show everything to a reviewer (or ChatGPT), without zipping, uploading, or losing context.

Copy-pasting files one by one is painful. Dumping raw directories is noisy and unreadable.

What you actually want is:

- A single file
- With clear boundaries between files
- That excludes junk
- And is structured enough for tools (and humans) to understand

The goal is to translate directory structure like this:

```text
├── dir1
│   ├── dir2
│   │   └── file3.txt (contents: "the lazy dog")
│   └── file2.java (contents: "jumped over" on separate lines)
├── file1.txt (contents: "The quick brown fox")
```

Into a single file something like this:

<pre>
---
FILE: ./dir1/dir2/file3.txt
---
```text
the lazy dog
```

---
FILE: ./dir1/file2.java
---
```java
jumped
over
```

---
FILE: ./file1.txt
---
```text
The quick brown fox
```
</pre>

Let’s build that properly.

```bash
#!/usr/bin/env bash

# Fail fast:
# -e  → exit on error
# -u  → error on undefined variables
# -o pipefail → catch errors inside pipes
set -euo pipefail

# Output file (Markdown so it's LLM / GitHub friendly)

OUTPUT="repo-dump.md"

# ------------------------------------------------------------------------------
# STEP 1: Write a header to guide whoever (or whatever) reads this file
# This massively improves review quality when feeding into ChatGPT or humans
# ------------------------------------------------------------------------------

cat > "$OUTPUT" <<'EOF'
PROJECT DUMP FOR REVIEW

Notes for reviewer:
- Paths are shown before each file.
- Build artifacts and binaries are excluded.
- Files are sorted alphabetically.
- Review for: architecture, bugs, code smells, JPA issues, Spring Boot issues,
  test gaps, naming, cohesion, coupling, and production risks.

---
EOF

# ------------------------------------------------------------------------------
# STEP 2: Find all relevant files
#
# Key points:
# - Use -print0 to safely handle spaces/newlines in filenames
# - Explicitly exclude junk directories and binary artifacts
# - Keep this list tight → garbage in = garbage out
# ------------------------------------------------------------------------------

find . -type f \
  ! -path "*/.git/*" \
  ! -path "*/target/*" \
  ! -path "*/build/*" \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/coverage/*" \
  ! -path "*/.idea/*" \
  ! -path "*/.vscode/*" \
  ! -path "*/.mvn/wrapper/*" \
  ! -path "*/tmp/*" \
  ! -path "*/logs/*" \
  ! -name "*.class" \
  ! -name "*.jar" \
  ! -name "*.war" \
  ! -name "*.ear" \
  ! -name "*.zip" \
  ! -name "*.tar" \
  ! -name "*.gz" \
  ! -name "*.png" \
  ! -name "*.jpg" \
  ! -name "*.jpeg" \
  ! -name "*.gif" \
  ! -name "*.webp" \
  ! -name "*.pdf" \
  ! -name "*.iml" \
  ! -name "*.log" \
  -print0 |

# ------------------------------------------------------------------------------
# STEP 3: Sort files for deterministic output
#
# Why this matters:
# - Stable diffs in Git
# - Easier comparison between runs
# ------------------------------------------------------------------------------

sort -z |

# ------------------------------------------------------------------------------
# STEP 4: Process each file safely
#
# - read -d '' → handles null-separated input
# - avoids breaking on spaces or weird filenames
# ------------------------------------------------------------------------------

while IFS= read -r -d '' file; do

  # --------------------------------------------------------------------------
  # STEP 4a: Skip binary files
  #
  # Even after filtering extensions, some binaries sneak in.
  # Dumping them will corrupt your output and waste tokens.
  # --------------------------------------------------------------------------

  if file --mime "$file" | grep -q 'charset=binary'; then
    continue
  fi

  # --------------------------------------------------------------------------
  # STEP 4b: Infer language for Markdown code fences
  #
  # This improves syntax highlighting AND helps LLMs interpret structure
  # --------------------------------------------------------------------------

  ext="${file##*.}"
  case "$ext" in
    java) lang="java" ;;
    xml) lang="xml" ;;
    yml|yaml) lang="yaml" ;;
    properties) lang="properties" ;;
    sql) lang="sql" ;;
    sh) lang="bash" ;;
    md) lang="markdown" ;;
    json) lang="json" ;;
    html) lang="html" ;;
    css) lang="css" ;;
    js) lang="javascript" ;;
    ts) lang="typescript" ;;
    txt) lang="text" ;;
    *) lang="" ;;  # unknown → no syntax hint
  esac

  # --------------------------------------------------------------------------
  # STEP 4c: Write file header
  #
  # Clear separation between files is critical for readability and parsing
  # --------------------------------------------------------------------------

  printf '\n---\nFILE: %s\n---\n' "$file" >> "$OUTPUT"

  # --------------------------------------------------------------------------
  # STEP 4d: Wrap content in Markdown code fences
  #
  # This:
  # - preserves formatting
  # - avoids accidental markdown parsing
  # - makes it LLM-friendly
  # --------------------------------------------------------------------------

  printf '```%s\n' "$lang" >> "$OUTPUT"
  cat "$file" >> "$OUTPUT"
  printf '\n```\n' >> "$OUTPUT"

done

# ------------------------------------------------------------------------------
# STEP 5: Final confirmation
# ------------------------------------------------------------------------------

echo "Created $OUTPUT"


find . -type f \
  ! -path "*/.git/*" \
  ! -path "*/target/*" \
  ! -path "*/build/*" \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/coverage/*" \
  ! -path "*/.idea/*" \
  ! -path "*/.vscode/*" \
  ! -path "*/.mvn/wrapper/*" \
  ! -path "*/tmp/*" \
  ! -path "*/logs/*" \
  ! -name "*.class" \
  ! -name "*.jar" \
  ! -name "*.war" \
  ! -name "*.ear" \
  ! -name "*.zip" \
  ! -name "*.tar" \
  ! -name "*.gz" \
  ! -name "*.png" \
  ! -name "*.jpg" \
  ! -name "*.jpeg" \
  ! -name "*.gif" \
  ! -name "*.webp" \
  ! -name "*.pdf" \
  ! -name "*.iml" \
  ! -name "*.log" \
  -print0 | sort -z | while IFS= read -r -d '' file; do

    if file --mime "$file" | grep -q 'charset=binary'; then
      continue
    fi

    ext="${file##*.}"
    case "$ext" in
      java) lang="java" ;;
      xml) lang="xml" ;;
      yml|yaml) lang="yaml" ;;
      properties) lang="properties" ;;
      sql) lang="sql" ;;
      sh) lang="bash" ;;
      md) lang="markdown" ;;
      json) lang="json" ;;
      html) lang="html" ;;
      css) lang="css" ;;
      js) lang="javascript" ;;
      ts) lang="typescript" ;;
      txt) lang="text" ;;
      *) lang="" ;;
    esac

    printf '\n---\nFILE: %s\n---\n' "$file" >> "$OUTPUT"
    printf '```%s\n' "$lang" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    printf '\n```\n' >> "$OUTPUT"

done

echo "Created $OUTPUT"
```

The main features of this are:
- excludes obvious garbage
- skips binary files
- sorts output, so diffs are stable
- uses markdown code fences, which helps LLMs parse files properly
- includes the path before every file

### Installation

On Linux I drop this file (let's call it "repo-scan.sh") into ~/.local/bin and make it executable:

```bash
mv repo-scan.sh ~/.local/bin
chmod +x ~/.local/bin/repo-scan.sh
```

Then it can be run from any directory.

### Can it be done in a one-liner?

Well, yes. But its very ugly:

```bash
find . -type f ! -path "*/.git/*" ! -path "*/target/*" ! -path "*/build/*" ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/coverage/*" ! -path "*/.idea/*" ! -path "*/.vscode/*" ! -path "*/.mvn/wrapper/*" ! -path "*/tmp/*" ! -path "*/logs/*" ! -name "*.class" ! -name "*.jar" ! -name "*.war" ! -name "*.ear" ! -name "*.zip" ! -name "*.tar" ! -name "*.gz" ! -name "*.png" ! -name "*.jpg" ! -name "*.jpeg" ! -name "*.gif" ! -name "*.webp" ! -name "*.pdf" ! -name "*.iml" ! -name "*.log" -print0 | sort -z | while IFS= read -r -d '' f; do file --mime "$f" | grep -q 'charset=binary' && continue; ext="${f##*.}"; case "$ext" in java)l=java;;xml)l=xml;;yml|yaml)l=yaml;;properties)l=properties;;sql)l=sql;;sh)l=bash;;md)l=markdown;;json)l=json;;html)l=html;;css)l=css;;js)l=javascript;;ts)l=typescript;;txt)l=text;;*)l="";; esac; printf '\n---\nFILE: %s\n---\n```%s\n' "$f" "$l"; cat "$f"; printf '\n```\n'; done > repo_dump_for_llm.md
```

### Final Thought

Most people treat this as a quick shell hack.

That’s a mistake.

If you’re serious about:

- code reviews
- architecture
- using LLMs effectively

…then how you present the code matters as much as the code itself.

This script gives you a clean, structured, reproducible way to do that.




