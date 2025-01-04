require("dotenv").config();

const express = require('express');
const session = require('express-session'); // Import express-session
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require('path'); // Import the 'path' module
const apiRoutes = require('../routes/api');
const testConnectionRoutes = require('../routes/testConnection.js');
const cors = require('cors');

// Set the backend URL (for config.js)
const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
console.log('Backend URL:', backendUrl);

// Define allowed origins for CORS
const allowedOrigins = [
    'http://localhost:3000', // Local development
    'https://milo-homes.vercel.app', // Your Vercel frontend
];

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply CORS middleware (BEFORE any routes)
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests from allowed origins or with no origin (e.g., Postman)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies and credentials
}));

// Handle preflight (OPTIONS) requests globally
app.options('*', cors());

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET, // Replace with a secure secret
    resave: false, // Avoid saving unmodified sessions
    saveUninitialized: false, // Only create sessions when necessary
    cookie: {
        httpOnly: true, // Prevent JavaScript access to cookies
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 60 * 60 * 1000, // 1 hour session lifetime
    },
}));

// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Log incoming requests
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

// Serve index.html at the root route (/)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve dynamic config.js
app.get('/config.js', (req, res) => {
    console.log('Serving config.js with backend URL:', backendUrl);
    res.type('application/javascript');
    res.send(`window.API_BASE_URL = "${backendUrl}";`);
});

// Routes
app.use('/test-connection', testConnectionRoutes);
app.use('/api', apiRoutes);

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
