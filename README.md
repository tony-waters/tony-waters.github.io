## Local development

This is a GitHub Pages/Jekyll site.

Install system Ruby headers once if Bundler fails while compiling native gems:

```bash
sudo apt-get update
sudo apt-get install ruby-dev
```

Install the site gems:

```bash
bundle install
```

Serve the site locally:

```bash
bundle exec jekyll serve --livereload
```

Open:

```text
http://localhost:4000
```
