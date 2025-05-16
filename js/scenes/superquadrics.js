// superquadrics.js - interactive superquadric shapes visualization
// Implementation of SuperquadricsViewer to render superquadric spheres and tori using parametric equations
// Based on the C++ code in superquadrics_scene_generator.cc which creates a celestial scene
// with a sun, planets, moons, and rings

// Assumes THREE is loaded globally
function superquadricSign(val) {
  return val >= 0 ? 1 : -1;
}

function superquadricPower(val, exp) {
  return superquadricSign(val) * Math.pow(Math.abs(val), exp);
}

function generateSuperquadricGeometry({
  type = 'sphere',
  radius = 1,
  radius2 = 0.4,
  north = 2.5,
  east = 2.5,
  segments = 64
} = {}) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let phiSteps, thetaSteps;
  if (type === 'sphere') {
    phiSteps = thetaSteps = segments;
    for (let i = 0; i <= phiSteps; i++) {
      const phi = Math.PI * (i / phiSteps - 0.5); // -pi/2 to pi/2
      for (let j = 0; j <= thetaSteps; j++) {
        const theta = 2 * Math.PI * (j / thetaSteps);
        // Parametric equations
        const x = radius * superquadricPower(Math.cos(phi), north) * superquadricPower(Math.cos(theta), east);
        const y = radius * superquadricPower(Math.cos(phi), north) * superquadricPower(Math.sin(theta), east);
        const z = radius * superquadricPower(Math.sin(phi), north);
        positions.push(x, y, z);
        // Approximate normal (for superquadrics, this is not exact but works visually)
        const nx = superquadricPower(Math.cos(phi), 2 - north) * superquadricPower(Math.cos(theta), 2 - east);
        const ny = superquadricPower(Math.cos(phi), 2 - north) * superquadricPower(Math.sin(theta), 2 - east);
        const nz = superquadricPower(Math.sin(phi), 2 - north);
        const nlen = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        normals.push(nx/nlen, ny/nlen, nz/nlen);
        uvs.push(j/thetaSteps, i/phiSteps);
      }
    }
    for (let i = 0; i < phiSteps; i++) {
      for (let j = 0; j < thetaSteps; j++) {
        const a = i * (thetaSteps + 1) + j;
        const b = a + thetaSteps + 1;
        // Correct winding: (a, a+1, b), (b, a+1, b+1)
        indices.push(a, a+1, b);
        indices.push(b, a+1, b+1);
      }
    }
  } else if (type === 'torus') {
    // Torus: major radius = radius, minor radius = radius2
    phiSteps = thetaSteps = segments;
    for (let i = 0; i <= phiSteps; i++) {
      const phi = 2 * Math.PI * (i / phiSteps);
      for (let j = 0; j <= thetaSteps; j++) {
        const theta = 2 * Math.PI * (j / thetaSteps);
        const r = radius + radius2 * superquadricPower(Math.cos(phi), north);
        const x = r * superquadricPower(Math.cos(theta), east);
        const y = r * superquadricPower(Math.sin(theta), east);
        const z = radius2 * superquadricPower(Math.sin(phi), north);
        positions.push(x, y, z);
        // Approximate normal
        const nx = superquadricPower(Math.cos(phi), 2 - north) * superquadricPower(Math.cos(theta), 2 - east);
        const ny = superquadricPower(Math.cos(phi), 2 - north) * superquadricPower(Math.sin(theta), 2 - east);
        const nz = superquadricPower(Math.sin(phi), 2 - north);
        const nlen = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        normals.push(nx/nlen, ny/nlen, nz/nlen);
        uvs.push(j/thetaSteps, i/phiSteps);
      }
    }
    for (let i = 0; i < phiSteps; i++) {
      for (let j = 0; j < thetaSteps; j++) {
        const a = i * (thetaSteps + 1) + j;
        const b = a + thetaSteps + 1;
        // Correct winding: (a, a+1, b), (b, a+1, b+1)
        indices.push(a, a+1, b);
        indices.push(b, a+1, b+1);
      }
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function SuperquadricsViewer(containerId, controlsId) {
  this.container = document.getElementById(containerId);
  this.controlsPanel = document.getElementById(controlsId);
  if (!this.container || !this.controlsPanel) return;
  this.scene = new THREE.Scene();  this.camera = new THREE.PerspectiveCamera(45, this.container.offsetWidth / this.container.offsetHeight, 0.1, 1000);
  // Position the camera similar to the C++ version (but adapt for different coordinate system)
  this.camera.position.set(11, 9, 15);
  this.renderer = new THREE.WebGLRenderer({ antialias: true });
  // Space-like background color matching the C++ version
  this.renderer.setClearColor(0x030310);
  this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
  this.container.appendChild(this.renderer.domElement);
  
  // Controls
  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  this.controls.target.set(0, 1, 0); // Look at the same point as the C++ version
    // Materials
  this.materials = {
    matte: new THREE.MeshStandardMaterial({ 
      roughness: 1, 
      metalness: 0,
      envMapIntensity: 0.3 // Lower environment map response
    }),
    plastic: new THREE.MeshStandardMaterial({ 
      roughness: 0.4, 
      metalness: 0.2,
      envMapIntensity: 0.4 // Lower environment map response
    }),
    metal: new THREE.MeshStandardMaterial({ 
      roughness: 0.1, 
      metalness: 0.8, // Reduced from 1.0
      envMapIntensity: 0.6 // Moderate environment map response
    })
  };
  
  // Object collections
  this.celestialObjects = [];
  this.torusObjects = [];
  this.stars = [];
  
  // Setup lighting similar to the C++ version
  this.setupLighting();
  
  // Create celestial scene
  this.createCelestialScene();
  
  // Create UI controls
  this.createControls();  // Animation loop with orbital movement
  this.time = 0;
  const animate = () => {
    this.time += 0.005;
    
    // Animate celestial objects
    this.animateScene();
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._animationId = requestAnimationFrame(animate);
  };
  animate();
}

// Setup lighting similar to the C++ version
SuperquadricsViewer.prototype.setupLighting = function() {
  // Base ambient light - significantly reduced intensity for non-sun objects
  const ambientLight = new THREE.AmbientLight(0x131a30, 0.1);
  this.scene.add(ambientLight);
  
  // Enhanced ambient light matching sun's color, but more localized around the sun
  const sunAmbient = new THREE.AmbientLight(0xffffc4, 0.7);
  this.scene.add(sunAmbient);
  
  // Add a directional light to provide better illumination from the sun's direction
  const dirLight = new THREE.DirectionalLight(0xffffbb, 0.2);
  dirLight.position.set(0, 0, 0);
  this.scene.add(dirLight);
};

// Create controls for scene manipulation
SuperquadricsViewer.prototype.createControls = function() {
  const panel = this.controlsPanel;
  panel.innerHTML = '';
  
  // Camera preset controls
  const viewLabel = document.createElement('label');
  viewLabel.textContent = 'Camera View:';
  const viewSelect = document.createElement('select');
  
  const views = {
    'default': { pos: [11, 9, 15], target: [0, 1, 0] }, // Increased camera distance to view the larger scene
    'top-down': { pos: [0, 18, 0], target: [0, 0, 0] },
    'side-view': { pos: [18, 0, 0], target: [0, 0, 0] },
    'sun-close': { pos: [0, 0, 3], target: [0, 0, 0] }
  };
  
  Object.keys(views).forEach(view => {
    const o = document.createElement('option');
    o.value = view;
    o.textContent = view.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    viewSelect.appendChild(o);
  });
  
  viewSelect.onchange = e => {
    const view = views[e.target.value];
    this.camera.position.set(...view.pos);
    this.controls.target.set(...view.target);
  };
  
  panel.appendChild(viewLabel);
  panel.appendChild(viewSelect);
  
  // Animation speed
  const speedLabel = document.createElement('label');
  speedLabel.textContent = ' Animation Speed:';
  const speedSlider = document.createElement('input');
  speedSlider.type = 'range';
  speedSlider.min = '0';
  speedSlider.max = '10';
  speedSlider.value = '5';
  speedSlider.oninput = e => {
    this.animationSpeed = parseFloat(e.target.value) / 5;
  };
  this.animationSpeed = 1;
  panel.appendChild(speedLabel);
  panel.appendChild(speedSlider);
  
  // Star count control
  const starCountLabel = document.createElement('label');
  starCountLabel.textContent = ' Stars:';
  const starCountInput = document.createElement('input');
  starCountInput.type = 'number';
  starCountInput.min = '0';
  starCountInput.max = '200';
  starCountInput.step = '10';
  starCountInput.value = '50';
  starCountInput.oninput = e => {
    const count = parseInt(e.target.value);
    this.updateStarfield(count);
  };
  panel.appendChild(starCountLabel);
  panel.appendChild(starCountInput);
  
  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Scene';
  resetBtn.onclick = () => this.resetScene();
  panel.appendChild(resetBtn);
};

// Create a celestial scene similar to the C++ version
SuperquadricsViewer.prototype.createCelestialScene = function() {
  // Clear any existing objects
  this.clearScene();
  
  // Create sun
  this.createSun();
  
  // Create planets and other celestial objects
  this.createCelestialObjects();
  
  // Create torus objects (rings)
  this.createTorusObjects();
  
  // Create starfield
  this.createStarfield(50);
};

// Create the central sun
SuperquadricsViewer.prototype.createSun = function() {
  const sunGeom = generateSuperquadricGeometry({
    type: 'sphere',
    radius: 1.0,
    north: 0.3,
    east: 0.3,
    segments: 64
  });
    // Create an enhanced emissive material for the sun with better glow
  const sunMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff99,
    emissive: 0xffcc33,
    emissiveIntensity: 2.0,
    roughness: 0.1,
    metalness: 0.9
  });
  
  const sun = new THREE.Mesh(sunGeom, sunMaterial);
  
  // Add a point light at the center
  const sunLight = new THREE.PointLight(0xffffbb, 12.0, 100);
  sunLight.position.set(0, 0, 0);
  sun.add(sunLight);
  
  // Add a more focused point light with a shorter range for a localized glow effect
  const sunGlowLight = new THREE.PointLight(0xffeeaa, 3.0, 3);
  sunGlowLight.position.set(0, 0, 0);
  sun.add(sunGlowLight);
  
  this.scene.add(sun);
  this.sun = sun;
};

// Create planets and other non-ring celestial objects
SuperquadricsViewer.prototype.createCelestialObjects = function() {
  // Inner planet (cube-like) - positioned farther from origin
  const innerPlanet = this.createPlanet(-4.5, 0, 4.5, 0.8, 2.0, 2.0, 0x6666cc);
  
  // Outer planet (pinched sphere) - moved farther out
  const outerPlanet = this.createPlanet(6, -1.5, -3, 1.2, 0.5, 2.0, 0x4ccc4c);
  
  // Moon (squashed sphere) - positioned relative to its parent planet (outer planet)
  const moon = this.createPlanet(8.2, -1, -4.2, 0.4, 2.0, 0.5, 0xcccccc);
  
  // Asteroid (elongated star-like shape)
  const asteroidGeom = generateSuperquadricGeometry({
    type: 'sphere',
    radius: 1.0,
    north: 0.3,
    east: 0.3,
    segments: 32
  });
  
  const asteroidMat = this.materials.matte.clone();
  asteroidMat.color.set(0xb39980);
  asteroidMat.roughness = 0.8;
  
  const asteroid = new THREE.Mesh(asteroidGeom, asteroidMat);
  asteroid.position.set(-5, -2, -5); // Moved to avoid intersection
  asteroid.rotation.set(15 * Math.PI/180, 20 * Math.PI/180, 0);
  asteroid.scale.set(0.3, 0.3, 1.0);
  
  this.scene.add(asteroid);
  this.celestialObjects.push({ mesh: asteroid, orbitalSpeed: 0.3, orbitalDistance: Math.sqrt(19) });
};

// Helper function to create a planet with specified parameters
SuperquadricsViewer.prototype.createPlanet = function(x, y, z, scale, north, east, color) {
  const geom = generateSuperquadricGeometry({
    type: 'sphere',
    radius: 1.0,
    north: north,
    east: east,
    segments: 48
  });
    const material = this.materials.matte.clone();
  material.color.set(color);
  // Lower ambient response for non-sun objects
  material.aoMapIntensity = 0.8; // Increase ambient occlusion effect
  
  const planet = new THREE.Mesh(geom, material);
  planet.position.set(x, y, z);
  planet.scale.set(scale, scale, scale);
  
  this.scene.add(planet);
  
  // Store the planet with its orbital parameters
  const orbitalDistance = Math.sqrt(x*x + y*y + z*z);
  const orbitalSpeed = 0.2 / orbitalDistance; // Adjust speed based on distance
  
  this.celestialObjects.push({ mesh: planet, orbitalSpeed, orbitalDistance });
  
  return planet;
};

// Create torus objects (rings)
SuperquadricsViewer.prototype.createTorusObjects = function() {
  // Gear-like planet
  const gearGeom = generateSuperquadricGeometry({
    type: 'torus',
    radius: 0.8,
    radius2: 0.4,
    north: 1.0,
    east: 0.2,
    segments: 48
  });
  
  const gearMat = this.materials.matte.clone();
  gearMat.color.set(0xe5b280);
  gearMat.roughness = 0.6;
  
  const gear = new THREE.Mesh(gearGeom, gearMat);
  gear.position.set(-7, 3, -4); // Moved further away to prevent intersection
  gear.rotation.set(75 * Math.PI/180, 0, 0);
  
  this.scene.add(gear);
  this.torusObjects.push({ mesh: gear, rotationSpeed: 0.01 });
  
  // First orbital ring (blue)
  const blueRingGeom = generateSuperquadricGeometry({
    type: 'torus',
    radius: 4.0,
    radius2: 0.1,
    north: 1.0,
    east: 0.2,
    segments: 64
  });
  
  const blueRingMat = this.materials.matte.clone();
  blueRingMat.color.set(0x8080cc);
  blueRingMat.transparent = false;
  blueRingMat.opacity = 1;
  
  const blueRing = new THREE.Mesh(blueRingGeom, blueRingMat);
  blueRing.rotation.set(30 * Math.PI/180, 0, 0);
  
  this.scene.add(blueRing);
  this.torusObjects.push({ mesh: blueRing, rotationSpeed: 0.005 });
  
  // Second orbital ring (gray)
  const grayRingGeom = generateSuperquadricGeometry({
    type: 'torus',
    radius: 5.5,
    radius2: 0.2,
    north: 2.0,
    east: 2.0,
    segments: 64
  });
  
  const grayRingMat = this.materials.matte.clone();
  grayRingMat.color.set(0x808080);
  grayRingMat.transparent = false;
  grayRingMat.opacity = 1.0;
  
  const grayRing = new THREE.Mesh(grayRingGeom, grayRingMat);
  grayRing.rotation.set(0, 45 * Math.PI/180, 0);
  
  this.scene.add(grayRing);
  this.torusObjects.push({ mesh: grayRing, rotationSpeed: 0.003 });
};

// Create a field of stars
SuperquadricsViewer.prototype.createStarfield = function(count) {
  // Parameters matching the C++ version
  const MIN_STAR_DISTANCE = 8.0; // Increased minimum distance to prevent intersections
  const REGULAR_STAR_MIN_SCALE = 0.03;
  const REGULAR_STAR_MAX_SCALE = 0.08;
  const SQ_STAR_MIN_SCALE = 0.08;
  const SQ_STAR_MAX_SCALE = 0.15;
  const LIGHT_STAR_MIN_SCALE = 0.18;
  const LIGHT_STAR_MAX_SCALE = 0.25;
  
  // Determine counts for different star types
  const numSuperQuadricStars = Math.floor(count * 0.2); // 20% are superquadric
  const numLightEmittingStars = Math.floor(count * 0.05); // 5% emit light
  const numRegularStars = count - numSuperQuadricStars - numLightEmittingStars;
  
  // Regular stars (simple spheres)
  for (let i = 0; i < numRegularStars; i++) {
    // Generate a random position on a sphere with minimum distance
    const theta = Math.random() * Math.PI;
    const phi = Math.random() * 2 * Math.PI;
    const radius = MIN_STAR_DISTANCE + Math.random() * 4;
    
    const x = radius * Math.sin(theta) * Math.cos(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(theta);
    
    // Simple sphere geometry for regular stars
    const starGeom = new THREE.SphereGeometry(1, 8, 8);
    
    // Simple material with random color (blue, red, or yellow)
    const colorType = i % 3;
    let starColor;
    if (colorType === 0) {
      starColor = 0xb3b3ff; // Blue
    } else if (colorType === 1) {
      starColor = 0xffb3b3; // Red
    } else {
      starColor = 0xffffcc; // Yellow
    }
    
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });
    const star = new THREE.Mesh(starGeom, starMat);
    
    // Apply random scale
    const scale = REGULAR_STAR_MIN_SCALE + Math.random() * (REGULAR_STAR_MAX_SCALE - REGULAR_STAR_MIN_SCALE);
    star.scale.set(scale, scale, scale);
    
    // Position the star
    star.position.set(x, y, z);
    
    this.scene.add(star);
    this.stars.push(star);
  }
  
  // Superquadric stars (pointy star-like shapes)
  for (let i = 0; i < numSuperQuadricStars; i++) {
    // Generate a random position
    const theta = Math.random() * Math.PI;
    const phi = Math.random() * 2 * Math.PI;
    const radius = MIN_STAR_DISTANCE + Math.random() * 4;
    
    const x = radius * Math.sin(theta) * Math.cos(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(theta);
    
    // Superquadric geometry for star-like shapes
    const northParam = 0.2 + Math.random() * 0.3; // Values < 1.0 create pointy stars
    const eastParam = 0.2 + Math.random() * 0.3;
    
    const starGeom = generateSuperquadricGeometry({
      type: 'sphere',
      radius: 1.0,
      north: northParam,
      east: eastParam,
      segments: 16
    });
    
    // Color based on pattern
    const colorType = i % 3;
    let starColor;
    if (colorType === 0) {
      starColor = 0xb3b3ff; // Blue
    } else if (colorType === 1) {
      starColor = 0xffb3b3; // Red
    } else {
      starColor = 0xffffcc; // Yellow
    }
    
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });
    const star = new THREE.Mesh(starGeom, starMat);
    
    // Apply random scale and rotation
    const scale = SQ_STAR_MIN_SCALE + Math.random() * (SQ_STAR_MAX_SCALE - SQ_STAR_MIN_SCALE);
    star.scale.set(scale, scale, scale);
    
    // Random rotation
    star.rotation.set(
      Math.random() * 90 * Math.PI/180,
      Math.random() * 90 * Math.PI/180,
      Math.random() * 90 * Math.PI/180
    );
    
    // Position the star
    star.position.set(x, y, z);
    
    this.scene.add(star);
    this.stars.push(star);
  }
  
  // Light-emitting stars
  for (let i = 0; i < numLightEmittingStars; i++) {
    // More evenly distribute light stars
    const phi = 2.0 * Math.PI * i / numLightEmittingStars;
    const theta = Math.PI * (0.3 + 0.4 * Math.random());
    const radius = 10.0 + Math.random() * 2 - 1.0;
    
    const x = radius * Math.sin(theta) * Math.cos(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(theta);
    
    // Simple geometry for light stars
    const starGeom = new THREE.SphereGeometry(1, 12, 12);
    
    // Determine color
    let starColor, lightColor;
    if (i % 3 === 0) {
      // Blue light
      starColor = 0x9999ff;
      lightColor = 0x6666ff;
    } else if (i % 3 === 1) {
      // Red light
      starColor = 0xff9999;
      lightColor = 0xff6666;
    } else {
      // Yellow light
      starColor = 0xffffb3;
      lightColor = 0xffff66;
    }
    
    const starMat = new THREE.MeshBasicMaterial({ 
      color: starColor,
      emissive: starColor,
      emissiveIntensity: 0.5
    });
    
    const star = new THREE.Mesh(starGeom, starMat);
    
    // Add point light
    const light = new THREE.PointLight(lightColor, 0.3, 5);
    star.add(light);
    
    // Apply scale
    const scale = LIGHT_STAR_MAX_SCALE;
    star.scale.set(scale, scale, scale);
    
    // Position the star
    star.position.set(x, y, z);
    
    this.scene.add(star);
    this.stars.push(star);
  }
};

// Animate the celestial scene
SuperquadricsViewer.prototype.animateScene = function() {
  if (!this.animationSpeed) return;
  
  // Rotate the sun
  if (this.sun) {
    this.sun.rotation.y += 0.005 * this.animationSpeed;
  }
  
  // Animate celestial objects (orbital movement)
  for (const obj of this.celestialObjects) {
    const { mesh, orbitalSpeed, orbitalDistance } = obj;
    
    // Calculate new position based on orbital parameters
    const angle = this.time * orbitalSpeed * this.animationSpeed;
    
    // Simple circular orbit in the XZ plane
    mesh.position.x = Math.cos(angle) * orbitalDistance;
    mesh.position.z = Math.sin(angle) * orbitalDistance;
    
    // Also rotate the object around its axis
    mesh.rotation.y += 0.01 * this.animationSpeed;
  }
  
  // Animate torus objects (rotation)
  for (const obj of this.torusObjects) {
    const { mesh, rotationSpeed } = obj;
    mesh.rotation.y += rotationSpeed * this.animationSpeed;
  }
};

// Update the starfield with a new count
SuperquadricsViewer.prototype.updateStarfield = function(count) {
  // Remove existing stars
  for (const star of this.stars) {
    this.scene.remove(star);
    if (star.geometry) star.geometry.dispose();
    if (star.material) {
      if (Array.isArray(star.material)) {
        star.material.forEach(m => m.dispose());
      } else {
        star.material.dispose();
      }
    }
  }
  this.stars = [];
  
  // Create new stars
  this.createStarfield(count);
};

// Clear all objects from the scene
SuperquadricsViewer.prototype.clearScene = function() {
  // Remove celestial objects
  for (const obj of this.celestialObjects) {
    this.scene.remove(obj.mesh);
    if (obj.mesh.geometry) obj.mesh.geometry.dispose();
    if (obj.mesh.material) {
      if (Array.isArray(obj.mesh.material)) {
        obj.mesh.material.forEach(m => m.dispose());
      } else {
        obj.mesh.material.dispose();
      }
    }
  }
  this.celestialObjects = [];
  
  // Remove torus objects
  for (const obj of this.torusObjects) {
    this.scene.remove(obj.mesh);
    if (obj.mesh.geometry) obj.mesh.geometry.dispose();
    if (obj.mesh.material) {
      if (Array.isArray(obj.mesh.material)) {
        obj.mesh.material.forEach(m => m.dispose());
      } else {
        obj.mesh.material.dispose();
      }
    }
  }
  this.torusObjects = [];
  
  // Remove stars
  this.updateStarfield(0);
  
  // Remove sun
  if (this.sun) {
    this.scene.remove(this.sun);
    if (this.sun.geometry) this.sun.geometry.dispose();
    if (this.sun.material) this.sun.material.dispose();
    this.sun = null;
  }
};

// Reset the scene to initial state
SuperquadricsViewer.prototype.resetScene = function() {
  this.clearScene();
  this.createCelestialScene();
  this.time = 0;
  this.animationSpeed = 1;
  this.createControls();
};

// Capture the current view as an image
SuperquadricsViewer.prototype.captureImage = function(callback) {
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
window.SuperquadricsViewer = SuperquadricsViewer;
