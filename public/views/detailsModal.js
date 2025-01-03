export function showPropertyDetails(details) {
    const modal = document.getElementById("details-modal");
    document.getElementById("details-title").textContent = details.Address;
    document.getElementById("details-address").textContent = `${details.City}, ${details.State}`;
    document.getElementById("details-description").textContent = details.Description;
    modal.classList.remove("hidden");

    document.getElementById("close-details-modal").onclick = () => {
        modal.classList.add("hidden");
    };
}
