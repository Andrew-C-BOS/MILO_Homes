// =================== CONFIG CONSTANTS ===================
const GRID_SIZE = 0.025;          // Degrees per grid
const MAX_CACHE_SIZE_MB = 50;      // Max memory for grid data
const DETAIL_ZOOM_THRESHOLD = 13;  // If map zoom < 13, fetch aggregates
const API_BASE_URL = window.API_BASE_URL || '';

console.log(API_BASE_URL);

// =================== GLOBAL STATE ===================
let map;
let buildingCache = [];             // Detailed data cache for buildings/units
let queriedGrids = new Map();       // Map<GridID, { data, lastAccess, sizeInBytes }>
let totalCacheSizeBytes = 0;        // Track approximate memory usage of grid data

// Aggregated data (optional) for zoomed-out view
let aggregateData = [];             // Could store polygons or super-grid data

// UI references (populated in renderTenantView)
let content, filtersPanel, apartmentList, priceSlider;

export async function renderTenantView() {
    const content = document.getElementById("content");
    content.innerHTML = `
        <div class="tenant-view-container">
            <!-- Map Section -->
            <div id="map" class="map-container"></div>

            <!-- Filters and Results Section -->
            <div class="filters-results">
                <header class="filters-header">
                    <button id="toggle-filters" class="toggle-filters-btn">Filters</button>
                    <input type="text" id="search-bar" placeholder="Search by city, ZIP, or address..." />
                    <button id="search-button" class="search-btn">Search</button>
                </header>
                <div id="filters-panel" class="filters-panel hidden">
                    <!-- Price Range Filter -->
                    <div class="filter-group">
                        <h3>Price Range <span>&#9660;</span></h3>
                        <div class="filter-content">
                            <div id="price-range"></div>
                            <p id="price-range-display">Price: $0 - $5000</p>
                        </div>
                    </div>
                    <!-- Bedrooms Filter -->
                    <div class="filter-group collapsed">
                        <h3>Bedrooms <span>&#9660;</span></h3>
                        <div class="filter-content">
                            <select id="bedroom-select">
								<option value="">Any</option>
                                <option value="1">1+ Bedroom</option>
                                <option value="2">2+ Bedrooms</option>
                                <option value="3">3+ Bedrooms</option>
                            </select>
                        </div>
                    </div>
                    <!-- Bathrooms Filter -->
                    <div class="filter-group collapsed">
                        <h3>Bathrooms <span>&#9660;</span></h3>
                        <div class="filter-content">
                            <select id="Bathroom-select">
								<option value="">Any</option>
                                <option value="2">2+ Bath</option>
                                <option value="3">3+ Bath</option>
                            </select>
                        </div>
                    </div>
                    <button id="apply-filters-btn" class="apply-filters-btn">Apply Filters</button>
                </div>
                <!-- Results Section -->
                <div id="results-list" class="results-list">
                    <h3>Available Apartments</h3>
                    <ul id="apartment-list"></ul>
                </div>
            </div>
        </div>
    `;

    // Initialize Map
    //map = L.map("map").setView([42.3601, -71.0589], 13); // Boston, MA
    //L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    //    attribution: "&copy; OpenStreetMap contributors",
    //}).addTo(map);
	
	
	map = L.map("map").setView([42.3601, -71.0589], 13); // Boston, MA
    L.tileLayer('https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apikey}', {
        attribution: "&copy; OpenStreetMap contributors",
		apikey: '21ae7cfe96cb4358b81388f73f08d7ec',
    }).addTo(map);

	map.on("moveend", async () => {
        await applyFiltersAndRefresh();
    });

    // Toggle Filters Panel
    document.getElementById("toggle-filters").addEventListener("click", () => {
        document.getElementById("filters-panel").classList.toggle("hidden");
    });

    // Setup Collapsible Filter Groups
    document.querySelectorAll(".filter-group h3").forEach((header) => {
        header.addEventListener("click", () => {
            const parent = header.parentElement;
            parent.classList.toggle("collapsed");
        });
    });

    // Initialize Price Range Slider
	priceSlider = document.getElementById("price-range");
	noUiSlider.create(priceSlider, {
		start: [500, 5000], // Initial range values
		connect: true,
		step: 50, // Add step increment of 50
		range: {
			min: 500,
			max: 5000,
		},
		tooltips: [
			{
				to: (value) => (value === 500 ? "$0" : `$${Math.round(value)}`), // Left tooltip
				from: (value) => Number(value),
			},
			{
				to: (value) => (value === 5000 ? "$5000+" : `$${Math.round(value)}`), // Right tooltip
				from: (value) => Number(value),
			},
		], // Custom tooltips for both handles
		format: {
			to: (value) => Math.round(value),
			from: (value) => Number(value),
		},
	});

	// Update the displayed range dynamically
	priceSlider.noUiSlider.on("update", (values) => {
		const min = parseInt(values[0], 10); // Convert to integer
		const max = parseInt(values[1], 10); // Convert to integer

		const minDisplay = min === 500 ? "$0" : `$${min}`;
		const maxDisplay = max === 5000 ? "$5000+" : `$${max}`;
		document.getElementById("price-range-display").textContent = `Price: ${minDisplay} - ${maxDisplay}`;
	});


    // Apply Filters
    document.getElementById("apply-filters-btn").addEventListener("click", async () => {
        await applyFiltersAndRefresh();
        //fetchProperties(filters);
    });

    // Search Functionality
    document.getElementById("search-button").addEventListener("click", () => {
        const searchValue = document.getElementById("search-bar").value;
        // NOTE: Example search approach
        console.log(`Searching for: ${searchValue} (not yet implemented)`);
        //fetchProperties({ search: searchValue });
    });
	
	const initialBounds = map.getBounds();
    await preloadBuildings(initialBounds);
    await applyFiltersAndRefresh();

    // Fetch and Display Initial Properties
    //fetchProperties();
}

// =================== FILTER & REFRESH ===================
async function applyFiltersAndRefresh() {
    const filters = getCurrentFilters();
    const bounds = map.getBounds();
    const currentZoom = map.getZoom();

    // If we're zoomed OUT beyond the threshold, load aggregated data
    if (currentZoom < DETAIL_ZOOM_THRESHOLD) {
        // Show aggregated polygons or summary
        await fetchAndShowAggregates(bounds);
        // Clear detailed markers to avoid clutter
        clearMapMarkers();
        // Show aggregate overlays
        updateResultsList([]); // Might show "Please zoom in for details" or aggregated summary
        renderAggregateOverlays();
    } else {
        // Show detailed data for individual grids
        await fetchGridDataIfNeeded(bounds, filters);
        // Now filter data from buildingCache
        const filteredUnits = filterUnits(filters, bounds);
        const groupedBuildings = groupUnitsByBuilding(filteredUnits);

        clearMapMarkers();
        updateMapMarkers(groupedBuildings);
        updateResultsList(groupedBuildings);
        // Optionally hide aggregate overlays if used
        clearAggregateOverlays();
    }
}

function getCurrentFilters() {
    let [priceMin, priceMax] = priceSlider.noUiSlider.get();

	priceMin = (priceMin === 500) ? 0 : priceMin;
	priceMax = (priceMax === 5000) ? 1000000 : priceMax;
	
    return {
        priceMin: parseInt(priceMin, 10),
        priceMax: parseInt(priceMax, 10),
        bedrooms: document.getElementById("bedroom-select").value,
        bathrooms: document.getElementById("Bathroom-select").value,
    };
}

// =================== AGGREGATION LOGIC ===================
async function fetchAndShowAggregates(bounds) {
    try {
        console.log("Fetching aggregated data for big area...");
        const params = new URLSearchParams({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
        }).toString();

        const response = await fetch(`${API_BASE_URL}/api/aggregates?${params}`);
        if (!response.ok) throw new Error("Failed to fetch aggregates");

        aggregateData = await response.json();
        console.log("Aggregates fetched:", aggregateData);
        // You can store this in a local var, then display polygons on the map
    } catch (error) {
        console.error("Error fetching aggregate data:", error);
    }
}

function renderAggregateOverlays() {
    // For example, if aggregateData is a list of polygons or city boundaries, you could:
    // 1. Draw polygons on the map
    // 2. Add a label for total units, etc.
    // This is left as an exercise, depends on your data format.

    console.log("Render aggregate overlays (not yet implemented).", aggregateData);
}

function clearAggregateOverlays() {
    // Remove polygons, markers, or overlays related to aggregated view
}


// =================== GRID DATA LOGIC (DETAILED VIEW) ===================
async function fetchGridDataIfNeeded(bounds, filters) {
    const visibleGrids = getVisibleGridSquares(bounds);
    const unfetchedGrids = [];

    // Determine which grids we haven't cached or that might not match the current filters
    for (const gridID of visibleGrids) {
        if (!queriedGrids.has(gridID)) {
            unfetchedGrids.push(gridID);
        }
    }

    if (unfetchedGrids.length === 0) {
        console.log("No new grids to fetch for detailed data.");
        return;
    }

    // Fetch from the server
    await fetchAndCacheGridData(unfetchedGrids, filters);
}

function getVisibleGridSquares(bounds) {
    const visibleGrids = [];
    const north = Math.ceil(bounds.getNorth() / GRID_SIZE);
    const south = Math.floor(bounds.getSouth() / GRID_SIZE);
    const east = Math.ceil(bounds.getEast() / GRID_SIZE);
    const west = Math.floor(bounds.getWest() / GRID_SIZE);

    for (let lat = south; lat <= north; lat++) {
        for (let lng = west; lng <= east; lng++) {
            const gridID = `${lat},${lng}`;
            visibleGrids.push(gridID);
        }
    }
    return visibleGrids;
}

// Server fetch for new grid squares
async function fetchAndCacheGridData(gridIDs, filters) {
    try {
        console.log("Fetching data for grids:", gridIDs);
		
		
        // Prepare request payload
        const payload = {
            grids: gridIDs,
            priceMin: filters.priceMin,
            priceMax: filters.priceMax,
            bedrooms: filters.bedrooms,
            bathrooms: filters.bathrooms,
        };
		
		console.log(payload);

        // Fetch data from the server
        const response = await fetch(`${API_BASE_URL}/api/grid-properties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Failed to fetch grid-based properties");

        // Parse JSON response
        const { unitsByGrid } = await response.json(); 
        // Example response: { unitsByGrid: { "12,15": [units], ... } }

        // Merge into buildingCache
        for (const [gridID, units] of Object.entries(unitsByGrid)) {
            if (!queriedGrids.has(gridID)) {
                // Calculate size once
                const sizeInBytes = roughSizeOfObject(units);

                // Mark as fetched
                queriedGrids.set(gridID, {
                    data: units,
                    lastAccess: Date.now(),
                    sizeInBytes,
                });
                totalCacheSizeBytes += sizeInBytes;

                // Merge into global buildingCache
                mergeUnitsIntoBuildingCache(units);
            } else {
                // Optional: Handle already fetched grids
            }
        }

        // Evict if we exceed cache limit
        evictIfOverLimit();

    } catch (error) {
        console.error("Error fetching grid data:", error);
    }
}


function mergeUnitsIntoBuildingCache(units) {
    // Convert flat array of units into building objects, then merge
    const newBuildings = groupUnitsByBuilding(units);
    newBuildings.forEach((newB) => {
        const existingB = buildingCache.find((b) => b.BuildingID === newB.BuildingID);
        if (existingB) {
            // Merge new units
            const uniqueUnits = newB.units.filter(
                (u) => !existingB.units.some((eu) => eu.UnitID === u.UnitID)
            );
            existingB.units.push(...uniqueUnits);
        } else {
            buildingCache.push(newB);
        }
    });
}

function evictIfOverLimit() {
    const maxBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
    if (totalCacheSizeBytes <= maxBytes) return; // no eviction needed

    console.log("Cache size exceeded. Evicting old grids...");

    // Sort by lastAccess ascending
    const entries = Array.from(queriedGrids.entries()); // [ [gridID, {...}], ... ]
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    for (const [gridID, info] of entries) {
        // Remove from map
        queriedGrids.delete(gridID);
        totalCacheSizeBytes -= info.sizeInBytes;
        // Optionally remove associated buildings from buildingCache 
        // if they exist only in that grid. (This depends on your logic.)

        if (totalCacheSizeBytes <= maxBytes) {
            break;
        }
    }

    console.log(`Eviction complete. Current cache size: ${totalCacheSizeBytes} bytes.`);
}

function roughSizeOfObject(obj) {
    // Quick-and-dirty size approximation. 
    // For a more accurate approach, consider libraries or structured clones.
    const jsonStr = JSON.stringify(obj);
    return new Blob([jsonStr]).size; 
}



// =================== PRELOAD ON INITIAL LOAD ===================
async function preloadBuildings(bounds) {
    try {
        console.log("Preloading buildings for initial bounds:", bounds);

        const params = new URLSearchParams({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
        }).toString();

        const response = await fetch(`${API_BASE_URL}/api/properties?${params}`);
        if (!response.ok) throw new Error("Failed to fetch listings");

        const units = await response.json();
        // Merge into buildingCache
        mergeUnitsIntoBuildingCache(units);
    } catch (error) {
        console.error("Error preloading buildings:", error);
    }
}

// =================== FILTER & GROUP ===================
function filterUnits(filters, mapBounds) {
    const filteredUnits = [];

    // Iterate through our entire buildingCache
    buildingCache.forEach((building) => {
        // Check if building is in map bounds
        if (mapBounds.contains([building.Latitude, building.Longitude])) {
            // Filter units
            const validUnits = building.units.filter((unit) => {
                return (
                    (!filters.priceMin || unit.Rent >= filters.priceMin) &&
                    (!filters.priceMax || unit.Rent <= filters.priceMax) &&
                    (!filters.bedrooms || unit.Bedrooms >= filters.bedrooms) &&
                    (!filters.bathrooms || unit.Bathrooms >= filters.bathrooms)
                );
            });
            // If any units match, add them
            if (validUnits.length > 0) {
                filteredUnits.push(...validUnits);
            }
        }
    });
    return filteredUnits;
}

function groupUnitsByBuilding(units) {
    const buildingMap = {};
    units.forEach((unit) => {
        const { BuildingID, Address, City, State, Latitude, Longitude } = unit;
        if (!buildingMap[BuildingID]) {
            buildingMap[BuildingID] = {
                BuildingID,
                Address,
                City,
                State,
                Latitude,
                Longitude,
                units: [],
            };
        }
        buildingMap[BuildingID].units.push(unit);
    });
    return Object.values(buildingMap);
}

// =================== MAP MARKERS & UI ===================

const apartmentIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div class="marker-icon">🏠</div>',
    iconSize: [32, 32], // Customize size
    iconAnchor: [16, 32], // Anchor at the bottom center
});

let markerClusterGroup = null; // Declare cluster group globally
let activePopup = null; // Track the active popup

function updateMapMarkers(buildings) {
    // Clear existing markers and cluster group
    if (markerClusterGroup) {
        map.removeLayer(markerClusterGroup);
    }
    markerClusterGroup = L.markerClusterGroup();

    buildings.forEach((building) => {
        const marker = L.marker([building.Latitude, building.Longitude], {
            icon: apartmentIcon,
        });

        marker.on('click', () => {
            // Close any active popup
            if (activePopup) {
                activePopup.remove();
                activePopup = null;
            }

            // Filter units based on current filters
            const filters = getCurrentFilters();
            const filteredUnits = building.units.filter((unit) => {
                return (
                    (!filters.priceMin || unit.Rent >= filters.priceMin) &&
                    (!filters.priceMax || unit.Rent <= filters.priceMax) &&
                    (!filters.bedrooms || unit.Bedrooms >= filters.bedrooms) &&
                    (!filters.bathrooms || unit.Bathrooms >= filters.bathrooms)
                );
            });
			console.log(filteredUnits);
            if (filteredUnits.length > 0) {
                // Create and track the new popup with filtered units
                activePopup = createCustomPopup(marker, filteredUnits, 0);
            }
        });

        markerClusterGroup.addLayer(marker);
    });

    map.addLayer(markerClusterGroup);
}


function createCustomPopup(marker, units, unitIndex) {
    const unit = units[unitIndex];

    // Create or reuse the popup element
    let popupDiv = document.querySelector('.custom-popup');
    if (!popupDiv) {
        popupDiv = document.createElement('div');
        popupDiv.className = 'custom-popup';

        // Append popup to the map container once
        const mapContainer = document.querySelector('.leaflet-container');
        mapContainer.appendChild(popupDiv);

        // Add close interaction
        const closePopup = () => {
            if (popupDiv) {
                popupDiv.remove();
                activePopup = null;
            }
            map.off('movestart', closePopup);
            map.off('zoomstart', closePopup);
        };

        popupDiv.addEventListener('click', (event) => {
            if (event.target.classList.contains('popup-close')) {
                closePopup();
            }
        });

        map.on('movestart', closePopup);
        map.on('zoomstart', closePopup);
    }

    // Update popup content dynamically
    popupDiv.innerHTML = `
        <div class="popup-header">
            <strong>${unit.Address || 'No Address'}, Unit ${unit.UnitNumber || 'N/A'}</strong>
            <button class="popup-close">&times;</button>
        </div>
        <div class="popup-body">
            <img src="${unit.ImageURL || 'placeholder.jpg'}" alt="Key Image" class="popup-image" />
            <div class="popup-details">
                <p><strong>Rent:</strong> $${unit.Rent || 'N/A'}/month</p>
                <p><strong>Bedrooms:</strong> ${unit.Bedrooms || 'N/A'}</p>
                <p><strong>Bathrooms:</strong> ${unit.Bathrooms || 'N/A'}</p>
            </div>
        </div>
        <div class="popup-footer">
            <button class="popup-prev">Previous</button>
            <button class="popup-action show-details" data-unit-id="${unit.UnitID}">Show Details</button>
            <button class="popup-next">Next</button>
        </div>
    `;

    // Position the popup
    const markerPoint = map.latLngToContainerPoint(marker.getLatLng());
    popupDiv.style.top = `${markerPoint.y - 60}px`; // Adjust for height
    popupDiv.style.left = `${markerPoint.x}px`;

    // Add navigation event listeners
    popupDiv.querySelector('.popup-prev').addEventListener('click', () => {
        const newIndex = (unitIndex - 1 + units.length) % units.length; // Wrap to the last unit if at the start
		createCustomPopup(marker, units, newIndex);
    });

    popupDiv.querySelector('.popup-next').addEventListener('click', () => {
        const newIndex = (unitIndex + 1) % units.length; // Wrap to the first unit if at the end
        createCustomPopup(marker, units, newIndex);
    });

    popupDiv.querySelector('.show-details').addEventListener('click', async (event) => {
        const unitID = event.target.getAttribute('data-unit-id');
        await openUnitDetailsModal(unit);
    });

    // Track the active popup
    activePopup = popupDiv;

    return popupDiv;
}

async function openOfferDetailsModal(offerID) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/offers/${offerID}/details`, { method: "GET" });

        if (!response.ok) throw new Error("Failed to fetch offer details");

        const details = await response.json();
        openDetailsModal(details); // Display details in the modal
    } catch (error) {
        console.error("Error fetching offer details:", error);
        alert("Failed to load offer details. Please try again.");
    }
}



async function fetchUnitDetails(unitID) {
    const response = await fetch(`/api/units/${unitID}/images`);
    const images = await response.json();
    return images;
}


function clearMapMarkers() {
    // Remove only marker layers (not tile layers)
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
}

function updateResultsList(buildings) {
	console.log(buildings);
    const apartmentList = document.getElementById("apartment-list");
    apartmentList.innerHTML = "";

    if (!buildings || buildings.length === 0) {
        apartmentList.innerHTML = "<li>No results available at this zoom or filters.</li>";
        return;
    }

    buildings.forEach((building) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <strong>${building.Address}</strong> – ${building.units.length} unit(s) available<br><hr>
        `;

        building.units.forEach((unit) => {
            const unitDiv = document.createElement("div");
            unitDiv.classList.add("unit");

            unitDiv.innerHTML = `
                <div class="unit-summary">
                    <strong>Unit ${unit.UnitNumber}</strong><br>
                    $${unit.Rent} / month<br>
                    ${unit.Bedrooms} bed, ${unit.Bathrooms} bath<br>
                    <button class="show-details">Show Details</button>
                </div>
            `;

            const showDetailsButton = unitDiv.querySelector(".show-details");
            showDetailsButton.addEventListener("click", async () => {
                try {
                    // Fetch detailed unit information
                    const response = await fetch(`${API_BASE_URL}/api/units/${unit.UnitID}`);
					console.log(unit);
					console.log(response);
                    if (!response.ok) throw new Error("Failed to fetch unit details");
                    const unitDetails = await response.json();

                    // Update modal content
                    const modal = document.getElementById("details-modal");
					const modalContent = modal.querySelector(".modal-content");
                    modal.querySelector("#details-title").textContent = `${building.Address}`;
                    modal.querySelector("#details-rent").textContent = `$${unit.Rent} / month`;
                    modal.querySelector("#details-description").textContent =
                        unitDetails.Description || "No description available.";

                    // Populate amenities
                    const amenitiesGrid = modal.querySelector("#amenities-grid");
                    amenitiesGrid.innerHTML = unitDetails.Amenities
                        ? Object.entries(unitDetails.Amenities)
                              .filter(([_, value]) => value)
                              .map(([key]) => `<div class="amenity-icon">${key}</div>`)
                              .join("")
                        : "<p>No amenities listed.</p>";

                    // Populate transit info
                    const transitDetails = modal.querySelector("#transit-details");
                    transitDetails.innerHTML = unitDetails.Transit
                        ? unitDetails.Transit.map(
                              (location) =>
                                  `<p><strong>${location.name}</strong>: Walk: ${location.walk}, Drive: ${location.drive}, Transit: ${
                                      location.transit || "N/A"
                                  }</p>`
                          ).join("")
                        : "<p>No transit information available.</p>";

                    // Handle Images with Grid
                    populateImageGrid(unitDetails.FeaturedImage, unitDetails.Images || []);

                    // Show modal
                    modal.classList.remove("hidden");
					
					modal.addEventListener("click", (event) => {
						// Check if the click was outside the modal content
						if (!modalContent.contains(event.target)) {
							modal.classList.add("hidden"); // Hide the modal
						}
					});



                    // Rent button action
                    const rentButton = modal.querySelector("#rent-button");
                    rentButton.onclick = () => {
                        alert(`Renting Unit ${unit.UnitNumber}!`);
                        modal.classList.add("hidden");
                    };
                } catch (error) {
                    console.error("Error fetching unit details:", error);
                    alert("Failed to load details. Please try again.");
                }
            });

            li.appendChild(unitDiv);
        });

        apartmentList.appendChild(li);
    });
}




async function handleRowClick(event) {
    const row = event.target.closest("tr"); // Ensure a row was clicked
    if (!row) return;

    const offerID = row.getAttribute("data-id"); // Get the offer's ID
    try {
        const response = await fetch(`${API_BASE_URL}/api/offers/${offerID}/details`, { method: "GET" });

        if (!response.ok) throw new Error("Failed to fetch offer details");

        const details = await response.json();
        openDetailsModal(details); // Display details in the modal
    } catch (error) {
        console.error("Error fetching offer details:", error);
    }
}



async function openUnitDetailsModal(unit) {
	let unitID = unit.UnitID;
    try {
        // 1. Fetch the unit details
        const response = await fetch(`${API_BASE_URL}/api/units/${unitID}`);
        if (!response.ok) throw new Error("Failed to fetch unit details");
        const unitDetails = await response.json();

        // 2. Grab the modal elements
        const modal = document.getElementById("details-modal");
        const modalContent = modal.querySelector(".modal-content");

        // 3. Populate your modal fields
        modal.querySelector("#details-title").textContent = unit.Address || "No address"; 
        modal.querySelector("#details-rent").textContent = `$${unit.Rent || "N/A"} / month`;
        modal.querySelector("#details-description").textContent =
            unitDetails.Description || "No description available.";

        // Example: amenities grid
        const amenitiesGrid = modal.querySelector("#amenities-grid");
        amenitiesGrid.innerHTML = unitDetails.Amenities
            ? Object.entries(unitDetails.Amenities)
                  .filter(([_, value]) => value)
                  .map(([key]) => `<div class="amenity-icon">${key}</div>`)
                  .join("")
            : "<p>No amenities listed.</p>";

        // Example: transit info
        const transitDetails = modal.querySelector("#transit-details");
        transitDetails.innerHTML = unitDetails.Transit
            ? unitDetails.Transit.map(
                  (loc) => `<p><strong>${loc.name}</strong>: Walk: ${loc.walk}, Drive: ${loc.drive}</p>`
              ).join("")
            : "<p>No transit information available.</p>";

        // Example: images
        populateImageGrid(unitDetails.FeaturedImage, unitDetails.Images || []);

        // 4. Show the modal
        modal.classList.remove("hidden");

        // 5. Close the modal on background click or dedicated close button
        modal.addEventListener("click", (evt) => {
            if (!modalContent.contains(evt.target)) {
                modal.classList.add("hidden");
            }
        });
    } catch (error) {
        console.error("Error fetching unit details:", error);
        alert("Failed to load details. Please try again.");
    }
}



function populateImageGrid(featuredImage, images) {
    const featuredImageContainer = document.getElementById("featured-image");
    const scrollableImagesContainer = document.getElementById("scrollable-images");

    // 1. Handle Featured Image
    if (featuredImage) {
        featuredImageContainer.style.display = "block";
        featuredImageContainer.innerHTML = `
            <img src="${featuredImage.ImageURL}" alt="${featuredImage.Caption || "Featured Image"}">
        `;
    } else {
        featuredImageContainer.style.display = "none";
    }

    // 2. Duplicate images multiple times (5 is arbitrary; increase as needed)
    const repeatedImages = new Array(5).fill(images).flat(); // 5 copies of the original array

    // 3. Populate scrollable container with all repeated images in normal flow
    scrollableImagesContainer.innerHTML = "";
    repeatedImages.forEach((imgData) => {
        const imgElement = document.createElement("img");
        imgElement.src = imgData.ImageURL;
        imgElement.alt = imgData.Caption || "Gallery Image";
        scrollableImagesContainer.appendChild(imgElement);
    });

    // 4. On load, set the scroll to the middle
    requestAnimationFrame(() => {
        const middleScrollTop = scrollableImagesContainer.scrollHeight / 2;
        scrollableImagesContainer.scrollTop = middleScrollTop;

        // 5. Listen for scrolling near edges, then reset to the middle
        scrollableImagesContainer.addEventListener("scroll", () => {
            // If near the top
            if (scrollableImagesContainer.scrollTop < 50) {
                scrollableImagesContainer.scrollTop += middleScrollTop;
            }
            // If near the bottom
            else if (
                scrollableImagesContainer.scrollTop + scrollableImagesContainer.clientHeight >
                scrollableImagesContainer.scrollHeight - 50
            ) {
                scrollableImagesContainer.scrollTop -= middleScrollTop;
            }
        });
    });
}




async function rentUnit(offerID) {
    try {
        const response = await fetch("${API_BASE_URL}/api/leases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ offerID }),
        });

        if (!response.ok) {
            throw new Error("Failed to rent the unit.");
        }

        alert("Unit rented successfully!");
        document.getElementById("details-modal").classList.add("hidden");

        // Refresh tenant view to reflect updated offers
        fetchProperties();
    } catch (error) {
        console.error("Error renting unit:", error);
        alert("Error renting the unit. Please try again.");
    }
}

function updateImageCarousel(imageCarousel) {
    const currentImage = document.getElementById("current-image");
    const imageCaption = document.getElementById("image-caption");
    const { currentIndex, images } = imageCarousel;

    if (images.length === 0) {
        currentImage.src = "";
        imageCaption.textContent = "No images available.";
        return;
    }

    // Set the current image and caption
    currentImage.src = images[currentIndex].ImageURL;
    imageCaption.textContent = images[currentIndex].Caption || "";

    // Add event listeners for navigation
    document.getElementById("prev-image").addEventListener("click", () => {
        imageCarousel.currentIndex =
            (currentIndex - 1 + images.length) % images.length;
        updateImageCarousel(imageCarousel);
    });

    document.getElementById("next-image").addEventListener("click", () => {
        imageCarousel.currentIndex = (currentIndex + 1) % images.length;
        updateImageCarousel(imageCarousel);
    });
}
