// fractal-terrain.js - interactive fractal terrain visualization
// Based on rd_view/assign5/fractalTerrain.cc C++ implementation
// Uses midpoint displacement diamond-square algorithm for terrain generation

// Assumes THREE is loaded globally

/**
 * Generates a height map using the diamond-square algorithm
 * @param {number} n - Grid size exponent (grid will be 2^n + 1)
 * @param {number} D - Fractal dimension (roughness factor)
 * @param {number} seed - Random seed
 * @param {number} sigma - Initial standard deviation (height scale)
 * @returns {Array<Array<number>>} 2D grid of heights
 */
function generateFractalTerrain(n, D, seed, sigma) {
  // Initialize parameters
  const H = 3.0 - D; // Hurst exponent
  const size = (1 << n) + 1; // 2^n + 1
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  
  // Setup pseudorandom Gaussian generator
  // We use a simple approximation of Gaussian through multiple uniform samples
  let s = seed || 12345;
  function randGauss() {
    // Box-Muller transform for Gaussian random number
    const u1 = rand();
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  
  // Seed-based uniform random number generator
  function rand() {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  }
  
  // Step 1: Set corner values
  let delta = sigma;
  grid[0][0] = delta * randGauss();
  grid[0][size-1] = delta * randGauss();
  grid[size-1][0] = delta * randGauss();
  grid[size-1][size-1] = delta * randGauss();
  
  // These track the current grid step sizes
  let D_step = size - 1; // Full step
  let d_step = D_step / 2; // Half step
  
  // Main algorithm loop
  for (let stage = 1; stage <= n; stage++) {
    // Reduce random variation according to fractal dimension
    delta = delta * Math.pow(0.5, 0.5 * H);
    
    // Calculate values at center of each square (diamond step)
    for (let x = d_step; x < size - 1; x += D_step) {
      for (let y = d_step; y < size - 1; y += D_step) {
        // Average the four corners plus random displacement
        const avg = (
          grid[x + d_step][y + d_step] + 
          grid[x + d_step][y - d_step] + 
          grid[x - d_step][y + d_step] + 
          grid[x - d_step][y - d_step]
        ) / 4.0;
        
        grid[x][y] = avg + delta * randGauss();
      }
    }
    
    // Apply additional randomness to existing points for more natural look
    for (let x = 0; x <= size - 1; x += D_step) {
      for (let y = 0; y <= size - 1; y += D_step) {
        grid[x][y] = grid[x][y] + delta * randGauss();
      }
    }
    
    // Further reduce random variation for square step
    delta = delta * Math.pow(0.5, 0.5 * H);
    
    // Calculate midpoint values at edges (special case for boundaries)
    // This is the "square" step where we use diamond midpoints
    for (let x = d_step; x < size - 1; x += D_step) {
      // Bottom edge - only 3 neighbors
      let avg = (grid[x + d_step][0] + grid[x - d_step][0] + grid[x][d_step]) / 3.0;
      grid[x][0] = avg + delta * randGauss();
      
      // Top edge - only 3 neighbors
      avg = (grid[x + d_step][size - 1] + grid[x - d_step][size - 1] + grid[x][size - 1 - d_step]) / 3.0;
      grid[x][size - 1] = avg + delta * randGauss();
      
      // Left edge - only 3 neighbors
      avg = (grid[0][x + d_step] + grid[0][x - d_step] + grid[d_step][x]) / 3.0;
      grid[0][x] = avg + delta * randGauss();
      
      // Right edge - only 3 neighbors
      avg = (grid[size - 1][x + d_step] + grid[size - 1][x - d_step] + grid[size - 1 - d_step][x]) / 3.0;
      grid[size - 1][x] = avg + delta * randGauss();
    }
    
    // Calculate values at interior edges (4 neighbors)
    for (let x = d_step; x < size - 1; x += D_step) {
      for (let y = D_step; y < size - 1; y += D_step) {
        const avg = (grid[x][y + d_step] + grid[x][y - d_step] + grid[x + d_step][y] + grid[x - d_step][y]) / 4.0;
        grid[x][y] = avg + delta * randGauss();
      }
    }
    
    for (let x = D_step; x < size - 1; x += D_step) {
      for (let y = d_step; y < size - 1; y += D_step) {
        const avg = (grid[x][y + d_step] + grid[x][y - d_step] + grid[x + d_step][y] + grid[x - d_step][y]) / 4.0;
        grid[x][y] = avg + delta * randGauss();
      }
    }
    
    // Apply more randomization to existing points for increased naturalism
    for (let x = 0; x <= size - 1; x += D_step) {
      for (let y = 0; y <= size - 1; y += D_step) {
        grid[x][y] = grid[x][y] + delta * randGauss();
      }
    }
    
    for (let x = d_step; x < size - 1; x += D_step) {
      for (let y = d_step; y < size - 1; y += D_step) {
        grid[x][y] = grid[x][y] + delta * randGauss();
      }
    }
    
    // Prepare for next iteration - halve the step sizes
    D_step /= 2;
    d_step /= 2;
  }
  
  // Normalize the grid to [0, 1] range
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      min = Math.min(min, grid[i][j]);
      max = Math.max(max, grid[i][j]);
    }
  }
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      grid[i][j] = (grid[i][j] - min) / (max - min);
    }
  }
  
  return grid;
}

/**
 * Maps height values to colors with smooth transitions
 * @param {number} h - Height value (0-1)
 * @returns {THREE.Color} Color object
 */
function colorForHeight(h) {
  // Enhanced color palette with smoother transitions
  if (h < 0.15) return new THREE.Color(0x0A2140); // Deep water
  if (h < 0.3) return lerp(new THREE.Color(0x0A2140), new THREE.Color(0x4fc3f7), (h - 0.15) / 0.15); // Transition to shallow
  if (h < 0.35) return lerp(new THREE.Color(0x4fc3f7), new THREE.Color(0xf7e9a0), (h - 0.3) / 0.05); // Transition to sand
  if (h < 0.55) return lerp(new THREE.Color(0xf7e9a0), new THREE.Color(0x81c784), (h - 0.35) / 0.2); // Transition to grass
  if (h < 0.75) return lerp(new THREE.Color(0x81c784), new THREE.Color(0x8d6e63), (h - 0.55) / 0.2); // Transition to mountain
  if (h < 0.85) return lerp(new THREE.Color(0x8d6e63), new THREE.Color(0xffffff), (h - 0.75) / 0.1); // Transition to snow
  return new THREE.Color(0xffffff); // Snow
}

function lerp(colorA, colorB, t) {
  return new THREE.Color(
    colorA.r + (colorB.r - colorA.r) * t,
    colorA.g + (colorB.g - colorA.g) * t,
    colorA.b + (colorB.b - colorA.b) * t
  );
}

function FractalTerrainViewer(containerId, controlsId) {
  console.log('[FractalTerrainViewer] Initializing viewer...');
  
  this.container = document.getElementById(containerId);
  this.controlsPanel = document.getElementById(controlsId);
  if (!this.container || !this.controlsPanel) {
    console.error('[FractalTerrainViewer] Container or controls panel not found');
    return;
  }
  
  // Scene setup
  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0x050512);
    // Camera setup
  this.camera = new THREE.PerspectiveCamera(60, this.container.offsetWidth / this.container.offsetHeight, 0.1, 1000);
  this.camera.position.set(0, -1, 1.5); // Position camera below terrain for bottom-up view
  this.camera.lookAt(0, 0, 0);
  
  // Renderer
  this.renderer = new THREE.WebGLRenderer({ antialias: true });
  this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
  this.container.appendChild(this.renderer.domElement);
  
  // Controls
  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  this.controls.enableDamping = true;
  this.controls.dampingFactor = 0.25;
  
  // Default parameters
  this.params = {
    n: 7,                 // Detail level
    D: 2.2,               // Fractal dimension (2.0-3.0)
    seed: 852,            // Random seed
    sigma: 1.0,           // Initial height scale
    mode: 'solid'         // Rendering mode
  };
  
  // Scene objects
  this.mesh = null;
  this.wireframeMesh = null;
  
  // Initialize
  this.setupLights();
  this.createControls();
  this.generateTerrain();
  
  // Animation loop
  const animate = () => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._animationId = requestAnimationFrame(animate);
  };
  animate();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (!this.camera || !this.renderer || !this.container) return;
    
    this.camera.aspect = this.container.offsetWidth / this.container.offsetHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
  });
}

// Set up lighting for the scene
FractalTerrainViewer.prototype.setupLights = function() {
  // Ambient light
  const ambient = new THREE.AmbientLight(0x404040, 0.6);
  this.scene.add(ambient);
  
  // Directional light for shadows and highlights
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  directional.position.set(2, 5, 3);
  this.scene.add(directional);
  
  // Hemisphere light for more natural lighting
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x404040, 0.4);
  this.scene.add(hemisphere);
};

// Create UI controls
FractalTerrainViewer.prototype.createControls = function() {
  // Clear container
  this.controlsPanel.innerHTML = '';
  
  // Main controls container
  const controls = document.createElement('div');
  controls.className = 'control-group';
  
  // Detail level (n)
  const nContainer = document.createElement('div');
  const nLabel = document.createElement('label');
  nLabel.textContent = 'Detail Level (n): ';
  const nInput = document.createElement('input');
  nInput.type = 'range';
  nInput.min = '5';
  nInput.max = '9';
  nInput.step = '1';
  nInput.value = this.params.n;
  const nValue = document.createElement('span');
  nValue.textContent = this.params.n;
  nInput.addEventListener('input', () => {
    this.params.n = parseInt(nInput.value);
    nValue.textContent = this.params.n;
    this.generateTerrain();
  });
  nContainer.appendChild(nLabel);
  nContainer.appendChild(nInput);
  nContainer.appendChild(nValue);
  controls.appendChild(nContainer);
  
  // Fractal dimension (roughness)
  const dContainer = document.createElement('div');
  const dLabel = document.createElement('label');
  dLabel.textContent = 'Roughness (D): ';
  const dInput = document.createElement('input');
  dInput.type = 'range';
  dInput.min = '2.0';
  dInput.max = '2.9';
  dInput.step = '0.05';
  dInput.value = this.params.D;
  const dValue = document.createElement('span');
  dValue.textContent = this.params.D;
  dInput.addEventListener('input', () => {
    this.params.D = parseFloat(dInput.value);
    dValue.textContent = this.params.D;
    this.generateTerrain();
  });
  dContainer.appendChild(dLabel);
  dContainer.appendChild(dInput);
  dContainer.appendChild(dValue);
  controls.appendChild(dContainer);
  
  // Random seed
  const seedContainer = document.createElement('div');
  const seedLabel = document.createElement('label');
  seedLabel.textContent = 'Random Seed: ';
  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.min = '1';
  seedInput.max = '9999';
  seedInput.value = this.params.seed;
  seedInput.addEventListener('change', () => {
    this.params.seed = parseInt(seedInput.value);
    this.generateTerrain();
  });
  seedContainer.appendChild(seedLabel);
  seedContainer.appendChild(seedInput);
  controls.appendChild(seedContainer);
  
  // Height scale (sigma)
  const sigmaContainer = document.createElement('div');
  const sigmaLabel = document.createElement('label');
  sigmaLabel.textContent = 'Height Scale: ';
  const sigmaInput = document.createElement('input');
  sigmaInput.type = 'range';
  sigmaInput.min = '0.2';
  sigmaInput.max = '2.0';
  sigmaInput.step = '0.1';
  sigmaInput.value = this.params.sigma;
  const sigmaValue = document.createElement('span');
  sigmaValue.textContent = this.params.sigma;
  sigmaInput.addEventListener('input', () => {
    this.params.sigma = parseFloat(sigmaInput.value);
    sigmaValue.textContent = this.params.sigma;
    this.generateTerrain();
  });
  sigmaContainer.appendChild(sigmaLabel);
  sigmaContainer.appendChild(sigmaInput);
  sigmaContainer.appendChild(sigmaValue);
  controls.appendChild(sigmaContainer);
  
  // Display mode
  const modeContainer = document.createElement('div');
  const modeLabel = document.createElement('label');
  modeLabel.textContent = 'Display Mode: ';
  const modeSelect = document.createElement('select');
  ['solid', 'wireframe', 'both'].forEach(mode => {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    modeSelect.appendChild(option);
  });
  modeSelect.value = this.params.mode;
  modeSelect.addEventListener('change', () => {
    this.params.mode = modeSelect.value;
    this.updateTerrainDisplay();
  });
  modeContainer.appendChild(modeLabel);
  modeContainer.appendChild(modeSelect);
  controls.appendChild(modeContainer);
  
  // Reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset All Parameters';
  resetButton.addEventListener('click', () => {
    this.reset();
  });
  controls.appendChild(resetButton);
  
  // Random button
  const randomButton = document.createElement('button');
  randomButton.textContent = 'Random Terrain';
  randomButton.addEventListener('click', () => {
    this.params.seed = Math.floor(Math.random() * 9999) + 1;
    seedInput.value = this.params.seed;
    this.generateTerrain();
  });
  controls.appendChild(randomButton);
  
  this.controlsPanel.appendChild(controls);
};

// Generate the fractal terrain mesh
FractalTerrainViewer.prototype.generateTerrain = function() {
  // Clean up previous meshes
  if (this.mesh) {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
  
  if (this.wireframeMesh) {
    this.scene.remove(this.wireframeMesh);
    this.wireframeMesh.geometry.dispose();
  }
  
  const p = this.params;
  
  // Generate the height map using improved algorithm
  const grid = generateFractalTerrain(p.n, p.D, p.seed, p.sigma);
  const size = grid.length;
  
  // Create geometry
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const normals = [];
  const indices = [];
    // Scale factor for terrain
  const scaleFactor = 2.0;
  const heightScale = p.sigma; // Use the sigma parameter directly as height scale
  
  // Fill position and color data
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      // Position: map to -1 to 1 range in X and Y, scale Z by height
      const x = (i / (size - 1) - 0.5) * scaleFactor;
      const y = (j / (size - 1) - 0.5) * scaleFactor;
      const z = (grid[i][j] - 0.5) * heightScale;
      
      positions.push(x, y, z);
      
      // Color based on height
      const color = colorForHeight(grid[i][j]);
      colors.push(color.r, color.g, color.b);
      
      // Normals will be computed later
      normals.push(0, 0, 1);
    }
  }
  
  // Create indices for triangles
  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size - 1; j++) {
      const a = i * size + j;
      const b = i * size + (j + 1);
      const c = (i + 1) * size + j;
      const d = (i + 1) * size + (j + 1);
      
      // Two triangles for each grid cell
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  // Set attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  
  // Compute proper normals for lighting
  geometry.computeVertexNormals();
  
  // Create material for solid rendering
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    side: THREE.FrontSide
  });
  
  // Create the mesh
  this.mesh = new THREE.Mesh(geometry, material);
  
  // Create wireframe if needed
  if (p.mode === 'wireframe' || p.mode === 'both') {
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2
    });
    
    const wireframe = new THREE.WireframeGeometry(geometry);
    this.wireframeMesh = new THREE.LineSegments(wireframe, wireframeMaterial);
  }
  
  // Update the display
  this.updateTerrainDisplay();
};

// Update the terrain display based on the current mode
FractalTerrainViewer.prototype.updateTerrainDisplay = function() {
  if (!this.mesh) return;
  
  switch (this.params.mode) {
    case 'solid':
      this.scene.add(this.mesh);
      if (this.wireframeMesh) this.scene.remove(this.wireframeMesh);
      break;
      
    case 'wireframe':
      this.scene.remove(this.mesh);
      if (this.wireframeMesh) this.scene.add(this.wireframeMesh);
      break;
      
    case 'both':
      this.scene.add(this.mesh);
      if (this.wireframeMesh) this.scene.add(this.wireframeMesh);
      break;
  }
};

// Reset all parameters to defaults
FractalTerrainViewer.prototype.reset = function() {
  this.params = {
    n: 7,
    D: 2.2,
    seed: 852,
    sigma: 1.0,
    mode: 'solid'
  };
  
  this.createControls();
  this.generateTerrain();
};

// Reset terrain to initial state
FractalTerrainViewer.prototype.resetTerrain = function() {
  this.clearScene();
  this.createControls();
  this.generateTerrain();
};

// Capture the current view as an image
FractalTerrainViewer.prototype.captureImage = function(callback) {
  // Force render to ensure the current state is captured
  this.renderer.render(this.scene, this.camera);
  
  // Get the data URL from the canvas
  const dataURL = this.renderer.domElement.toDataURL('image/png');
  
  if (callback && typeof callback === 'function') {
    callback(dataURL);
  }
  
  return dataURL;
};

// Make available globally
window.FractalTerrainViewer = FractalTerrainViewer;
