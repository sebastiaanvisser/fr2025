/* ------------ way-points to force the corridor ------------ */
const WAYPOINTS = [
  { location: "Luxembourg City", stopover: true },
  { location: "Dijon, France", stopover: true },
];

/* ------------ category configuration ------------ */
let CATEGORY_CONFIG = null;

function initializeCategoryConfig() {
  CATEGORY_CONFIG = {
    castle: {
      name: "Castles",
      color: "#8B4513", // brown
      shape: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 6
    },
    canoe: {
      name: "Canoe Locations",
      color: "#FFD700", // yellow
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 7
    },
    climbing_forest: {
      name: "Climbing & Forest Parks",
      color: "#228B22", // forest green
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 8
    },
    old_city: {
      name: "Historic Cities",
      color: "#800080", // purple
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 8
    },
    cave: {
      name: "Caves & Grottos",
      color: "#A0522D", // sienna
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 8
    },
    hiking_trail: {
      name: "Hiking Trails",
      color: "#32CD32", // lime green
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 8
    },
    family_activity: {
      name: "Family Activities",
      color: "#FF69B4", // hot pink
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 8
    },
    museum: {
      name: "Museums",
      color: "#4169E1", // royal blue
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 8
    },
    garden: {
      name: "Gardens & Parks",
      color: "#90EE90", // light green
      shape: google.maps.SymbolPath.CIRCLE,
      scale: 8
    }
  };
}

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
let poiMarkers = {}; // Store POI markers by category
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
  // Add cache-busting parameter
  const urlWithCacheBuster = `${campsiteUrl}?v=${Date.now()}`;
  return fetch(urlWithCacheBuster)
    .then((r) => r.json())
    .then((campsites) => {
      const markers = [];
      campsites.forEach((cs) => {
        const marker = new google.maps.Marker({
          position: { lat: cs.lat, lng: cs.lng },
          map,
          title: cs.name,
          icon: markerType === 'visit' ? undefined : {
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
        // Add cache-busting parameter for visit campsites
        const visitUrlWithCacheBuster = `${visitConfig.url}?v=${Date.now()}`;
        fetch(visitUrlWithCacheBuster)
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

/* ------------ load POIs function ------------ */
function loadPOIs(map, bounds, poiUrl = "poi.json") {
  // Add cache-busting parameter
  const urlWithCacheBuster = `${poiUrl}?v=${Date.now()}`;
  return fetch(urlWithCacheBuster)
    .then((r) => r.json())
    .then((pois) => {
      // Initialize category markers
      Object.keys(CATEGORY_CONFIG).forEach(category => {
        poiMarkers[category] = [];
      });
      
      pois.forEach((poi) => {
        const category = poi.category;
        const config = CATEGORY_CONFIG[category];
        
        if (!config) {
          console.warn(`Unknown category: ${category}`);
          return;
        }
        
        const marker = new google.maps.Marker({
          position: { lat: poi.lat, lng: poi.lng },
          map,
          title: poi.name,
          icon: {
            path: config.shape,
            scale: config.scale,
            fillColor: config.color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            rotation: config.shape === google.maps.SymbolPath.FORWARD_CLOSED_ARROW ? 0 : undefined,
          },
        });
        
        // Create info window content with image if available
        let content = `<strong>${poi.name}</strong><br>${poi.location}<br>`;
        content += `<em>Category: ${config.name}</em><br>`;
        if (poi.nearCampsite) {
          content += `Near: ${poi.nearCampsite}<br>`;
        }
        
        // Add Perplexity search link
        const searchQuery = encodeURIComponent(`${poi.name} ${poi.location} in English`);
        const perplexityUrl = `https://www.perplexity.ai/?q=${searchQuery}`;
        content += `<a href="${perplexityUrl}" target="_blank" style="color: #007bff; text-decoration: none;">🔍 Search in Perplexity</a><br>`;
        
        // Add Google Images search link
        const imageSearchQuery = encodeURIComponent(`${poi.name} ${poi.location}`);
        const googleImagesUrl = `https://www.google.com/search?q=${imageSearchQuery}&tbm=isch`;
        content += `<a href="${googleImagesUrl}" target="_blank" style="color: #007bff; text-decoration: none;">🖼️ Google Images</a><br>`;
        
        if (poi.website) {
          content += `<a href="${poi.website}" target="_blank">Website</a><br>`;
        }
        if (poi.image) {
          content += `<img src="${poi.image}" alt="${poi.name}" style="max-width:200px;max-height:150px;margin-top:5px;">`;
        }
        
        const iw = new google.maps.InfoWindow({
          content: content,
        });
        marker.addListener("click", () => iw.open(map, marker));
        bounds.extend(marker.getPosition());
        
        // Store marker by category
        poiMarkers[category].push(marker);
      });
      
      // Create dynamic category checkboxes
      createCategoryCheckboxes();
      
      return pois;
    })
    .catch((error) => {
      console.error("Failed to load POIs:", error);
    });
}

/* ------------ toggle functions ------------ */
function toggleRoute(routeType, visible) {
  if (routeRenderers[routeType]) {
    routeRenderers[routeType].setMap(visible ? mapInstance : null);
  }
}

function toggleAllPOICategories() {
  Object.keys(CATEGORY_CONFIG).forEach(category => {
    const checkbox = document.getElementById(`toggle-${category}`);
    if (checkbox) {
      checkbox.checked = true;
      togglePOICategory(category, true);
    }
  });
}

function toggleNonePOICategories() {
  Object.keys(CATEGORY_CONFIG).forEach(category => {
    const checkbox = document.getElementById(`toggle-${category}`);
    if (checkbox) {
      checkbox.checked = false;
      togglePOICategory(category, false);
    }
  });
}

function togglePOICategory(category, visible) {
  if (poiMarkers[category]) {
    poiMarkers[category].forEach(marker => {
      marker.setMap(visible ? mapInstance : null);
    });
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

function createCategoryCheckboxes() {
  const container = document.getElementById('poi-categories-list');
  if (!container) return;
  
  container.innerHTML = ''; // Clear existing content
  
  Object.entries(CATEGORY_CONFIG).forEach(([category, config]) => {
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    
    // Create left side with checkbox, icon, and name
    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display: flex; align-items: center;';
    
    // Create icon element
    const icon = document.createElement('span');
    icon.style.cssText = `
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: ${config.shape === google.maps.SymbolPath.CIRCLE ? '50%' : '0'};
      background-color: ${config.color};
      border: 2px solid white;
      margin-right: 8px;
      vertical-align: middle;
    `;
    
    leftSide.innerHTML = `<input type="checkbox" id="toggle-${category}" checked> `;
    leftSide.appendChild(icon);
    leftSide.appendChild(document.createTextNode(config.name));
    
    // Create right side with count
    const rightSide = document.createElement('span');
    rightSide.style.cssText = 'color: #999; font-size: 12px; margin-left: auto;';
    
    // Get count for this category
    const count = poiMarkers[category] ? poiMarkers[category].length : 0;
    rightSide.textContent = `(${count})`;
    
    // Add event listener for category toggle
    const checkbox = leftSide.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      togglePOICategory(category, e.target.checked);
    });
    
    label.appendChild(leftSide);
    label.appendChild(rightSide);
    container.appendChild(label);
  });
  
  // Calculate and display total count
  const totalCount = Object.values(poiMarkers).reduce((sum, markers) => sum + markers.length, 0);
  const totalElement = document.createElement('div');
  totalElement.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: right;';
  totalElement.textContent = `Total: ${totalCount}`;
  container.appendChild(totalElement);
  
  // Add event listeners for All/None buttons
  const toggleAllBtn = document.getElementById('toggle-all-poi');
  const toggleNoneBtn = document.getElementById('toggle-none-poi');
  
  if (toggleAllBtn) {
    toggleAllBtn.addEventListener('click', toggleAllPOICategories);
  }
  
  if (toggleNoneBtn) {
    toggleNoneBtn.addEventListener('click', toggleNonePOICategories);
  }
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
  
  // Check if any POI categories are enabled for distance filtering
  let hasActivePOICategories = false;
  Object.keys(CATEGORY_CONFIG).forEach(category => {
    const checkbox = document.getElementById(`toggle-${category}`);
    if (checkbox && checkbox.checked) {
      hasActivePOICategories = true;
    }
  });
  
  // Only show circles if distance filtering is active
  if (!hasActivePOICategories) {
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
  
  // Filter all POI categories
  Object.entries(poiMarkers).forEach(([category, markers]) => {
    const checkbox = document.getElementById(`toggle-${category}`);
    if (checkbox && checkbox.checked) {
      markers.forEach(marker => {
        const markerPos = {
          lat: marker.getPosition().lat(),
          lng: marker.getPosition().lng()
        };
        
        // Check if POI is within distance of ANY visible campsite
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
      // If category filter is off, hide all markers in this category
      markers.forEach(marker => marker.setMap(null));
    }
  });
  
  // Update distance circles
  updateDistanceCircles();
}

function zoomToVisitCampsites() {
  if (!mapInstance || !visitCampsiteMarkers) return;
  
  // Get all visit campsite positions
  const visitCampsitePositions = Object.values(visitCampsiteMarkers)
    .filter(marker => marker && marker.getMap()) // Only visible markers
    .map(marker => marker.getPosition());
  
  if (visitCampsitePositions.length === 0) return;
  
  // Create bounds that include all visit campsites
  const bounds = new google.maps.LatLngBounds();
  visitCampsitePositions.forEach(position => {
    bounds.extend(position);
  });
  
  // Add padding to include distance circles
  const maxDistance = parseFloat(document.getElementById('distance-filter').value) || 50;
  const padding = maxDistance * 0.01; // Convert km to degrees (approximate)
  
  // Extend bounds by padding
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  bounds.extend(new google.maps.LatLng(ne.lat() + padding, ne.lng() + padding));
  bounds.extend(new google.maps.LatLng(sw.lat() - padding, sw.lng() - padding));
  
  // Fit map to bounds
  mapInstance.fitBounds(bounds);
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
  
  // Zoom to visit campsites button
  document.getElementById('zoom-to-visit-campsites').addEventListener('click', () => {
    zoomToVisitCampsites();
  });
}

/* ------------ main map initialiser (called by Google) ---- */
function initMap() {
  // Initialize category configuration after Google Maps is loaded
  initializeCategoryConfig();
  
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

  /* ---- 2) load POIs ---- */
  loadPOIs(map, bounds);

  /* ---- 3) plot the main route using the new function ---- */
  routeRenderers.east = plotRoute(
    map,
    "Utrecht, Netherlands",
    "Montirat, Tarn, France",
    WAYPOINTS,
    "#0000ff", // blue color
    4 // line weight
  );

  /* ---- 4) plot alternative route via Paris ---- */
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