const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

let db;
let mainWindow;

// Setup the SQLite database
function setupDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'models.db');
  
  console.log('Initializing database at:', dbPath);
  
  // Create the database connection
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Database connection error:', err.message);
      return;
    }
    console.log('Connected to the SQLite database');
  });
  
  // Create tables if they don't exist
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        dimensions TEXT,
        image_path TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_models_name ON models(name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_models_category ON models(category)`);
  });
}

function createWindow() {
  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' file: data:; " +
          "connect-src 'self'"
        ]
      }
    });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: false,  // Disable sandbox to allow preload scripts to use Node.js modules
      webSecurity: true
    },
  });

  mainWindow.loadFile("index.html");
  
  // Open DevTools in development
  mainWindow.webContents.openDevTools();
}

// Database operations
ipcMain.handle('db:getModels', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM models ORDER BY name', [], (err, rows) => {
      if (err) {
        console.error('Error getting models:', err.message);
        resolve({ success: false, error: err.message });
        return;
      }
      resolve({ success: true, models: rows });
    });
  });
});

ipcMain.handle('db:saveModel', async (event, model) => {
  return new Promise((resolve, reject) => {
    const { id, name, category, dimensions, image_path } = model;
    const now = Date.now();
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO models (id, name, category, dimensions, image_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      name,
      category,
      JSON.stringify(dimensions),
      image_path,
      now,
      now,
      function(err) {
        if (err) {
          console.error('Error saving model:', err.message);
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true });
      }
    );
    
    stmt.finalize();
  });
});

ipcMain.handle('db:deleteModel', async (event, id) => {
  return new Promise((resolve, reject) => {
    // First get the model to find its image path
    db.get('SELECT image_path FROM models WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error finding model:', err.message);
        resolve({ success: false, error: err.message });
        return;
      }
      
      // Delete the model from database
      db.run('DELETE FROM models WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting model:', err.message);
          resolve({ success: false, error: err.message });
          return;
        }
        
        // Delete the image file if it exists
        if (row && row.image_path) {
          const imagePath = path.join(app.getPath('userData'), row.image_path);
          if (fs.existsSync(imagePath)) {
            try {
              fs.unlinkSync(imagePath);
            } catch (fsErr) {
              console.error('Error deleting image file:', fsErr.message);
              // Continue even if image deletion fails
            }
          }
        }
        
        resolve({ success: true });
      });
    });
  });
});

ipcMain.handle('db:searchModels', async (event, { category, searchTerm }) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM models WHERE 1=1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (searchTerm && searchTerm.trim()) {
      query += ' AND name LIKE ?';
      params.push(`%${searchTerm}%`);
    }
    
    query += ' ORDER BY name';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error searching models:', err.message);
        resolve({ success: false, error: err.message });
        return;
      }
      resolve({ success: true, models: rows });
    });
  });
});

// Image handling
ipcMain.handle('image:save', (event, { id, imageData }) => {
  try {
    // Create images directory if it doesn't exist
    const userDataPath = app.getPath('userData');
    const imagesDir = path.join(userDataPath, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Handle Base64 data
    if (imageData.startsWith('data:')) {
      // Extract base64 content
      const base64Data = imageData.split(',')[1];
      // Get file extension from mime type
      const mimeMatch = imageData.match(/data:([^;]+);/);
      if (!mimeMatch) {
        return { success: false, error: 'Invalid image data format' };
      }
      
      const mimeType = mimeMatch[1];
      const ext = mimeType.split('/')[1] || 'png';
      
      // Save the file
      const filename = `${id}.${ext}`;
      const filePath = path.join(imagesDir, filename);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      
      return { 
        success: true, 
        path: `images/${filename}`
      };
    }
    // If it's already a file path, just return it
    else if (imageData.startsWith('images/')) {
      return { success: true, path: imageData };
    }
    
    return { success: false, error: 'Invalid image data format' };
  } catch (error) {
    console.error('Error saving image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('image:getPath', (event, relativePath) => {
  try {
    if (!relativePath) {
      return { success: false, error: 'No path provided' };
    }
    
    const userDataPath = app.getPath('userData');
    const fullPath = path.join(userDataPath, relativePath);
    
    // Check if the file exists
    if (fs.existsSync(fullPath)) {
      return { success: true, path: fullPath };
    } else {
      console.error(`Image file does not exist: ${fullPath}`);
      return { success: false, error: 'Image file not found', path: null };
    }
  } catch (error) {
    console.error('Error resolving image path:', error);
    return { success: false, error: error.message, path: null };
  }
});

// Migration from localStorage to SQLite
ipcMain.handle('db:migrateFromLocalStorage', async (event, localStorageData) => {
  return new Promise((resolve, reject) => {
    try {
      const models = JSON.parse(localStorageData);
      if (!Array.isArray(models)) {
        resolve({ success: false, error: 'Invalid data format' });
        return;
      }
      
      // Begin transaction
      db.run('BEGIN TRANSACTION', function(err) {
        if (err) {
          console.error('Transaction error:', err.message);
          resolve({ success: false, error: err.message });
          return;
        }
        
        const now = Date.now();
        let migratedCount = 0;
        let pendingOperations = models.length;
        
        // If no models to migrate, just end the transaction
        if (models.length === 0) {
          db.run('COMMIT', function(err) {
            if (err) {
              console.error('Commit error:', err.message);
              resolve({ success: false, error: err.message });
              return;
            }
            resolve({ success: true, message: 'No models to migrate' });
          });
          return;
        }
        
        // Process each model
        models.forEach(model => {
          // Extract image from base64 if present
          let imagePath = null;
          if (model.imageUrl && model.imageUrl !== "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjVmZiIvPjxwYXRoIGQ9Ik04NSA4MEgxMTVMMTI1IDEwMEwxMDAgMTMwTDc1IDEwMEw4NSA4MFoiIGZpbGw9IiM0Mjk5ZTEiLz48dGV4dCB4PSIxMDAiIHk9IjE2MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMmQzNzQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=") {
            try {
              // Create images directory if it doesn't exist
              const userDataPath = app.getPath('userData');
              const imagesDir = path.join(userDataPath, 'images');
              if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
              }
              
              // Handle Base64 data
              if (model.imageUrl.startsWith('data:')) {
                // Extract base64 content
                const parts = model.imageUrl.split(',');
                if (parts.length === 2) {
                  const base64Content = parts[1];
                  // Get file extension from mime type
                  const mimeMatch = parts[0].match(/data:([^;]+);/);
                  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                  const ext = mimeType.split('/')[1] || 'png';
                  
                  // Save the file
                  const filename = `${model.id}.${ext}`;
                  const filePath = path.join(imagesDir, filename);
                  fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));
                  
                  imagePath = `images/${filename}`;
                }
              }
            } catch (imageError) {
              console.error('Error saving image during migration:', imageError);
              // Continue without the image if there's an error
            }
          }
          
          // Prepare the statement
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO models (id, name, category, dimensions, image_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          
          const modelId = model.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
          
          stmt.run(
            modelId,
            model.name,
            model.category,
            JSON.stringify(model.dimensions || []),
            imagePath,
            now,
            now,
            function(err) {
              if (err) {
                console.error('Error inserting model during migration:', err.message);
                // Continue with other models even if one fails
              } else {
                migratedCount++;
              }
              
              // Finalize the statement
              stmt.finalize();
              
              // Decrement pending operations
              pendingOperations--;
              
              // If this is the last operation, commit the transaction
              if (pendingOperations === 0) {
                db.run('COMMIT', function(err) {
                  if (err) {
                    console.error('Commit error:', err.message);
                    resolve({ success: false, error: err.message });
                    return;
                  }
                  resolve({ 
                    success: true, 
                    message: `Successfully migrated ${migratedCount} models to the database` 
                  });
                });
              }
            }
          );
        });
      });
    } catch (error) {
      console.error('Migration error:', error);
      resolve({ success: false, error: error.message });
    }
  });
});

app.whenReady().then(() => {
  setupDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  // Close the database connection before quitting
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database on app quit:', err.message);
      }
    });
  }
  
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
