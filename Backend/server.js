const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();

app.use(cors());
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); 

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });

// Database connection configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'nutrisafe_db'
};

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database.');
});

app.post('/api/signup', (req, res) => {
  const { fullname, email, username, password } = req.body;

  if (!fullname || !email || !username || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const sql = 'INSERT INTO users (name, email, username, password) VALUES (?, ?, ?, ?)';
  db.query(sql, [fullname, email, username, password], (err, results) => {
    if (err) {
      console.error('Error inserting data into database:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, message: 'Sign up successful!' });
  });
});

app.post('/api/login', (req, res) => {
  console.log(req.body);
  const { username, password } = req.body;

  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = results[0];

    // Compare plain text password
    if (password === user.password) {
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });
});


// Handle file uploads
app.post('/api/addRestaurant', upload.single('shopImage'), (req, res) => {
  const { shopName, shopAddress, shopOpens, shopClose, shopContact } = req.body;
  const shopImage = req.file ? req.file.buffer : null; // Get the uploaded file's binary data

  if (!shopName || !shopAddress || !shopOpens || !shopClose || !shopContact) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Insert binary image data into the database
  const sql = 'INSERT INTO restaurant (name, address, open, close, contact, image) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(sql, [shopName, shopAddress, shopOpens, shopClose, shopContact, shopImage], (err, results) => {
    if (err) {
      console.error('Error inserting data into database:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, message: 'Shop added successfully!' });
  });
});

app.get('/api/getRestaurants', (req, res) => {
  const sql = 'SELECT id, name, address, open, close, contact, image FROM restaurant';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Convert image binary data to Base64 format
    const modifiedResults = results.map(restaurant => {
      if (restaurant.image) {
        restaurant.image = `data:image/jpeg;base64,${Buffer.from(restaurant.image).toString('base64')}`;
      }
      return restaurant;
    });

    res.json({ success: true, data: modifiedResults });
  });
});

app.post('/api/updateUser', (req, res) => {
  const { name, age, email, gender, country, city, pincode, contact, address } = req.body;
  console.log(req.body)
  if (!name || !age || !email || !gender || !country || !city || !pincode || !contact || !address) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const sql = `UPDATE users SET name = ?, age = ?, gender = ?, country = ?, city = ?, pincode = ?, contact = ?, address = ? WHERE email = ?`;
  db.query(sql, [name, age, gender, country, city, pincode, contact, address, email], (err, result) => {
    if (err) {
      console.error('Error updating user details:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User details updated successfully' });
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
