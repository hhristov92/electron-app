const { contextBridge, ipcRenderer } = require("electron");
const { readdirSync, readFileSync } = require("fs");
const { join } = require("path");

console.log("Preload script loaded successfully.");

contextBridge.exposeInMainWorld("electronAPI", {
  appDir: __dirname, // Expose the application directory
  resolvePath: (...paths) => {
    const resolvedPath = join(...paths);
    console.log("Resolved path:", resolvedPath);
    return resolvedPath;
  },
  readDirectory: (dirPath) => {
    console.log("Reading directory:", dirPath);
    try {
      return readdirSync(dirPath);
    } catch (error) {
      console.error("Directory read error:", error);
      return [];
    }
  },
  readFile: (filePath) => {
    console.log("Reading file:", filePath);
    try {
      return readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error("File read error:", error);
      return null;
    }
  },
});

// Expose database and image handling APIs
contextBridge.exposeInMainWorld("dbAPI", {
  // Database operations
  getModels: () => ipcRenderer.invoke('db:getModels'),
  saveModel: (model) => ipcRenderer.invoke('db:saveModel', model),
  deleteModel: (id) => ipcRenderer.invoke('db:deleteModel', id),
  searchModels: (filters) => ipcRenderer.invoke('db:searchModels', filters),
  
  // Migration
  migrateFromLocalStorage: (data) => ipcRenderer.invoke('db:migrateFromLocalStorage', data)
});

// Expose image handling APIs
contextBridge.exposeInMainWorld("imageAPI", {
  saveImage: (data) => ipcRenderer.invoke('image:save', data),
  getImagePath: (path) => ipcRenderer.invoke('image:getPath', path)
});
