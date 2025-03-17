// Admin credentials (in a real app, this would be stored securely on a server)
const ADMIN_CREDENTIALS = [{ name: "admin", personalId: "1234" }];

// Base64 placeholder image
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjVmZiIvPjxwYXRoIGQ9Ik04NSA4MEgxMTVMMTI1IDEwMEwxMDAgMTMwTDc1IDEwMEw4NSA4MFoiIGZpbGw9IiM0Mjk5ZTEiLz48dGV4dCB4PSIxMDAiIHk9IjE2MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMmQzNzQ4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=";

// DOM Elements
const loginForm = document.getElementById("loginForm");
const adminLogin = document.getElementById("adminLogin");
const adminControls = document.getElementById("adminControls");
const addModelBtn = document.getElementById("addModelBtn");
const logoutBtn = document.getElementById("logoutBtn");
const addModelModal = document.getElementById("addModelModal");
const addModelForm = document.getElementById("addModelForm");
const cancelAddBtn = document.getElementById("cancelAdd");
const statusMessage = document.getElementById("statusMessage");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("results");

// State
let isAdminLoggedIn = false;
let models = [];
let currentModels = []; // Track current displayed models
let searchTimeout;

// Categories
const CATEGORIES = [
  "Начало",
  "Тоалетни",
  "Рингове",
  "Езици",
  "Казани",
  "Капаци",
  "FFC",
  "Други",
];

let currentCategory = "Начало"; // Default to Home category

// Initialize left panel
function initializeLeftPanel() {
  const leftPanel = document.querySelector(".left-panel");
  if (!leftPanel) return;

  // Add click handlers to existing category items
  document.querySelectorAll(".category-item").forEach((item, index) => {
    item.onclick = () => {
      // Update the UI to show active category
      document
        .querySelectorAll(".category-item")
        .forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      
      // Set the current category
      currentCategory = CATEGORIES[index];
      
      // Show a loading indicator
      resultsContainer.innerHTML = `
        <div class="loading-container" style="text-align: center; padding: 40px; width: 100%;">
          <div class="loading" style="display: inline-block; margin: 0 auto 15px;"></div>
          <p style="color: var(--gray); font-size: 1.1rem;">Филтриране на модели...</p>
        </div>
      `;
      
      // Small timeout to show the loading state
      setTimeout(() => {
        // Auto-filter when category is clicked, no need for explicit search
        filterAndDisplayModels();
      }, 300);
    };
  });
}

// Load models from database
async function loadModels() {
  try {
    const result = await window.dbAPI.getModels();
    if (result.success) {
      models = result.models.map(model => ({
        ...model,
        dimensions: JSON.parse(model.dimensions || '[]')
      }));
      currentModels = [...models];
      
      // If we're on the Home page, don't display models until search
      if (currentCategory === "Начало") {
        filterAndDisplayModels(); // This will show the welcome message
      } else {
        displayModels(currentModels, true);
      }
    } else {
      showStatus("Error loading models: " + result.error, "error");
    }
  } catch (error) {
    showStatus("Error loading models: " + error.message, "error");
    // Check if localStorage has models (for migration)
    checkAndMigrateData();
  }
}

// Migration from localStorage to database
async function checkAndMigrateData() {
  const storedModels = localStorage.getItem("pvcModels");
  if (storedModels) {
    try {
      const result = await window.dbAPI.getModels();
      if (result.success && result.models.length === 0) {
        // We have localStorage data but empty database - perfect time to migrate
        if (confirm("Искате ли да мигрирате моделите от локалната база данни към новата система за съхранение?")) {
          await migrateToDatabase();
        }
      }
    } catch (error) {
      console.error("Error checking database:", error);
    }
  }
}

// Migrate data from localStorage to database
async function migrateToDatabase() {
  try {
    const storedModels = localStorage.getItem("pvcModels");
    if (!storedModels) {
      showStatus("No data to migrate", "error");
      return;
    }
    
    // Show migration in progress
    showStatus("Migration in progress...");
    
    // Send data to main process for migration
    const result = await window.dbAPI.migrateFromLocalStorage(storedModels);
    
    if (result.success) {
      showStatus(result.message);
      // Clear localStorage after successful migration
      localStorage.removeItem("pvcModels");
      // Load models from the database
      await loadModels();
    } else {
      showStatus("Migration failed: " + result.error, "error");
    }
  } catch (error) {
    showStatus("Migration error: " + error.message, "error");
  }
}

// Show status message
function showStatus(message, type = "info") {
  console.log(`Status message: ${message} (${type})`);
  
  // Create or get the status element
  let statusElement = document.getElementById("statusMessage");
  
  if (!statusElement) {
    statusElement = document.createElement("div");
    statusElement.id = "statusMessage";
    statusElement.className = "status-message";
    document.body.appendChild(statusElement);
  }
  
  // Clear previous classes and timeouts
  statusElement.className = "status-message";
  clearTimeout(statusElement.timeout);
  
  // Set message and type
  statusElement.textContent = message;
  statusElement.classList.add(type);
  statusElement.classList.add("visible");
  
  // Auto hide after 3 seconds
  statusElement.timeout = setTimeout(() => {
    statusElement.classList.remove("visible");
  }, 3000);
}

// Handle admin login
function handleLogin(e) {
  e.preventDefault();
  const name = document.getElementById("adminName").value;
  const personalId = document.getElementById("personalId").value;

  console.log("Attempting login with:", name);
  
  const admin = ADMIN_CREDENTIALS.find(
    (a) => a.name === name && a.personalId === personalId
  );

  if (admin) {
    console.log("Admin login successful");
    isAdminLoggedIn = true;
    localStorage.setItem("isAdminLoggedIn", "true");
    adminLogin.style.display = "none";
    adminControls.style.display = "flex";
    
    // Ensure both buttons are fully visible with explicit styling
    addModelBtn.style.display = "block";
    addModelBtn.style.opacity = "1";
    logoutBtn.style.display = "block";
    logoutBtn.style.opacity = "1";
    
    showStatus("Успешен вход", "success");
    loginForm.reset();
    // Redisplay models to show edit/delete buttons
    displayModels(models);
  } else {
    console.log("Admin login failed");
    showStatus("Невалидни данни", "error");
  }
}

// Handle logout
function handleLogout() {
  console.log("Admin logging out");
  isAdminLoggedIn = false;
  localStorage.removeItem("isAdminLoggedIn");
  adminLogin.style.display = "block";
  adminControls.style.display = "none";
  addModelModal.style.display = "none";
  displayModels(models);
  showStatus("Успешен изход");
}

// Attach event listener to login form
if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
  console.log("Login form event listener attached");
} else {
  console.error("Login form element not found!");
}

// Show add model modal with improved visibility
function showAddModelModal() {
  console.log("Opening Add Model modal");
  
  if (!isAdminLoggedIn) {
    showStatus("Моля влезте като администратор за добавяне на модели", "error");
    return;
  }
  
  // Reset form and clear previous values
  addModelForm.reset();
  
  // Ensure we're using a clean handler for submission
  addModelForm.onsubmit = null;
  setTimeout(() => {
    addModelForm.onsubmit = handleAddModel;
  }, 100);
  
  // Update modal title to ensure it shows the add mode
  const modalHeader = document.querySelector("#addModelModal .modal-header h2");
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fas fa-plus-circle"></i> Добави нов модел`;
  }
  
  // Ensure the modal is shown with the correct display style
  addModelModal.style.display = "flex";
  
  console.log("Modal display style set to:", addModelModal.style.display);
  
  // Force a reflow to ensure the modal is visible
  setTimeout(() => {
    if (addModelModal.style.display !== "flex") {
      console.log("Modal visibility issue detected, forcing display");
      addModelModal.style.display = "flex";
      document.body.style.overflow = "hidden"; // Prevent scrolling behind modal
    }
  }, 50);
}

// Process the add model form data
async function processAddModelForm() {
  console.log("Processing add model form");
  
  const modelId = Date.now().toString();
  let imagePath = null;
  const imageFile = document.getElementById("modelImage").files[0];

  if (imageFile) {
    try {
      console.log("Processing image file:", imageFile.name);
      
      // Convert image to base64 for saving
      const fileReader = new FileReader();
      
      const base64Data = await new Promise((resolve, reject) => {
        fileReader.onload = () => {
          console.log("File successfully read");
          resolve(fileReader.result);
        };
        fileReader.onerror = (error) => {
          console.error("Error reading file:", error);
          reject(error);
        };
        fileReader.readAsDataURL(imageFile);
      });
      
      console.log("Image converted to base64, sending to main process");
      
      // Save image to file system with better encoding
      const imageResult = await window.imageAPI.saveImage({
        id: modelId,
        imageData: base64Data,
        fileName: imageFile.name // Include original filename for better reference
      });
      
      console.log("Image save result:", imageResult);
      
      if (imageResult.success) {
        // Store just the relative path in the database for consistency
        imagePath = imageResult.path;
        if (imagePath.includes('\\')) {
          // Extract just the filename portion for database storage
          const pathParts = imagePath.split('\\');
          imagePath = `images/${pathParts[pathParts.length - 1]}`;
        } else if (imagePath.includes('/')) {
          const pathParts = imagePath.split('/');
          imagePath = `images/${pathParts[pathParts.length - 1]}`;
        }
        console.log("Storing image path in database as:", imagePath);
      } else {
        throw new Error("Failed to save image: " + imageResult.error);
      }
    } catch (imageError) {
      console.error("Image processing error:", imageError);
      showStatus("Error processing image: " + imageError.message, "error");
      // Continue without image
    }
  }

  // Get dimensions from both fields
  const dimensionsF25 = document.getElementById("dimensionsF25")
    .value.split("\n")
    .map(d => d.trim())
    .filter(d => d);
  
  const dimensionsF20 = document.getElementById("dimensionsF20")
    .value.split("\n")
    .map(d => d.trim())
    .filter(d => d);
  
  // Combine dimensions with section headers
  const dimensions = [];
  
  if (dimensionsF25.length > 0) {
    dimensions.push("Ф25:");
    dimensions.push(...dimensionsF25);
  }
  
  if (dimensionsF20.length > 0) {
    dimensions.push("Ф20:");
    dimensions.push(...dimensionsF20);
  }
    
  const newModel = {
    id: modelId,
    name: document.getElementById("modelName").value,
    category: document.getElementById("modelCategory").value,
    dimensions: dimensions,
    image_path: imagePath
  };

  console.log("Saving model to database:", newModel);
  
  // Save model to database
  const result = await window.dbAPI.saveModel(newModel);
  
  if (result.success) {
    console.log("Model saved successfully");
    showStatus("Моделът е добавен успешно", "success");
    return newModel;
  } else {
    throw new Error("Failed to save model: " + result.error);
  }
}

// Handle Add Model Form Submission
async function handleAddModel(e) {
  e.preventDefault();
  
  console.log("Add model form submitted");
  if (!isAdminLoggedIn) {
    showStatus(
      "Моля влезте като администратор за добавяне на модели",
      "error"
    );
    return;
  }

  // Disable form submission to prevent multiple submissions
  const submitButton = addModelForm.querySelector("button[type='submit']");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Запазване...';
  }

  try {
    showStatus("Запазване на новия модел...", "info");
    
    // Remove any duplicate handlers by clearing and reassigning
    addModelForm.onsubmit = null;
    
    const newModel = await processAddModelForm();
    
    // Successful model addition
    console.log("Model saved, closing modal and refreshing");
    addModelForm.reset();
    addModelModal.style.display = "none";
    document.body.style.overflow = "auto"; // Re-enable scrolling
    
    // Wait a bit before reattaching the handler to prevent accidental double submissions
    setTimeout(() => {
      addModelForm.onsubmit = handleAddModel;
    }, 500);
    
    // Reload models to show the new one
    await loadModels();
  } catch (error) {
    console.error("Error in form processing:", error);
    showStatus(`Грешка при запазване на модела: ${error.message}`, "error");
    
    // Reattach the handler
    addModelForm.onsubmit = handleAddModel;
  } finally {
    // Re-enable the submit button in any case
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Запази';
    }
  }
}

// Initial form handler setup
addModelForm.onsubmit = handleAddModel;

// Improved display of models with animations
async function displayModels(modelsToShow, isInitialLoad = false, showCategoryLabels = false) {
  currentModels = modelsToShow;
  
  if (!modelsToShow || modelsToShow.length === 0) {
    showEmptyState();
    return;
  }
  
  console.log("Displaying", modelsToShow.length, "models");
  resultsContainer.innerHTML = "";
  
  // Create a document fragment for better performance
  const fragment = document.createDocumentFragment();
  
  for (const model of modelsToShow) {
    const modelCard = document.createElement("div");
    modelCard.className = "model-card";
    modelCard.dataset.id = model.id;
    
    // Get image source if available
    let imageSource = PLACEHOLDER_IMAGE;
    let imageLoaded = false;
    
    if (model.image_path) {
      try {
        // Get full image path from the main process
        console.log(`Fetching image path for model ${model.id} with path: ${model.image_path}`);
        const result = await window.imageAPI.getImagePath(model.image_path);
        console.log("Image path result:", result);
        
        if (result && result.success && result.path) {
          // Properly format the file path for Electron
          // Use normalization to handle backslashes and ensure proper URL encoding
          const formattedPath = result.path.replace(/\\/g, '/');
          imageSource = `file:///${formattedPath}`; // Add an extra slash for proper file:/// protocol format
          imageLoaded = true;
          console.log(`Using image at: ${imageSource}`);
        } else {
          console.warn(`Failed to get valid image path for model ${model.id}`);
        }
      } catch (error) {
        console.error(`Error getting image for model ${model.id}:`, error);
      }
    } else {
      console.log(`No image path specified for model ${model.id}`);
    }
    
    // Process dimensions to separate Ф25 and Ф20
    let f25Dimensions = [];
    let f20Dimensions = [];
    
    if (Array.isArray(model.dimensions) && model.dimensions.length > 0) {
      let inF25Section = false;
      let inF20Section = false;
      
      model.dimensions.forEach(line => {
        if (line.includes("Ф25:") || line === "Ф25:") {
          inF25Section = true;
          inF20Section = false;
        } else if (line.includes("Ф20:") || line === "Ф20:") {
          inF25Section = false;
          inF20Section = true;
        } else {
          if (inF25Section) {
            f25Dimensions.push(line);
          } else if (inF20Section) {
            f20Dimensions.push(line);
          } else {
            // If no explicit section, try to guess based on content
            if (line.toLowerCase().includes("ф25") || line.toLowerCase().includes("f25")) {
              f25Dimensions.push(line);
            } else if (line.toLowerCase().includes("ф20") || line.toLowerCase().includes("f20")) {
              f20Dimensions.push(line);
            } else {
              // Default to Ф25 if can't determine
              f25Dimensions.push(line);
            }
          }
        }
      });
    }
    
    // Create category badge HTML if showing category labels
    const categoryBadgeHTML = showCategoryLabels && model.category ? `
      <div class="category-badge">
        ${getCategoryIcon(model.category)} ${model.category}
      </div>
    ` : '';
    
    // Create the model card content with image and side-by-side dimensions
    modelCard.innerHTML = `
      <div class="model-image-container">
        <img src="${imageSource}" alt="${model.name}" class="model-image" data-id="${model.id}">
      </div>
      <div class="model-info">
        <div class="model-name-container">
          <h3 class="model-name">${model.name}</h3>
          ${categoryBadgeHTML}
        </div>
        <div class="model-dimensions-container">
          <div class="dimension-box">
            <div class="dimension-header">Ф25</div>
            <div class="dimension-content">
              ${f25Dimensions.length > 0 
                ? f25Dimensions.map(dim => `<div class="dimension-line">${dim}</div>`).join('')
                : '<p><em>Няма въведени размери</em></p>'
              }
            </div>
          </div>
          <div class="dimension-box">
            <div class="dimension-header">Ф20</div>
            <div class="dimension-content">
              ${f20Dimensions.length > 0 
                ? f20Dimensions.map(dim => `<div class="dimension-line">${dim}</div>`).join('')
                : '<p><em>Няма въведени размери</em></p>'
              }
            </div>
          </div>
        </div>
      </div>
      <div class="model-actions">
        <button class="btn action-btn edit-btn" title="Редактирай" data-id="${model.id}">
          <i class="fas fa-edit"></i> Редактирай
        </button>
        <button class="btn action-btn delete-btn" title="Изтрий" data-id="${model.id}">
          <i class="fas fa-trash-alt"></i> Изтрий
        </button>
      </div>
    `;
    
    // Add event listeners for image error with improved handling
    const modelImage = modelCard.querySelector(".model-image");
    modelImage.addEventListener("error", function(e) {
      console.error(`Image load error for model ${model.id}:`, e);
      console.log(`Failed image source was: ${this.src}`);
      this.src = PLACEHOLDER_IMAGE;
    });
    
    // If we loaded a real image, preload it with better error handling
    if (imageLoaded) {
      const img = new Image();
      img.onload = function() {
        console.log(`Successfully preloaded image for model ${model.id}`);
        modelImage.src = imageSource;
      };
      img.onerror = function(e) {
        console.error(`Failed to preload image for model ${model.id}:`, e);
        console.log(`Failed preload source was: ${img.src}`);
        modelImage.src = PLACEHOLDER_IMAGE;
      };
      
      // Set the source after attaching event handlers
      img.src = imageSource;
      
      // Add a fallback timeout in case image loading takes too long
      setTimeout(() => {
        if (!modelImage.complete || modelImage.naturalHeight === 0) {
          console.warn(`Image load timeout for model ${model.id}, using placeholder`);
          modelImage.src = PLACEHOLDER_IMAGE;
        }
      }, 3000);
    }
    
    // Add proper event listeners for edit and delete buttons
    const editBtn = modelCard.querySelector(".edit-btn");
    const deleteBtn = modelCard.querySelector(".delete-btn");
    
    // Only show admin buttons if admin is logged in
    if (!isAdminLoggedIn) {
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";
    } else {
      editBtn.style.display = "flex";
      deleteBtn.style.display = "flex";
      
      // Add event listeners properly
      editBtn.addEventListener("click", function() {
        console.log("Edit button clicked for model ID:", model.id);
        editModel(model.id);
      });
      
      deleteBtn.addEventListener("click", function() {
        console.log("Delete button clicked for model ID:", model.id);
        deleteModel(model.id);
      });
    }
    
    fragment.appendChild(modelCard);
  }
  
  // Append all cards at once
  resultsContainer.appendChild(fragment);
  
  // Animate cards appearing
  setTimeout(() => {
    document.querySelectorAll('.model-card').forEach(card => {
      card.classList.add('visible');
    });
  }, 50);
}

// Show detailed model information in a modal
async function showModelDetails(model) {
  // Create a temporary modal for displaying model details
  const detailsModal = document.createElement('div');
  detailsModal.className = 'modal';
  detailsModal.style.display = 'flex';
  
  // Show loading state in the modal
  detailsModal.innerHTML = `
    <div class="modal-content model-details-modal">
      <div class="modal-header">
        <h2><i class="fas fa-info-circle"></i> Детайли за модел: ${model.name}</h2>
        <button type="button" class="close-modal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Зареждане на детайли...</p>
        </div>
      </div>
    </div>
  `;
  
  // Add to body
  document.body.appendChild(detailsModal);
  
  // Add close button functionality
  const closeButton = detailsModal.querySelector('.close-modal');
  closeButton.addEventListener('click', () => {
    document.body.removeChild(detailsModal);
  });
  
  try {
    // Get proper image source
    let imageSource = PLACEHOLDER_IMAGE;
    if (model.image_path) {
      try {
        // Get full image path from the main process
        const result = await window.imageAPI.getImagePath(model.image_path);
        console.log("Image path result for details view:", result);
        
        if (result && result.success && result.path) {
          // Properly format the file path for Electron
          // Use normalization to handle backslashes and ensure proper URL encoding
          const formattedPath = result.path.replace(/\\/g, '/');
          imageSource = `file:///${formattedPath}`; // Add an extra slash for proper file:/// protocol format
          console.log(`Using image in details view: ${imageSource}`);
        }
      } catch (error) {
        console.error("Error getting image path for details view:", error);
      }
    }
    
    // Format dimensions for display
    const dimensionsHtml = formatDimensions(model.dimensions);
    
    // Update modal content with the details
    const modalContent = detailsModal.querySelector('.modal-content');
    modalContent.innerHTML = `
      <div class="modal-header">
        <h2><i class="fas fa-info-circle"></i> Детайли за модел: ${model.name}</h2>
        <button type="button" class="close-modal">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="details-container">
          <div class="details-image-container">
            <img src="${imageSource}" alt="${model.name}" class="details-image">
          </div>
          <div class="details-info">
            <div class="details-row">
              <strong>Категория:</strong> 
              <span>${getCategoryIcon(model.category)} ${model.category || "Без категория"}</span>
            </div>
            <div class="details-row">
              <strong>Размери:</strong>
              <div class="details-dimensions">
                ${dimensionsHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary-btn close-btn">
          <i class="fas fa-times"></i> Затвори
        </button>
        ${isAdminLoggedIn ? `
          <button class="btn primary-btn edit-btn" data-id="${model.id}">
            <i class="fas fa-edit"></i> Редактирай
          </button>
        ` : ''}
      </div>
    `;
    
    // Re-add event listeners
    const closeButtons = modalContent.querySelectorAll('.close-modal, .close-btn');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(detailsModal);
      });
    });
    
    // Add image error handler with improved logging
    const detailsImage = modalContent.querySelector('.details-image');
    detailsImage.addEventListener('error', function(e) {
      console.error("Error loading image in details view:", e);
      console.log("Failed image source was:", this.src);
      this.src = PLACEHOLDER_IMAGE;
    });
    
    // Preload the image for the details view
    if (imageSource !== PLACEHOLDER_IMAGE) {
      const img = new Image();
      img.onload = function() {
        console.log("Successfully preloaded image for details view");
        detailsImage.src = imageSource;
      };
      img.onerror = function(e) {
        console.error("Failed to preload image for details view:", e);
        detailsImage.src = PLACEHOLDER_IMAGE;
      };
      img.src = imageSource;
    }
    
    // Add edit button functionality if admin is logged in
    if (isAdminLoggedIn) {
      const editBtn = modalContent.querySelector('.edit-btn');
      editBtn.addEventListener('click', () => {
        document.body.removeChild(detailsModal);
        editModel(model.id);
      });
    }
  } catch (error) {
    console.error("Error displaying model details:", error);
    
    // Show error message in modal
    const modalBody = detailsModal.querySelector('.modal-body');
    modalBody.innerHTML = `
      <div class="error-container">
        <i class="fas fa-exclamation-circle" style="color: var(--error); font-size: 2rem;"></i>
        <p>Грешка при зареждане на детайли: ${error.message}</p>
      </div>
    `;
  }
  
  // Close when clicking outside the modal content
  detailsModal.addEventListener('click', (e) => {
    if (e.target === detailsModal) {
      document.body.removeChild(detailsModal);
    }
  });
}

// Helper function to get icon for category
function getCategoryIcon(category) {
  const iconMap = {
    'Тоалетни': '<i class="fas fa-toilet"></i>',
    'Рингове': '<i class="fas fa-ring"></i>',
    'Езици': '<i class="fas fa-tasks"></i>',
    'Казани': '<i class="fas fa-box"></i>',
    'Капаци': '<i class="fas fa-shield-alt"></i>',
    'FFC': '<i class="fas fa-stream"></i>',
    'Други': '<i class="fas fa-shapes"></i>'
  };
  
  return iconMap[category] || '<i class="fas fa-cube"></i>';
}

// Format dimensions for display
function formatDimensions(dimensions) {
  if (!dimensions || dimensions.length === 0) return "<p>Няма въведени размери</p>";
  
  // Group dimensions by section (looking for lines that might be headers)
  let sections = [];
  let currentSection = { title: "Размери", items: [] };
  
  dimensions.forEach(line => {
    // Check if line looks like a header (ends with ':' or is all caps or starts with a special character)
    if (line.endsWith(':') || line.toUpperCase() === line || line.startsWith('#') || line.startsWith('*')) {
      // If we already have items in the current section, save it and start a new one
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { 
        title: line.replace(/[:*#]/g, '').trim(), 
        items: [] 
      };
    } else {
      // This is a regular dimension line
      currentSection.items.push(line.trim());
    }
  });
  
  // Add the last section
  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }
  
  // If no sections were created, create a default one with all lines
  if (sections.length === 0) {
    sections.push({
      title: "Размери",
      items: dimensions
    });
  }
  
  // Generate HTML for all sections
  return sections.map(section => {
    return `
      <div class="dimension-section">
        <strong>${section.title}</strong>
        ${section.items.map(item => `<div>${item}</div>`).join('')}
      </div>
    `;
  }).join('');
}

// Improved empty state display
function showEmptyState(message = null) {
  const defaultMessage = "Няма намерени модели";
  const displayMessage = message || defaultMessage;
  
  console.log("Showing empty state:", displayMessage);
  
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <i class="fas fa-search"></i>
      </div>
      <h3 class="empty-state-title">${displayMessage}</h3>
      <p class="empty-state-description">
        Опитайте да изберете друга категория или променете търсеното име.
      </p>
    </div>
  `;
}

// Function alias for backward compatibility - redirect showStatusMessage to showStatus
function showStatusMessage(message, type = "info") {
  console.log("showStatusMessage called, redirecting to showStatus");
  showStatus(message, type);
}

// Improved filterAndDisplayModels function
function filterAndDisplayModels() {
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
  
  // Special case for Home (Начало) with no search term - show empty state telling user to search
  if (currentCategory === "Начало" && !searchTerm) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-search"></i>
        </div>
        <h3 class="empty-state-title">Добре дошли!</h3>
        <p class="empty-state-description">
          Потърсете модел или изберете категория от менюто вляво.
        </p>
      </div>
    `;
    return;
  }
  
  // Show loading state
  resultsContainer.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Зареждане на модели...</p>
    </div>
  `;
  
  // Get models from database using window.dbAPI instead of ipcRenderer
  const filters = {
    // Only apply category filter if not on the Home page or search is empty
    category: currentCategory !== "Начало" ? currentCategory : null,
    searchTerm: searchTerm
  };
  
  window.dbAPI.searchModels(filters)
    .then(result => {
      if (!result.success) {
        showStatusMessage(`Грешка при зареждане на модели: ${result.error}`, "error");
        showEmptyState("Грешка при зареждане на моделите");
        return;
      }
      
      const models = result.models;
      
      if (!models || models.length === 0) {
        // Show appropriate empty state message
        if (currentCategory === "Начало" && !searchTerm) {
          // This should never happen now due to early return above, but keeping for safety
          showEmptyState("Потърсете модел или изберете категория от менюто вляво");
        } else if (searchTerm && currentCategory !== "Начало") {
          showEmptyState(`Няма намерени модели "${searchTerm}" в категория "${currentCategory}"`);
        } else if (searchTerm) {
          showEmptyState(`Няма намерени модели за "${searchTerm}"`);
        } else if (currentCategory !== "Начало") {
          showEmptyState(`Няма модели в категория "${currentCategory}"`);
        } else {
          showEmptyState();
        }
        return;
      }
      
      // Process models to parse dimensions
      const processedModels = models.map(model => ({
        ...model,
        dimensions: JSON.parse(model.dimensions || '[]')
      }));
      
      // On Home page with a search term, we want to show models with their category
      const showCategoryLabels = currentCategory === "Начало" && searchTerm;
      
      // Display filtered models with category labels if needed
      displayModels(processedModels, false, showCategoryLabels);
    })
    .catch(err => {
      console.error("Error fetching models:", err);
      showStatusMessage(`Грешка при зареждане на модели: ${err.message}`, "error");
      showEmptyState("Грешка при зареждане на моделите");
    });
}

// Update search handler
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    filterAndDisplayModels();
  }, 300);
});

// Add Enter key handler for search
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    filterAndDisplayModels();
  }
});

// Search button click handler
searchBtn.addEventListener("click", (e) => {
  e.preventDefault();
  filterAndDisplayModels();
});

// Edit model - fixed version
async function editModel(modelId) {
  console.log("Editing model with ID:", modelId);
  
  if (!isAdminLoggedIn) {
    showStatus(
      "Моля влезте като администратор за редактиране на моделите",
      "error"
    );
    return;
  }

  // Find the model in our data
  const model = models.find((m) => m.id === modelId);
  if (!model) {
    console.error("Model not found with ID:", modelId);
    showStatus("Моделът не е намерен", "error");
    return;
  }

  console.log("Found model to edit:", model);

  // Clear any existing handlers first
  addModelForm.onsubmit = null;

  // Set the form values
  document.getElementById("modelName").value = model.name || "";
  document.getElementById("modelCategory").value = model.category || CATEGORIES[0];
  
  // Split dimensions into Ф25 and Ф20 sections
  let dimensionsF25 = [];
  let dimensionsF20 = [];
  
  if (Array.isArray(model.dimensions)) {
    let currentSection = ""; 
    
    model.dimensions.forEach(line => {
      if (line.includes("Ф25:") || line === "Ф25:") {
        currentSection = "Ф25";
      } else if (line.includes("Ф20:") || line === "Ф20:") {
        currentSection = "Ф20";
      } else {
        if (currentSection === "Ф25") {
          dimensionsF25.push(line);
        } else if (currentSection === "Ф20") {
          dimensionsF20.push(line);
        } else {
          // For backward compatibility with old format
          // If no section headers, try to guess based on content
          if (line.toLowerCase().includes("ф25") || line.toLowerCase().includes("f25")) {
            dimensionsF25.push(line);
          } else if (line.toLowerCase().includes("ф20") || line.toLowerCase().includes("f20")) {
            dimensionsF20.push(line);
          } else {
            // Default to Ф25 if can't determine
            dimensionsF25.push(line);
          }
        }
      }
    });
  }
  
  document.getElementById("dimensionsF25").value = dimensionsF25.join("\n");
  document.getElementById("dimensionsF20").value = dimensionsF20.join("\n");

  // Update modal title to show we're editing
  const modalHeader = document.querySelector("#addModelModal .modal-header h2");
  if (modalHeader) {
    modalHeader.innerHTML = `<i class="fas fa-edit"></i> Редактирай модел: ${model.name}`;
  }

  // Display the modal - use flex instead of block for consistency
  console.log("Showing edit modal...");
  addModelModal.style.display = "flex";
  document.body.style.overflow = "hidden"; // Prevent scrolling
  console.log("Modal display style set to:", addModelModal.style.display);
  
  // Force modal to appear in next event loop
  setTimeout(() => {
    if (addModelModal.style.display !== "flex") {
      console.log("Modal not visible after timeout, forcing display");
      addModelModal.style.display = "flex";
    }
  }, 10);

  // Update form submission handler for editing
  setTimeout(() => {
    addModelForm.onsubmit = async (e) => {
      e.preventDefault();
      console.log("Edit form submitted for model ID:", modelId);
  
      if (!isAdminLoggedIn) {
        showStatus(
          "Моля влезте като администратор за запазване на промените",
          "error"
        );
        return;
      }
  
      // Disable form submission to prevent multiple submissions
      const submitButton = addModelForm.querySelector("button[type='submit']");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Запазване...';
      }
  
      try {
        showStatus("Запазване на промените...", "info");
        
        // Handle image update
        let imagePath = model.image_path;
        const imageFile = document.getElementById("modelImage").files[0];
        
        if (imageFile) {
          console.log("New image selected for upload:", imageFile.name);
          // Convert image to base64 for saving
          const fileReader = new FileReader();
          const base64Data = await new Promise((resolve, reject) => {
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = (error) => {
              console.error("Error reading file:", error);
              reject(error);
            };
            fileReader.readAsDataURL(imageFile);
          });
          
          // Save image to file system with improved handling
          const imageResult = await window.imageAPI.saveImage({
            id: model.id,
            imageData: base64Data,
            fileName: imageFile.name // Include original filename for reference
          });
          
          console.log("Image save result:", imageResult);
          
          if (imageResult.success) {
            // Store just the relative path in the database for consistency
            imagePath = imageResult.path;
            if (imagePath.includes('\\')) {
              // Extract just the filename portion for database storage
              const pathParts = imagePath.split('\\');
              imagePath = `images/${pathParts[pathParts.length - 1]}`;
            } else if (imagePath.includes('/')) {
              const pathParts = imagePath.split('/');
              imagePath = `images/${pathParts[pathParts.length - 1]}`;
            }
            console.log("Storing image path in database as:", imagePath);
          } else {
            throw new Error("Failed to save image: " + imageResult.error);
          }
        }
  
        // Get dimensions from both fields
        const dimensionsF25 = document.getElementById("dimensionsF25")
          .value.split("\n")
          .map(d => d.trim())
          .filter(d => d);
        
        const dimensionsF20 = document.getElementById("dimensionsF20")
          .value.split("\n")
          .map(d => d.trim())
          .filter(d => d);
        
        // Combine dimensions with section headers
        const dimensions = [];
        
        if (dimensionsF25.length > 0) {
          dimensions.push("Ф25:");
          dimensions.push(...dimensionsF25);
        }
        
        if (dimensionsF20.length > 0) {
          dimensions.push("Ф20:");
          dimensions.push(...dimensionsF20);
        }
          
        const updatedModel = {
          id: modelId,
          name: document.getElementById("modelName").value,
          category: document.getElementById("modelCategory").value,
          dimensions: dimensions,
          image_path: imagePath
        };
        
        console.log("Updating model in database:", updatedModel);
        
        // Save model to database
        const result = await window.dbAPI.saveModel(updatedModel);
        
        if (result.success) {
          console.log("Model updated successfully");
          showStatus("Моделът е обновен успешно", "success");
          addModelForm.reset();
          addModelModal.style.display = "none";
          document.body.style.overflow = "auto"; // Re-enable scrolling
          await loadModels();
        } else {
          throw new Error("Failed to update model: " + result.error);
        }
      } catch (error) {
        console.error("Error updating model:", error);
        showStatus(`Грешка при обновяване на модела: ${error.message}`, "error");
      } finally {
        // Re-enable the submit button in any case
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = 'Запази';
        }
      }
    };
  }, 100);
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, initializing application');
  
  // Check if user was previously logged in
  isAdminLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";
  
  if (isAdminLoggedIn) {
    console.log("Admin already logged in");
    adminLogin.style.display = "none";
    adminControls.style.display = "flex";
    
    // Ensure both buttons are fully visible with explicit styling
    addModelBtn.style.display = "block";
    addModelBtn.style.opacity = "1";
    logoutBtn.style.display = "block";
    logoutBtn.style.opacity = "1";
  } else {
    console.log("Admin not logged in");
    adminLogin.style.display = "block";
    adminControls.style.display = "none";
  }
  
  // Verify login form has its event listener
  if (loginForm && !loginForm._hasSubmitListener) {
    loginForm.addEventListener("submit", handleLogin);
    loginForm._hasSubmitListener = true;
    console.log("Login form event listener attached during initialization");
  }
  
  // Initialize other event listeners
  initializeLeftPanel();
  
  // Set up logout button event listener
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
    console.log("Logout button event listener attached");
  }
  
  // Set up add model button event listener
  if (addModelBtn) {
    addModelBtn.addEventListener("click", showAddModelModal);
    console.log("Add model button event listener attached");
  }
  
  // Set up cancel button for add/edit model modal
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener("click", () => {
      console.log("Cancelling add/edit operation");
      addModelModal.style.display = "none";
      document.body.style.overflow = "auto"; // Re-enable scrolling
    });
    console.log("Cancel button event listener attached");
  }
  
  // Set up close (X) button on modal
  const closeModalBtn = document.getElementById("closeModal");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      console.log("Closing modal via X button");
      addModelModal.style.display = "none";
      document.body.style.overflow = "auto"; // Re-enable scrolling
    });
    console.log("Close button (X) event listener attached");
  }
  
  // Set up ESC key handler for modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && addModelModal.style.display === "flex") {
      console.log("Closing modal via ESC key");
      addModelModal.style.display = "none";
      document.body.style.overflow = "auto"; // Re-enable scrolling
    }
  });
  
  // Load models
  loadModels();
});