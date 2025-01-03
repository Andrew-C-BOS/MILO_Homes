import { navigateTo } from "./router.js";


document.addEventListener("DOMContentLoaded", () => {
    console.log("Welcome to MILO Homes!");

    // Initialize the application to the home view
    navigateTo("home");

    // Example: Add event listeners for navigation if needed
    // document.getElementById("nav-home").addEventListener("click", () => navigateTo("home"));
    // document.getElementById("nav-lease").addEventListener("click", () => navigateTo("lease"));
});


document.addEventListener("DOMContentLoaded", async () => {
    console.log("Welcome to Milo Homes Prototype!");

    // DOM Elements
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userInfo = document.getElementById("user-info");
    const userName = document.getElementById("user-name");
    const loginModal = document.getElementById("login-modal");
    const authForm = document.getElementById("auth-form");
    const toggleForm = document.querySelector("#toggle-form");

    // Check login status
    async function checkLoginStatus() {
        try {
            const response = await fetch("/api/user-data", {
                method: "GET",
                credentials: "include", // Include cookies
            });

            if (response.ok) {
                const data = await response.json();
                console.log("User data fetched:", data);

                // Update UI for logged-in user
                userInfo.classList.remove("hidden");
                userName.textContent = `Hello, ${data.user.username}`;
                loginBtn.classList.add("hidden");

                // Render user-specific view
                if (data.user.userType === "LANDLORD") {
                    renderLandlordView();
                } else if (data.user.userType === "TENANT") {
                    renderTenantView();
                } else {
                    console.error("Unknown user type:", data.user.userType);
                }
            } else {
                throw new Error("Not authenticated");
            }
        } catch (error) {
            console.log("User not logged in:", error.message);

            // Reset UI for logged-out state
            userInfo.classList.add("hidden");
            loginBtn.classList.remove("hidden");
            renderTenantView(); // Default to tenant view for logged-out users
        }
    }

    // Handle form toggling
    toggleForm.addEventListener("click", (e) => {
        e.preventDefault();

        const emailField = document.getElementById("email");
        const userTypeField = document.getElementById("user-type");
        const modalTitle = document.getElementById("modal-title");
        const isRegistering = !emailField.classList.contains("hidden");

        if (isRegistering) {
            // Switch to Login Mode
            emailField.classList.add("hidden");
            userTypeField.classList.add("hidden");
            modalTitle.textContent = "Login";
            toggleForm.innerHTML = `Don't have an account? <a href="#">Register</a>`;
        } else {
            // Switch to Register Mode
            emailField.classList.remove("hidden");
            userTypeField.classList.remove("hidden");
            modalTitle.textContent = "Register";
            toggleForm.innerHTML = `Already have an account? <a href="#">Login</a>`;
        }
    });

    // Open login modal
    loginBtn.addEventListener("click", () => {
        loginModal.classList.remove("hidden");
    });

    // Close login modal
    document.getElementById("close-modal").addEventListener("click", () => {
        loginModal.classList.add("hidden");
    });

    // Handle login/register form submission
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        const emailField = document.getElementById("email");
        const userTypeField = document.getElementById("user-type");

        const email = emailField.classList.contains("hidden") ? null : emailField.value.trim();
        const userType = userTypeField.classList.contains("hidden") ? null : userTypeField.value;

        const isRegistering = !emailField.classList.contains("hidden");

        const endpoint = isRegistering ? "/api/register" : "/api/login";
        const requestData = { username, password };
        if (isRegistering) {
            requestData.email = email;
            requestData.userType = userType;
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestData),
                credentials: "include", // Include cookies
            });
            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                loginModal.classList.add("hidden");
                await checkLoginStatus(); // Update UI after login
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error during login/register:", error);
        }
    });

    // Handle logout
    logoutBtn.addEventListener("click", async () => {
        try {
            const response = await fetch("/api/logout", {
                method: "POST",
                credentials: "include",
            });

            if (response.ok) {
                alert("Logged out successfully.");
                await checkLoginStatus(); // Reset UI after logout
            } else {
                throw new Error("Logout failed");
            }
        } catch (error) {
            console.error("Error during logout:", error);
            alert("Failed to log out.");
        }
    });

    // Initialize page
    await checkLoginStatus();
});

// Render tenant view
function renderTenantView() {
    const content = document.getElementById("content");
    content.innerHTML = `
        <h1>Tenant View</h1>
        <table id="properties-table">
            <thead>
                <tr>
                    <th>Address</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Bedrooms</th>
                    <th>Bathrooms</th>
                    <th>Description</th>
                    <th>Pet Policy</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
    // Fetch and populate tenant-specific data
    fetchProperties();
}

// Render landlord view
function renderLandlordView() {
    const content = document.getElementById("content");
    content.innerHTML = `<h1>Landlord View</h1>`;
    // Future: Add landlord-specific functionality here
}

// Fetch and populate properties
function fetchProperties() {
    fetch("/api/properties")
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to fetch properties");
            }
            return response.json();
        })
        .then((data) => populateTable(data))
        .catch((error) => console.error("Error:", error));
}

function populateTable(properties) {
    const tbody = document.querySelector("table tbody");
    tbody.innerHTML = ""; // Clear existing rows

    properties.forEach((property) => {
        const row = document.createElement("tr");
        row.setAttribute("data-id", property.PropertyID);
        row.innerHTML = `
            <td>${property.Address}</td>
            <td>${property.City}</td>
            <td>${property.State}</td>
            <td>${property.Bedrooms}</td>
            <td>${property.Bathrooms}</td>
            <td>${property.Description}</td>
            <td>${property.PetPolicy}</td>
        `;
        tbody.appendChild(row);
    });

    // Add event listener for clicks
    tbody.addEventListener("click", handleRowClick);
}

async function handleRowClick(event) {
    const row = event.target.closest("tr");
    if (!row) return;

    const propertyID = row.getAttribute("data-id");
    try {
        const response = await fetch(`/api/properties/${propertyID}/details`);
        if (!response.ok) throw new Error("Failed to fetch property details");

        const details = await response.json();
        showPropertyDetails(details); // Display in modal
    } catch (error) {
        console.error("Error fetching property details:", error);
    }
}

function showPropertyDetails(details) {
    const modal = document.getElementById("details-modal");
    const images = details.Images;
    let currentIndex = 0;

    document.getElementById("details-title").textContent = details.Address;
    document.getElementById("details-address").textContent = `${details.City}, ${details.State}, ${details.ZipCode}`;
    document.getElementById("details-description").textContent = details.Description;

    const updateImage = () => {
        const currentImage = images[currentIndex];
        document.getElementById("current-image").src = currentImage.ImageURL;
        document.getElementById("current-image").alt = currentImage.Caption || "Property Image";
        document.getElementById("image-caption").textContent = currentImage.Caption || "";
    };

    if (images && images.length > 0) {
        updateImage();
    } else {
        document.getElementById("current-image").src = "";
        document.getElementById("current-image").alt = "No images available";
        document.getElementById("image-caption").textContent = "No images available";
    }

    document.getElementById("prev-image").onclick = () => {
        if (images && images.length > 0) {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            updateImage();
        }
    };

    document.getElementById("next-image").onclick = () => {
        if (images && images.length > 0) {
            currentIndex = (currentIndex + 1) % images.length;
            updateImage();
        }
    };

    document.getElementById("close-details-modal").onclick = () => {
        modal.classList.add("hidden");
    };

    modal.classList.remove("hidden");
}

// Close details modal if clicking outside content
document.getElementById("close-details-modal").addEventListener("click", () => {
    const modal = document.getElementById("details-modal");
    modal.classList.add("hidden");
});

document.getElementById("details-modal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
        const modal = document.getElementById("details-modal");
        modal.classList.add("hidden");
    }
});
