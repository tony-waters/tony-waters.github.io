---
title: Flattening a Codebase into a Single File (for Review, LLMs, and Sanity)
layout: post
header-img: "img/bash.png"
---

When working on a non-trivial codebase—especially something like a layered Spring Boot application — you eventually hit this problem:

> I want to show everything to a reviewer (or ChatGPT), without zipping, uploading, or losing context.

Copy-pasting files one by one is painful. Dumping raw directories is noisy and unreadable. What you actually want is:

- A single file
- With clear boundaries between files
- That excludes junk
- And is structured enough for tools (and humans) to understand

The goal is to translate a directory structure like this:

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

The main features of the script are:
- excludes obvious garbage
- skips binary files
- sorts output, so diffs are stable
- uses markdown code fences, which helps LLMs parse files properly
- includes the path before every file

### Installation

The script can be found [here](https://github.com/tony-waters/directory-to-text/blob/main/directory-to-text.sh).

On Linux I drop this file into `~/.local/bin` and make it executable:

```bash
mv directory-to-text.sh ~/.local/bin
chmod +x ~/.local/bin/directory-to-text.sh
```

Then it can be run from any directory.

### Can it be done in a one-liner?

Well, yes. But its very ugly:

```bash
find . -type f ! -path "*/.git/*" ! -path "*/target/*" ! -path "*/build/*" ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/coverage/*" ! -path "*/.idea/*" ! -path "*/.vscode/*" ! -path "*/.mvn/wrapper/*" ! -path "*/tmp/*" ! -path "*/logs/*" ! -name "*.class" ! -name "*.jar" ! -name "*.war" ! -name "*.ear" ! -name "*.zip" ! -name "*.tar" ! -name "*.gz" ! -name "*.png" ! -name "*.jpg" ! -name "*.jpeg" ! -name "*.gif" ! -name "*.webp" ! -name "*.pdf" ! -name "*.iml" ! -name "*.log" -print0 | sort -z | while IFS= read -r -d '' f; do file --mime "$f" | grep -q 'charset=binary' && continue; ext="${f##*.}"; case "$ext" in java)l=java;;xml)l=xml;;yml|yaml)l=yaml;;properties)l=properties;;sql)l=sql;;sh)l=bash;;md)l=markdown;;json)l=json;;html)l=html;;css)l=css;;js)l=javascript;;ts)l=typescript;;txt)l=text;;*)l="";; esac; printf '\n---\nFILE: %s\n---\n```%s\n' "$f" "$l"; cat "$f"; printf '\n```\n'; done > repo_dump_for_llm.md
```

### Final Thought

While we could treat this as a quick shell hack, sometimes how you present the code matters as much as the code itself. This script gives you a clean, structured, reproducible, LLM-friendly way to do that.




