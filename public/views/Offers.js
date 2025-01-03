import { navigateTo } from "../router.js";

// Offers.js

// Initialize the offers management page
export function initOffersPage() {
    renderOffersLayout();
}


function renderOffersLayout() {
    // Select the main content container
     const content = document.getElementById("content");

    // Populate the main content with the layout
    content.innerHTML = `
		<div class="offers-layout">
			<!-- Left Panel: Building List -->
			<aside class="building-unit-list-offers">
				<h2>Your Buildings</h2>
				<div id="building-list-offers" class="card-list-offers">
					<p>Loading buildings...</p>
				</div>
			</aside>

			<!-- Right Panel: Unit Details -->
			<section class="unit-details-main">
				<p>Select a building and unit to view or create offers.</p>
			</section>
			<button id="back-to-landlord-home" class="floating-action-btn" aria-label="Back to Landlord Home">
				<i class="fas fa-home"></i> <!-- Use an icon library like FontAwesome -->
			</button>
		</div>
    `;

    // Fetch and display buildings
	
	document.getElementById("back-to-landlord-home").addEventListener("click", () => {
		console.log("Navigating to Landlord Home...");
		navigateTo("landlord");// Replace with the actual logic to load the landlord dashboard
	});
	
    fetchBuildings();
}

// Fetch buildings and display them in the list
async function fetchBuildings() {
    try {
        const response = await fetch("/api/buildings");
        const buildings = await response.json();

        const buildingList = document.getElementById("building-list-offers");
        buildingList.innerHTML = ""; // Clear loading message

        buildings.forEach((building) => {
            const card = document.createElement("div");
            card.className = "card-offers-list";
            card.innerHTML = `
                <p><strong>${building.Address}</strong></p>
                <p>${building.City}, ${building.State} ${building.ZipCode}</p>
            `;

            // Add click listener to load units for the building
            card.addEventListener("click", () => fetchUnits(building.BuildingID));
            buildingList.appendChild(card);
        });
    } catch (error) {
        console.error("Error fetching buildings:", error);
        const buildingList = document.getElementById("building-list-offers");
        buildingList.innerHTML = "<p>Failed to load buildings. Try again later.</p>";
    }
}

let leasesCache = {}; // To store leases by UnitID

// Fetch all leases for the landlord and cache them
async function fetchLeases() {
    try {
        const response = await fetch("/api/landlord/leases"); // Update the API path as needed
        const leases = await response.json();

        // Map leases by UnitID
        leases.forEach((lease) => {
            if (!leasesCache[lease.UnitID]) {
                leasesCache[lease.UnitID] = [];
            }
            leasesCache[lease.UnitID].push(lease);
        });

        console.log("Leases fetched and cached:", leasesCache);
    } catch (error) {
        console.error("Error fetching leases:", error);
    }
}


let offersCache = {}; // To store offers by UnitID for quick lookups

// Fetch all offers for the landlord and cache them
async function fetchOffers() {
    try {
        const response = await fetch("/api/landlord/offers");
        const offers = await response.json();

        // Extract OfferIDs
        const offerIds = offers.map((offer) => offer.OfferID);

        // Fetch incentives for the list of OfferIDs
        const incentiveResponse = await fetch("/api/offers/incentives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offerIds }),
        });
        const incentives = await incentiveResponse.json();

        // Attach incentives to the respective offers
        offers.forEach((offer) => {
            offer.incentives = incentives.filter((incentive) => incentive.OfferID === offer.OfferID);
        });

        // Map offers by UnitID for quick lookups
        offers.forEach((offer) => {
            if (!offersCache[offer.UnitID]) {
                offersCache[offer.UnitID] = [];
            }
            offersCache[offer.UnitID].push(offer);
        });

        console.log("Offers fetched and cached:", offersCache);
    } catch (error) {
        console.error("Error fetching offers:", error);
    }
}

// Fetch units for a building and determine their statuses
async function fetchUnits(buildingID) {
    try {
        // Ensure leases and offers are fetched and cached
        if (Object.keys(leasesCache).length === 0) {
            await fetchLeases();
        }
        if (Object.keys(offersCache).length === 0) {
            await fetchOffers();
        }

        const response = await fetch(`/api/buildings/${buildingID}/units`);
        const units = await response.json();

        const buildingList = document.getElementById("building-list-offers");
        buildingList.innerHTML = ""; // Clear previous content

        const cardList = document.createElement("div");
        cardList.className = "card-list-offers";

        units.forEach((unit) => {
            const status = determineUnitStatus(unit.UnitID); // Get status
            const statusColor = getStatusColor(status); // Get color

           const card = document.createElement("div");
			card.className = "card-offers-list";
			card.setAttribute("data-status", status); // Set the status attribute
				
			// Determine the Font Awesome icon based on the status
			let faIcon = "";
			switch (status) {
				case "Occupied":
					faIcon = `<i class="fas fa-home"></i>`; // Home icon for Occupied
					break;
				case "Rented":
					faIcon = `<i class="fas fa-calendar-check"></i>`; // Calendar-check icon for Rented
					break;
				case "On Offer":
					faIcon = `<i class="fas fa-tag"></i>`; // Tag icon for On Offer
					break;
				case "Available to Offer":
					faIcon = `<i class="fas fa-exclamation-circle"></i>`; // Exclamation-circle icon for Available
					break;
				default:
					faIcon = `<i class="fas fa-question-circle"></i>`; // Question-circle icon for unknown status
			}


			card.innerHTML = `
				<p><strong>Unit ${unit.UnitNumber}</strong></p>
				<p>${unit.Bedrooms} Bed | ${unit.Bathrooms} Bath</p>
				<span class="status-icon">${faIcon}</span> <!-- Insert the icon -->
				<span class="status-label">${status}</span>
			`;

            card.addEventListener("click", () => selectUnit(unit));
            cardList.appendChild(card);
        });

		buildingList.appendChild(cardList);
		
		// Add "Back to Buildings" button
		const backButtonContainer = document.createElement("div");
		backButtonContainer.className = "back-button-container"; // New container for the button
		const backButton = document.createElement("button");
		backButton.textContent = "Back to Buildings";
		backButton.className = "landlord-btn";
		backButton.addEventListener("click", () => fetchBuildings());
		backButtonContainer.appendChild(backButton);

		buildingList.appendChild(backButtonContainer);
    } catch (error) {
        console.error("Error fetching units:", error);
        const buildingList = document.getElementById("building-list");
        buildingList.innerHTML = "<p>Failed to load units. Try again later.</p>";
    }
}


// Determine the status of a unit based on its offers
function determineUnitStatus(unitID) {
    const today = new Date();
    const leases = leasesCache[unitID] || [];
    const offers = offersCache[unitID] || [];

    // Check for Occupied status
    if (leases.some((lease) => new Date(lease.StartDate) <= today && new Date(lease.EndDate) >= today)) {
        return "Occupied";
    }

    // Check for Rented status
    if (leases.some((lease) => new Date(lease.StartDate) > today)) {
        return "Rented";
    }

    // Check for On Offer status
    if (offers.some((offer) => offer.AvailabilityStatus)) {
        return "On Offer";
    }

    // Default to Available to Offer
    return "Available to Offer";
}


// Function to get color based on status
function getStatusColor(status) {
    switch (status) {
        case "Occupied":
            return "#28a745"; // Green
        case "Rented":
            return "#17a2b8"; // Blue
        case "On Offer":
            return "#ffc107"; // Yellow
        case "Available to Offer":
            return "#dc3545"; // Red
        default:
            return "#6c757d"; // Gray
    }
}


// Display unit details and manage offers
function selectUnit(unit) {
    const main = document.querySelector(".unit-details-main");
    main.innerHTML = `
        <header>
            <h2>Unit ${unit.UnitNumber}</h2>
            <p>${unit.Bedrooms} Bed | ${unit.Bathrooms} Bath | ${unit.SquareFeet || "N/A"} Sq. Ft.</p>
        </header>
        <div class="offers-section">
            <h3>Current Offers</h3>
            <div id="offers-list">
                <p>Loading offers...</p>
            </div>
            <button id="create-offer-btn" class="landlord-btn">Create New Offer</button>
        </div>
    `;

    document.getElementById("create-offer-btn").addEventListener("click", () => {
        renderOfferForm(unit.UnitID);
    });

    // Fetch and display offers for this unit
    fetchUnitOffers(unit.UnitID);
}

async function fetchUnitOffers(unitID) {
    const offer = offersCache[unitID] ? offersCache[unitID][0] : null; // Single offer per unit
    const offersList = document.getElementById("offers-list");

    offersList.innerHTML = ""; // Clear loading message

    if (!offer) {
        offersList.innerHTML = "<p>No offers available. Create one to get started.</p>";
    } else {
        renderOfferDetails(offer);
    }
}

function renderOfferForm(unitID) {
    const detailsSection = document.querySelector(".unit-details-main");
    detailsSection.innerHTML = `
        <h3>Create New Offer</h3>
        <form id="create-offer-form">
            <div class="form-group">
                <label for="rent-amount">Rent Amount</label>
                <input type="number" id="rent-amount" name="rentAmount" placeholder="Enter Rent Amount" required>
            </div>
            <div class="form-group">
                <label for="application-fee">Application Fee</label>
                <input type="number" id="application-fee" name="applicationFee" placeholder="Enter Application Fee" required>
            </div>
            <div class="form-group">
                <label for="fee-waiver-threshold">Fee Waiver Threshold (0-100)</label>
                <input type="number" id="fee-waiver-threshold" name="feeWaiverThreshold" min="0" max="100" placeholder="Enter Threshold" required>
            </div>
            <div class="form-actions">
                <button type="submit" class="landlord-btn save-btn">Create Offer</button>
                <button type="button" class="landlord-btn cancel-btn">Cancel</button>
            </div>
        </form>
    `;

    document.querySelector(".cancel-btn").addEventListener("click", () => {
        fetchUnitOffers(unitID); // Go back to the unit's offer list
    });

    document.getElementById("create-offer-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const rentAmount = parseFloat(document.getElementById("rent-amount").value);
        const applicationFee = parseFloat(document.getElementById("application-fee").value);
        const feeWaiverThreshold = parseInt(document.getElementById("fee-waiver-threshold").value);

        try {
            const response = await fetch(`/api/units/${unitID}/offers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    RentAmount: rentAmount,
                    ApplicationFee: applicationFee,
                    FeeWaiverThreshold: feeWaiverThreshold,
                }),
            });

            if (response.ok) {
                alert("Offer created successfully!");
                fetchUnitOffers(unitID); // Reload offers for this unit
            } else {
                const errorText = await response.text();
                console.error("Error creating offer:", errorText);
                alert("Failed to create offer. Please try again.");
            }
        } catch (error) {
            console.error("Error creating offer:", error);
            alert("An unexpected error occurred. Please try again.");
        }
    });
}


function renderOfferDetails(offer) {
    const detailsSection = document.querySelector('.offers-section');
    detailsSection.innerHTML = `
        <h3>Offer Dashboard</h3>
        <div class="offer-details-dashboard">
            <div class="pricing-info">
                <h4>Pricing Breakdown</h4>
                <p><strong>Rent Amount:</strong> $${offer.RentAmount ? offer.RentAmount.toFixed(2) : 'TBD'}</p>
                <p><strong>Application Fee:</strong> $${offer.ApplicationFee ? offer.ApplicationFee.toFixed(2) : 'TBD'}</p>
                <p><strong>Security Deposit:</strong> TBD</p>
                <p><strong>Broker Fee:</strong> TBD</p>
                <p><strong>Pet Rent:</strong> TBD</p>
                <p><strong>Pet Deposit:</strong> TBD</p>
                <p><strong>Pro-Rata Enabled:</strong> TBD</p>
            </div>
            <div class="custom-fees-info">
                <h4>Custom Fees</h4>
                <p><strong>Custom Fees:</strong> TBD</p>
            </div>
            <div class="incentives-info">
                <h4>Incentives for Qualified Tenants</h4>
                ${renderIncentives(offer.incentives)}
            </div>
            <div class="future-metrics">
                <h4>Future Metrics</h4>
                <p><em>TBD</em></p>
            </div>
            <div class="actions">
                <h4>Actions</h4>
                <button id="edit-offer-btn" class="landlord-btn">Edit Offer</button>
                <button id="deactivate-offer-btn" class="landlord-btn">Deactivate Offer</button>
            </div>
        </div>
    `;

    // Event listeners for actions
    document.getElementById('edit-offer-btn').addEventListener('click', () => renderBasicRentSetup(offer));
    document.getElementById('deactivate-offer-btn').addEventListener('click', () => deactivateOffer(offer.OfferID));
}

function renderIncentives(incentives) {
    if (!incentives || incentives.length === 0) {
        return '<p>No incentives available.</p>';
    }

    return incentives
        .map(incentive => {
            if (incentive.BenefitType === 'ApplicationFee') {
                return `
                    <p><strong>Fee Waiver:</strong> Tenants with a Strength Score of ${incentive.StrengthScoreThreshold} or higher 
                    have their application fee of $${incentive.BenefitValue.toFixed(2)} waived.</p>
                `;
            }
            return '';
        })
        .join('');
}

// Multi-step navigation state
let editOfferState = {
    RentAmount: null,
    SecurityDepositAmount: null,
    BrokerFee: null,
    BrokerFeeType: 'flat', // or 'months'
    PaymentSchedule: [],
    LateFees: null,
    CustomFees: [],
    TierIncentives: null,
    TierAdjustedDeposit: null,
    EarlyTerminationPenalty: null,
};

function renderBasicRentSetup(offer) {
    const detailsSection = document.querySelector('.offers-section');
    detailsSection.innerHTML = `
        <h3>Edit Offer</h3>
        <form id="edit-offer-form">
            <div class="form-group">
                <label for="rent-amount">Rent Amount</label>
                <input type="number" id="rent-amount" name="rentAmount" value="${offer.RentAmount}" required>
            </div>
            <div class="form-group">
                <label for="application-fee">Application Fee</label>
                <input type="number" id="application-fee" name="applicationFee" value="${offer.ApplicationFee}" required>
            </div>
            <div class="form-group">
                <label for="fee-waiver-threshold">Fee Waiver Threshold (0-100)</label>
                <input type="number" id="fee-waiver-threshold" name="feeWaiverThreshold" value="${offer.FeeWaiverThreshold || 0}" min="0" max="100" required>
            </div>
            <button type="submit" class="landlord-btn">Save Offer</button>
        </form>
    `;

    document.getElementById('edit-offer-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const rentAmount = parseFloat(document.getElementById('rent-amount').value);
        const applicationFee = parseFloat(document.getElementById('application-fee').value);
        const feeWaiverThreshold = parseInt(document.getElementById('fee-waiver-threshold').value);

        try {
            const response = await fetch(`/api/offers/${offer.OfferID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ RentAmount: rentAmount, ApplicationFee: applicationFee, FeeWaiverThreshold: feeWaiverThreshold }),
            });

            if (response.ok) {
                alert('Offer updated successfully.');
                fetchUnitOffers(offer.UnitID); // Reload offers for the unit
            } else {
                alert('Failed to update offer.');
            }
        } catch (error) {
            console.error('Error updating offer:', error);
        }
    });
}

function renderPaymentAndFeesSetup(offer) {
    const detailsSection = document.querySelector('.offers-section');
    detailsSection.innerHTML = `
        <h3>Payment and Fees Setup</h3>
        <form id="payment-fees-form">
            <div class="form-group">
                <label for="late-fees">Late Fees</label>
                <input type="number" id="late-fees" name="lateFees" value="${editOfferState.LateFees || ''}">
            </div>
            <div class="form-group">
                <label for="custom-fees">Custom Fees</label>
                <textarea id="custom-fees" name="customFees">${editOfferState.CustomFees.join(', ') || ''}</textarea>
                <small>Enter fees as a comma-separated list (e.g., Cleaning Fee - $200, Key Replacement - $50).</small>
            </div>
            <div class="form-actions">
                <button type="button" class="landlord-btn prev-btn">Previous</button>
                <button type="button" class="landlord-btn next-btn">Next</button>
            </div>
        </form>
    `;

    document.querySelector('.prev-btn').addEventListener('click', () => {
        renderBasicRentSetup(offer);
    });

    document.querySelector('.next-btn').addEventListener('click', () => {
        const form = document.getElementById('payment-fees-form');
        editOfferState = {
            ...editOfferState,
            LateFees: parseFloat(form.lateFees.value) || null,
            CustomFees: form.customFees.value ? form.customFees.value.split(',').map(fee => fee.trim()) : [],
        };
        renderTenantIncentivesSetup(offer);
    });
}

function renderTenantIncentivesSetup(offer) {
    const detailsSection = document.querySelector('.offers-section');
    detailsSection.innerHTML = `
        <h3>Tenant Incentives Setup</h3>
        <form id="tenant-incentives-form">
            <div class="form-group">
                <label for="tier-incentives">Incentives for Qualified Tenants</label>
                <textarea id="tier-incentives" name="tierIncentives">${editOfferState.TierIncentives || ''}</textarea>
                <small>Describe incentives (e.g., First Month Free, Reduced Deposit).</small>
            </div>
            <div class="form-group">
                <label for="early-termination-penalty">Early Termination Penalty</label>
                <input type="number" id="early-termination-penalty" name="earlyTerminationPenalty" value="${editOfferState.EarlyTerminationPenalty || ''}">
            </div>
            <div class="form-actions">
                <button type="button" class="landlord-btn prev-btn">Previous</button>
                <button type="submit" class="landlord-btn save-btn">Save</button>
            </div>
        </form>
    `;

    document.querySelector('.prev-btn').addEventListener('click', () => {
        renderPaymentAndFeesSetup(offer);
    });

    document.getElementById('tenant-incentives-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        editOfferState = {
            ...editOfferState,
            TierIncentives: document.getElementById('tier-incentives').value || null,
            EarlyTerminationPenalty: parseFloat(document.getElementById('early-termination-penalty').value) || null,
        };
        await saveOffer(offer.UnitID, offer);
    });
}



async function saveOffer(unitID, existingOffer) {
    const endpoint = existingOffer ? `/api/offers/${existingOffer.OfferID}` : `/api/units/${unitID}/offers`;

    try {
        const response = await fetch(endpoint, {
            method: existingOffer ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                RentAmount: editOfferState.RentAmount,
                AvailabilityStatus: 1, // Assuming the offer is set to active when edited
                StartDate: editOfferState.StartDate || new Date().toISOString(),
                EndDate: editOfferState.EndDate || null,
                FirstMonthUpfront: editOfferState.FirstMonthUpfront || 0,
                LastMonthUpfront: editOfferState.LastMonthUpfront || 0,
                SecurityDepositAmount: editOfferState.SecurityDepositAmount || 0,
                BrokerFee: editOfferState.BrokerFee || 0,
                PetRent: editOfferState.PetRent || 0,
                PetDeposit: editOfferState.PetDeposit || 0,
                CustomFees: editOfferState.CustomFees ? editOfferState.CustomFees.join(', ') : null,
                Tier: editOfferState.Tier || null,
                TierAdjustedDeposit: editOfferState.TierAdjustedDeposit || 0,
                TierIncentives: editOfferState.TierIncentives || null,
                EarlyTerminationPenalty: editOfferState.EarlyTerminationPenalty || 0,
                ProRataEnabled: editOfferState.ProRataEnabled || 0,
                RenewalTerms: editOfferState.RenewalTerms || null,
                UpdatedBy: "System", // Replace with actual user ID if available
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Error saving offer:', error);
            alert('Failed to save changes. Please try again.');
            return;
        }

        alert('Offer saved successfully.');
        fetchUnitOffers(unitID); // Refresh the offers list
    } catch (error) {
        console.error('Error saving offer:', error);
        alert('An unexpected error occurred. Please try again.');
    }
}




async function deactivateOffer(offerID) {
    try {
        const response = await fetch(`/api/offers/${offerID}/deactivate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
            alert("Offer deactivated successfully.");
            renderOffers(); // Refresh the offers list
        } else {
            console.error("Failed to deactivate offer:", await response.text());
        }
    } catch (error) {
        console.error("Error deactivating offer:", error);
    }
}




