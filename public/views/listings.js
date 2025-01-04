import { navigateTo } from "../router.js";

const API_BASE_URL = window.API_BASE_URL || '';

export function renderPage() {
    const content = document.getElementById("content");

    content.innerHTML = `
        <div class="unit-details-page">
            <aside class="selectors-panel">
                <section class="building-selector" id="Building-Container">
                    <h3>Your Buildings</h3>
                    <div id="building-list" class="card-list"></div>
                </section>
                <section class="unit-selector">
                    <h3>Units</h3>
                    <div id="unit-list" class="card-list collapsed"></div>
                    <button class="landlord-btn full-width-btn" id="add-unit-btn">Add Unit</button>
                </section>
            </aside>
            <main class="unit-details-main">
                <header class="unit-header">
                    <h1>Select Unit</h1>
                    <p>Please select a building and a unit to view details.</p>
                </header>
            </main>
        </div>
		
		    <button id="back-to-landlord-home" class="floating-action-btn" aria-label="Back to Landlord Home">
				<i class="fas fa-home"></i> <!-- Use an icon library like FontAwesome -->
			</button>
    `;


    fetchBuildings(); // Populate building list
	
	document.getElementById("back-to-landlord-home").addEventListener("click", () => {
		console.log("Navigating to Landlord Home...");
		navigateTo("landlord");// Replace with the actual logic to load the landlord dashboard
	});

}

// Fetch and populate buildings
function fetchBuildings() {
    fetch("${API_BASE_URL}/api/buildings")
        .then((response) => response.json())
        .then((buildings) => {
            const buildingList = document.getElementById("building-list");
            buildingList.innerHTML = ""; // Clear previous list

            buildings.forEach((building) => {
                const card = document.createElement("div");
                card.className = "card";
                card.dataset.buildingId = building.BuildingID; // Set a custom attribute for easy reference
                card.innerHTML = `
                    <p><strong>${building.Address}</strong></p>
                    <p>${building.City}, ${building.State}</p>
                `;
                card.addEventListener("click", () => {
                    console.log("Building clicked:", building.BuildingID); // Debug log
                    hideOtherBuildings(building.BuildingID);
					selectBuilding(building.BuildingID);
                });
                buildingList.appendChild(card);
            });
			
			const BuildingSelect = document.getElementById("Building-Container");
			const addBuildingBtn = document.createElement("button");
            addBuildingBtn.className = "landlord-btn full-width-btn";
            addBuildingBtn.textContent = "Add New Building";
            addBuildingBtn.addEventListener("click", renderSearchBar);
            BuildingSelect.appendChild(addBuildingBtn);
        })
        .catch((error) => console.error("Error fetching buildings:", error));
}

function renderSearchBar() {
    const main = document.querySelector(".unit-details-main");

    main.innerHTML = `
        <header class="unit-header">
            <h1>Search Buildings</h1>
            <p>Search for a building in the database or add a new one if it doesn't exist.</p>
        </header>
        <section class="search-section">
            <div class="form-group">
                <label for="building-search">Search by Address, City, or Zip Code:</label>
                <input type="text" id="building-search" placeholder="Type to search...">
            </div>
            <ul id="search-results" class="search-results"></ul>
        </section>
        <section class="fallback-section hidden">
            <p>No results found. You can add a new building below:</p>
            <button class="landlord-btn" id="render-Form">Add New Building</button>
        </section>
    `;

    document.getElementById("building-search").addEventListener("input", handleBuildingSearch);
}

async function handleBuildingSearch(event) {
    const query = event.target.value.trim();

    if (!query) {
        // Clear results if the query is empty
        document.getElementById("search-results").innerHTML = "";
        document.querySelector(".fallback-section").classList.add("hidden");
        return;
    }

    try {
        const encodedQuery = encodeURIComponent(query); // Encode the query to handle special characters
        const response = await fetch(`${API_BASE_URL}/api/buildings/search?q=${encodedQuery}`);
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();
		console.log(data);
        const resultsList = document.getElementById("search-results");
        resultsList.innerHTML = "";

        if (data.length > 0) {
            data.forEach((building) => {
                const listItem = document.createElement("li");
                listItem.className = "search-result";
                listItem.innerHTML = `
                    <strong>${building.Address}</strong>
                    <p>${building.City}, ${building.State} ${building.ZipCode}</p>
                `;
                listItem.addEventListener("click", () => renderAddUnitForm(building.BuildingID));
                resultsList.appendChild(listItem);
            });
            document.querySelector(".fallback-section").classList.add("hidden");
        } else {
            document.querySelector(".fallback-section").classList.remove("hidden");
			document.getElementById("render-Form").addEventListener("click", () => {
				renderAddBuildingForm();
			});
        }
    } catch (error) {
        console.error("Error fetching buildings:", error);
    }
}

function renderAddUnitForm(buildingID) {
    const unitDetails = document.querySelector(".unit-details-main");
	console.log(buildingID);
    unitDetails.innerHTML = `
        <div class="add-unit-form-container">
            <h2>Add New Unit</h2>
            <form id="add-unit-form">
                <div class="form-group">
                    <label for="unit-number">Unit Number</label>
                    <input type="text" id="unit-number" name="unitNumber" placeholder="Enter unit number" required>
                </div>
                <div class="form-group">
                    <label for="bedrooms">Bedrooms</label>
                    <input type="number" id="bedrooms" name="bedrooms" step="0.5" placeholder="Enter number of bedrooms" required>
                </div>
                <div class="form-group">
                    <label for="bathrooms">Bathrooms</label>
                    <input type="number" id="bathrooms" name="bathrooms" step="0.5" placeholder="Enter number of bathrooms" required>
                </div>
                <div class="form-group">
                    <label for="square-feet">Square Feet</label>
                    <input type="number" id="square-feet" name="squareFeet" placeholder="Enter square footage">
                </div>
                <div class="form-group">
                    <label for="property-type">Property Type</label>
                    <select id="property-type" name="propertyType" required>
                        <option value="">Select a type</option>
                        <option value="Apartment">Apartment</option>
                        <option value="Condo">Condo</option>
                        <option value="House">House</option>
                    </select>
                </div>
                <button type="submit" class="landlord-btn">Add Unit</button>
                <button type="button" class="landlord-btn cancel-btn" id="cancel-add-unit">Cancel</button>
            </form>
        </div>
    `;

    // Attach event listeners
    document.getElementById("add-unit-form").addEventListener("submit", (event) =>
        handleAddUnit(event, buildingID)
    );
    document.getElementById("cancel-add-unit").addEventListener("click", () => {
        unitDetails.innerHTML = "<p>Select a unit or action to view details here.</p>"; // Reset the details view
    });
}


async function handleAddUnit(event, buildingID) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const unitData = {
        unitNumber: formData.get("unitNumber"),
        bedrooms: parseFloat(formData.get("bedrooms")),
        bathrooms: parseFloat(formData.get("bathrooms")),
        squareFeet: formData.get("squareFeet") ? parseInt(formData.get("squareFeet"), 10) : null,
        propertyType: formData.get("propertyType"),
    };

    console.log("Sending unitData:", unitData); // Add this to debug the payload

    try {
        const response = await fetch(`${API_BASE_URL}/api/buildings/${buildingID}/units`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(unitData),
        });

        if (response.ok) {
            const data = await response.json();
            alert(`Unit created successfully with ID: ${data.unitID}`);
        } else {
            const error = await response.text(); // Log raw text if response isn't JSON
            console.error("API Error:", error);
            alert(`Error creating unit: ${error}`);
        }
    } catch (error) {
        console.error("Error creating unit:", error);
        alert("An error occurred. Please try again.");
    }
}




function renderAddBuildingForm() {
    const main = document.querySelector(".unit-details-main");

    main.innerHTML = `
        <header class="unit-header">
            <h1>Add New Building</h1>
            <p>Fill out the details below to add a new building to MILO Homes.</p>
        </header>
        <section class="details-section">
            <form id="add-building-form" class="form-styled compact-form">
                <div class="form-group">
                    <label for="address">Address:</label>
                    <input type="text" id="address" name="address" placeholder="Enter building address" required>
                </div>
                <div class="form-group">
                    <label for="city">City:</label>
                    <input type="text" id="city" name="city" placeholder="Enter city" required>
                </div>
                <div class="form-group">
                    <label for="state">State:</label>
                    <input type="text" id="state" name="state" maxlength="2" placeholder="State (e.g., MA)" required>
                </div>
                <div class="form-group">
                    <label for="zipCode">Zip Code:</label>
                    <input type="text" id="zipCode" name="zipCode" placeholder="Enter zip code" required>
                </div>
                <button type="button" class="landlord-btn next-map-btn">Next: Select Location on Map</button>
            </form>
        </section>
    `;

    document.querySelector(".next-map-btn").addEventListener("click", handleNextToMap);
}


function handleNextToMap() {
    const form = document.getElementById("add-building-form");
    const formData = new FormData(form);
    const buildingData = Object.fromEntries(formData.entries());

    // Validate the form
    if (!buildingData.address || !buildingData.city || !buildingData.state || !buildingData.zipCode) {
        alert("Please fill out all required fields.");
        return;
    }

    // Store the building data for the next step
    localStorage.setItem("buildingData", JSON.stringify(buildingData));

    // Render the map selection step
    renderMapSelection();
}


function renderMapSelection() {
    const main = document.querySelector(".unit-details-main");

    main.innerHTML = `
        <header class="unit-header">
            <h1>Select Building Location</h1>
            <p>Drag the marker to the building's location on the map.</p>
        </header>
        <section class="map-section">
            <div id="map" style="height: 400px; border-radius: 8px; overflow: hidden;"></div>
            <button class="landlord-btn save-location-btn">Save Location</button>
        </section>
    `;

    const map = L.map("map").setView([42.3601, -71.0589], 13); // Default to Boston
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([42.3601, -71.0589], { draggable: true }).addTo(map);

    document.querySelector(".save-location-btn").addEventListener("click", () => {
        const { lat, lng } = marker.getLatLng();

        // Add the location to the building data and save
        const buildingData = JSON.parse(localStorage.getItem("buildingData"));
        buildingData.latitude = lat;
        buildingData.longitude = lng;

        // Submit the final data
        submitBuilding(buildingData);
    });
}

async function submitBuilding(buildingData) {
    try {
        const response = await fetch("${API_BASE_URL}/api/buildings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(buildingData),
        });

        if (response.ok) {
            alert("Building added successfully!");
            fetchBuildings(); // Refresh building list
        } else {
            const errorData = await response.json();
            alert(`Failed to add building: ${errorData.error || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Error adding building:", error);
    }
}


async function handleAddBuilding(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const buildingData = Object.fromEntries(formData.entries());

    try {
        const response = await fetch("${API_BASE_URL}/api/buildings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(buildingData),
        });

        if (response.ok) {
            alert("Building added successfully!");
            fetchBuildings(); // Refresh building list
        } else {
            const errorData = await response.json();
            alert(`Failed to add building: ${errorData.error || "Unknown error"}`);
        }
    } catch (error) {
        console.error("Error adding building:", error);
    }
}


// Hide other buildings except the selected one
function hideOtherBuildings(selectedBuildingID) {
    console.log("HIDE!!! Selected Building ID:", selectedBuildingID); // Debug log

    const buildingCards = document.querySelectorAll("#building-list .card");
    buildingCards.forEach((card) => {
        const isSelected = card.dataset.buildingId === String(selectedBuildingID); // Match dataset ID
        card.style.display = isSelected ? "block" : "none";
    });

    // Add a back button to restore all buildings
    const buildingList = document.getElementById("building-list");
    if (!document.querySelector("#building-list .back-button")) {
        const backButton = document.createElement("button");
        backButton.className = "landlord-btn full-width-btn back-button";
        backButton.textContent = "Back to Buildings";
        backButton.addEventListener("click", resetBuildings);
        buildingList.appendChild(backButton);
    }
}


// Reset to show all buildings
function resetBuildings() {
    const buildingCards = document.querySelectorAll("#building-list .card");
    buildingCards.forEach((card) => {
        card.style.display = "block";
    });

    // Remove the back button
    const backButton = document.querySelector("#building-list .back-button");
    if (backButton) backButton.remove();

    // Collapse the unit list
    document.getElementById("unit-list").classList.add("collapsed");
    document.getElementById("unit-list").innerHTML = ""; // Clear units list
}


// Fetch and populate units for a building
function fetchUnits(buildingID) {
    fetch(`${API_BASE_URL}/api/buildings/${buildingID}/units`)
        .then((response) => response.json())
        .then((units) => {
            const unitList = document.getElementById("unit-list");
            unitList.innerHTML = ""; // Clear previous content

            units.forEach((unit) => {
                const card = document.createElement("div");
                card.className = "card";
                card.innerHTML = `
                    <p><strong>Unit ${unit.UnitNumber}</strong></p>
                    <p>${unit.Bedrooms} Bed | ${unit.Bathrooms} Bath</p>
                `;
                // Attach event listener dynamically
                card.addEventListener("click", () => selectUnit(unit.UnitID));
                unitList.appendChild(card);
            });


			unitList.classList.remove("collapsed"); // Expand units list


            const addUnitBtn = document.getElementById("add-unit-btn");
			if (!addUnitBtn) {
				console.error("Add Unit button not found in the DOM.");
			} else {
				console.log("Add Unit button exists and is ready for events.");
			}
			
			if (addUnitBtn) {
				const newAddUnitBtn = addUnitBtn.cloneNode(true);
				addUnitBtn.replaceWith(newAddUnitBtn); // Replace the old button
				const RealaddUnitBtn = document.getElementById("add-unit-btn");
				// Reattach the listener to the new button
				RealaddUnitBtn.addEventListener("click", () => {
					console.log("Add Unit button clicked!"); // Debug log
					renderAddUnitForm(buildingID); // Render the Add Unit form
				});
			}

            
			
        })
        .catch((error) => console.error("Error fetching units:", error));
}


// Select a building and show its units
function selectBuilding(buildingID) {
    fetchUnits(buildingID);
    const buildingList = document.getElementById("building-list");
    Array.from(buildingList.children).forEach((card) => {
        card.style.display = card.getAttribute("onclick").includes(buildingID)
            ? "block"
            : "none";
    });
    buildingList.insertAdjacentHTML(
        "beforeend",
        `<button class="landlord-btn full-width-btn" onclick="resetBuildings()">Back to Buildings</button>`
    );
}


// Select a unit and display its details
function selectUnit(unitID) {
    fetch(`${API_BASE_URL}/api/units/${unitID}`)
        .then((response) => response.json())
        .then((unit) => populateUnitDetails(unit))
        .catch((error) => console.error("Error fetching unit details:", error));
}

// Populate unit details
function populateUnitDetails(unit) {
    const main = document.querySelector(".unit-details-main");
	console.log("Unit Images Data:", unit.Images);
    main.innerHTML = `
        <header class="unit-header">
            <h1>Unit ${unit.UnitNumber}</h1>
            <p>${unit.Bedrooms} Bed | ${unit.Bathrooms} Bath | ${unit.SquareFeet || "N/A"} Sq. Ft.</p>
        </header>
        <section class="details-section">
            <h2>Details</h2>
            <div class="details-grid">
                <p><span>Type:</span> ${unit.PropertyType}</p>
                <p><span>Pet Policy:</span> ${unit.PetPolicy || "N/A"}</p>
                <p><span>Parking:</span> ${unit.Parking || "N/A"}</p>
                <p><span>Description:</span> ${unit.Description || "No description available."}</p>
            </div>
        </section>
        <section class="image-section">
            <h2>Images</h2>
            <div class="unit-image-container">
                ${
                    unit.Images && unit.Images.length > 0
                        ? unit.Images.map(
                              (image) => `
							<div class="unit-image-card">
								<img src="${image.ImageURL}" alt="${image.Caption || "Unit Image"}" title="${image.Caption || ""}">
							</div>
					`
                          ).join("")
                        : "<p>No images available.</p>"
                }
            </div>
            <button class="landlord-btn edit-images-btn">Edit Images</button>
        </section>
        <section class="action-section">
            <button class="landlord-btn edit-details-btn">Edit Unit Details</button>
        </section>
    `;
	
	const editDetailsButton = main.querySelector(".edit-details-btn");
    editDetailsButton.addEventListener("click", () => {
        renderEditUnitForm(unit.UnitID); // Call the form rendering function
    });
	
	const editImagesButton = main.querySelector(".edit-images-btn");
    editImagesButton.addEventListener("click", () => {
        renderEditImages(unit.UnitID); // Call the form rendering function
    });
}


function renderEditUnitForm(unitID) {
    // Fetch the current unit details from the backend or cache
    fetch(`${API_BASE_URL}/api/units/${unitID}`)
        .then((response) => response.json())
        .then((unit) => {
            const main = document.querySelector(".unit-details-main");

            main.innerHTML = `
                <header class="unit-header">
                    <h1>Edit Unit ${unit.UnitNumber}</h1>
                    <p>${unit.Bedrooms} Bed | ${unit.Bathrooms} Bath | ${unit.SquareFeet || "N/A"} Sq. Ft.</p>
                </header>
                <form id="edit-unit-form" class="details-section">
                    <h2>Edit Details</h2>
                    <div class="form-group">
                        <label for="edit-pet-policy">Pet Policy</label>
                        <input type="text" id="edit-pet-policy" name="petPolicy" value="${unit.PetPolicy || ""}" placeholder="e.g., Dogs Allowed">
                    </div>
                    <div class="form-group">
                        <label for="edit-parking">Parking</label>
                        <input type="text" id="edit-parking" name="parking" value="${unit.Parking || ""}" placeholder="e.g., 2 Reserved Spots">
                    </div>
                    <div class="form-group">
                        <label for="edit-description">Description</label>
                        <textarea id="edit-description" name="description" rows="4" placeholder="Enter a description">${unit.Description || ""}</textarea>
                    </div>
                    <button type="submit" class="landlord-btn save-btn">Save Changes</button>
                    <button type="button" class="landlord-btn cancel-btn" onclick="populateUnitDetails(${unit.UnitID})">Cancel</button>
                </form>
            `;

            // Attach form submission logic
            document.getElementById("edit-unit-form").addEventListener("submit", (event) => handleSaveUnitDetails(event, unitID));
        })
        .catch((error) => {
            console.error("Error fetching unit details:", error);
            alert("An error occurred while fetching unit details.");
        });
}

async function handleSaveUnitDetails(event, unitID) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const updatedData = {
        petPolicy: formData.get("petPolicy"),
        parking: formData.get("parking"),
        description: formData.get("description"),
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/units/${unitID}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedData),
        });

        if (response.ok) {
            const updatedUnit = await response.json();
            alert("Unit details updated successfully!");
            populateUnitDetails(updatedUnit); // Re-render the updated unit details
        } else {
            const error = await response.json();
            alert(`Error updating unit: ${error.error}`);
        }
    } catch (error) {
        console.error("Error updating unit details:", error);
        alert("An error occurred. Please try again.");
    }
}

async function renderEditImages(unitID) {
    const main = document.querySelector(".unit-details-main");
    try {
        const response = await fetch(`${API_BASE_URL}/api/units/${unitID}/images`);
        const images = await response.json();

        main.innerHTML = `
            <header class="unit-header">
                <h1>Edit Images</h1>
                <p>Manage and update images for this unit below.</p>
            </header>
            <section class="image-edit-container">
                <div class="image-grid">
                    ${images.map(img => `
                        <div class="image-card">
                            <div class="image-preview-container">
                                <img class="image-preview" src="${img.ImageURL}" alt="${img.Caption || "No Caption"}">
                            </div>
                            <div class="image-details">
                                <input
                                    type="text"
                                    class="image-caption-input"
                                    value="${img.Caption || ""}"
                                    data-id="${img.ImageID}"
                                    placeholder="Edit Caption"
                                >
                                <button class="landlord-btn delete-image-btn" data-id="${img.ImageID}">
                                    Delete
                                </button>
                            </div>
                        </div>
                    `).join("")}
                </div>
                <div class="upload-section">
                    <input type="file" id="image-upload" multiple class="file-input">
                    <button id="upload-images-btn" class="landlord-btn">
                        Upload Images
                    </button>
                </div>
                <button class="landlord-btn back-to-unit-btn">
                    Back to Unit
                </button>
            </section>
        `;

        document.querySelector("#upload-images-btn").addEventListener("click", () => handleImageUpload(unitID));
        document.querySelectorAll(".delete-image-btn").forEach(btn =>
            btn.addEventListener("click", e => handleImageDelete(e.target.dataset.id, unitID))
        );
        document.querySelectorAll(".image-caption-input").forEach(input =>
            input.addEventListener("blur", e => updateImageCaption(e.target.dataset.id, e.target.value))
        );
        document.querySelector(".back-to-unit-btn").addEventListener("click", () => populateUnitDetails(unitID));
    } catch (error) {
        console.error("Error fetching images:", error);
        main.innerHTML = `
            <p class="error-message">Failed to load images. Please try again later.</p>
        `;
    }
}



async function handleImageUpload(unitID) {
    const files = document.getElementById("image-upload").files;
    if (!files.length) return alert("Please select images to upload.");

    const formData = new FormData();
    [...files].forEach(file => formData.append("images", file));

    try {
        const response = await fetch(`${API_BASE_URL}/api/units/${unitID}/images`, {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            const result = await response.json();
            alert("Images uploaded successfully!");
            renderEditImages(unitID); // Refresh the images view
        } else {
            const error = await response.json();
            alert(`Error uploading images: ${error.error}`);
        }
    } catch (error) {
        console.error("Error uploading images:", error);
        alert("An error occurred during upload.");
    }
}


async function handleImageDelete(imageID, unitID) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/images/${imageID}`, { method: "DELETE" });
        if (response.ok) {
            alert("Image deleted successfully!");
            renderEditImages(unitID);
        } else {
            const error = await response.json();
            alert(`Error deleting image: ${error.message}`);
        }
    } catch (error) {
        console.error("Error deleting image:", error);
    }
}


async function updateImageCaption(imageID, caption) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/images/${imageID}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caption }),
        });
        if (!response.ok) {
            const error = await response.json();
            alert(`Error updating caption: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating caption:", error);
    }
}
