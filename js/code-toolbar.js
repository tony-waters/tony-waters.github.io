(function () {
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
        } finally {
            document.body.removeChild(textarea);
        }
        return Promise.resolve();
    }

    // Parses a GitHub blob URL into the bits used to label the link:
    // .../blob/<sha>/<path/to/File.java>#L21-L27
    function describeGithubUrl(githubUrl) {
        var match = /\/blob\/[^\/]+\/([^#?]+)/.exec(githubUrl);
        var path = match ? match[1] : '';
        var segments = path.split('/');
        var filename = segments.pop() || githubUrl;

        var javaRoot = 'src/main/java/';
        var javaIndex = path.indexOf(javaRoot);
        var pkg = null;
        if (javaIndex !== -1) {
            var pkgSegments = path.slice(javaIndex + javaRoot.length).split('/');
            pkgSegments.pop();
            if (pkgSegments.length) {
                pkg = pkgSegments.join('.');
            }
        }

        var lineMatch = /#L(\d+)(?:-L(\d+))?/.exec(githubUrl);
        var lines = lineMatch ? (lineMatch[2] ? lineMatch[1] + '-' + lineMatch[2] : lineMatch[1]) : null;

        // Standard Java fully-qualified-name style: uk.bit1.outbox.rest.order.OrderController.java
        var qualifiedName = pkg ? pkg + '.' + filename : filename;

        return { filename: filename, qualifiedName: qualifiedName, path: path, lines: lines };
    }

    function buildToolbar(block, githubUrl) {
        var toolbar = document.createElement('div');
        toolbar.className = 'code-toolbar';

        if (githubUrl) {
            var info = describeGithubUrl(githubUrl);
            var link = document.createElement('a');
            link.className = 'code-toolbar-github';
            link.href = githubUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = info.path + (info.lines ? ' (lines ' + info.lines + ')' : '');
            link.setAttribute('aria-label', 'View ' + info.filename + ' on GitHub');

            var icon = document.createElement('i');
            icon.className = 'fa fa-github';
            icon.setAttribute('aria-hidden', 'true');
            link.appendChild(icon);

            var nameEl = document.createElement('span');
            nameEl.className = 'code-toolbar-filename';
            nameEl.textContent = info.qualifiedName;
            link.appendChild(nameEl);

            toolbar.appendChild(link);
        }

        var copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'code-toolbar-copy';
        copyButton.setAttribute('aria-label', 'Copy code');

        var copyIcon = document.createElement('i');
        copyIcon.className = 'fa fa-files-o';
        copyIcon.setAttribute('aria-hidden', 'true');
        copyButton.appendChild(copyIcon);

        copyButton.addEventListener('click', function () {
            var code = block.querySelector('pre code') || block.querySelector('code');
            if (!code) {
                return;
            }
            copyText(code.innerText).then(function () {
                copyIcon.className = 'fa fa-check';
                copyButton.classList.add('is-copied');
                copyButton.setAttribute('aria-label', 'Copied!');
                setTimeout(function () {
                    copyIcon.className = 'fa fa-files-o';
                    copyButton.classList.remove('is-copied');
                    copyButton.setAttribute('aria-label', 'Copy code');
                }, 1500);
            });
        });
        toolbar.appendChild(copyButton);

        return toolbar;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var blocks = document.querySelectorAll('article div.highlighter-rouge');
        if (!blocks.length) {
            return;
        }

        var links = window.postGithubLinks || [];

        blocks.forEach(function (block, index) {
            block.classList.add('has-code-toolbar');
            block.insertBefore(buildToolbar(block, links[index]), block.firstChild);
        });
    });
})();
