import { navigateTo } from "../router.js";

export function renderLandlordDashboard() {
    const content = document.getElementById("content");
    content.innerHTML = `
        <div id="dashboard-header">
            <h1>Landlord Dashboard</h1>
        </div>
        <div class="metrics-container">
            <div class="metric-card">
                <h2 id="total-properties">0</h2>
                <p>Total Units</p>
            </div>
            <div class="metric-card">
                <h2 id="total-units">0</h2>
                <p>Leased Units</p>
            </div>
            <div class="metric-card">
                <h2 id="active-offers">0</h2>
                <p>Active Offers</p>
            </div>
            <div class="metric-card">
                <h2 id="expected-revenue">$0</h2>
                <p>Expected Revenue (Next Month)</p>
            </div>
        </div>
        <div class="actions-container">
            <button class="dashboard-btn" id="manage-properties-btn">Manage Properties</button>
            <button class="dashboard-btn" id="manage-offers-btn">Manage Offers</button>
            <button class="dashboard-btn" id="manage-tenants-btn">Manage Tenants</button>
        </div>
    `;

    // Fetch and display metrics
    fetchMetrics();

    // Event Listeners for Buttons
    document.getElementById("manage-properties-btn").addEventListener("click", () => {
        navigateTo("manageProperties");
    });

    document.getElementById("manage-offers-btn").addEventListener("click", () => {
        navigateTo("manageOffers"); // Navigate to manage offers
    });

    document.getElementById("manage-tenants-btn").addEventListener("click", () => {
        alert("Tenant management coming soon.");
    });
}


async function fetchMetrics() {
    try {
        const response = await fetch("/api/landlord/dashboard", {
            method: "GET",
            credentials: "include",
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById("total-properties").textContent = data.totalUnits || 0;
            document.getElementById("total-units").textContent = data.leasedUnits || 0;
            document.getElementById("active-offers").textContent = data.activeOffers || 0;
            const revenueElement = document.getElementById("expected-revenue");
            if (revenueElement) {
                revenueElement.textContent = `$${data.expectedRevenue.toLocaleString()}` || "$0";
            }
        } else {
            console.error("Failed to fetch metrics.");
        }
    } catch (error) {
        console.error("Error fetching metrics:", error);
    }
}




let previewLatitude = null;
let previewLongitude = null;

function renderNewListingForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <h2>Search for Building</h2>
		<div class="button-container">
            <button id="back-to-home-btn" class="landlord-btn">Back to Landlord Home</button>
        </div>
        <form id="building-search-form" class="form-styled">
            <div class="form-group">
                <label for="address">Address:</label>
                <input type="text" id="address" name="address" placeholder="Enter building address">
            </div>
            
            <div class="form-group">
                <label for="city">City:</label>
                <input type="text" id="city" name="city" placeholder="Enter city">
            </div>
            
            <div class="form-group">
                <label for="state">State:</label>
                <input type="text" id="state" name="state" maxlength="2" placeholder="State (e.g., MA)">
            </div>
            
            <div class="form-group">
                <label for="zipCode">Zip Code:</label>
                <input type="text" id="zipCode" name="zipCode" placeholder="Zip code">
            </div>
            
            <button type="submit" class="landlord-btn">Search</button>
        </form>
        <div id="search-results"></div>
    `;
    document.getElementById("back-to-home-btn").addEventListener("click", () => {
        renderLandlordView();
    });
	
    document.getElementById('building-search-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const searchParams = new URLSearchParams(formData);

        try {
            const response = await fetch(`/api/buildings/search?${searchParams.toString()}`);
            const resultDiv = document.getElementById('search-results');
            resultDiv.innerHTML = ''; // Clear previous results

            if (response.ok) {
                const data = await response.json();

			if (data.length > 0) {
				resultDiv.innerHTML = '<h3>Search Results:</h3>';
				data.forEach((building) => {
					const buildingElement = document.createElement('div');
					buildingElement.className = 'building-card';
					buildingElement.innerHTML = `
						<div>
							<p><strong>${building.Address}</strong></p>
							<p>${building.City}, ${building.State} ${building.ZipCode}</p>
						</div>
						<button class="landlord-btn" data-building-id="${building.BuildingID}">
							Proceed with Building
						</button>
					`;
					resultDiv.appendChild(buildingElement);
				});

				// Add event listeners to "Proceed with Building" buttons
				document.querySelectorAll('[data-building-id]').forEach((button) => {
					button.addEventListener('click', () => {
						const buildingID = button.getAttribute('data-building-id');
						console.log('Proceeding with Building ID:', buildingID);
						fetchUnits(buildingID);
					});
				});
			} else {
                    resultDiv.innerHTML = `<p>No buildings found matching your criteria.</p>`;
                    renderAddNewBuildingForm(formData);
                }
            } else {
                const error = await response.json();
                resultDiv.innerHTML = `<p>${error.message}</p>`;
            }
        } catch (error) {
            console.error('Error fetching building:', error);
            document.getElementById('search-results').innerHTML = '<p>An error occurred. Please try again later.</p>';
        }
    });
}

function renderAddNewBuildingForm(initialFormData) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <h2>Add New Building</h2>
        <div class="form-map-container">
            <form id="add-building-form" class="form-styled">
                <div class="form-group">
                    <label for="address">Address:</label>
                    <input type="text" id="address" name="address" value="${initialFormData.get('address')}" required>
                </div>
                
                <div class="form-group">
                    <label for="city">City:</label>
                    <input type="text" id="city" name="city" value="${initialFormData.get('city')}" required>
                </div>
                
                <div class="form-group">
                    <label for="state">State:</label>
                    <input type="text" id="state" name="state" value="${initialFormData.get('state')}" maxlength="2" required>
                </div>
                
                <div class="form-group">
                    <label for="zipCode">Zip Code:</label>
                    <input type="text" id="zipCode" name="zipCode" value="${initialFormData.get('zipCode')}" required>
                </div>
                
                <button type="button" id="preview-location-btn" class="landlord-btn">Preview Location</button>
            </form>

            <div id="map-container" style="display: none;">
				<div id="map" style="height: 500px; width: 100%;"></div>
			</div>
			<div id="button-column" class="button-column" style="display: none;">
				<button id="confirm-location-btn" class="landlord-btn">Confirm Location</button>
				<button id="manual-pin-btn" class="landlord-btn">Manual Pin</button>
			</div>

        </div>
    `;

    document.getElementById('preview-location-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('CLICK');
        // Create a new FormData object from the current form state
        const formElement = document.getElementById('add-building-form');
        const updatedFormData = new FormData(formElement);

        await previewBuildingLocation(updatedFormData);
    });

    document.getElementById('confirm-location-btn').addEventListener('click', async () => {
        // Create a new FormData object from the current form state
        const formElement = document.getElementById('add-building-form');
        const updatedFormData = new FormData(formElement);

        await confirmBuildingCreation(updatedFormData);
    });
}


let mapInstance = null; // Global variable to store the Leaflet map instance
let markerInstance = null;

async function previewBuildingLocation(formData) {
    console.log('preview');
    const address = formData.get('address');
    const city = formData.get('city');
    const state = formData.get('state');
    let zipCode = formData.get('zipCode');

    zipCode = zipCode.match(/^\d{5}/)?.[0] || ''; // Use only the first 5 digits

    try {
        const response = await fetch(`/api/geocode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, city, state, zipCode }),
        });
		if (!response.ok) {
			alert('Failed to geocode address. Please check inputs.');
			return; // Exit to avoid errors downstream
		}

        if (response.ok) {
            const { latitude, longitude } = await response.json();
			
			if (!latitude || !longitude) {
				alert('Invalid location coordinates. Please refine your address.');
				return;
			}

            // Save geocoded coordinates globally
            previewLatitude = latitude;
            previewLongitude = longitude;

            // Show the map container and button column
            document.getElementById('map-container').style.display = 'block';
			if (mapInstance) mapInstance.invalidateSize();
            
			
            // Destroy existing map instance if it exists
            if (mapInstance) {
				mapInstance.remove(); // Destroy the old instance
				mapInstance = null;   // Reset the reference
			}

            // Initialize a new map instance
            mapInstance = L.map('map').setView([latitude, longitude], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
            }).addTo(mapInstance);

            // Add a marker for the estimated location
            markerInstance = L.marker([latitude, longitude], { draggable: false }).addTo(mapInstance).bindPopup('Estimated Location').openPopup();
			
			const buttonColumn = document.getElementById('button-column');
			if (buttonColumn) {
				buttonColumn.style.display = 'flex';
			} else {
				console.error("Error: 'button-column' not found in the DOM.");
			}
				
			document.getElementById('manual-pin-btn').addEventListener('click', () => {
				enableManualPinMode();
			});
        } else {
            throw new Error('Failed to fetch geocode');
        }
    } catch (error) {
        console.error('Error fetching geocode:', error);
        alert('Unable to preview location. Please try again.');
    }
}





async function confirmBuildingCreation(formData) {
    if (previewLatitude === null || previewLongitude === null) {
        alert('Location preview is required before confirming the building.');
        return;
    }
	
    try {
        const jsonData = {
            address: formData.get('address'),
            city: formData.get('city'),
            state: formData.get('state'),
            zipCode: formData.get('zipCode'),
            latitude: previewLatitude,
            longitude: previewLongitude,
        };

        const response = await fetch('/api/buildings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData),
        });

        if (response.ok) {
            const building = await response.json();
            document.getElementById('success-message').innerHTML = `
                <p><strong>Building added successfully!</strong></p>
                <p>Building ID: ${building.buildingID}</p>
            `;
            document.getElementById('map-container').innerHTML = ''; // Clear map after successful submission
			
			renderLandlordView();
        } else {
            throw new Error('Failed to create building');
        }
    } catch (error) {
        console.error('Error creating building:', error);
        alert('An error occurred while adding the building. Please try again.');
    }
}

let manualPinMode = false;

function enableManualPinMode() {
    if (!mapInstance) {
        alert('Please load the map preview first.');
        return;
    }

    manualPinMode = true;
    alert('Click anywhere on the map to set the correct location.');

    // Add click event listener to map
	mapInstance.off('click'); 
    mapInstance.on('click', (event) => {
        if (manualPinMode) {
            const { lat, lng } = event.latlng;

            // Update marker location
            if (markerInstance) {
                markerInstance.setLatLng([lat, lng]);
            } else {
                markerInstance = L.marker([lat, lng], { draggable: false }).addTo(mapInstance);
            }

            // Update global coordinates
            previewLatitude = lat;
            previewLongitude = lng;

            // Disable manual pin mode after selection
            manualPinMode = false;
            alert('Location updated successfully.');
        }
    });
}

async function fetchUnits(buildingID) {
    try {
        const response = await fetch(`/api/buildings/${buildingID}/units`);
        if (response.ok) {
            const units = await response.json();
            renderUnits(units, buildingID);
        } else {
            alert('Failed to fetch units.');
        }
    } catch (error) {
        console.error('Error fetching units:', error);
    }
}


function renderUnits(units, buildingID) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="unit-container">
            <h2>Units for Building ID: ${buildingID}</h2>
            <div id="unit-list">
                ${
                    units.length > 0
                        ? units.map(unit => `
                            <div class="unit">
                                <p><strong>Unit Number:</strong> ${unit.UnitNumber}</p>
                                <p><strong>Bedrooms:</strong> ${unit.Bedrooms}</p>
                                <p><strong>Bathrooms:</strong> ${unit.Bathrooms}</p>
                                <p class="status-label ${unit.Status.toLowerCase()}">${unit.Status}</p>
                                <button class="manage-unit-btn" data-unit-id="${unit.UnitID}">Manage Unit</button>
                            </div>
                        `).join('')
                        : '<p>No units found for this building.</p>'
                }
            </div>
            <button id="add-unit-btn" class="landlord-btn">Add New Unit</button>
        </div>
    `;

    document.getElementById('add-unit-btn').addEventListener('click', () => {
        renderAddUnitForm(buildingID);
    });

    document.querySelectorAll('.manage-unit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const unitID = e.target.getAttribute('data-unit-id');
            renderAddOfferForm(unitID);
        });
    });
}





function renderAddUnitForm(buildingID) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <h2>Add New Unit</h2>
        <form id="add-unit-form" class="form-styled">
            <label for="unitNumber">Unit Number:</label>
            <input type="text" id="unitNumber" name="unitNumber" required>
            <label for="bedrooms">Bedrooms:</label>
            <input type="number" id="bedrooms" name="bedrooms" required>
            <label for="bathrooms">Bathrooms:</label>
            <input type="number" id="bathrooms" name="bathrooms" required>
            <label for="squareFeet">Square Feet:</label>
            <input type="number" id="squareFeet" name="squareFeet">
            <label for="propertyType">Unit Type:</label>
            <select id="propertyType" name="propertyType" required>
                <option value="Apartment">Apartment</option>
                <option value="House">House</option>
                <option value="Condo">Condo</option>
                <option value="Other">Other</option>
            </select>
            <button type="submit">Create Unit</button>
        </form>
    `;

    document.getElementById('add-unit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            const response = await fetch(`/api/buildings/${buildingID}/units`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
                },
                body: JSON.stringify(Object.fromEntries(formData)),
            });

            if (response.ok) {
                alert('Unit created successfully!');
                await fetchUnits(buildingID); // Refresh unit list
            } else {
                const errorData = await response.json();
                alert(`Failed to create unit: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error creating unit:', error);
        }
    });
}


function renderAddOfferForm(unitID) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <h2>Create Offer for Unit</h2>
        <form id="add-offer-form" class="form-styled">
            <label for="rentAmount">Rent Amount:</label>
            <input type="number" id="rentAmount" name="rentAmount" required>
            <label for="availabilityStatus">Availability:</label>
            <select id="availabilityStatus" name="availabilityStatus">
                <option value="1">Available</option>
                <option value="0">Unavailable</option>
            </select>
            <label for="startDate">Start Date:</label>
            <input type="date" id="startDate" name="startDate" required>
            <label for="endDate">End Date (optional):</label>
            <input type="date" id="endDate" name="endDate">
            <button type="submit">Create Offer</button>
        </form>
    `;

    document.getElementById('add-offer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            const response = await fetch(`/api/units/${unitID}/offers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
                },
                body: JSON.stringify(Object.fromEntries(formData)),
            });

            if (response.ok) {
                alert('Offer created successfully!');
                // Optionally refresh the page or redirect
            } else {
                const errorData = await response.json();
                alert(`Failed to create offer: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    });
}

function renderManageListings() {
    const content = document.getElementById("content");
    content.innerHTML = `
        <h2>Manage Existing Listings</h2>
		<div class="button-container">
            <button id="back-to-home-btn" class="landlord-btn">Back to Landlord Home</button>
        </div>
        <table id="listings-table">
            <thead>
                <tr>
                    <th>Address</th>
                    <th>Unit</th>
                    <th>Rent</th>
                    <th>Availability</th>
                    <th>Lease Dates</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    document.getElementById("back-to-home-btn").addEventListener("click", () => {
        renderLandlordView();
    });
	
    fetchListings();
}

async function fetchListings() {
    try {
        const response = await fetch("/api/landlord/offers", {
            method: "GET",
            credentials: "include",
        });

        if (response.ok) {
            const offers = await response.json();
            populateListingsTable(offers);
        } else {
            alert("Failed to fetch listings.");
        }
    } catch (error) {
        console.error("Error fetching listings:", error);
    }
}

function populateListingsTable(offers) {
    const tbody = document.querySelector("#listings-table tbody");
    tbody.innerHTML = "";

    offers.forEach((offer) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${offer.Address}, ${offer.City}, ${offer.State}</td>
            <td>${offer.UnitNumber}</td>
            <td>$${offer.RentAmount}</td>
            <td>${offer.AvailabilityStatus ? "Available" : "Unavailable"}</td>
            <td>${new Date(offer.StartDate).toLocaleDateString()} - ${new Date(offer.EndDate).toLocaleDateString()}</td>
            <td>
                <button class="update-offer-btn" data-id="${offer.OfferID}">Update</button>
                <button class="approve-lease-btn" data-unit="${offer.UnitID}">Approve Lease</button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Add event listeners
    document.querySelectorAll(".update-offer-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => updateOffer(e.target.dataset.id));
    });

    document.querySelectorAll(".approve-lease-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => approveLease(e.target.dataset.unit));
    });
}


async function updateOffer(offerID) {
    const newRent = prompt("Enter new rent amount:");
    const availability = confirm("Mark as available?");

    try {
        const response = await fetch(`/api/offers/${offerID}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rentAmount: newRent, availabilityStatus: availability ? 1 : 0 }),
        });

        if (response.ok) {
            alert("Offer updated successfully.");
            fetchListings();
        } else {
            alert("Failed to update offer.");
        }
    } catch (error) {
        console.error("Error updating offer:", error);
    }
}


async function approveLease(unitID) {
    const leaseID = prompt("Enter the Lease ID to approve:");

    try {
        const response = await fetch("/api/leases/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leaseID }),
        });

        if (response.ok) {
            alert("Lease approved successfully.");
            fetchListings();
        } else {
            alert("Failed to approve lease.");
        }
    } catch (error) {
        console.error("Error approving lease:", error);
    }
}
