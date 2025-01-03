const axios = require('axios');

async function geocodeAddress(address, city, state, zipCode) {
    const country = "US"; // Hardcoded country
    const url = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&postalcode=${encodeURIComponent(zipCode)}&country=${encodeURIComponent(country)}&format=json&addressdetails=1`;

    console.log('Geocoding URL:', url); // Log the URL for debugging

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'MiloHomes/1.0 (milo@example.com)' // Replace with your app details
            }
        });

        if (response.data && response.data.length > 0) {
            const { lat, lon } = response.data[0];
            return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
        } else {
            throw new Error('No results found for the given address');
        }
    } catch (error) {
        console.error('Error during geocoding:', error.message);
        throw new Error('Failed to geocode address');
    }
}


module.exports = { geocodeAddress };