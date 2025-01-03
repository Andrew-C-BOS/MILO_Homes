export function setupAuthModal() {
    const authModal = document.getElementById("auth-modal");
    const loginForm = document.getElementById("login-form");
    const registerStep1 = document.getElementById("register-form-step-1");
    const registerStep2 = document.getElementById("register-form-step-2");
    const switchToRegister = document.getElementById("switch-to-register");
    const switchToLogin = document.getElementById("switch-to-login");
    const nextStepBtn = document.getElementById("continue-to-step-2");
    const backStepBtn = document.getElementById("back-to-step-1");
    const userTypeField = document.getElementById("register-user-type");
    const tenantSubmitButton = document.getElementById("submit-tenant");
	const landlordSubmitButton = document.getElementById("submit-landlord");
    let registrationData = {};

    // Open login modal
    document.getElementById("login-btn").addEventListener("click", () => {
        authModal.classList.remove("hidden");
        loginForm.classList.remove("hidden");
        registerStep1.classList.add("hidden");
        registerStep2.classList.add("hidden");
    });

    // Close modal
    document.getElementById("close-modal").addEventListener("click", () => {
        authModal.classList.add("hidden");
    });

    // Switch to Register Mode
    switchToRegister.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.classList.add("hidden");
        registerStep1.classList.remove("hidden");
    });

    // Switch to Login Mode
    switchToLogin.addEventListener("click", (e) => {
        e.preventDefault();
        registerStep1.classList.add("hidden");
        loginForm.classList.remove("hidden");
    });

    // Handle user type selection
    userTypeField.addEventListener("change", () => {
        if (userTypeField.value === "LANDLORD") {
            nextStepBtn.classList.remove("hidden");
            tenantSubmitButton.classList.add("hidden");
        } else {
            nextStepBtn.classList.add("hidden");
            tenantSubmitButton.classList.remove("hidden");
        }
    });

    // Navigate to Step 2 for landlords
    nextStepBtn.addEventListener("click", () => {
        const username = document.getElementById("register-username").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value.trim();

        if (!username || !email || !password) {
            alert("Please fill out all fields.");
            return;
        }

        registrationData = { username, email, password, userType: userTypeField.value };

        registerStep1.classList.add("hidden");
        registerStep2.classList.remove("hidden");
    });

    // Back to Step 1
    backStepBtn.addEventListener("click", () => {
        registerStep2.classList.add("hidden");
        registerStep1.classList.remove("hidden");
    });

    // Submit Registration for landlords
	registerStep2.addEventListener("submit", async (e) => {
		e.preventDefault();
		const phoneNumber = document.getElementById("register-phone-number").value.trim();

		if (!phoneNumber) {
			alert("Please enter your phone number.");
			return;
		}

		registrationData.phoneNumber = phoneNumber;
		await submitRegistration(registrationData);
	});

	// Submit Registration for tenants
	registerStep1.addEventListener("submit", async (e) => {
		e.preventDefault();
		const username = document.getElementById("register-username").value.trim();
		const email = document.getElementById("register-email").value.trim();
		const password = document.getElementById("register-password").value.trim();
		const userType = userTypeField.value;

		const requestData = { username, email, password, userType };
		await submitRegistration(requestData);
	});
	
	document.getElementById("login-form").addEventListener("submit", async (e) => {
		e.preventDefault(); // Prevent default form submission
		const username = document.getElementById("login-username").value.trim();
		const password = document.getElementById("login-password").value.trim();

		if (!username || !password) {
			alert("Username and password are required.");
			return;
		}

		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
				credentials: "include",
			});

			const result = await response.json();

			if (response.ok) {
				alert("Login successful!");
				document.getElementById("auth-modal").classList.add("hidden");
				location.reload();// Refresh to reflect logged-in state
			} else {
				alert(result.error || "Login failed.");
			}
		} catch (error) {
			console.error("Error during login:", error);
			alert("An error occurred. Please try again.");
		}
	});



    async function submitRegistration(data) {
        const endpoint = data.userType === "LANDLORD" ? "/api/register" : "/api/register";

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                authModal.classList.add("hidden");
                location.reload(); // Reload the page to update login status
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error during registration:", error);
        }
    }
}
