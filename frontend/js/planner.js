/* DevNet EcoNav – Interactive Planner Script */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize Map with Google Maps Tiles
    var map = L.map('google_map', {
        zoomControl: false
    }).setView([14.588, 120.991], 13); // Default view over Metro Manila

    // Google Maps Roadmap Tiles
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }).addTo(map);

    // Zoom Controls in Top-Right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Custom Map Markers matching EcoNav Theme
    var startIcon = L.divIcon({
        className: 'custom-pin-start',
        html: '<div style="background:#dc2626; width:28px; height:28px; border-radius:50%; border:3px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:grid; place-items:center; color:#fff; font-size:12px;"><i class="bi bi-geo-alt-fill"></i></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
    });

    var endIcon = L.divIcon({
        className: 'custom-pin-end',
        html: '<div style="background:#2563eb; width:28px; height:28px; border-radius:50%; border:3px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:grid; place-items:center; color:#fff; font-size:12px;"><i class="bi bi-pin-map-fill"></i></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
    });

    // Manila Sample Route Coordinates
    var originCoords = [14.6135, 120.9902];
    var destCoords = [14.5647, 120.9932];

    var originMarker = L.marker(originCoords, { icon: startIcon }).addTo(map)
        .bindPopup("<b>Starting Point</b><br>España Blvd, Sampaloc, Manila");

    var destMarker = L.marker(destCoords, { icon: endIcon }).addTo(map)
        .bindPopup("<b>Destination</b><br>Taft Ave 2401, Manila");

    // Center camera to fit both markers cleanly without drawing a connecting line
    var markerBounds = L.latLngBounds([originCoords, destCoords]);
    map.fitBounds(markerBounds, { padding: [60, 60] });

    // Handle Form Submit Event
    var form = document.getElementById('route_planner_form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var btn = document.getElementById('start_route_btn');
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Calculating Route...';
            btn.disabled = true;

            setTimeout(function () {
                btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Route Active';
                btn.style.backgroundColor = '#0a3d2a';
                btn.disabled = false;

                map.flyToBounds(markerBounds, { duration: 1.2, padding: [60, 60] });
            }, 800);
        });
    }
});