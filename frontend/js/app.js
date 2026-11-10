/* DevNet EcoNav - Interactive Application Script */
(function () {
    var menu = document.getElementById('navMenu');
    var links = document.querySelectorAll('#navPills .nav-pill-link, a[href^="#"]');
    var items = [];

    // Gather targets for scrollspy
    var navPillLinks = document.querySelectorAll('#navPills .nav-pill-link');
    navPillLinks.forEach(function (a) {
        var href = a.getAttribute('href');
        if (a.hasAttribute('data-bs-toggle') || !href || href.charAt(0) !== '#' || href.length < 2) return;
        var sec = document.getElementById(href.slice(1));
        if (sec) items.push({ a: a, sec: sec });
    });

    function setActive(a) {
        items.forEach(function (it) { it.a.classList.toggle('active', it.a === a); });
    }

    function onScroll() {
        if (!items.length) return;
        var y = window.scrollY + 120;
        var current = items[0];
        items.forEach(function (it) { if (it.sec.offsetTop <= y) current = it; });
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
            current = items[items.length - 1];
        }
        setActive(current.a);
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { onScroll(); ticking = false; });
    }, { passive: true });

    window.addEventListener('resize', onScroll);
    onScroll();

    // Smooth sliding animation for internal links
    links.forEach(function (a) {
        a.addEventListener('click', function (e) {
            var href = a.getAttribute('href');

            // Close mobile collapse if open
            if (menu && menu.classList.contains('show')) {
                bootstrap.Collapse.getOrCreateInstance(menu).hide();
            }

            if (!href || href === '#' || href.charAt(0) !== '#' || a.hasAttribute('data-bs-toggle')) return;

            var targetSec = document.getElementById(href.slice(1));
            if (targetSec) {
                e.preventDefault();
                var targetTop = targetSec.getBoundingClientRect().top + window.pageYOffset - 90;

                window.scrollTo({
                    top: targetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
})();