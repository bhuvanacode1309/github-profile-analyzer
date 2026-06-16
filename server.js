// Load environment variables
require('dotenv').config();

// Import express library
const express = require('express');

// Import database connection pool
require('./config/db');

// Import our profile routes
const profileRoutes = require('./routes/profileRoutes');

// Create an express application
const app = express();

// Middleware - tells express to handle JSON data
app.use(express.json());

// Mount our profile routes at the path '/api/profiles'
app.use('/api/profiles', profileRoutes);

// Define PORT from environment variables (fallback to 3000)
const PORT = process.env.PORT || 3000;

// Basic route - when someone visits http://localhost:3000/
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to GitHub Profile Analyzer API' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
