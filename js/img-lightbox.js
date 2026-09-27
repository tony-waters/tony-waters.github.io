(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var images = document.querySelectorAll('article img');
        if (!images.length) {
            return;
        }

        var overlay = document.createElement('div');
        overlay.className = 'img-lightbox-overlay';

        var overlayImg = document.createElement('img');
        overlay.appendChild(overlayImg);
        document.body.appendChild(overlay);

        function open(image) {
            overlayImg.src = image.currentSrc || image.src;
            overlayImg.alt = image.alt || '';
            overlay.classList.add('is-open');
            document.body.classList.add('img-lightbox-active');
        }

        function close() {
            overlay.classList.remove('is-open');
            document.body.classList.remove('img-lightbox-active');
        }

        images.forEach(function (image) {
            image.classList.add('is-zoomable');
            image.addEventListener('click', function () {
                open(image);
            });
        });

        overlay.addEventListener('click', close);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                close();
            }
        });
    });
})();
