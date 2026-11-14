/* DevNet EcoNav – Interactive Planner Script */
document.addEventListener("DOMContentLoaded", function () {
  // Initialize Map centered over Manila
  var map = L.map("google_map", {
    zoomControl: false,
  }).setView([14.588, 120.991], 13);

  // OpenStreetMap Tiles
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
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

  // Static Coordinates for demonstration; change this code later on
  /* Inside your DOMContentLoaded block, replace the static coordinates section with this: */

  // 1. Dynamic Coordinate State
  let originCoords = null;
  let destCoords = null;
  let originMarker = null;
  let destMarker = null;

  // 2. Debounce helper to delay API calls until typing pauses
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // 3. Autocomplete Setup Function
  function setupAutocomplete(inputId, resultsId, isOrigin) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);

    input.addEventListener("input", () => {
      if (isOrigin) {
        originCoords = null;
      } else {
        destCoords = null;
      }
    });

    input.addEventListener(
      "input",
      debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length < 3) {
          results.classList.add("d-none");
          return;
        }

        try {
          // Fetch from OpenStreetMap Nominatim, only for the Philippines
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ph`,
          );
          const data = await res.json();

          results.innerHTML = "";
          if (data.length > 0) {
            results.classList.remove("d-none");
            data.forEach((place) => {
              const div = document.createElement("div");
              div.className = "autocomplete-item";

              // Split the long display name into a cleaner title and subtitle
              const nameParts = place.display_name.split(", ");
              const mainText = `<strong>${nameParts[0]}</strong>`;
              const subText = nameParts.slice(1).join(", ");
              div.innerHTML = `${mainText}<br><small class="text-muted">${subText}</small>`;

              div.addEventListener("click", () => {
                input.value = nameParts[0]; // Set input to the primary name
                results.classList.add("d-none"); // Hide dropdown

                const latlng = [parseFloat(place.lat), parseFloat(place.lon)];

                if (isOrigin) {
                  originCoords = latlng;
                  if (originMarker) map.removeLayer(originMarker);
                  originMarker = L.marker(latlng, { icon: startIcon })
                    .addTo(map)
                    .bindPopup("<b>Starting Point</b><br>" + nameParts[0])
                    .openPopup();
                } else {
                  destCoords = latlng;
                  if (destMarker) map.removeLayer(destMarker);
                  destMarker = L.marker(latlng, { icon: endIcon })
                    .addTo(map)
                    .bindPopup("<b>Destination</b><br>" + nameParts[0])
                    .openPopup();
                }

                // If both markers exist, zoom to fit both. Otherwise, center on the new one.
                if (originCoords && destCoords) {
                  map.fitBounds(L.latLngBounds([originCoords, destCoords]), {
                    padding: [60, 60],
                  });
                } else {
                  map.setView(latlng, 15);
                }
              });
              results.appendChild(div);
            });
          } else {
            results.classList.add("d-none");
          }
        } catch (err) {
          console.error("Geocoding error:", err);
        }
      }, 400),
    );

    // Hide dropdown if the user clicks anywhere else on the page
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.add("d-none");
      }
    });
  }

  // Initialize both inputs
  setupAutocomplete("from_input", "from_results", true);
  setupAutocomplete("to_input", "to_results", false);

  // Track active polyline layer to remove old routes on re-submits
  var currentRouteLayer = null;

  // Handle Form Submit Event
  // Fetch route from FastAPI backend
  var form = document.getElementById("route_planner_form");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Halt execution if either or both points haven't been selected yet
      if (!originCoords && !destCoords) {
        Swal.fire({
          title: "Missing Locations",
          text: "Please select both a Starting Point and Destination from the dropdown suggestions.",
          icon: "warning",
          confirmButtonColor: "#0a3d2a",
          confirmButtonText: "Retry again",
        });
        return;
      } else if (!originCoords) {
        Swal.fire({
          title: "Missing Starting Point",
          text: "Please select a valid Starting Point from the dropdown suggestions.",
          icon: "warning",
          confirmButtonColor: "#0a3d2a",
          confirmButtonText: "Retry again",
        });
        return;
      } else if (!destCoords) {
        Swal.fire({
          title: "Missing Destination",
          text: "Please select a valid Destination from the dropdown suggestions.",
          icon: "warning",
          confirmButtonColor: "#0a3d2a",
          confirmButtonText: "Retry again",
        });
        return;
      }

      var btn = document.getElementById("start_route_btn");
      var originalBtnHtml = btn.innerHTML;

      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Routing...';
      btn.disabled = true;

      // Vehicle type from the dropdown, used by the backend for the emissions estimate
      var selectedVehicle = document.getElementById("vehicle_type").value;

      // GraphHopper always routes as "car". vehicle_type only affects emissions.
      var payload = {
        origin: { latitude: originCoords[0], longitude: originCoords[1] },
        destination: { latitude: destCoords[0], longitude: destCoords[1] },
        vehicle_profile: "car",
        vehicle_type: selectedVehicle,
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

        // 1. Target the UI elements in the sidebar
        var distanceElem = document.querySelector(".distance-val");
        var etaElem = document.querySelector(".eta-val");
        var emissionsElem = document.querySelector(".emissions-val");

        // 2. Update real data from GraphHopper API
        if (distanceElem) {
          distanceElem.innerText = `(${data.distance_km} km)`;
          distanceElem.style.color = "#0d6efd";
        }
        if (etaElem) {
          etaElem.innerText = `(${data.duration_minutes} mins)`;
          etaElem.style.color = "#0d6efd";
        }

        // 3. Carbon emissions from the Climatiq API (via the backend)
        if (emissionsElem) {
          if (data.emissions_kg !== null && data.emissions_kg !== undefined) {
            emissionsElem.innerText = `(${data.emissions_kg} kg CO₂e)`;
            emissionsElem.style.color = "#198754";
          } else {
            emissionsElem.innerText = "(unavailable)";
            emissionsElem.style.color = "#6c757d";
          }
        }

        // 3b. Weather at both ends of the trip (OpenWeather, via the backend)
        var weatherSection = document.getElementById("weather_section");
        var rainWarning = document.getElementById("rain_warning");

        // Builds one weather row: icon, place and condition, then the figures
        const weatherHtml = (label, w) =>
          `<img class="weather-icon" src="https://openweathermap.org/img/wn/${w.icon}@2x.png" alt="">` +
          `<div class="weather-place">` +
          `<span class="metric-label">${label}</span>` +
          `<span class="weather-condition">${w.condition}</span>` +
          `</div>` +
          `<div class="weather-figures">` +
          `<strong class="weather-temp">${w.temperature_c}°C</strong>` +
          `<span class="weather-rain">${w.rain_chance_percent}% rain</span>` +
          `</div>`;

        if (weatherSection) {
          if (data.weather) {
            document.getElementById("origin_weather").innerHTML = weatherHtml(
              "Starting Point",
              data.weather.origin,
            );
            document.getElementById("dest_weather").innerHTML = weatherHtml(
              "Destination",
              data.weather.destination,
            );

            // Rain warning: name which end of the trip expects rain
            var rainyEnds = [];
            if (data.weather.origin.rain_expected)
              rainyEnds.push("your starting point");
            if (data.weather.destination.rain_expected)
              rainyEnds.push("your destination");

            if (rainyEnds.length > 0) {
              rainWarning.innerHTML =
                '<i class="bi bi-cloud-rain-fill me-1"></i>Rain expected at ' +
                rainyEnds.join(" and ") +
                ". Drive carefully.";
              rainWarning.classList.remove("d-none");
            } else {
              rainWarning.classList.add("d-none");
            }

            weatherSection.classList.remove("d-none");
          } else {
            weatherSection.classList.add("d-none");
          }
        }

        // 4. Decode the GraphHopper polyline and draw it
        var decodedPoints = polyline.decode(data.encoded_polyline);

        if (currentRouteLayer) {
          map.removeLayer(currentRouteLayer);
        }

        currentRouteLayer = L.polyline(decodedPoints, {
          color: "#0d6efd",
          weight: 6,
          opacity: 0.85,
        }).addTo(map);

        map.fitBounds(currentRouteLayer.getBounds(), { padding: [60, 60] });

        btn.innerHTML =
          '<i class="bi bi-check-circle-fill me-2"></i>Route Active';
        btn.style.backgroundColor = "#0a3d2a";
        btn.disabled = false;
        //   Error Handling
      } catch (err) {
        console.error("Routing error:", err);

        // Check if the backend passed along a GraphHopper or HTTP error indicating no route exists
        if (
          err.message.includes("GraphHopper") ||
          err.message.includes("No valid route") ||
          err.message.includes("Route request failed")
        ) {
          Swal.fire({
            title: "Route Unavailable",
            html: "Unable to calculate a continuous driving route.<br><br>The destination may be out of bounds, across an ocean, or requires air/sea travel not supported by standard vehicles.",
            icon: "error",
            confirmButtonColor: "#0a3d2a",
            confirmButtonText: "Okay",
          });
        } else {
          Swal.fire({
            title: "System Error",
            text: err.message,
            icon: "error",
            confirmButtonColor: "#dc2626", // Red for standard system errors
            confirmButtonText: "Close",
          });
        }

        // Reset the button state
        btn.innerHTML = originalBtnHtml;
        btn.disabled = false;
      }
    });
  }
});
