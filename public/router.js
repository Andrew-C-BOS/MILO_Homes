import { renderHomeView } from "./views/homeView.js";
import { renderTenantView } from "./views/tenantView.js";
import { renderLandlordDashboard } from "./views/landlordView.js";
import { renderPage } from "./views/listings.js"; 
import { initOffersPage } from "./views/Offers.js";


const routes = {
    home: renderHomeView,
	tenant: renderTenantView,
    landlord: renderLandlordDashboard,
    manageProperties: renderPage,
	manageOffers: initOffersPage,
};

// Navigate to a route
function navigateTo(route) {
	console.log(route);
    const viewFunction = routes[route];
    if (viewFunction) {
        viewFunction(); // Render the appropriate view
        history.pushState({ route }, "", `#${route}`);
    } else {
        console.error(`Route "${route}" not found`);
    }
}

// Handle back/forward navigation
// On page load, check the URL hash
window.addEventListener("DOMContentLoaded", () => {
    const route = location.hash.replace("#", "") || "home"; // Default to "landlord"
    const viewFunction = routes[route];
    if (viewFunction) {
        viewFunction();
    }
});

// Handle back/forward navigation
window.addEventListener("popstate", (e) => {
    const route = e.state?.route || "home"; // Default to "landlord"
    const viewFunction = routes[route];
    if (viewFunction) {
        viewFunction();
    }
});

export { navigateTo };
