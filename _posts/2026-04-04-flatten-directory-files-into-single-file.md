---
title: Flatten directory files into a single file
layout: post
header-img: "img/spring5.jpg"
---

Rather than dragging and dropping lots of individual files into an AI, it often easier to combine all the files into a single text file that can be copied and pasted in one move.

Here is a Bash script I use to do just this:

```bash
OUTPUT="folder-dump.md"

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

On Linux I drop this file (let's call it "repo-scan.sh") into ~/.local/bin and make it executable:

```bash
mv repo-scan.sh ~/.local/bin
chmod +x ~/.local/bin/repo-scan.sh
```

Then it can be run from any directory.

For example, this directory structure:

```text
├── dir1
│   ├── dir2
│   │   └── file3.txt
│   └── file2.java
├── file1.txt
```

Produces this output:

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

