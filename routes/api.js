const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const multer = require('multer');
const stream = require('stream');
const authenticateToken = require("../middlewares/auth");
const { geocodeAddress } = require('../middlewares/geocode'); // Import the geocoding function
const cloudinary = require('../config/cloudinary');
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const { poolPromise } = require('../server/db');
const storage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });

const GRID_SIZE = 0.025; // The same grid size used on the client


router.get("/properties", async (req, res) => {
    let { priceMin, priceMax, bedrooms, bathrooms, north, south, east, west } = req.query;
	console.log(req.query);
	console.log(`Coordinates Received:`);
    console.log(`North: ${north}, South: ${south}, East: ${east}, West: ${west}`);
	
	if( priceMin == 500 ){
		priceMin = 0
	}
	
	if( priceMax == 5000 ){
		priceMax = 1000000
	}
	
    try {
        const query = `
            SELECT 
                u.UnitID, u.UnitNumber, u.Bedrooms, u.Bathrooms, o.RentAmount AS Rent,
                b.BuildingID, b.Address, b.City, b.State, b.Latitude, b.Longitude
            FROM Units u
            INNER JOIN Buildings b ON u.BuildingID = b.BuildingID
            INNER JOIN Offers o ON u.UnitID = o.UnitID
            WHERE 1=1
            ${priceMin ? "AND o.RentAmount >= @priceMin" : ""}
            ${priceMax ? "AND o.RentAmount <= @priceMax" : ""}
            ${bedrooms ? "AND u.Bedrooms >= @bedrooms" : ""}
            ${bathrooms ? "AND u.Bathrooms >= @bathrooms" : ""}
            ${north && south && east && west ? `
                AND b.Latitude <= @north
                AND b.Latitude >= @south
                AND b.Longitude <= @east
                AND b.Longitude >= @west
            ` : ""}
        `;

        const pool = await poolPromise;
        const result = await pool.request()
            .input("priceMin", priceMin || null)
            .input("priceMax", priceMax || null)
            .input("bedrooms", bedrooms || null)
            .input("bathrooms", bathrooms || null)
            .input("north", north || null)
            .input("south", south || null)
            .input("east", east || null)
            .input("west", west || null)
            .query(query);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Error fetching properties:", error);
        res.status(500).json({ error: "Failed to fetch properties." });
    }
});




router.get("/user-data", authenticateToken, async (req, res) => {
    //console.log("Decoded user in /user-data:", req.user);
    try {
        const { userId, username, userType } = req.user;
        res.status(200).json({ user: { userId, username, userType } });
    } catch (error) {
        console.error("Error fetching user data:", error.message);
        res.status(500).json({ error: "Failed to retrieve user data." });
    }
});


router.post("/grid-properties", async (req, res) => {
  const { grids, priceMin, priceMax, bedrooms, bathrooms } = req.body;

  // Basic validation
  if (!Array.isArray(grids) || grids.length === 0) {
    return res
      .status(400)
      .json({ error: "Invalid or missing 'grids' array in request body." });
  }

  try {
    const pool = await poolPromise;

    // Convert empty strings to null for numeric filters
    const normalizedPriceMin =
      priceMin === "" ? null : priceMin != null ? Number(priceMin) : null;
    const normalizedPriceMax =
      priceMax === "" ? null : priceMax != null ? Number(priceMax) : null;
    const normalizedBedrooms =
      bedrooms === "" ? null : bedrooms != null ? Number(bedrooms) : null;
    const normalizedBathrooms =
      bathrooms === "" ? null : bathrooms != null ? Number(bathrooms) : null;

    // Object to store units keyed by grid ID:  { "latIndex,lngIndex": [...] }
    const unitsByGrid = {};

    // For each grid ID, compute bounding box and query
    for (const gridID of grids) {
      // Parse latIndex, lngIndex from "latIndex,lngIndex"
      const [latIndexStr, lngIndexStr] = gridID.split(",");
      const latIndex = Number(latIndexStr);
      const lngIndex = Number(lngIndexStr);

      // Calculate bounding box
      const south = latIndex * GRID_SIZE;
      const north = south + GRID_SIZE;
      const west = lngIndex * GRID_SIZE;
      const east = west + GRID_SIZE;

      // Build the WKT polygon for the bounding box
      // Order = (Longitude, Latitude) => (west, north) => X Y
      // Must be a closed polygon: first coordinate repeated at the end
      const polygonWKT = `
        POLYGON((
          ${west} ${north},
          ${east} ${north},
          ${east} ${south},
          ${west} ${south},
          ${west} ${north}
        ))
      `.trim();


      // Build the SQL query
      const query = `
        SELECT 
          u.UnitID,
          u.UnitNumber,
          u.Bedrooms,
          u.Bathrooms,
          o.RentAmount AS Rent,
          b.BuildingID,
          b.Address,
          b.City,
          b.State,
          b.Latitude,
          b.Longitude
        FROM Units u
        INNER JOIN Buildings b ON u.BuildingID = b.BuildingID
        INNER JOIN Offers o ON u.UnitID = o.UnitID
        WHERE b.Location.STWithin(
          geography::STPolyFromText(@polygonWKT, 4326)
        ) = 1
          AND (@priceMin IS NULL OR o.RentAmount >= @priceMin)
          AND (@priceMax IS NULL OR o.RentAmount <= @priceMax)
          AND (@bedrooms IS NULL OR u.Bedrooms >= @bedrooms)
          AND (@bathrooms IS NULL OR u.Bathrooms >= @bathrooms)
      `;

      // Prepare the SQL request
      const request = pool.request();
      request.input("polygonWKT", sql.NVarChar, polygonWKT);

      if (normalizedPriceMin != null) {
        request.input("priceMin", sql.Decimal(10, 2), normalizedPriceMin);
      }
      if (normalizedPriceMax != null) {
        request.input("priceMax", sql.Decimal(10, 2), normalizedPriceMax);
      }
      request.input("bedrooms", sql.Decimal(3, 1), normalizedBedrooms);
	  request.input("bathrooms", sql.Decimal(3, 1), normalizedBathrooms);

      // Execute the query
      const result = await request.query(query);


      // Store the result in our unitsByGrid object
      unitsByGrid[gridID] = result.recordset;
    }

    res.status(200).json({ unitsByGrid });
  } catch (error) {
    console.error("Error in /api/grid-properties:", error);
    res.status(500).json({ error: "Failed to fetch grid properties." });
  }
});


/*router.get("/properties/:id/details", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("PropertyID", id)
            .query(`
                SELECT 
                    p.PropertyID, 
                    p.Address, 
                    p.City, 
                    p.State, 
                    p.ZipCode, 
                    d.Description, 
                    i.ImageURL, 
                    i.Caption
                FROM 
                    Properties p
                JOIN 
                    PropertyDetails d ON p.PropertyID = d.PropertyID
                LEFT JOIN 
                    Images i ON p.PropertyID = i.PropertyID
                WHERE 
                    p.PropertyID = @PropertyID;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Property not found" });
        }

        // Group images together
        const property = {
            PropertyID: result.recordset[0].PropertyID,
            Address: result.recordset[0].Address,
            City: result.recordset[0].City,
            State: result.recordset[0].State,
            ZipCode: result.recordset[0].ZipCode,
            Description: result.recordset[0].Description,
            Images: result.recordset.map(record => ({
                ImageURL: record.ImageURL,
                Caption: record.Caption
            }))
        };

        res.status(200).json(property);
    } catch (error) {
        console.error("Error fetching property details:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});*/

router.get("/offers/:id/details", async (req, res) => {
    const { id } = req.params; // OfferID

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("OfferID", id)
            .query(`
                SELECT 
                    o.OfferID,
                    o.RentAmount,
                    o.AvailabilityStatus,
                    o.StartDate,
                    o.EndDate,
                    u.UnitNumber,
                    u.Bedrooms,
                    u.Bathrooms,
                    u.PropertyType,
                    b.Address,
                    b.City,
                    b.State,
                    b.ZipCode,
                    d.Description,
                    d.PetPolicy,
                    d.Parking,
                    i.ImageURL,
                    i.Caption
                FROM Offers o
                JOIN Units u ON o.UnitID = u.UnitID
                JOIN Buildings b ON u.BuildingID = b.BuildingID
                JOIN PropertyDetails d ON u.UnitID = d.UnitID
                LEFT JOIN Images i ON u.UnitID = i.UnitID
                WHERE o.OfferID = @OfferID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Offer not found" });
        }

        // Process and structure the images
        const images = result.recordset
            .filter(record => record.ImageURL) // Include only rows with images
            .map(record => ({
                ImageURL: record.ImageURL,
                Caption: record.Caption || "No caption available",
            }));

        // Extract unique details (excluding redundant image rows)
        const offerDetails = result.recordset[0];
        const response = {
            OfferID: offerDetails.OfferID,
            RentAmount: offerDetails.RentAmount,
            AvailabilityStatus: offerDetails.AvailabilityStatus,
            StartDate: offerDetails.StartDate,
            EndDate: offerDetails.EndDate,
            UnitNumber: offerDetails.UnitNumber,
            Bedrooms: offerDetails.Bedrooms,
            Bathrooms: offerDetails.Bathrooms,
            PropertyType: offerDetails.PropertyType,
            Address: offerDetails.Address,
            City: offerDetails.City,
            State: offerDetails.State,
            ZipCode: offerDetails.ZipCode,
            Description: offerDetails.Description,
            PetPolicy: offerDetails.PetPolicy,
            Parking: offerDetails.Parking,
            Images: images,
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching offer details:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});




router.post("/register", async (req, res) => {
    const { username, password, email, userType, phoneNumber } = req.body;

    // Validate inputs
    if (!username || !password || !email || !userType) {
        return res.status(400).json({ error: "All fields are required." });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format." });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const pool = await poolPromise;

        // Begin Transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Insert into Users Table
            const userResult = await transaction.request()
                .input("Username", username)
                .input("PasswordHash", hashedPassword)
                .input("Email", email)
                .input("UserType", userType)
                .query(`
                    INSERT INTO Users (Username, PasswordHash, Email, UserType)
                    OUTPUT inserted.UserID
                    VALUES (@Username, @PasswordHash, @Email, @UserType)
                `);

            const userId = userResult.recordset[0].UserID;

            // If UserType is LANDLORD, Insert into Landlords Table
            if (userType === "LANDLORD") {
                if (!phoneNumber) {
                    throw new Error("Phone number is required for landlords.");
                }

                await transaction.request()
                    .input("Name", username)
                    .input("PhoneNumber", phoneNumber)
                    .input("Email", email)
                    .query(`
                        INSERT INTO Landlords (Name, PhoneNumber, Email)
                        VALUES (@Name, @PhoneNumber, @Email)
                    `);
            }

            // Commit Transaction
            await transaction.commit();
            res.status(201).json({ message: "User registered successfully." });
        } catch (error) {
            await transaction.rollback();
            console.error("Transaction error:", error.message);
            res.status(500).json({ error: "Failed to register user." });
        }
    } catch (error) {
        console.error("Registration error:", error.message);
        res.status(500).json({ error: "Failed to register user." });
    }
});


router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("Username", username)
            .query(`
                SELECT UserID, PasswordHash, UserType FROM Users WHERE Username = @Username
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = result.recordset[0];
        const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid password." });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.UserID, username, userType: user.UserType },
            process.env.JWT_SECRET,
            { expiresIn: "7d" } // Token valid for 7 days
        );

        // Set the JWT in a secure HTTP-only cookie
        res.cookie("authToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // Use secure cookies in production
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json({ message: "Login successful." });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Failed to log in." });
    }
});

router.post("/logout", (req, res) => {
    res.clearCookie("authToken");
    res.status(200).json({ message: "Logged out successfully." });
});

/*router.post('/upload', upload.single('image'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Upload image to Cloudinary
        const result = await cloudinary.uploader.upload_stream(
            { folder: 'properties' }, // Organize images in a specific folder
            (error, result) => {
                if (error) throw error;
                res.status(200).json({ url: result.secure_url });
            }
        ).end(file.buffer); // Send file buffer to Cloudinary
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});*/

/*router.post("/properties", async (req, res) => {
    const {
        address,
        city,
        state,
        zipCode,
        rentAmount,
        bedrooms,
        bathrooms,
        squareFeet,
        unitNumber,
        propertyType,
        petPolicy,
        parking,
        description,
        landlordID
    } = req.body;

    if (!address || !city || !state || !zipCode || !rentAmount || !bedrooms || !bathrooms || !landlordID) {
        return res.status(400).json({ error: "Required fields are missing." });
    }

    try {
        const pool = await poolPromise;
        const transaction = pool.transaction();

        await transaction.begin();

        try {
            // Insert into Properties table
            const propertyResult = await transaction.request()
                .input("Address", address)
                .input("City", city)
                .input("State", state)
                .input("ZipCode", zipCode)
                .input("RentAmount", rentAmount)
                .input("Bedrooms", bedrooms)
                .input("Bathrooms", bathrooms)
                .input("SquareFeet", squareFeet || null)
                .input("AvailabilityStatus", 1) // Default to "Available"
                .input("DateListed", new Date())
                .input("LandlordID", landlordID)
                .input("UnitNumber", unitNumber || null)
                .input("PropertyType", propertyType || "Apartment") // Default to "Apartment"
                .query(`
                    INSERT INTO Properties (
                        Address, City, State, ZipCode, RentAmount, Bedrooms, Bathrooms, SquareFeet, 
                        AvailabilityStatus, DateListed, LandlordID, UnitNumber, PropertyType
                    )
                    OUTPUT inserted.PropertyID
                    VALUES (
                        @Address, @City, @State, @ZipCode, @RentAmount, @Bedrooms, @Bathrooms, @SquareFeet, 
                        @AvailabilityStatus, @DateListed, @LandlordID, @UnitNumber, @PropertyType
                    )
                `);

            const propertyID = propertyResult.recordset[0].PropertyID;

            // Insert into PropertyDetails table
            await transaction.request()
                .input("PropertyID", propertyID)
                .input("PetPolicy", petPolicy || "Unknown") // Default to "Unknown"
                .input("Parking", parking || "None") // Default to "None"
                .input("Description", description || "")
                .query(`
                    INSERT INTO PropertyDetails (PropertyID, PetPolicy, Parking, Description)
                    VALUES (@PropertyID, @PetPolicy, @Parking, @Description)
                `);

            // Commit transaction
            await transaction.commit();

            res.status(201).json({ message: "Property created successfully.", propertyID });
        } catch (error) {
            await transaction.rollback();
            console.error("Transaction error:", error);
            res.status(500).json({ error: "Failed to create property." });
        }
    } catch (error) {
        console.error("Database connection error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});*/

router.get("/offers", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`
                SELECT 
                    o.OfferID,
                    o.RentAmount,
                    o.AvailabilityStatus,
                    o.StartDate,
                    o.EndDate,
                    u.UnitNumber,
                    u.Bedrooms,
                    u.Bathrooms,
                    u.PropertyType,
                    b.Address,
                    b.City,
                    b.State
                FROM Offers o
                JOIN Units u ON o.UnitID = u.UnitID
                JOIN Buildings b ON u.BuildingID = b.BuildingID
                WHERE o.AvailabilityStatus = 1
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching offers:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.post("/units/:unitID/offers", authenticateToken, async (req, res) => {
    const { unitID } = req.params;
    const { RentAmount, ApplicationFee, FeeWaiverThreshold } = req.body;

    if (!RentAmount || !ApplicationFee) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        const pool = await poolPromise;

        // Insert the new offer
        const result = await pool.request()
            .input("UnitID", unitID)
            .input("RentAmount", RentAmount)
            .input("ApplicationFee", ApplicationFee)
            .query(`
                INSERT INTO Offers (UnitID, RentAmount, ApplicationFee, CreatedAt)
                OUTPUT INSERTED.OfferID
                VALUES (@UnitID, @RentAmount, @ApplicationFee, GETDATE())
            `);

        const newOfferID = result.recordset[0].OfferID;

        // Add the Fee Waiver incentive if provided
        if (FeeWaiverThreshold) {
            await pool.request()
                .input("OfferID", newOfferID)
                .input("StrengthScoreThreshold", FeeWaiverThreshold)
                .input("BenefitValue", ApplicationFee)
                .query(`
                    INSERT INTO ApplicationBenefits (OfferID, StrengthScoreThreshold, BenefitType, BenefitValue, CreatedAt)
                    VALUES (@OfferID, @StrengthScoreThreshold, 'ApplicationFee', @BenefitValue, GETDATE())
                `);
        }

        res.status(201).json({ message: "Offer created successfully.", OfferID: newOfferID });
    } catch (error) {
        console.error("Error creating offer:", error);
        res.status(500).json({ error: "Failed to create offer." });
    }
});

router.post("/units/:unitID/images", upload.array("images"), async (req, res) => {
    const { unitID } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
    }

    try {
        const pool = await poolPromise;

        const uploadedImages = [];
        for (const file of files) {
            console.log("Uploading file to Cloudinary...", file.originalname);

            // Upload image to Cloudinary
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "unit_images" },
                    (error, result) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(result);
                        }
                    }
                );

                const bufferStream = new stream.PassThrough();
                bufferStream.end(file.buffer);
                bufferStream.pipe(uploadStream);
            });

            console.log("Cloudinary Upload Result:", result);

            // Save image metadata in the database
            const dbResult = await pool.request()
                .input("UnitID", sql.Int, unitID)
                .input("ImageURL", sql.NVarChar, result.secure_url)
                .input("Caption", sql.NVarChar, "Temp") // Default caption
                .query(`
                    INSERT INTO Images (UnitID, ImageURL, Caption)
                    VALUES (@UnitID, @ImageURL, @Caption)
                `);

            uploadedImages.push({ ImageID: dbResult.insertId, ImageURL: result.secure_url });
        }

        res.status(201).json({
            message: "Images uploaded successfully.",
            uploadedImages,
        });
    } catch (error) {
        console.error("Error uploading images:", error);
        res.status(500).json({ error: "Failed to upload images." });
    }
});

router.post('/buildings', async (req, res) => {
    let { address, city, state, zipCode, latitude, longitude } = req.body;
	
	zipCode = zipCode.match(/^\d{5}/)?.[0] || '';

    // Validate required fields
    if (!address || !city || !state || !zipCode || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Address, city, state, zip code, latitude, and longitude are required.' });
    }

    try {
        const pool = await poolPromise;

        // Insert building into the database using provided latitude and longitude
        const result = await pool.request()
            .input('Address', address)
            .input('City', city)
            .input('State', state)
            .input('ZipCode', zipCode)
            .input('Latitude', latitude)
            .input('Longitude', longitude)
            .query(`
                INSERT INTO Buildings (Address, City, State, ZipCode, Latitude, Longitude)
                OUTPUT inserted.BuildingID
                VALUES (@Address, @City, @State, @ZipCode, @Latitude, @Longitude)
            `);

        const buildingID = result.recordset[0].BuildingID;

        res.status(201).json({
            message: 'Building added successfully',
            buildingID,
        });
    } catch (error) {
        console.error('Error adding building:', error.message);
        res.status(500).json({ error: 'Failed to add building' });
    }
});


router.post('/geocode', async (req, res) => {
    const { address, city, state, zipCode } = req.body;

    if (!address || !city || !state || !zipCode) {
        return res.status(400).json({ error: 'Address, city, state, and zip code are required.' });
    }

    try {
        const { latitude, longitude } = await geocodeAddress(address, city, state, zipCode);
        res.status(200).json({ latitude, longitude });
    } catch (error) {
        console.error('Error during geocoding:', error);
        res.status(500).json({ error: 'Failed to geocode address' });
    }
});

router.post('/buildings/:id/units', authenticateToken, async (req, res) => {
    const { id } = req.params; // BuildingID
    const { unitNumber, bedrooms, bathrooms, squareFeet, propertyType } = req.body;
    const userID = req.user.userId;
	const buildingID = req.session.buildingID;

	console.log(req.body);
	
    if (!userID) {
        return res.status(401).json({ error: 'Unauthorized: UserID not found.' });
    }

    if (!unitNumber || !bedrooms || !bathrooms || !propertyType) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    try {
        const pool = await poolPromise;

		const landlordResult = await pool.request()
			.input('UserID', userID)
			.query(`
				SELECT LandlordID
				FROM UserLandlord
				WHERE UserID = @UserID
			`);

		if (landlordResult.recordset.length === 0) {
			return res.status(403).json({ error: 'No landlord associated with this user.' });
		}

		const landlordID = landlordResult.recordset[0].LandlordID;

        // Insert new unit
        const result = await pool.request()
            .input('BuildingID', id)
            .input('UnitNumber', unitNumber)
            .input('Bedrooms', bedrooms)
            .input('Bathrooms', bathrooms)
            .input('SquareFeet', squareFeet || null)
            .input('PropertyType', propertyType)
			.input('landlordID', landlordID)
            .query(`
                INSERT INTO Units (BuildingID, UnitNumber, Bedrooms, Bathrooms, SquareFeet, PropertyType, LandlordID)
                OUTPUT inserted.UnitID
                VALUES (@BuildingID, @UnitNumber, @Bedrooms, @Bathrooms, @SquareFeet, @PropertyType, @landlordID)
            `);

        res.status(201).json({ message: 'Unit created successfully', unitID: result.recordset[0].UnitID });
    } catch (error) {
        console.error('Error creating unit:', error);
        res.status(500).json({ error: 'Failed to create unit.' });
    }
});

router.post('/units/:unitId/offers', authenticateToken, async (req, res) => {
    const { unitId } = req.params; // UnitID
    const { rentAmount, availabilityStatus, startDate, endDate } = req.body;
    const userID = req.user.userId; // Retrieved from the token middleware
	//console.log(userID);
    if (!rentAmount || !startDate) {
        return res.status(400).json({ error: 'Required fields are missing.' });
    }

    try {
        const pool = await poolPromise;

        // Step 1: Get the LandlordID for the current user
        const landlordResult = await pool.request()
            .input('UserID', userID)
            .query(`
                SELECT LandlordID
                FROM UserLandlord
                WHERE UserID = @UserID
            `);

        if (landlordResult.recordset.length === 0) {
            return res.status(403).json({ error: 'No landlord associated with this user.' });
        }

        const landlordID = landlordResult.recordset[0].LandlordID;

        // Step 2: Validate the Unit's LandlordID matches the user's LandlordID
        const unitResult = await pool.request()
            .input('UnitID', unitId)
            .query(`
                SELECT u.LandlordID
                FROM Units u
                WHERE u.UnitID = @UnitID
            `);

        if (unitResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Unit not found.' });
        }

        const unitLandlordID = unitResult.recordset[0].LandlordID;

        if (landlordID !== unitLandlordID) {
            return res.status(403).json({ error: 'Unauthorized: Landlord mismatch for this unit.' });
        }

        // Step 3: Create the offer
        const result = await pool.request()
            .input('UnitID', unitId)
            .input('RentAmount', rentAmount)
            .input('AvailabilityStatus', availabilityStatus || 1)
            .input('StartDate', startDate)
            .input('EndDate', endDate || null)
            .query(`
                INSERT INTO Offers (UnitID, RentAmount, AvailabilityStatus, StartDate, EndDate)
                OUTPUT inserted.OfferID
                VALUES (@UnitID, @RentAmount, @AvailabilityStatus, @StartDate, @EndDate)
            `);

        res.status(201).json({ message: 'Offer created successfully', offerID: result.recordset[0].OfferID });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({ error: 'Failed to create offer.' });
    }
});

router.put('/offers/:id', authenticateToken, async (req, res) => {
    const offerID = req.params.id;
	const userID = req.user.userId;
    const { RentAmount, ApplicationFee, FeeWaiverThreshold } = req.body; // New fields

    try {
        const pool = await poolPromise;

        // Update the Offer
        await pool.request()
            .input('OfferID', offerID)
            .input('RentAmount', RentAmount)
            .input('ApplicationFee', ApplicationFee)
            .query(`
                UPDATE Offers
                SET RentAmount = @RentAmount, 
                    ApplicationFee = @ApplicationFee, 
                    UpdatedAt = GETDATE()
                WHERE OfferID = @OfferID
            `);

        // Check if an Application Fee Benefit exists
        const result = await pool.request()
            .input('OfferID', offerID)
            .query(`
                SELECT BenefitID 
                FROM ApplicationBenefits 
                WHERE OfferID = @OfferID AND BenefitType = 'ApplicationFee'
            `);

        if (result.recordset.length > 0) {
            // Update existing benefit
            await pool.request()
                .input('OfferID', offerID)
                .input('FeeWaiverThreshold', FeeWaiverThreshold)
                .input('BenefitValue', ApplicationFee)
                .query(`
                    UPDATE ApplicationBenefits
                    SET StrengthScoreThreshold = @FeeWaiverThreshold, 
                        BenefitValue = @BenefitValue, 
                        UpdatedAt = GETDATE()
                    WHERE OfferID = @OfferID AND BenefitType = 'ApplicationFee'
                `);
        } else {
            // Insert new benefit
            await pool.request()
                .input('OfferID', offerID)
                .input('FeeWaiverThreshold', FeeWaiverThreshold)
                .input('BenefitValue', ApplicationFee)
                .query(`
                    INSERT INTO ApplicationBenefits (OfferID, StrengthScoreThreshold, BenefitType, BenefitValue, CreatedAt)
                    VALUES (@OfferID, @FeeWaiverThreshold, 'ApplicationFee', @BenefitValue, GETDATE())
                `);
        }

        res.status(200).json({ message: 'Offer and application benefit updated successfully.' });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ error: 'Failed to update offer.' });
    }
});



router.get('/buildings/:id/units', async (req, res) => {

	
    const { id } = req.params; // BuildingID
	//console.log(id);
	req.session.buildingID = id;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('BuildingID', id)
            .query(`
                SELECT 
				u.UnitID, 
				u.UnitNumber, 
				u.Bedrooms, 
				u.Bathrooms, 
				u.SquareFeet,
				CASE 
					WHEN EXISTS (
						SELECT 1 
						FROM Offers o 
						WHERE o.UnitID = u.UnitID AND o.AvailabilityStatus = 1
					) THEN 'Available'
					WHEN EXISTS (
						SELECT 1 
						FROM Leases l 
						WHERE l.UnitID = u.UnitID AND GETDATE() < l.StartDate
					) THEN 'Rented'
					WHEN EXISTS (
						SELECT 1 
						FROM Leases l 
						WHERE l.UnitID = u.UnitID AND GETDATE() BETWEEN l.StartDate AND l.EndDate
					) THEN 'Occupied'
					ELSE 'Unknown'
				END AS Status
			FROM Units u
			WHERE u.BuildingID = @BuildingID
            `);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching units:', error);
        res.status(500).json({ error: 'Failed to retrieve units' });
    }
});


router.get("/landlord/offers", authenticateToken, async (req, res) => {
    const userID = req.user.userId;

    try {
        const pool = await poolPromise;
        const landlordResult = await pool.request()
            .input("UserID", userID)
            .query(`
                SELECT LandlordID FROM UserLandlord WHERE UserID = @UserID
            `);

        if (landlordResult.recordset.length === 0) {
            return res.status(403).json({ error: "Unauthorized: No landlord linked." });
        }

        const landlordID = landlordResult.recordset[0].LandlordID;

        const offersResult = await pool.request()
            .input("LandlordID", landlordID)
            .query(`
                SELECT 
                    o.OfferID, o.UnitID, o.RentAmount, o.AvailabilityStatus, o.StartDate, o.EndDate,
                    o.SecurityDepositAmount, o.BrokerFee, o.PetRent, o.PetDeposit, o.CustomFees, 
                    o.Tier, o.TierAdjustedDeposit, o.TierIncentives, o.EarlyTerminationPenalty, 
                    o.ProRataEnabled, o.ApplicationFee,
                    u.UnitNumber, u.Bedrooms, u.Bathrooms, u.PropertyType,
                    b.Address, b.City, b.State
                FROM Offers o
                JOIN Units u ON o.UnitID = u.UnitID
                JOIN Buildings b ON u.BuildingID = b.BuildingID
                WHERE u.LandlordID = @LandlordID
            `);

        res.status(200).json(offersResult.recordset);
    } catch (error) {
        console.error("Error fetching landlord offers:", error);
        res.status(500).json({ error: "Failed to retrieve offers." });
    }
});

router.get("/units/:unitID/images", async (req, res) => {
    const { unitID } = req.params;

    try {
        const pool = await poolPromise;

        // Query the Images table for the specified UnitID
        const result = await pool.request()
            .input("UnitID", sql.Int, unitID)
            .query(`
                SELECT ImageID, UnitID, ImageURL, Caption
                FROM Images
                WHERE UnitID = @UnitID
            `);


        // Return the images in JSON format
        res.status(200).json(result.recordset || []);
    } catch (error) {
        console.error("Error fetching images:", error);
        res.status(500).json({ error: "Failed to fetch images." });
    }
});


router.post('/offers/incentives', async (req, res) => {
    const { offerIds } = req.body; // List of OfferIDs sent from the frontend

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
        return res.status(400).json({ error: 'Invalid or missing offerIds.' });
    }

    try {
        const pool = await poolPromise;

        // Construct a parameterized query for the list of OfferIDs
        const query = `
            SELECT OfferID, BenefitType, StrengthScoreThreshold, BenefitValue
            FROM ApplicationBenefits
            WHERE OfferID IN (${offerIds.map((_, i) => `@OfferID${i}`).join(', ')})
        `;

        const request = pool.request();
        offerIds.forEach((offerId, index) => {
            request.input(`OfferID${index}`, offerId);
        });

        const result = await request.query(query);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching incentives:', error);
        res.status(500).json({ error: 'Failed to fetch incentives.' });
    }
});



router.post("/leases", authenticateToken, async (req, res) => {
    const { offerID } = req.body; // Passed from frontend
    const userID = req.user.userId; // From the JWT token

    if (!offerID) {
        return res.status(400).json({ error: "OfferID is required." });
    }

    try {
        const pool = await poolPromise;

        // Step 1: Retrieve offer details
        const offerResult = await pool.request()
            .input("OfferID", offerID)
            .query(`
                SELECT o.UnitID, o.StartDate
                FROM Offers o
                WHERE o.OfferID = @OfferID AND o.AvailabilityStatus = 1
            `);

        if (offerResult.recordset.length === 0) {
            return res.status(404).json({ error: "Offer not available." });
        }

        const { UnitID, StartDate } = offerResult.recordset[0];

        // Step 2: Calculate end date (12 months later)
        const endDate = new Date(StartDate);
        endDate.setFullYear(endDate.getFullYear() + 1);

        // Step 3: Begin transaction
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Insert lease into Leases table
            await transaction.request()
                .input("UserID", userID)
                .input("UnitID", UnitID)
                .input("StartDate", StartDate)
                .input("EndDate", endDate)
                .query(`
                    INSERT INTO Leases (UserID, UnitID, StartDate, EndDate)
                    VALUES (@UserID, @UnitID, @StartDate, @EndDate)
                `);

            // Update offer availability
            await transaction.request()
                .input("OfferID", offerID)
                .query(`
                    UPDATE Offers
                    SET AvailabilityStatus = 0
                    WHERE OfferID = @OfferID
                `);

            // Commit transaction
            await transaction.commit();
            res.status(201).json({ message: "Lease created successfully." });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error creating lease:", error);
        res.status(500).json({ error: "Failed to create lease." });
    }
});


router.post("/leases/approve", authenticateToken, async (req, res) => {
    const { leaseID } = req.body;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("LeaseID", leaseID)
            .query(`
                UPDATE Leases
                SET Approved = 1
                WHERE LeaseID = @LeaseID
            `);

        res.status(200).json({ message: "Lease approved successfully." });
    } catch (error) {
        console.error("Error approving lease:", error);
        res.status(500).json({ error: "Failed to approve lease." });
    }
});

router.get("/landlord/dashboard", authenticateToken, async (req, res) => {
    try {
        const userID = req.user.userId; // Extract user ID from the token
        const pool = await poolPromise;

        // Query: Total Units
        const unitsQuery = `
            SELECT COUNT(*) AS TotalUnits
            FROM Units
            WHERE LandlordID = (SELECT LandlordID FROM UserLandlord WHERE UserID = @UserID)
        `;
        const unitsResult = await pool.request()
            .input("UserID", userID)
            .query(unitsQuery);

        // Query: Total Leased Units
        const leasedUnitsQuery = `
            SELECT COUNT(DISTINCT u.UnitID) AS LeasedUnits
            FROM Units u
            INNER JOIN Offers o ON u.UnitID = o.UnitID
            WHERE u.LandlordID = (SELECT LandlordID FROM UserLandlord WHERE UserID = @UserID)
              AND o.AvailabilityStatus = 0
              AND GETDATE() BETWEEN o.StartDate AND o.EndDate
        `;
        const leasedUnitsResult = await pool.request()
            .input("UserID", userID)
            .query(leasedUnitsQuery);

        // Query: Total Active Offers
        const activeOffersQuery = `
            SELECT COUNT(*) AS ActiveOffers
            FROM Offers
            WHERE AvailabilityStatus = 1
              AND UnitID IN (
                  SELECT UnitID
                  FROM Units
                  WHERE LandlordID = (SELECT LandlordID FROM UserLandlord WHERE UserID = @UserID)
              )
        `;
        const activeOffersResult = await pool.request()
            .input("UserID", userID)
            .query(activeOffersQuery);

        // Query: Expected Revenue for Next Month
        const nextMonthRevenueQuery = `
            SELECT SUM(o.RentAmount) AS ExpectedRevenue
            FROM Offers o
            INNER JOIN Units u ON o.UnitID = u.UnitID
            WHERE u.LandlordID = (SELECT LandlordID FROM UserLandlord WHERE UserID = @UserID)
              AND o.AvailabilityStatus = 0
              AND o.StartDate <= DATEADD(month, 1, GETDATE())
              AND o.EndDate >= DATEADD(month, 1, GETDATE())
        `;
        const nextMonthRevenueResult = await pool.request()
            .input("UserID", userID)
            .query(nextMonthRevenueQuery);

        // Construct response
        res.json({
            totalUnits: unitsResult.recordset[0].TotalUnits,
            leasedUnits: leasedUnitsResult.recordset[0].LeasedUnits,
            activeOffers: activeOffersResult.recordset[0].ActiveOffers,
            expectedRevenue: nextMonthRevenueResult.recordset[0].ExpectedRevenue || 0,
        });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
});

router.get("/buildings", authenticateToken, async (req, res) => {
    try {
        const userID = req.user.userId;
        const pool = await poolPromise;

        const result = await pool.request()
            .input("UserID", userID)
            .query(`
                SELECT DISTINCT b.BuildingID, b.Address, b.City, b.State, b.ZipCode
                FROM Buildings b
                INNER JOIN Units u ON b.BuildingID = u.BuildingID
                INNER JOIN Landlords l ON u.LandlordID = l.LandlordID
                INNER JOIN UserLandlord ul ON l.LandlordID = ul.LandlordID
                WHERE ul.UserID = @UserID
            `);

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Error fetching buildings:", error);
        res.status(500).json({ error: "Failed to fetch buildings." });
    }
});


router.get('/units/:unitID', async (req, res) => {
    const { unitID } = req.params;

    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input('UnitID', sql.Int, unitID)
            .query(`
                SELECT 
                    u.UnitID,
                    u.UnitNumber,
                    u.Bedrooms,
                    u.Bathrooms,
                    u.SquareFeet,
                    u.PropertyType,
                    d.PetPolicy,
                    d.Parking,
                    d.Description,
                    i.ImageID,
                    i.ImageURL,
                    i.Caption,
                    i.FeaturedImage
                FROM Units u
                LEFT JOIN PropertyDetails d ON u.UnitID = d.UnitID
                LEFT JOIN Images i ON u.UnitID = i.UnitID
                WHERE u.UnitID = @UnitID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Unit not found.' });
        }

        // Extract unit details
        const unitDetails = result.recordset[0];

        const unit = {
            UnitID: unitDetails.UnitID,
            UnitNumber: unitDetails.UnitNumber,
            Bedrooms: unitDetails.Bedrooms,
            Bathrooms: unitDetails.Bathrooms,
            SquareFeet: unitDetails.SquareFeet,
            PropertyType: unitDetails.PropertyType,
            PetPolicy: unitDetails.PetPolicy,
            Parking: unitDetails.Parking,
            Description: unitDetails.Description,
            FeaturedImage: result.recordset
                .filter(row => row.FeaturedImage) // Identify the featured image
                .map(row => ({
                    ImageID: row.ImageID,
                    ImageURL: row.ImageURL,
                    Caption: row.Caption,
                    FeaturedImage: row.FeaturedImage,
                }))[0] || null, // Return the first featured image or null if none exists
            Images: result.recordset
                .filter(row => row.ImageID && !row.FeaturedImage) // Exclude the featured image
                .map(row => ({
                    ImageID: row.ImageID,
                    ImageURL: row.ImageURL,
                    Caption: row.Caption,
                    FeaturedImage: row.FeaturedImage,
                })),
        };

		console.log(unit);
        res.status(200).json(unit);
    } catch (error) {
        console.error('Error fetching unit details:', error);
        res.status(500).json({ error: 'Failed to fetch unit details.' });
    }
});



router.post('/units/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; // UnitID
    const { petPolicy, parking, description } = req.body; // Updated fields from the request body
    const userID = req.user.userId;

    // Validate user authentication
    if (!userID) {
        return res.status(401).json({ error: 'Unauthorized: UserID not found.' });
    }

    // Validate input fields
    if (!petPolicy && !parking && !description) {
        return res.status(400).json({ error: 'At least one field must be provided for update or insert.' });
    }

    try {
        const pool = await poolPromise;

        // Validate that the user is associated with the unit
        const unitValidation = await pool.request()
            .input('UnitID', id)
            .input('UserID', userID)
            .query(`
                SELECT u.UnitID
                FROM Units u
                JOIN UserLandlord ul ON u.LandlordID = ul.LandlordID
                WHERE u.UnitID = @UnitID AND ul.UserID = @UserID
            `);

        if (unitValidation.recordset.length === 0) {
            return res.status(403).json({ error: 'You do not have permission to update this unit.' });
        }

        // Check if the UnitID exists in the PropertyDetails table
        const propertyDetailsExists = await pool.request()
            .input('UnitID', id)
            .query(`
                SELECT UnitID
                FROM PropertyDetails
                WHERE UnitID = @UnitID
            `);

        if (propertyDetailsExists.recordset.length === 0) {
            // Insert new row if UnitID does not exist in PropertyDetails
            await pool.request()
                .input('UnitID', id)
                .input('PetPolicy', petPolicy || null)
                .input('Parking', parking || null)
                .input('Description', description || null)
                .query(`
                    INSERT INTO PropertyDetails (UnitID, PetPolicy, Parking, Description)
                    VALUES (@UnitID, @PetPolicy, @Parking, @Description)
                `);
        } else {
            // Update existing row if UnitID exists in PropertyDetails
            await pool.request()
                .input('UnitID', id)
                .input('PetPolicy', petPolicy || null)
                .input('Parking', parking || null)
                .input('Description', description || null)
                .query(`
                    UPDATE PropertyDetails
                    SET 
                        PetPolicy = ISNULL(@PetPolicy, PetPolicy),
                        Parking = ISNULL(@Parking, Parking),
                        Description = ISNULL(@Description, Description)
                    WHERE UnitID = @UnitID
                `);
        }

        // Fetch the updated unit details
        const updatedUnit = await pool.request()
            .input('UnitID', id)
            .query(`
                SELECT u.UnitID, u.UnitNumber, u.Bedrooms, u.Bathrooms, u.SquareFeet, u.PropertyType,
                       pd.PetPolicy, pd.Parking, pd.Description
                FROM Units u
                LEFT JOIN PropertyDetails pd ON u.UnitID = pd.UnitID
                WHERE u.UnitID = @UnitID
            `);

        res.status(200).json(updatedUnit.recordset[0]);
    } catch (error) {
        console.error('Error updating or inserting unit details:', error);
        res.status(500).json({ error: 'Failed to update or insert unit details.' });
    }
});


router.get("/buildings/search", async (req, res) => {
    	
	const { q } = req.query;
	
    // Validate the query parameter
    if (!q || q.trim() === "") {
        return res.status(400).json({ error: "Query parameter 'q' is required." });
    }

    try {
        const pool = await poolPromise;
		const result = await pool.request()
			.input('KeyWord', `%${q}%`)
			.query(`
            SELECT TOP 10*
            FROM Buildings
            WHERE Address LIKE @KeyWord
               OR City LIKE @KeyWord
               OR State LIKE @KeyWord
               OR ZipCode LIKE @KeyWord;
        `);


console.log(result);
     if (result.recordset.length === 0) {
            return res.status(200).json([]);
        }

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error fetching unit details:', error);
        res.status(500).json({ error: 'Failed to fetch unit details.' });
    }
});

router.get("/landlord/leases", authenticateToken, async (req, res) => {
    const userID = req.user.userId; // Get the landlord's user ID

    try {
        const pool = await poolPromise;

        // Fetch the LandlordID for the user
        const landlordResult = await pool.request()
            .input("UserID", userID)
            .query(`
                SELECT LandlordID FROM UserLandlord WHERE UserID = @UserID
            `);

        if (landlordResult.recordset.length === 0) {
            return res.status(403).json({ error: "Unauthorized: No landlord linked." });
        }

        const landlordID = landlordResult.recordset[0].LandlordID;

        // Fetch all leases for units owned by the landlord
        const leasesResult = await pool.request()
            .input("LandlordID", landlordID)
            .query(`
                SELECT 
                    l.LeaseID,
                    l.UnitID,
                    l.StartDate,
                    l.EndDate,
                    u.UnitNumber,
                    u.Bedrooms,
                    u.Bathrooms,
                    b.Address,
                    b.City,
                    b.State
                FROM Leases l
                JOIN Units u ON l.UnitID = u.UnitID
                JOIN Buildings b ON u.BuildingID = b.BuildingID
                WHERE u.LandlordID = @LandlordID
            `);

        res.status(200).json(leasesResult.recordset);
    } catch (error) {
        console.error("Error fetching leases:", error);
        res.status(500).json({ error: "Failed to retrieve leases." });
    }
});

router.patch("/images/:id", async (req, res) => {
    const { id } = req.params;
    const { caption } = req.body;

    // Validate input
    if (!caption || typeof caption !== "string") {
        return res.status(400).json({ error: "Invalid or missing 'caption' field." });
    }

    try {
        const pool = await poolPromise;

        // Update the caption in the Images table
        const result = await pool.request()
            .input("ImageID", sql.Int, id)
            .input("Caption", sql.NVarChar, caption)
            .query(`
                UPDATE Images
                SET Caption = @Caption
                WHERE ImageID = @ImageID
            `);

        // Check if the record was updated
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Image not found." });
        }

        // Respond with success
        res.status(200).json({ message: "Caption updated successfully." });
    } catch (error) {
        console.error("Error updating caption:", error);
        res.status(500).json({ error: "Failed to update caption." });
    }
});


router.delete("/images/:imageID", async (req, res) => {
    const { imageID } = req.params;

    try {
        const pool = await poolPromise;

        // Retrieve the ImageURL from the database
        const result = await pool.request()
            .input("ImageID", sql.Int, imageID)
            .query(`
                SELECT ImageURL
                FROM Images
                WHERE ImageID = @ImageID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Image not found." });
        }

        const imageURL = result.recordset[0].ImageURL;

        // Extract the public_id from the Cloudinary URL
        const urlParts = imageURL.split("/");
        const fileNameWithExt = urlParts[urlParts.length - 1]; // e.g., "my-image.png"
        const folderPath = urlParts[urlParts.length - 2]; // e.g., "unit_images"
        const publicId = `${folderPath}/${fileNameWithExt.split(".")[0]}`; // e.g., "unit_images/my-image"

        console.log("Deleting from Cloudinary, public_id:", publicId);

        // Delete the image from Cloudinary
        const cloudinaryResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.destroy(publicId, (error, result) => {
                if (error) {
                    console.error("Cloudinary Deletion Error:", error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        console.log("Cloudinary Deletion Result:", cloudinaryResult);

        if (cloudinaryResult.result !== "ok") {
            return res.status(500).json({ error: "Failed to delete image from Cloudinary." });
        }

        // Delete the image metadata from the database
        await pool.request()
            .input("ImageID", sql.Int, imageID)
            .query(`
                DELETE FROM Images
                WHERE ImageID = @ImageID
            `);

        res.status(200).json({ message: "Image deleted successfully." });
    } catch (error) {
        console.error("Error deleting image:", error);
        res.status(500).json({ error: "Failed to delete image." });
    }
});



module.exports = router;
