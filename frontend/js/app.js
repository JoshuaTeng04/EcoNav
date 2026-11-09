/* Nav pill scroll spy and mobile menu auto-close */
(function () {
    var menu = document.getElementById('navMenu');
    var links = document.querySelectorAll('#navPills .nav-pill-link');
    var items = [];

    links.forEach(function (a) {
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

    links.forEach(function (a) {
        a.addEventListener('click', function () {
            if (menu && menu.classList.contains('show')) {
                bootstrap.Collapse.getOrCreateInstance(menu).hide();
            }
        });
    });
})();