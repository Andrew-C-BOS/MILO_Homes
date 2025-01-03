import { navigateTo } from "../router.js";

export function renderHomeView() {
    const content = document.getElementById("content");
    content.innerHTML = `
        <div class="home-container">
            <h1>Welcome to MILO Homes</h1>
            <p>Your trusted solution for tenants and landlords.</p>
            <button id="tenant-btn">View Tenant Page</button>
            <button id="landlord-btn">View Landlord Page</button>
        </div>
    `;

    // Attach event listeners programmatically
    document.getElementById("tenant-btn").addEventListener("click", () => navigateTo("tenant"));
    document.getElementById("landlord-btn").addEventListener("click", () => navigateTo("landlord"));
}
