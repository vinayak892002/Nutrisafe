const express = require('express');
const http = require('http');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();


app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
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
    const tableName = `user_cart_${username.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const sqlCreateUserCartTable = `
        CREATE TABLE ${tableName} (
        cart_item_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id,
        menu_item VARCHAR(255),
        quantity INT,
        total_price DECIMAL(10,2),
        price DECIMAL(10,2),
        food_image LONGBLOB,
    
      )
    `;

    db.query(sqlCreateUserCartTable, (err) => {
      if (err) {
        console.error('Error creating user-specific table:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({ success: true, message: 'Sign up successful and user-specific table created!' });
    });
  });
});



app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Query to retrieve user details
  const sql = 'SELECT id, password FROM users WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = results[0];


    if (password === user.password) {
      // Insert into user_details table
      const insertDetailsSql = 'INSERT INTO user_details (username, password, user_id) VALUES (?, ?, ?)';
      db.query(insertDetailsSql, [username, password, user.id], (err) => {
        if (err) {
          console.error('Error inserting user details:', err);
          return res.status(500).json({ success: false, message: 'Failed to save user details' });
        }

        // Respond with success message
        res.json({
          success: true,
          message: 'Login successful and user details saved'
        });
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });
});
//logout
app.post('/api/out', (req, res) => {
  // SQL query to delete all records from the user_details table
  const deleteAllSql = 'DELETE FROM user_details';
  db.query(deleteAllSql, (err) => {
    if (err) {
      console.error('Error deleting user details:', err);
      return res.status(500).json({ success: false, message: 'Unable to clear user details. Please try again later.' });
    }

    // Respond with success message
    res.status(200).json({ success: true, message: 'All user details deleted successfully.' });
  });
});

//getusername
// Endpoint to get the username from the user_details table
app.get('/api/getUsername', (req, res) => {
  const sql = 'SELECT username FROM user_details LIMIT 1';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'User details not found' });
    }

    const userDetails = results[0];
    res.json({
      success: true,
      username: userDetails.username
    });
  });
});

// recomendation

app.get('/api/restaurants', (req, res) => {
  const item = req.query.item;

  if (!item) {
    return res.status(400).json({ error: 'Item query parameter is required' });
  }

  // Fetch restaurant names from the main table
  connection.query('SELECT name FROM restaurant', (err, restaurants) => {
    if (err) return res.status(500).json({ error: err.message });

    const promises = restaurants.map(restaurant => {
      return new Promise((resolve, reject) => {
        // Query each restaurant's menu table
        connection.query(`SELECT * FROM \`${restaurant.name}\` WHERE item_name = ?`, [item], (err, menu) => {
          if (err) return reject(err);

          if (menu.length > 0) {
            resolve({ restaurant: restaurant.name, menu });
          } else {
            resolve(null);
          }
        });
      });
    });

    Promise.all(promises).then(results => {
      // Filter out null results and send response
      const filteredResults = results.filter(result => result !== null);
      res.json(filteredResults);
    }).catch(err => {
      res.status(500).json({ error: err.message });
    });
  });
});

// Handle file uploads
app.post('/api/addRestaurant', upload.single('shopImage'), (req, res) => {
  const { shopName, shopAddress, shopOpens, shopClose, shopContact } = req.body;
  const shopImage = req.file ? req.file.buffer : null;

  if (!shopName || !shopAddress || !shopOpens || !shopClose || !shopContact) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Insert restaurant data
  const sqlInsert = 'INSERT INTO restaurant (name, address, open, close, contact, image) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(sqlInsert, [shopName, shopAddress, shopOpens, shopClose, shopContact, shopImage], (err, results) => {
    if (err) {
      console.error('Error inserting data into database:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Create a new table for the restaurant
    const sanitizedTableName = shopName.replace(/[^a-zA-Z0-9_]/g, '_');
    const sqlCreateTable = `CREATE TABLE ${sanitizedTableName} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT,
      food_type VARCHAR(50),
      menu_item VARCHAR(255),
      item_price DECIMAL(10,2),
      item_category VARCHAR(255),
      food_image LONGBLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurant_id) REFERENCES restaurant(id)
  )`;


    db.query(sqlCreateTable, (err) => {
      if (err) {
        console.error('Error creating table:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      res.json({ success: true, message: 'Shop added and table created successfully!' });
    });
  });
});


app.get('/api/getRestaurants', (req, res) => {
  const sql = 'SELECT id, name, address, open, close, contact, image FROM restaurant';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }


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

// add menu
app.post('/api/addMenuItem', upload.single('foodImage'), (req, res) => {
  const { foodType, shopName, menuItem, itemPrice, itemCategory } = req.body;
  const foodImage = req.file ? req.file.buffer : null;

  if (!foodType || !shopName || !menuItem || !itemPrice || !itemCategory) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }


  const sqlGetRestaurantId = 'SELECT id FROM restaurant WHERE name = ?';
  db.query(sqlGetRestaurantId, [shopName], (err, results) => {
    if (err) {
      console.error('Error querying restaurant table:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const restaurantId = results[0].id;
    const sanitizedTableName = shopName.replace(/[^a-zA-Z0-9_]/g, '_');


    const sqlCheckTable = `SHOW TABLES LIKE ?`;
    db.query(sqlCheckTable, [sanitizedTableName], (err, results) => {
      if (err) {
        console.error('Error checking table existence:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(400).json({ success: false, message: 'Table does not exist' });
      }

      const sqlInsert = `INSERT INTO ${sanitizedTableName} (restaurant_id, food_type, menu_item, item_price, item_category, food_image) VALUES (?, ?, ?, ?, ?, ?)`;

      db.query(sqlInsert, [restaurantId, foodType, menuItem, parseFloat(itemPrice), itemCategory, foodImage], (err, results) => {
        if (err) {
          console.error('Error inserting data into database:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Menu item added successfully!' });
      });
    });
  });
});

// gget menu
app.get('/api/getMenu/:shopName', (req, res) => {
  const shopName = req.params.shopName.replace(/[^a-zA-Z0-9_]/g, '_');


  const sql = `SELECT menu_item, item_price, food_image FROM ${shopName}`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }


    const modifiedResults = results.map(item => {
      if (item.food_image) {
        item.food_image = `data:image/jpeg;base64,${Buffer.from(item.food_image).toString('base64')}`;
      }
      return item;
    });

    res.json({ success: true, data: modifiedResults });
  });
});

//add to cart
app.post('/api/addToCart', (req, res) => {
  console.log('Request received:', req.body);

  const { restaurant_name, menu_item, quantity, price, total_price, food_image } = req.body;

  // Validate input data
  if (
    typeof restaurant_name !== 'string' ||
    typeof menu_item !== 'string' ||
    !Number.isInteger(quantity) || quantity <= 0 ||
    typeof price !== 'number' || price <= 0 ||
    typeof total_price !== 'number' || total_price <= 0 ||
    typeof food_image !== 'string'
  ) {
    console.error('Invalid input data:', req.body);
    return res.status(400).json({ success: false, error: 'Invalid input data' });
  }


  const userQuery = 'SELECT user_id, username FROM user_details LIMIT 1';
  db.query(userQuery, (err, results) => {
    if (err) {
      console.error('Error fetching user data:', err);
      return res.status(500).json({ success: false, error: 'Error fetching user data' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userId = results[0].user_id;
    const username = results[0].username;


    const tableName = `user_cart_${username.replace(/[^a-zA-Z0-9_]/g, '_')}`;


    const insertCartQuery = `
      INSERT INTO ${tableName} (user_id, restaurant_name, menu_item, quantity, price, total_price, food_image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;


    const updateTokensQuery = 'UPDATE users SET tokens = COALESCE(tokens, 0) + ? WHERE username = ?';

    // Start transaction to ensure atomic operations
    db.beginTransaction((err) => {
      if (err) {
        console.error('Transaction error:', err);
        return res.status(500).json({ success: false, error: 'Transaction error' });
      }

      // Insert into the cart table
      db.query(insertCartQuery, [userId, restaurant_name, menu_item, quantity, price, total_price, food_image], (err) => {
        if (err) {
          console.error('Error inserting data into user cart:', err);
          return db.rollback(() => {
            res.status(500).json({ success: false, error: 'Error inserting data into user cart' });
          });
        }


        const tokensToAdd = Math.floor(total_price / 100) * 5;


        db.query(updateTokensQuery, [tokensToAdd, username], (err) => {
          if (err) {
            console.error('Error updating tokens:', err);
            return db.rollback(() => {
              res.status(500).json({ success: false, error: 'Failed to update tokens' });
            });
          }


          db.commit((err) => {
            if (err) {
              console.error('Transaction commit error:', err);
              return db.rollback(() => {
                res.status(500).json({ success: false, error: 'Transaction commit error' });
              });
            }


            res.status(200).json({ success: true, message: 'Item added to cart and tokens updated successfully' });
          });
        });
      });
    });
  });
});



// get cart

app.get('/api/getCartItems/:username', (req, res) => {
  const username = req.params.username;
  console.log(`Fetching cart items for user: ${username}`);

  const cartTableName = `user_cart_${username.replace(/[^a-zA-Z0-9_]/g, '_')}`;


  const cartQuery = `SELECT cart_item_id, restaurant_name, menu_item, quantity, price, total_price FROM ${cartTableName}`;
  db.query(cartQuery, (err, cartResults) => {
    if (err) {
      console.error('Error querying cart database:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }


    const modifiedResults = [];

    // Fetch food images for each cart item
    let completedRequests = 0;

    cartResults.forEach(item => {
      const restaurantTableName = item.restaurant_name.replace(/[^a-zA-Z0-9_]/g, '_');

      const imageQuery = `SELECT food_image FROM ${restaurantTableName} WHERE menu_item = ?`;
      db.query(imageQuery, [item.menu_item], (err, imageResults) => {
        if (err) {
          console.error('Error querying menu database:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }

        const foodImage = imageResults.length ? `data:image/jpeg;base64,${Buffer.from(imageResults[0].food_image).toString('base64')}` : '';

        modifiedResults.push({
          ...item,
          food_image: foodImage
        });

        completedRequests++;


        if (completedRequests === cartResults.length) {
          res.json({ success: true, data: modifiedResults });
        }
      });
    });


    if (cartResults.length === 0) {
      res.json({ success: true, data: modifiedResults });
    }
  });
});

// remove cart
app.delete('/api/removeCartItem/:username/:menu_item', (req, res) => {
  const username = req.params.username;
  const menuItem = req.params.menu_item;
  const cartTableName = `user_cart_${username.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  if (!menuItem) {
    console.error('Menu item name is missing.');
    return res.status(400).json({ success: false, message: 'Menu item name is required' });
  }

  console.log(`Attempting to delete from ${cartTableName} where menu_item = ${menuItem}`);

  const query = `DELETE FROM ${cartTableName} WHERE menu_item = ?`;
  db.query(query, [menuItem], (err, results) => {
    if (err) {
      console.error('Error deleting item from cart:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    console.log(`Delete operation result:`, results);

    if (results.affectedRows === 0) {
      console.error('No item found with the given menu item name.');
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, removedItemTotal: 0 });
  });
});
// tokens add
app.post('/api/placeOrder', (req, res) => {
  const { username, items, grandTotal, tokensToAdd } = req.body;

  console.log('Received Order Data:', req.body);

  // Validate input
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid order items' });
  }
  if (typeof grandTotal !== 'number' || isNaN(grandTotal) || grandTotal <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid grand total' });
  }
  if (typeof tokensToAdd !== 'number' || tokensToAdd <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid tokens value' });
  }

  // Start transaction to ensure atomic operations
  db.beginTransaction((err) => {
    if (err) {
      console.error('Transaction error:', err);
      return res.status(500).json({ success: false, message: 'Transaction error' });
    }

    // Insert order into orders table
    const insertOrderQuery = 'INSERT INTO orders (username, grand_total, tokens_to_add, order_time) VALUES (?, ?, ?, NOW())';
    db.query(insertOrderQuery, [username, grandTotal, tokensToAdd], (error, results) => {
      if (error) {
        console.error('Error inserting order:', error);
        return db.rollback(() => {
          res.status(500).json({ success: false, message: 'Failed to insert order' });
        });
      }

      const orderId = results.insertId;

      // Insert items into order_items table
      const insertOrderItemsQuery = 'INSERT INTO order_items (order_id, item_id, item_name, quantity, price, total, username) VALUES ?';
      const orderItems = items.map(item => [orderId, item.id, item.name, item.quantity, item.price, item.total, username]);

      db.query(insertOrderItemsQuery, [orderItems], (error) => {
        if (error) {
          console.error('Error inserting order items:', error);
          return db.rollback(() => {
            res.status(500).json({ success: false, message: 'Failed to insert order items' });
          });
        }

        // Update user's tokens
        const updateTokensQuery = 'UPDATE users SET tokens = COALESCE(tokens, 0) + ? WHERE username = ?';
        db.query(updateTokensQuery, [tokensToAdd, username], (error) => {
          if (error) {
            console.error('Error updating tokens:', error);
            return db.rollback(() => {
              res.status(500).json({ success: false, message: 'Failed to update tokens' });
            });
          }

          // Delete cart items
          const cartTableName = `user_cart_${username}`;
          const deleteCartQuery = `DELETE FROM ${cartTableName}`;
          db.query(deleteCartQuery, [username], (error) => {
            if (error) {
              console.error('Error deleting cart items:', error);
              return db.rollback(() => {
                res.status(500).json({ success: false, message: 'Failed to delete cart items' });
              });
            }


            db.commit((err) => {
              if (err) {
                console.error('Transaction commit error:', err);
                return db.rollback(() => {
                  res.status(500).json({ success: false, message: 'Transaction commit error' });
                });
              }


              res.json({ success: true });
            });
          });
        });
      });
    });
  });
});


// get orders

app.get('/api/getUserOrders/:username', (req, res) => {
  const username = req.params.username;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const query = `
      SELECT o.id AS order_id, 
             o.grand_total, 
             o.tokens_to_add, 
             o.order_time, 
             oi.item_name, 
             oi.quantity, 
             oi.price, 
             oi.total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.username = ?
  `;

  db.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error fetching orders:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const orders = [];
    results.forEach(row => {
      let order = orders.find(o => o.id === row.order_id);
      if (!order) {
        order = {
          id: row.order_id,
          grand_total: row.grand_total,
          tokens_to_add: row.tokens_to_add,
          order_time: row.order_time,
          items: []
        };
        orders.push(order);
      }
      order.items.push({
        item_name: row.item_name,
        quantity: row.quantity,
        price: row.price,
        total: row.total
      });
    });

    res.json({ orders });
  });
});

// mealtokens
app.get('/api/getUserTokens', (req, res) => {

  const sql = 'SELECT user_id FROM user_details LIMIT 1';

  db.query(sql, (err, userDetails) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    console.log('User Details:', userDetails);

    if (!userDetails || userDetails.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }


    const userId = userDetails[0].user_id;
    console.log('User ID:', userId);

    const tokenQuery = 'SELECT tokens FROM users WHERE id = ?';

    db.query(tokenQuery, [userId], (err, results) => {
      if (err) {
        console.error('Error executing token query:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch tokens' });
      }

      console.log('Token Results:', results);

      if (!results || results.length === 0) {
        return res.status(404).json({ success: false, message: 'Tokens not found' });
      }

      // Get the tokens value
      const tokens = results[0].tokens;
      res.json({ success: true, tokens });
    });
  });
});



//donate
app.post('/api/donateTokens', (req, res) => {
  const grandTotal = req.body.grandTotal;

  // Validate grandTotal
  if (!grandTotal || isNaN(grandTotal) || grandTotal <= 0) {
    console.error('Invalid grand total amount:', grandTotal);
    return res.status(400).json({ success: false, message: 'Invalid grand total amount' });
  }

  // Fetch the user ID from user_details
  const userSql = 'SELECT user_id FROM user_details LIMIT 1';
  db.query(userSql, (err, userDetails) => {
    if (err) {
      console.error('Error fetching user details:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!userDetails || userDetails.length === 0) {
      console.error('User not found');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userId = userDetails[0].user_id;

    // Fetch current tokens from the users table
    const tokenQuery = 'SELECT tokens FROM users WHERE id = ?';
    db.query(tokenQuery, [userId], (err, results) => {
      if (err) {
        console.error('Error fetching tokens:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!results || results.length === 0) {
        console.error('Tokens not found');
        return res.status(404).json({ success: false, message: 'Tokens not found' });
      }

      const currentTokens = results[0].tokens;

      if (currentTokens < grandTotal) {
        console.error('Insufficient tokens to donate');
        return res.status(400).json({ success: false, message: 'Insufficient tokens to donate' });
      }

      // Deduct tokens
      const updatedTokens = currentTokens - grandTotal;
      const updateQuery = 'UPDATE users SET tokens = ? WHERE id = ?';

      db.query(updateQuery, [updatedTokens, userId], (err) => {
        if (err) {
          console.error('Error updating tokens:', err);
          return res.status(500).json({ success: false, message: 'Failed to update tokens' });
        }

        res.json({ success: true, updatedTokens });
      });
    });
  });
});

// contact

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'cvinayak542@gmail.com',
    pass: 'acaz kqtb bjpl zfsw'
  }
});

app.post('/api/sendEmail', (req, res) => {
  const { name, email, subject, message } = req.body;

  const mailOptions = {
    from: 'cvinayak542@gmail.com',
    replyTo: email,
    to: 'cvinayak87@gmail.com',
    subject: subject,
    html: `
        <h3>Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>From Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.json({ success: false, message: error.message });
    }
    res.json({ success: true, message: 'Email sent: ' + info.response });
  });
});



// newsletter


app.post('/api/sendConfirmationEmail', (req, res) => {
  const { email } = req.body;

  const mailOptions = {
    from: 'cvinayak542@gmail.com',
    to: email,
    subject: 'Subscription Confirmation',
    text: `Thank you for subscribing to our newsletter! Use CODE: NEWBEE! to avail up to ₹100 discount on your first order above ₹399. Hurry Up!

    As a valued subscriber, you also receive a special coupon code for 20% off on orders above ₹500. Use CODE: SPECIAL20 to get this discount, valid only once per user. Don't miss out on this exclusive offer and stay tuned for more exciting updates and promotions!`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.json({ success: false, message: error.message });
    }
    res.json({ success: true, message: 'Email sent: ' + info.response });
  });
});

// discount
app.post('/api/applyCoupon', async (req, res) => {
  try {
    const { couponCode, grandTotal } = req.body;

    if (typeof grandTotal !== 'number') {
      return res.status(400).json({ success: false, message: 'Grand total must be a number.' });
    }


    db.query('SELECT username FROM user_details LIMIT 1', async (err, userResults) => {
      if (err) {
        console.error('Error querying user details:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }

      if (userResults.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const username = userResults[0].username;

      // Fetch user orders
      db.query('SELECT COUNT(*) AS orderCount FROM orders WHERE username = ?', [username], (err, orderResults) => {
        if (err) {
          console.error('Error querying orders:', err);
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (orderResults.length === 0) {
          return res.status(404).json({ success: false, message: 'Orders not found.' });
        }

        const orderCount = orderResults[0].orderCount;

        if (orderCount > 0 && couponCode === 'NEWBEE!') {
          return res.status(400).json({ success: false, message: 'You are not eligible for this coupon.' });
        }

        if (couponCode === 'NEWBEE!') {
          discountAmount=100;
          const discountedTotal = grandTotal - discountAmount;
          const finalTotal = discountedTotal < 0 ? 0 : discountedTotal;

          res.json({ success: true, message: 'Coupon applied successfully.', newTotal: finalTotal,discountAmount });
        } else if (couponCode === 'SPECIAL20') {
          if (grandTotal >= 500) {
            const discountAmount = Math.min(grandTotal * 0.20, 100); // Calculate 20% or ₹100, whichever is lowe
            const discountedTotal = grandTotal -  Math.min(grandTotal * 0.20, 100);
            const finalTotal = discountedTotal < 0 ? 0 : discountedTotal;
            res.json({ success: true, message: 'Coupon applied successfully.', newTotal: finalTotal, discountAmount});
          }
        }
        else {
          res.status(400).json({ success: false, message: 'Invalid coupon code.' });
        }
      });
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// profile
app.get('/api/getUserProfile', (req, res) => {

  const getUserIdSql = 'SELECT user_id FROM user_details LIMIT 1';

  db.query(getUserIdSql, (err, userDetailsResults) => {
    if (err) {
      console.error('Error fetching user ID from user_details:', err);
      res.status(500).json({ error: 'Failed to fetch user ID' });
      return;
    }

    const userId = userDetailsResults[0]?.user_id;
    if (!userId) {
      res.status(404).json({ error: 'User ID not found' });
      return;
    }


    const getUserProfileSql = `SELECT id, name, contact AS phone, email, age, gender, country, city, pincode, address
    FROM users
    WHERE id = ?`;


    db.query(getUserProfileSql, [userId], (err, userResults) => {
      if (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Failed to fetch user profile' });
        return;
      }

      res.json(userResults[0] || {});
    });
  });
});


// recomendation

app.get('/api/getRestaurantsByProduct', async (req, res) => {
  const product = req.query.product;
  const sql = 'SELECT id, name, address, open, close, contact, image FROM restaurant';

  if (!product) {
    return res.status(400).json({ success: false, message: 'Product parameter is missing' });
  }

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Print the number of records present
    console.log(product);
    const restaurantNames = [];

    // Loop through the results to store restaurant names
    results.forEach(restaurant => {
      // console.log('Restaurant name:', restaurant.name); // Log the name
      restaurantNames.push(restaurant.name); // Add to the array
    });

    const formattedNames = restaurantNames.map(name => name.replace(/ /g, '_'));

    // Track tables with products available
    const tablesWithProduct = new Set();

    // Check each formatted name in the database
    let completedQueries = 0;
    formattedNames.forEach(name => {
      const query = 'SELECT item_category FROM ?? WHERE item_category = ?';

      db.query(query, [name, product], (err, rows) => {
        if (err) {
          console.error('Error executing query for table', name, ':', err);
          return;
        }

        if (rows.length > 0) {
          console.log(`${name}: yes`);
          tablesWithProduct.add(name);
        } else {
          console.log(`${name}: no`);
        }

        // Check if all queries are complete
        completedQueries++;
        if (completedQueries === formattedNames.length) {
          // Filter results based on tables with products available
          const filteredResults = results.filter(restaurant =>
            tablesWithProduct.has(restaurant.name.replace(/ /g, '_'))
          );

          // Process the results for frontend
          const modifiedResults = filteredResults.map(restaurant => {
            if (restaurant.image) {
              restaurant.image = `data:image/jpeg;base64,${Buffer.from(restaurant.image).toString('base64')}`;
            }
            return restaurant;
          });

          // Send response to the frontend
          res.json({ success: true, data: modifiedResults });
        }
      });
    });
  });
});


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
