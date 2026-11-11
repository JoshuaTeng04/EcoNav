/* DevNet EcoNav – Interactive Planner Script */
document.addEventListener("DOMContentLoaded", function () {
  // Initialize Map centered over Manila
  var map = L.map("google_map", {
    zoomControl: false,
  }).setView([14.588, 120.991], 13);

  // Google Maps Roadmap Tiles
  L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "&copy; Google Maps",
  }).addTo(map);

  L.control.zoom({ position: "topright" }).addTo(map);

  // Custom Map Markers
  var startIcon = L.divIcon({
    className: "custom-pin-start",
    html: '<div style="background:#dc2626; width:28px; height:28px; border-radius:50%; border:3px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:grid; place-items:center; color:#fff; font-size:12px;"><i class="bi bi-geo-alt-fill"></i></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  var endIcon = L.divIcon({
    className: "custom-pin-end",
    html: '<div style="background:#2563eb; width:28px; height:28px; border-radius:50%; border:3px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:grid; place-items:center; color:#fff; font-size:12px;"><i class="bi bi-pin-map-fill"></i></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  // Coordinates for Manila locations (España Blvd to Taft Ave)
  var originCoords = [14.6085, 120.9925];
  var destCoords = [14.5647, 120.9932];

  L.marker(originCoords, { icon: startIcon })
    .addTo(map)
    .bindPopup("<b>Starting Point</b><br>España Blvd, Sampaloc, Manila");

  L.marker(destCoords, { icon: endIcon })
    .addTo(map)
    .bindPopup("<b>Destination</b><br>Taft Ave 2401, Manila");

  var markerBounds = L.latLngBounds([originCoords, destCoords]);
  map.fitBounds(markerBounds, { padding: [60, 60] });

  // Track active polyline layer to remove old routes on re-submits
  var currentRouteLayer = null;

  // Handle Form Submit Event
  var form = document.getElementById("route_planner_form");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = document.getElementById("start_route_btn");
      var originalBtnHtml = btn.innerHTML;

      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Routing...';
      btn.disabled = true;

      // Fetch route from FastAPI backend
      // Get the active value from the dropdown
      var selectedProfile = document.getElementById("vehicle_type").value;

      var payload = {
        origin: { latitude: originCoords[0], longitude: originCoords[1] },
        destination: { latitude: destCoords[0], longitude: destCoords[1] },
        vehicle_profile: selectedProfile,
      };

      try {
        var response = await fetch("/api/routes/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          var errorData = await response.json();
          throw new Error(errorData.detail || "Route request failed");
        }

        var data = await response.json();

        // 1. Update Distance and Duration in the sidebar
        var distanceElem = document.querySelector(".distance-val");
        var etaElem = document.querySelector(".eta-val");

        if (distanceElem) distanceElem.innerText = `(${data.distance_km} km)`;
        if (etaElem) etaElem.innerText = `(${data.duration_minutes} mins)`;

        // 2. Decode the GraphHopper polyline
        // polyline.decode returns an array of [lat, lng] pairs
        var decodedPoints = polyline.decode(data.encoded_polyline);

        // 3. Remove existing polyline if one exists
        if (currentRouteLayer) {
          map.removeLayer(currentRouteLayer);
        }

        // 4. Draw route on map
        currentRouteLayer = L.polyline(decodedPoints, {
          color: "#0d6efd",
          weight: 6,
          opacity: 0.85,
        }).addTo(map);

        // 5. Fit map camera to full route line
        map.fitBounds(currentRouteLayer.getBounds(), { padding: [60, 60] });

        btn.innerHTML =
          '<i class="bi bi-check-circle-fill me-2"></i>Route Active';
        btn.style.backgroundColor = "#0a3d2a";
        btn.disabled = false;
      } catch (err) {
        console.error("Routing error:", err);
        alert("Routing failed: " + err.message);
        btn.innerHTML = originalBtnHtml;
        btn.disabled = false;
      }
    });
  }
});
