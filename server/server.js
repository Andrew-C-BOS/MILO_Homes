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

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
console.log('Backend URL:', backendUrl);
// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = ['http://localhost:3000','https://milo-homes.vercel.app/']; // Replace with your Vercel app domain

app.options('*', cors());

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET, // Replace with a secure secret
    resave: false, // Avoid saving the session back to the store if it hasn't been modified
    saveUninitialized: false, // Only create sessions when necessary
    cookie: {
        httpOnly: true, // Prevents JavaScript access to cookies
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 60 * 60 * 1000, // 1 hour session lifetime
    },
}));

// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Apply CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps) or explicitly allowed origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies and credentials
}));

app.use((req, res, next) => {
    //console.log('Session:', req.session);
	console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

// Serve index.html at the root route (/)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/config.js', (req, res) => {
	let LocalUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
	console.log(LocalUrl);
    res.type('application/javascript');
    res.send(`window.API_BASE_URL = "${LocalUrl}";`);
});


// Routes
app.use('/test-connection', testConnectionRoutes);

// Use API routes from the routes folder
app.use('/api', apiRoutes);

// Start the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
