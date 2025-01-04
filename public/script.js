import { navigateTo } from "./router.js";
import { setupAuthModal } from "./components/authModal.js";
const API_BASE_URL = window.API_BASE_URL || '';

document.addEventListener("DOMContentLoaded", async () => {
    console.log("MILO Homes Loaded!");

    setupHeader();
    setupAuthModal();
    await checkLoginStatus();
});

// Handles header-specific logic like logout
function setupHeader() {
    const logoutBtn = document.getElementById("logout-btn");

    logoutBtn.addEventListener("click", async () => {
        try {
            const response = await fetch("${API_BASE_URL}/api/logout", { method: "POST", credentials: "include" });

            if (response.ok) {
                alert("Logged out successfully.");
                resetUIForLoggedOutUser();
                navigateTo("home");
            } else {
                throw new Error("Logout failed");
            }
        } catch (error) {
            console.error("Error during logout:", error);
        }
    });
}

// Checks login status and redirects appropriately
async function checkLoginStatus() {
    try {
        const response = await fetch("${API_BASE_URL}/api/user-data", {
            method: "GET",
            credentials: "include",
        });

        if (response.ok) {
            const data = await response.json();
            console.log("User data retrieved:", data);
            updateUIForLoggedInUser(data.user);
        } else {
            console.error("User not logged in:", response.status);
            resetUIForLoggedOutUser();
        }
    } catch (error) {
        console.error("Error in checkLoginStatus:", error.message);
    }
}



// Updates UI for logged-in users
function updateUIForLoggedInUser(user) {
    const loginBtn = document.getElementById("login-btn");
    const userInfo = document.getElementById("user-info");
    const userName = document.getElementById("user-name");
	
	console.log(user);
	
    loginBtn.classList.add("hidden");
    userInfo.classList.remove("hidden");
    userName.textContent = `Hello, ${user.username}`;
	sessionStorage.setItem('userID', user.userId);

    // Navigate to appropriate view
    if (user.userType === "TENANT") {
        navigateTo("tenant");
    } else if (user.userType === "LANDLORD") {
        navigateTo("landlord");
    } else {
        console.error("Unknown user type:", user.userType);
    }
}

// Resets UI for logged-out users
function resetUIForLoggedOutUser() {
    const loginBtn = document.getElementById("login-btn");
    const userInfo = document.getElementById("user-info");

    loginBtn.classList.remove("hidden");
    userInfo.classList.add("hidden");
}
