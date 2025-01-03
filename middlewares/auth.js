const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    const token = req.cookies.authToken;
    //console.log("Token from cookie:", token);

    if (!token) {
        console.error("No token provided.");
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        //console.log("Verified token payload:", verified);
        req.user = verified; // Attach user data to request
        next();
    } catch (err) {
        console.error("Token verification error:", err.message);
        res.status(403).json({ error: "Invalid or expired token." });
    }
};


module.exports = authenticateToken;