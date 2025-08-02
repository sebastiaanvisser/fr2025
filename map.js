/* ------------ way-points to force the corridor ------------ */
const WAYPOINTS = [
  { location: "Luxembourg City", stopover: true },
  { location: "Dijon, France", stopover: true },
];

/* ------------ global variables for toggling ------------ */
let mapInstance = null;
let boundsInstance = null;
let routeRenderers = {
  east: null,
  west: null
};
let campsiteMarkers = {
  east: [],
  west: [],
  visit: []
};
let visitCampsiteMarkers = {}; // Individual markers for visit campsites
let castleMarkers = []; // Store castle markers for distance filtering
let canoeMarkers = []; // Store canoe markers for distance filtering
let distanceCircles = []; // Store distance circles for visualization

/* ------------ reusable route plotting function ------------ */
function plotRoute(map, origin, destination, waypoints = [], lineColor = "#0000ff", lineWeight = 4) {
  const dirSvc = new google.maps.DirectionsService();
  const dirRender = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true, // keep our own icons
    polylineOptions: { strokeColor: lineColor, strokeWeight: lineWeight },
  });

  dirSvc.route(
    {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
    },
    (res, status) => {
      if (status === "OK") {
        dirRender.setDirections(res);
        // Extend bounds with route points
        res.routes[0].overview_path.forEach((p) => {
          if (map.bounds) {
            map.bounds.extend(p);
          }
        });
        // Fit bounds if available
        if (map.bounds) {
          map.fitBounds(map.bounds);
        }
      } else {
        console.error("Directions request failed: " + status);
      }
    }
  );

  return dirRender; // Return renderer for potential future use
}

/* ------------ reusable campsite loading function ------------ */
function loadCampsites(map, bounds, campsiteUrl = "campsites.json", markerColor = "#0066cc", markerType = "east") {
  return fetch(campsiteUrl)
    .then((r) => r.json())
    .then((campsites) => {
      const markers = [];
      campsites.forEach((cs) => {
        const marker = new google.maps.Marker({
          position: { lat: cs.lat, lng: cs.lng },
          map,
          title: cs.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        const iw = new google.maps.InfoWindow({
          content:
            `<strong>${cs.name}</strong><br>` +
            `${cs.location}<br>` +
            `${cs.percent} % of trip, ${cs.detour}<br>` +
            `<a href="${cs.website}" target="_blank">Website</a>`,
        });
        marker.addListener("click", () => iw.open(map, marker));
        bounds.extend(marker.getPosition());
        markers.push(marker);
        
        // Store individual markers for visit campsites
        if (markerType === "visit") {
          visitCampsiteMarkers[cs.name] = marker;
        }
      });
      
      // Store markers for toggling
      if (campsiteMarkers[markerType]) {
        campsiteMarkers[markerType] = markers;
      }
      
      return campsites; // Return campsites for potential future use
    })
    .catch((error) => {
      console.error("Failed to load campsites:", error);
    });
}

/* ------------ load multiple campsite files function ------------ */
function loadMultipleCampsites(map, bounds, campsiteConfigs) {
  const promises = campsiteConfigs.map(config => 
    loadCampsites(map, bounds, config.url, config.color, config.type)
  );
  
  return Promise.all(promises)
    .then(results => {
      console.log(`Loaded ${results.length} campsite files`);
      
      // Create individual checkboxes for visit campsites
      const visitConfig = campsiteConfigs.find(config => config.type === "visit");
      if (visitConfig) {
        fetch(visitConfig.url)
          .then(r => r.json())
          .then(visitCampsites => {
            createVisitCampsiteCheckboxes(visitCampsites);
            // Apply distance filter after campsites are loaded
            applyDistanceFilter();
          });
      } else {
        // Apply distance filter even if no visit campsites
        applyDistanceFilter();
      }
      
      return results;
    })
    .catch((error) => {
      console.error("Failed to load some campsite files:", error);
    });
}

/* ------------ distance calculation function ------------ */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

/* ------------ load castles function ------------ */
function loadCastles(map, bounds, castlesUrl = "castles.json") {
  return fetch(castlesUrl)
    .then((r) => r.json())
    .then((castles) => {
      castles.forEach((castle) => {
        const marker = new google.maps.Marker({
          position: { lat: castle.lat, lng: castle.lng },
          map,
          title: castle.name,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#8B4513", // brown color
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 1,
            rotation: 0, // pointing up
          },
        });
        
        // Create info window content with image if available
        let content = `<strong>${castle.name}</strong><br>${castle.location}<br>`;
        if (castle.nearCampsite) {
          content += `Near: ${castle.nearCampsite}<br>`;
        }
        if (castle.website) {
          content += `<a href="${castle.website}" target="_blank">Website</a><br>`;
        }
        if (castle.image) {
          content += `<img src="${castle.image}" alt="${castle.name}" style="max-width:200px;max-height:150px;margin-top:5px;">`;
        }
        
        const iw = new google.maps.InfoWindow({
          content: content,
        });
        marker.addListener("click", () => iw.open(map, marker));
        bounds.extend(marker.getPosition());
        castleMarkers.push(marker); // Store for distance filtering
      });
      return castles; // Return castles for potential future use
    })
    .catch((error) => {
      console.error("Failed to load castles:", error);
    });
}

/* ------------ load canoe locations function ------------ */
function loadCanoeLocations(map, bounds, canoeUrl = "canoe.json") {
  return fetch(canoeUrl)
    .then((r) => r.json())
    .then((canoeLocations) => {
      canoeLocations.forEach((canoe) => {
        const marker = new google.maps.Marker({
          position: { lat: canoe.lat, lng: canoe.lng },
          map,
          title: canoe.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#FFD700", // yellow color
            fillOpacity: 1,
            strokeColor: "#FF8C00", // dark orange border
            strokeWeight: 2,
          },
        });
        
        // Create info window content with image if available
        let content = `<strong>${canoe.name}</strong><br>${canoe.location}<br>`;
        if (canoe.nearCampsite) {
          content += `Near: ${canoe.nearCampsite}<br>`;
        }
        if (canoe.website) {
          content += `<a href="${canoe.website}" target="_blank">Website</a><br>`;
        }
        if (canoe.image) {
          content += `<img src="${canoe.image}" alt="${canoe.name}" style="max-width:200px;max-height:150px;margin-top:5px;">`;
        }
        
        const iw = new google.maps.InfoWindow({
          content: content,
        });
        marker.addListener("click", () => iw.open(map, marker));
        bounds.extend(marker.getPosition());
        canoeMarkers.push(marker); // Store for distance filtering
      });
      return canoeLocations; // Return canoe locations for potential future use
    })
    .catch((error) => {
      console.error("Failed to load canoe locations:", error);
    });
}

/* ------------ toggle functions ------------ */
function toggleRoute(routeType, visible) {
  if (routeRenderers[routeType]) {
    routeRenderers[routeType].setMap(visible ? mapInstance : null);
  }
}

function toggleCampsites(campsiteType, visible) {
  if (campsiteMarkers[campsiteType]) {
    campsiteMarkers[campsiteType].forEach(marker => {
      marker.setMap(visible ? mapInstance : null);
    });
  }
  // Reapply distance filter when campsites are toggled
  applyDistanceFilter();
}

function createVisitCampsiteCheckboxes(visitCampsites) {
  const container = document.getElementById('visit-campsites-list');
  container.innerHTML = ''; // Clear existing content
  
  visitCampsites.forEach((campsite) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" id="toggle-visit-${campsite.name.replace(/[^a-zA-Z0-9]/g, '-')}" checked> ${campsite.name}`;
    
    // Add event listener for individual campsite toggle
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      const marker = visitCampsiteMarkers[campsite.name];
      if (marker) {
        marker.setMap(e.target.checked ? mapInstance : null);
      }
      // Reapply distance filter when visit campsites are toggled
      applyDistanceFilter();
    });
    
    container.appendChild(label);
  });
}

function updateDistanceCircles() {
  // Clear existing circles
  distanceCircles.forEach(circle => circle.setMap(null));
  distanceCircles = [];
  
  const maxDistance = parseFloat(document.getElementById('distance-filter').value);
  const filterCastles = document.getElementById('filter-castles').checked;
  const filterCanoe = document.getElementById('filter-canoe').checked;
  
  // Only show circles if distance filtering is active
  if (!filterCastles && !filterCanoe) {
    return;
  }
  
  // Only get visit campsite positions for circles
  const visitCampsitePositions = [];
  
  // Add visit campsites if visible
  Object.values(visitCampsiteMarkers).forEach(marker => {
    if (marker && marker.getMap()) {
      visitCampsitePositions.push({
        lat: marker.getPosition().lat(),
        lng: marker.getPosition().lng()
      });
    }
  });
  
  // Create circles only for visit campsites
  visitCampsitePositions.forEach(pos => {
    const circle = new google.maps.Circle({
      strokeColor: '#FF0000',
      strokeOpacity: 0.3,
      strokeWeight: 1,
      fillColor: '#FF0000',
      fillOpacity: 0.05,
      map: mapInstance,
      center: { lat: pos.lat, lng: pos.lng },
      radius: maxDistance * 1000, // Convert km to meters
    });
    distanceCircles.push(circle);
  });
}

function applyDistanceFilter() {
  const maxDistance = parseFloat(document.getElementById('distance-filter').value);
  const filterCastles = document.getElementById('filter-castles').checked;
  const filterCanoe = document.getElementById('filter-canoe').checked;
  
  // Get all currently visible campsite positions
  const visibleCampsitePositions = [];
  
  // Add east campsites if visible
  if (campsiteMarkers.east && campsiteMarkers.east.length > 0) {
    campsiteMarkers.east.forEach(marker => {
      if (marker.getMap()) {
        visibleCampsitePositions.push({
          lat: marker.getPosition().lat(),
          lng: marker.getPosition().lng()
        });
      }
    });
  }
  
  // Add west campsites if visible
  if (campsiteMarkers.west && campsiteMarkers.west.length > 0) {
    campsiteMarkers.west.forEach(marker => {
      if (marker.getMap()) {
        visibleCampsitePositions.push({
          lat: marker.getPosition().lat(),
          lng: marker.getPosition().lng()
        });
      }
    });
  }
  
  // Add visit campsites if visible
  Object.values(visitCampsiteMarkers).forEach(marker => {
    if (marker && marker.getMap()) {
      visibleCampsitePositions.push({
        lat: marker.getPosition().lat(),
        lng: marker.getPosition().lng()
      });
    }
  });
  
  // Filter castles
  if (filterCastles) {
    castleMarkers.forEach(marker => {
      const markerPos = {
        lat: marker.getPosition().lat(),
        lng: marker.getPosition().lng()
      };
      
      // Check if castle is within distance of ANY visible campsite
      const isWithinDistance = visibleCampsitePositions.some(campsitePos => {
        const distance = calculateDistance(
          campsitePos.lat, campsitePos.lng,
          markerPos.lat, markerPos.lng
        );
        return distance <= maxDistance;
      });
      
      marker.setMap(isWithinDistance ? mapInstance : null);
    });
  } else {
    // If castles filter is off, hide all castles
    castleMarkers.forEach(marker => marker.setMap(null));
  }
  
  // Filter canoe locations
  if (filterCanoe) {
    canoeMarkers.forEach(marker => {
      const markerPos = {
        lat: marker.getPosition().lat(),
        lng: marker.getPosition().lng()
      };
      
      // Check if canoe location is within distance of ANY visible campsite
      const isWithinDistance = visibleCampsitePositions.some(campsitePos => {
        const distance = calculateDistance(
          campsitePos.lat, campsitePos.lng,
          markerPos.lat, markerPos.lng
        );
        return distance <= maxDistance;
      });
      
      marker.setMap(isWithinDistance ? mapInstance : null);
    });
  } else {
    // If canoe filter is off, hide all canoe locations
    canoeMarkers.forEach(marker => marker.setMap(null));
  }
  
  // Update distance circles
  updateDistanceCircles();
}

function setupToggleListeners() {
  // Route toggles
  document.getElementById('toggle-east-route').addEventListener('change', (e) => {
    toggleRoute('east', e.target.checked);
  });
  
  document.getElementById('toggle-west-route').addEventListener('change', (e) => {
    toggleRoute('west', e.target.checked);
  });
  
  // Campsite toggles
  document.getElementById('toggle-east-campsites').addEventListener('change', (e) => {
    toggleCampsites('east', e.target.checked);
  });
  
  document.getElementById('toggle-west-campsites').addEventListener('change', (e) => {
    toggleCampsites('west', e.target.checked);
  });
  
  // Distance filter listeners
  document.getElementById('distance-filter').addEventListener('input', applyDistanceFilter);
  document.getElementById('filter-castles').addEventListener('change', applyDistanceFilter);
  document.getElementById('filter-canoe').addEventListener('change', applyDistanceFilter);
}

/* ------------ main map initialiser (called by Google) ---- */
function initMap() {
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 6,
    center: { lat: 47.5, lng: 4.5 },
  });

  const bounds = new google.maps.LatLngBounds();
  map.bounds = bounds; // Store bounds on map object for route function
  
  // Store global references
  mapInstance = map;
  boundsInstance = bounds;

  /* ---- 1) load both campsite files with different colors ---- */
  const campsiteConfigs = [
    { url: "campsites/east.json", color: "#0066cc", type: "east" }, // blue for east
    { url: "campsites/west.json", color: "#ff0000", type: "west" },  // red for west
    { url: "campsites/visit.json", color: "#006600", type: "visit" }  // green for visit
  ];
  loadMultipleCampsites(map, bounds, campsiteConfigs);

  /* ---- 2) load castles ---- */
  loadCastles(map, bounds);

  /* ---- 3) load canoe locations ---- */
  loadCanoeLocations(map, bounds);

  /* ---- 4) plot the main route using the new function ---- */
  routeRenderers.east = plotRoute(
    map,
    "Utrecht, Netherlands",
    "Montirat, Tarn, France",
    WAYPOINTS,
    "#0000ff", // blue color
    4 // line weight
  );

  /* ---- 5) plot alternative route via Paris ---- */
  routeRenderers.west = plotRoute(
    map,
    "Utrecht, Netherlands",
    "Montirat, Tarn, France",
    [
      { location: "Beauvais, France", stopover: true },
      { location: "Orléans, France", stopover: true },
    ],
    "#ff0000", // red color
    4 // line weight
  );
  
  // Set up toggle listeners
  setupToggleListeners();
}

/* ------------ load Google Maps JS with key from URI ------ */
function loadMapScript() {
  const key = new URLSearchParams(location.search).get("key");
  if (!key) {
    document.body.innerHTML =
      "<p style='font:16px/1.4 sans-serif;padding:2rem;color:#c00'>" +
      "Missing Google Maps API key.<br>" +
      "Open this file as <code>?key=YOUR_API_KEY</code>.</p>";
    return;
  }
  const s = document.createElement("script");
  s.src =
    "https://maps.googleapis.com/maps/api/js?" +
    "key=" +
    encodeURIComponent(key) +
    "&callback=initMap";
  s.async = s.defer = true;
  document.head.appendChild(s);
}
window.addEventListener("load", loadMapScript); 