// neutron-sim.js - interactive neutron simulation visualization
// Based on rd_view/assign4/dynamic_neutron_scene_generator.cc and static_neutron_scene_generator.cc

// Assumes THREE is loaded globally

// Physics constants - combined from both static and dynamic neutron generators
const DEFAULT_PARAMS = {
  NUM_TRACKS: 250,           // Number of neutron tracks to generate
  POINTS_PER_TRACK: 20,      // Points along each track
  SOURCE_RADIUS: 0.5,        // Radius of neutron source at center
  CORE_RADIUS: 3.0,          // Radius of the reactor core
  REFLECTOR_RADIUS: 6.0,     // Radius of the reflector region
  CURVATURE_FACTOR: 0.4,     // How much tracks curve (scattering)
  CORE_ABSORPTION: 0.1,      // Absorption probability in core
  REFLECTOR_ABSORPTION: 0.4, // Absorption probability in reflector
  OUTER_ABSORPTION: 0.8,     // Absorption probability outside reflector
  TRACK_LENGTH: 15,          // Maximum length of a neutron track
  FISSION_PROBABILITY: 0.15, // Probability of neutron causing fission
  MAX_LIFETIME: 100,         // Maximum neutron lifetime (sim time)
  MEAN_FREE_PATH: 2.0,       // Average distance between interactions
  SIMULATION_SPEED: 1.0,     // Speed multiplier for simulation
  DYNAMIC_MODE: false        // Static vs dynamic simulation mode
};

// Energy group definitions (from dynamic_neutron_scene_generator.cc)
const ENERGY_GROUPS = {
  FAST: 0,
  EPITHERMAL: 1,
  THERMAL: 2
};

// Colors for different regions and energy groups (matching original code)
const COLORS = {
  CORE: 0xff4d4d,            // Red for core region
  REFLECTOR: 0x4da6ff,       // Blue for reflector
  OUTER: 0xfff04d,           // Yellow for outer region
  ENERGY: [
    0xff3300,                // Fast neutrons (red)
    0xffcc00,                // Epithermal neutrons (yellow)
    0x0080ff                 // Thermal neutrons (blue)
  ],
  FISSION: 0xffff00          // Bright yellow for fission events
};

// Scattering probability matrix between energy groups (from dynamic_neutron_scene_generator.cc)
const SCATTERING_PROBABILITIES = [
  [0.5, 0.4, 0.1],   // Fast neutron scattering probabilities
  [0.0, 0.6, 0.4],   // Epithermal neutron scattering probabilities
  [0.0, 0.0, 1.0]    // Thermal neutron scattering probabilities
];

// Helper function to generate random point in unit sphere
function randomInUnitSphere(radius) {
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = radius * Math.pow(Math.random(), 1/3); // Cube root for uniform distribution
  
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  ];
}

// Helper function to generate random unit vector
function randomUnitVector3() {
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.acos(2 * Math.random() - 1);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi)
  ];
}

// Linear interpolation helper
function lerp(a, b, t) { return a + (b - a) * t; }

// Determine color based on region (static mode)
function regionColor(r, coreR, reflR) {
  if (r < coreR) return COLORS.CORE;
  if (r < reflR) return COLORS.REFLECTOR;
  return COLORS.OUTER;
}

// Probability of absorption based on region
function getAbsorptionProbability(r, coreR, reflR) {
  if (r < coreR) return DEFAULT_PARAMS.CORE_ABSORPTION;
  if (r < reflR) return DEFAULT_PARAMS.REFLECTOR_ABSORPTION;
  return DEFAULT_PARAMS.OUTER_ABSORPTION;
}

// Main viewer class
function NeutronSimViewer(containerId, controlsId) {
  console.log('[NeutronSimViewer] Initializing viewer...');
  
  this.container = document.getElementById(containerId);
  this.controlsPanel = document.getElementById(controlsId);
  if (!this.container || !this.controlsPanel) {
    console.error('[NeutronSimViewer] Container or controls panel not found');
    return;
  }
  
  // Set up scene
  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0x050512); // Dark blue background
  
  // Camera setup
  this.camera = new THREE.PerspectiveCamera(40, this.container.offsetWidth / this.container.offsetHeight, 0.1, 1000);
  this.camera.position.set(0, 10, 15);
  this.camera.lookAt(0, 0, 0);
  
  // Renderer
  this.renderer = new THREE.WebGLRenderer({ antialias: true });
  this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
  this.container.appendChild(this.renderer.domElement);
  
  // Controls
  this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
  this.controls.enableDamping = true;
  this.controls.dampingFactor = 0.25;
  
  // Simulation parameters
  this.params = {
    numTracks: DEFAULT_PARAMS.NUM_TRACKS,
    pointsPerTrack: DEFAULT_PARAMS.POINTS_PER_TRACK,
    coreRadius: DEFAULT_PARAMS.CORE_RADIUS,
    reflectorRadius: DEFAULT_PARAMS.REFLECTOR_RADIUS,
    sourceRadius: DEFAULT_PARAMS.SOURCE_RADIUS,
    curvature: DEFAULT_PARAMS.CURVATURE_FACTOR,
    trackLength: DEFAULT_PARAMS.TRACK_LENGTH,
    fissionProb: DEFAULT_PARAMS.FISSION_PROBABILITY,
    simulationSpeed: DEFAULT_PARAMS.SIMULATION_SPEED,
    dynamicMode: DEFAULT_PARAMS.DYNAMIC_MODE
  };
  
  // Storage for objects
  this.tracks = [];
  this.reactorMesh = null;
  this.neutrons = [];
  this.fissionEvents = [];
  this.animationActive = false;
  this.simulationTime = 0;
  this.trackCount = 0;
  
  // Initialize
  this.setupLights();
  this.createControls();
  this.createReactorVisualization();
  this.generateTracks();
  
  // Animation loop
  const animate = () => {
    if (this.animationActive && this.params.dynamicMode) {
      this.updateDynamicSimulation();
    }
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(animate);
  };
  
  // Start animation
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
NeutronSimViewer.prototype.setupLights = function() {
  // Ambient light
  const ambient = new THREE.AmbientLight(0x404040, 0.6);
  this.scene.add(ambient);
  
  // Directional light for shadows and highlights
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 10, 7);
  this.scene.add(directional);
  
  // Hemisphere light for more natural lighting
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x404040, 0.4);
  this.scene.add(hemisphere);
};

// Create visual representation of reactor regions
NeutronSimViewer.prototype.createReactorVisualization = function() {
  // Remove previous visualization if it exists
  if (this.reactorMesh) {
    this.scene.remove(this.reactorMesh);
  }
  
  const p = this.params;
  
  // Create geometry for reactor regions
  const coreGeometry = new THREE.SphereGeometry(p.coreRadius, 32, 32);
  const reflectorGeometry = new THREE.SphereGeometry(p.reflectorRadius, 32, 32);
  const sourceGeometry = new THREE.SphereGeometry(p.sourceRadius, 32, 32);
    // Create transparent materials with rendering on both sides
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.CORE,
    transparent: true,
    opacity: 0.08,  // Further reduced opacity for better neutron visibility
    wireframe: false,
    side: THREE.BackSide, // Use BackSide to ensure interior objects are visible
    depthWrite: false, // This helps with visibility of objects inside
    depthTest: true,
    blending: THREE.AdditiveBlending // Enhance visibility of internal elements
  });
  
  const reflectorMaterial = new THREE.MeshBasicMaterial({
    color: COLORS.REFLECTOR,
    transparent: true,
    opacity: 0.04,  // Further reduced opacity for better neutron visibility
    wireframe: false,
    side: THREE.BackSide, // Use BackSide for better visibility
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  });
  
  const sourceMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    wireframe: false,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  });
  
  // Create wire material for outlines - lighter and more visible
  const wireframeMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    wireframe: true,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    depthTest: true
  });
  
  // Create meshes
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const coreWire = new THREE.Mesh(coreGeometry, wireframeMaterial.clone());
  
  const reflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
  const reflectorWire = new THREE.Mesh(reflectorGeometry, wireframeMaterial.clone());
  
  const source = new THREE.Mesh(sourceGeometry, sourceMaterial);
  
  // Add to scene
  this.reactorMesh = new THREE.Group();
  this.reactorMesh.add(source);
  this.reactorMesh.add(core);
  this.reactorMesh.add(coreWire);
  this.reactorMesh.add(reflector);
  this.reactorMesh.add(reflectorWire);
  this.scene.add(this.reactorMesh);
  
  // Add to the visualization group
  this.reactorComponents = {
    source: source,
    core: core,
    coreWire: coreWire,
    reflector: reflector,
    reflectorWire: reflectorWire
  };
};

// Create UI controls
NeutronSimViewer.prototype.createControls = function() {
  // Clear container
  this.controlsPanel.innerHTML = '';
  
  // Main controls container
  const controls = document.createElement('div');
  controls.className = 'control-group';
  
  // Mode toggle
  const modeContainer = document.createElement('div');
  const modeLabel = document.createElement('label');
  modeLabel.textContent = 'Simulation Mode: ';
  const modeSelect = document.createElement('select');
  const staticOption = document.createElement('option');
  staticOption.value = 'static';
  staticOption.textContent = 'Static';
  const dynamicOption = document.createElement('option');
  dynamicOption.value = 'dynamic';
  dynamicOption.textContent = 'Dynamic';
  modeSelect.appendChild(staticOption);
  modeSelect.appendChild(dynamicOption);
  modeSelect.value = this.params.dynamicMode ? 'dynamic' : 'static';  modeSelect.addEventListener('change', () => {
    // Change mode
    this.params.dynamicMode = modeSelect.value === 'dynamic';
    
    // Store animation state to restore if needed
    const wasActive = this.animationActive;
    
    // Stop animation during mode change
    this.animationActive = false;
    
    // Clean up scene completely before generating new content
    this.cleanupScene();
    
    // Reset simulation state
    this.neutrons = [];
    this.fissionEvents = [];
    this.trackCount = 0;
    this.simulationTime = 0;
    
    // Regenerate the visualization
    this.createReactorVisualization();
    
    // Force a small delay to ensure cleanup completes
    setTimeout(() => {
      // Generate the appropriate view
      this.generateTracks();
      
      // Toggle simulation controls visibility
      const simControls = this.controlsPanel.querySelector('.dynamic-controls');
      if (simControls) {
        simControls.style.display = this.params.dynamicMode ? 'block' : 'none';
        
        // Update play button text
        const playButton = simControls.querySelector('button');
        if (playButton) {
          playButton.textContent = 'Start Simulation';
        }
      }
      
      // Force a render to update the display
      this.renderer.render(this.scene, this.camera);
    }, 100);
    
    // Store state for tab visibility change
    this._wasActiveBeforeHidden = false;
  });
  modeContainer.appendChild(modeLabel);
  modeContainer.appendChild(modeSelect);
  controls.appendChild(modeContainer);
  
  // Number of tracks
  const numTracksContainer = document.createElement('div');
  const numTracksLabel = document.createElement('label');
  numTracksLabel.textContent = 'Neutron Tracks: ';
  const numTracksInput = document.createElement('input');
  numTracksInput.type = 'range';
  numTracksInput.min = '50';
  numTracksInput.max = '500';
  numTracksInput.step = '50';
  numTracksInput.value = this.params.numTracks;
  const numTracksValue = document.createElement('span');
  numTracksValue.textContent = this.params.numTracks;
  numTracksInput.addEventListener('input', () => {
    this.params.numTracks = parseInt(numTracksInput.value);
    numTracksValue.textContent = this.params.numTracks;
    this.generateTracks();
  });
  numTracksContainer.appendChild(numTracksLabel);
  numTracksContainer.appendChild(numTracksInput);
  numTracksContainer.appendChild(numTracksValue);
  controls.appendChild(numTracksContainer);
  
  // Core radius
  const coreRadiusContainer = document.createElement('div');
  const coreRadiusLabel = document.createElement('label');
  coreRadiusLabel.textContent = 'Core Radius: ';
  const coreRadiusInput = document.createElement('input');
  coreRadiusInput.type = 'range';
  coreRadiusInput.min = '1';
  coreRadiusInput.max = '5';
  coreRadiusInput.step = '0.5';
  coreRadiusInput.value = this.params.coreRadius;
  const coreRadiusValue = document.createElement('span');
  coreRadiusValue.textContent = this.params.coreRadius;
  coreRadiusInput.addEventListener('input', () => {
    this.params.coreRadius = parseFloat(coreRadiusInput.value);
    coreRadiusValue.textContent = this.params.coreRadius;
    this.createReactorVisualization();
    this.generateTracks();
  });
  coreRadiusContainer.appendChild(coreRadiusLabel);
  coreRadiusContainer.appendChild(coreRadiusInput);
  coreRadiusContainer.appendChild(coreRadiusValue);
  controls.appendChild(coreRadiusContainer);
  
  // Reflector radius
  const reflectorRadiusContainer = document.createElement('div');
  const reflectorRadiusLabel = document.createElement('label');
  reflectorRadiusLabel.textContent = 'Reflector Radius: ';
  const reflectorRadiusInput = document.createElement('input');
  reflectorRadiusInput.type = 'range';
  reflectorRadiusInput.min = '2';
  reflectorRadiusInput.max = '10';
  reflectorRadiusInput.step = '0.5';
  reflectorRadiusInput.value = this.params.reflectorRadius;
  const reflectorRadiusValue = document.createElement('span');
  reflectorRadiusValue.textContent = this.params.reflectorRadius;
  reflectorRadiusInput.addEventListener('input', () => {
    this.params.reflectorRadius = parseFloat(reflectorRadiusInput.value);
    reflectorRadiusValue.textContent = this.params.reflectorRadius;
    this.createReactorVisualization();
    this.generateTracks();
  });
  reflectorRadiusContainer.appendChild(reflectorRadiusLabel);
  reflectorRadiusContainer.appendChild(reflectorRadiusInput);
  reflectorRadiusContainer.appendChild(reflectorRadiusValue);
  controls.appendChild(reflectorRadiusContainer);
  
  // Curvature factor
  const curvatureContainer = document.createElement('div');
  const curvatureLabel = document.createElement('label');
  curvatureLabel.textContent = 'Scattering: ';
  const curvatureInput = document.createElement('input');
  curvatureInput.type = 'range';
  curvatureInput.min = '0';
  curvatureInput.max = '1';
  curvatureInput.step = '0.1';
  curvatureInput.value = this.params.curvature;
  const curvatureValue = document.createElement('span');
  curvatureValue.textContent = this.params.curvature;
  curvatureInput.addEventListener('input', () => {
    this.params.curvature = parseFloat(curvatureInput.value);
    curvatureValue.textContent = this.params.curvature;
    this.generateTracks();
  });
  curvatureContainer.appendChild(curvatureLabel);
  curvatureContainer.appendChild(curvatureInput);
  curvatureContainer.appendChild(curvatureValue);
  controls.appendChild(curvatureContainer);
  
  // Dynamic mode specific controls
  const dynamicControls = document.createElement('div');
  dynamicControls.className = 'dynamic-controls';
  dynamicControls.style.display = this.params.dynamicMode ? 'block' : 'none';
  
  // Play/Pause button
  const playButton = document.createElement('button');
  playButton.textContent = 'Start Simulation';
  playButton.addEventListener('click', () => {
    if (this.animationActive) {
      this.animationActive = false;
      playButton.textContent = 'Start Simulation';
    } else {
      this.animationActive = true;
      playButton.textContent = 'Pause Simulation';
      
      // Store state for tab visibility change
      this._wasActiveBeforeHidden = true;
    }
  });
  dynamicControls.appendChild(playButton);
  
  // Reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset Simulation';
  resetButton.addEventListener('click', () => {
    this.resetDynamicSimulation();
  });
  dynamicControls.appendChild(resetButton);
  
  // Simulation speed
  const speedContainer = document.createElement('div');
  const speedLabel = document.createElement('label');
  speedLabel.textContent = 'Simulation Speed: ';
  const speedInput = document.createElement('input');
  speedInput.type = 'range';
  speedInput.min = '0.1';
  speedInput.max = '3';
  speedInput.step = '0.1';
  speedInput.value = this.params.simulationSpeed;
  const speedValue = document.createElement('span');
  speedValue.textContent = this.params.simulationSpeed + 'x';
  speedInput.addEventListener('input', () => {
    this.params.simulationSpeed = parseFloat(speedInput.value);
    speedValue.textContent = this.params.simulationSpeed + 'x';
  });
  speedContainer.appendChild(speedLabel);
  speedContainer.appendChild(speedInput);
  speedContainer.appendChild(speedValue);
  dynamicControls.appendChild(speedContainer);
  
  // Stats display
  this.statsDisplay = document.createElement('div');
  this.statsDisplay.className = 'stats-display';
  dynamicControls.appendChild(this.statsDisplay);
  
  controls.appendChild(dynamicControls);
  
  // Reset all params button
  const resetAllButton = document.createElement('button');
  resetAllButton.textContent = 'Reset All Parameters';
  resetAllButton.addEventListener('click', () => {
    this.reset();
  });
  controls.appendChild(resetAllButton);
  
  this.controlsPanel.appendChild(controls);
};

// Clean up the entire scene
NeutronSimViewer.prototype.cleanupScene = function() {
  // Clean up tracks
  if (this.tracks && this.tracks.length > 0) {
    this.tracks.forEach(track => {
      if (track.mesh) {
        this.scene.remove(track.mesh);
        if (track.mesh.geometry) track.mesh.geometry.dispose();
        if (track.mesh.material) {
          if (Array.isArray(track.mesh.material)) {
            track.mesh.material.forEach(mtl => mtl.dispose());
          } else {
            track.mesh.material.dispose();
          }
        }
      }
    });
    this.tracks = [];
  }
  
  // Clean up neutrons
  if (this.neutrons && this.neutrons.length > 0) {
    this.neutrons.forEach(neutron => {
      if (neutron.mesh) {
        this.scene.remove(neutron.mesh);
        if (neutron.mesh.geometry) neutron.mesh.geometry.dispose();
        if (neutron.mesh.material) {
          if (Array.isArray(neutron.mesh.material)) {
            neutron.mesh.material.forEach(mtl => mtl.dispose());
          } else {
            neutron.mesh.material.dispose();
          }
        }
      }
    });
    this.neutrons = [];
  }
  
  // Clean up fission events
  if (this.fissionEvents && this.fissionEvents.length > 0) {
    this.fissionEvents.forEach(event => {
      if (event.mesh) {
        this.scene.remove(event.mesh);
        if (event.mesh.geometry) event.mesh.geometry.dispose();
        if (event.mesh.material) {
          if (Array.isArray(event.mesh.material)) {
            event.mesh.material.forEach(mtl => mtl.dispose());
          } else {
            event.mesh.material.dispose();
          }
        }
      }
    });
    this.fissionEvents = [];
  }
  
  // Find and remove any leftover meshes (e.g., flashes from fission events)
  this.scene.traverse(object => {
    if (object.isMesh && 
        (!this.reactorComponents || 
         !Object.values(this.reactorComponents).includes(object))) {
      this.scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(mtl => mtl.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
  });
  
  // Clean up reactor mesh
  if (this.reactorMesh) {
    this.scene.remove(this.reactorMesh);
    this.reactorMesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mtl => mtl.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.reactorMesh = null;
    this.reactorComponents = null;
  }
};

// Generate static neutron tracks
NeutronSimViewer.prototype.generateTracks = function() {
  // Clean up old tracks first
  this.tracks.forEach(track => {
    if (track.mesh) {
      this.scene.remove(track.mesh);
      if (track.mesh.geometry) track.mesh.geometry.dispose();
      if (track.mesh.material) track.mesh.material.dispose();
    }
  });
  this.tracks = [];
  
  // Switch between static and dynamic mode
  if (this.params.dynamicMode) {
    this.setupDynamicSimulation();
    return;
  }
  
  const p = this.params;
    // Generate the specified number of tracks
  for (let i = 0; i < p.numTracks; i++) {
    // Start from source - random point in source sphere
    const sourcePoint = randomInUnitSphere(p.sourceRadius);
    const startPoint = new THREE.Vector3(sourcePoint[0], sourcePoint[1], sourcePoint[2]);
    
    // Initial random direction
    const randDir = randomUnitVector3();
    const direction = new THREE.Vector3(randDir[0], randDir[1], randDir[2]);
    
    // Energy group for this track (fast=0, epithermal=1, thermal=2)
    // Initialize as fast neutron (newly created)
    let energyGroup = ENERGY_GROUPS.FAST;
    
    // Create points along track
    const points = [];
    const pointColors = []; // Store colors for each point
    let prevPos = startPoint.clone();
    let absorbed = false;
    
    // Add first point
    points.push(prevPos.clone());
    pointColors.push(new THREE.Color(COLORS.ENERGY[energyGroup]));
    
    for (let j = 0; j < p.pointsPerTrack; j++) {
      if (absorbed) break;
      
      // Add some randomness to direction (scattering)
      if (p.curvature > 0 && j > 0) {
        const curveAmount = p.curvature * Math.min(j/5, 0.5);
        const randOffset = randomUnitVector3();
        direction.x += (randOffset[0] - 0.5) * curveAmount;
        direction.y += (randOffset[1] - 0.5) * curveAmount;
        direction.z += (randOffset[2] - 0.5) * curveAmount;
        direction.normalize();
        
        // Chance to slow down neutron (energy group change) during scattering
        // Following SCATTERING_PROBABILITIES matrix
        if (Math.random() < 0.3 && energyGroup < ENERGY_GROUPS.THERMAL) {
          energyGroup++;
        }
      }
      
      // Move along direction
      const stepLength = p.trackLength / p.pointsPerTrack;
      const nextPos = prevPos.clone().add(direction.clone().multiplyScalar(stepLength));
      
      // Check for absorption based on region
      const r = prevPos.length();
      const absProb = getAbsorptionProbability(r, p.coreRadius, p.reflectorRadius);
      
      if (Math.random() < absProb) {
        absorbed = true;
      }
      
      // Add point with color based on current energy group
      points.push(nextPos.clone());
      pointColors.push(new THREE.Color(COLORS.ENERGY[energyGroup]));
      
      if (!absorbed) {
        prevPos = nextPos;
      }
      
      // Check if track goes out of bounds
      if (prevPos.length() > p.reflectorRadius * 1.5) {
        absorbed = true;
      }
    }
    
    // Create tube along points
    if (points.length >= 2) {
      const path = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(path, points.length * 4, 0.05, 8, false);
      
      // Calculate colors along the path based on energy group and region
      const colors = [];
      const positions = tubeGeometry.getAttribute('position');
      const vertexCount = positions.count;
      
      // Map tube vertices to the closest path point for coloring
      for (let v = 0; v < vertexCount; v++) {
        const x = positions.getX(v);
        const y = positions.getY(v);
        const z = positions.getZ(v);
        const position = new THREE.Vector3(x, y, z);
        
        // Find the closest path point for color
        let minDist = Infinity;
        let closestIndex = 0;
        
        for (let p = 0; p < points.length; p++) {
          const dist = position.distanceTo(points[p]);
          if (dist < minDist) {
            minDist = dist;
            closestIndex = p;
          }
        }
        
        // Use region-influenced color with energy tint
        const distance = position.length();
        let baseColor = pointColors[closestIndex].clone();
        
        // Blend with region color
        if (distance < p.coreRadius) {
          baseColor.lerp(new THREE.Color(COLORS.CORE), 0.3);
        } else if (distance < p.reflectorRadius) {
          baseColor.lerp(new THREE.Color(COLORS.REFLECTOR), 0.3);
        } else {
          baseColor.lerp(new THREE.Color(COLORS.OUTER), 0.3);
        }
        
        colors.push(baseColor.r, baseColor.g, baseColor.b);
      }
      
      // Apply the vertex colors to the tube geometry
      tubeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      // Use MeshStandardMaterial with vertex colors enabled
      const tubeMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissiveIntensity: 0.3,
        transparent: false,
        opacity: 1.0,
        side: THREE.FrontSide,
        metalness: 0.3,
        roughness: 0.5,
        depthWrite: true,
        depthTest: true
      });
      
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      this.scene.add(tube);
      
      this.tracks.push({
        points: points,
        absorbed: absorbed,
        mesh: tube
      });
    }
  }
};

// Set up the dynamic simulation
NeutronSimViewer.prototype.setupDynamicSimulation = function() {
  // Clear existing neutrons
  if (this.neutrons) {
    this.neutrons.forEach(neutron => {
      if (neutron.mesh) {
        this.scene.remove(neutron.mesh);
        if (neutron.mesh.geometry) neutron.mesh.geometry.dispose();
        if (neutron.mesh.material) neutron.mesh.material.dispose();
      }
    });
  }
  
  // Reset state
  this.neutrons = [];
  this.fissionEvents = [];
  this.trackCount = 0;
  this.simulationTime = 0;
  
  // Initialize with starting neutrons
  const initialCount = Math.min(this.params.numTracks / 10, 25);
  
  for (let i = 0; i < initialCount; i++) {
    this.addNeutron();
  }
  
  // Update stats
  this.updateStatsDisplay();
  this._wasActiveBeforeHidden = false;
};

// Add a neutron to the dynamic simulation
NeutronSimViewer.prototype.addNeutron = function(position, direction, energyGroup) {
  if (!this.scene) return;
  
  const p = this.params;
  
  // Create at source if position not specified
  let pos, dir;
  
  if (!position) {
    // Random point in source sphere
    const sourcePoint = randomInUnitSphere(p.sourceRadius);
    pos = new THREE.Vector3(sourcePoint[0], sourcePoint[1], sourcePoint[2]);
    
    // Random direction
    const randDir = randomUnitVector3();
    dir = new THREE.Vector3(randDir[0], randDir[1], randDir[2]);
  } else {
    pos = position;
    dir = direction || new THREE.Vector3(1, 0, 0); // Default direction if none provided
  }
  // Default to fast neutrons if not specified
  const eGroup = energyGroup !== undefined ? energyGroup : ENERGY_GROUPS.FAST;
  
  // Create visual representation - sphere with consistent base size
  const baseSize = 0.15; // Consistent size for all neutrons
  // Add a small variation based on energy just for visual distinction but not dramatic size differences
  const size = baseSize * (1.0 + 0.05 * (2 - eGroup)); 
  const geometry = new THREE.SphereGeometry(size, 8, 8);
  
  // Determine base color based on energy group
  const energyColor = new THREE.Color(COLORS.ENERGY[eGroup]);
  
  // Adjust color based on region (like in static tracks)
  const distance = pos.length();
  let finalColor = energyColor.clone();
  
  // Blend with region color
  if (distance < this.params.coreRadius) {
    finalColor.lerp(new THREE.Color(COLORS.CORE), 0.15);
  } else if (distance < this.params.reflectorRadius) {
    finalColor.lerp(new THREE.Color(COLORS.REFLECTOR), 0.15);
  } else {
    finalColor.lerp(new THREE.Color(COLORS.OUTER), 0.15);
  }
  
  // Create material with enhanced visual effects
  const material = new THREE.MeshStandardMaterial({
    color: finalColor,
    emissive: COLORS.ENERGY[eGroup],
    emissiveIntensity: 0.6, // Increased intensity for better visibility
    transparent: true,
    opacity: 0.9,
    side: THREE.FrontSide,
    metalness: 0.2,
    roughness: 0.5
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(pos);
  this.scene.add(mesh);
  
  // Add to neutrons array
  this.neutrons.push({
    position: pos.clone(),
    direction: dir.normalize(),
    energyGroup: eGroup,
    lifetime: 0,
    absorbed: false,
    mesh: mesh
  });
};

// Create a fission event at the given position
NeutronSimViewer.prototype.createFissionEvent = function(position) {
  // Visual effect 1: main expanding sphere with pulsing glow
  const mainGeometry = new THREE.SphereGeometry(0.2, 24, 24);
  const mainMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00, // Bright yellow core
    emissive: 0xffaa00, // Orange-yellow emission
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    roughness: 0.2,
    metalness: 0.8
  });
  
  const flash = new THREE.Mesh(mainGeometry, mainMaterial);
  flash.position.copy(position);
  this.scene.add(flash);
  
  // Visual effect 2: wireframe outer sphere with random rotation
  const outerGeometry = new THREE.IcosahedronGeometry(0.25, 1);
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcc00,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  
  const outerFlash = new THREE.Mesh(outerGeometry, outerMaterial);
  outerFlash.position.copy(position);
  outerFlash.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  this.scene.add(outerFlash);
  
  // Visual effect 3: shockwave ring
  const ringGeometry = new THREE.RingGeometry(0.1, 0.15, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(position);
  ring.lookAt(this.camera.position); // Orient towards camera
  this.scene.add(ring);
  
  // Visual effect 4: enhanced particles
  const particleCount = 30; // Increased particle count
  const particles = [];
  const particleTypes = [
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.TetrahedronGeometry(0.06),
    new THREE.OctahedronGeometry(0.05)
  ];
  
  for (let i = 0; i < particleCount; i++) {
    const randDir = randomUnitVector3();
    const speed = 0.03 + Math.random() * 0.05; // Higher random speed
    
    // Generate heat-map like colors (orange, yellow, white)
    const heat = Math.random();
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(
        1.0, // Red always 1.0
        0.3 + heat * 0.7, // Green (0.3-1.0)
        Math.min(0.9, heat * 1.5)  // Blue (0-0.9)
      ),
      transparent: true,
      opacity: 0.8 + Math.random() * 0.2,
      blending: THREE.AdditiveBlending
    });
    
    // Randomly choose particle geometry
    const geoIndex = Math.floor(Math.random() * particleTypes.length);
    const particle = new THREE.Mesh(particleTypes[geoIndex], particleMaterial);
    particle.position.copy(position);
    
    // Add slight random rotation to particles
    particle.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    
    // Add velocity and rotation speed to user data
    particle.userData = {
      velocity: new THREE.Vector3(randDir[0] * speed, randDir[1] * speed, randDir[2] * speed),
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.2,
        y: (Math.random() - 0.5) * 0.2,
        z: (Math.random() - 0.5) * 0.2
      }
    };
    
    this.scene.add(particle);
    particles.push(particle);
  }
  
  // Animation for growth, fade and particles
  let age = 0;
  const maxAge = 45; // Slightly longer animation
  
  const update = () => {
    age++;
    if (age >= maxAge) {
      // Clean up when animation is done
      this.scene.remove(flash);
      this.scene.remove(outerFlash);
      this.scene.remove(ring);
      
      particles.forEach(p => {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
      });
      
      return;
    }
    
    // Normalized progress (0 to 1)
    const progress = age / maxAge;
    
    // Main flash animation with pulsing
    const pulseFreq = 15;
    const pulseAmp = Math.max(0, 0.3 * (1 - progress * 1.5));
    const pulseFactor = 1 + pulseAmp * Math.sin(progress * pulseFreq);
    const mainScale = (0.2 + progress * 3.5) * pulseFactor; // Larger maximum size
    flash.scale.set(mainScale, mainScale, mainScale);
    flash.material.opacity = 0.9 * (1 - progress * progress); // Quadratic fade
    flash.material.emissiveIntensity = 1.5 * (1 - progress);
    
    // Outer wireframe animation with rotation
    const outerScale = 0.25 + progress * 4.0; // Even larger than main
    outerFlash.scale.set(outerScale, outerScale, outerScale);
    outerFlash.material.opacity = 0.8 * (1 - progress);
    outerFlash.rotation.x += 0.01;
    outerFlash.rotation.y += 0.02;
    
    // Ring shockwave animation
    const ringScale = 0.1 + progress * 8.0; // Fast expanding ring
    ring.scale.set(ringScale, ringScale, ringScale);
    ring.material.opacity = Math.max(0, 0.9 * (1 - progress * 2)); // Fade out faster
    // Keep ring oriented towards camera
    ring.lookAt(this.camera.position);
    
    // Particle animation with rotation
    particles.forEach(p => {
      p.position.add(p.userData.velocity);
      p.rotation.x += p.userData.rotationSpeed.x;
      p.rotation.y += p.userData.rotationSpeed.y;
      p.rotation.z += p.userData.rotationSpeed.z;
      
      p.material.opacity = Math.max(0, 0.8 * (1 - progress * 1.2));
      
      // Shrink particles over time with slight pulsing
      const particlePulse = 1 + 0.1 * Math.sin(progress * 20 + p.position.x * 10);
      const particleScale = Math.max(0.1, (1 - progress) * particlePulse);
      p.scale.set(particleScale, particleScale, particleScale);
    });
      requestAnimationFrame(update);
  };
  update();
  
  // Spawn new neutrons
  const numNewNeutrons = Math.floor(Math.random() * 2) + 1; // 1-2 new neutrons
  
  for (let i = 0; i < numNewNeutrons; i++) {
    const randDir = randomUnitVector3();
    const direction = new THREE.Vector3(randDir[0], randDir[1], randDir[2]);
    
    // New neutrons are fast
    this.addNeutron(position.clone(), direction, ENERGY_GROUPS.FAST);
  }
  
  return numNewNeutrons;
};

// Update the dynamic simulation
NeutronSimViewer.prototype.updateDynamicSimulation = function() {
  if (!this.neutrons) return;
  
  const p = this.params;
  const deltaTime = 0.016 * p.simulationSpeed; // Base on approximately 60fps
  this.simulationTime += deltaTime;
    // Update neutron positions
  for (let i = 0; i < this.neutrons.length; i++) {
    const neutron = this.neutrons[i];
    if (neutron.absorbed) continue;
    
    // Update lifetime
    neutron.lifetime += deltaTime;
      // Check max lifetime - significantly extended to allow more travel time
    const maxLifetime = DEFAULT_PARAMS.MAX_LIFETIME * (1.5 + (2 - neutron.energyGroup) * 0.5);
    if (neutron.lifetime > maxLifetime) {
      neutron.absorbed = true;
      continue;
    }
      // Reduced speed to allow more time for color transitions to be visible
    // Still keep faster speeds for higher energy neutrons
    const speed = 0.15 * (1.0 + (2 - neutron.energyGroup) * 0.4);
    const step = speed * deltaTime * 5;
      // Update position based on direction and speed
    neutron.position.x += neutron.direction.x * step;
    neutron.position.y += neutron.direction.y * step;
    neutron.position.z += neutron.direction.z * step;
    neutron.mesh.position.copy(neutron.position);
    
    // Calculate radius for region determination
    const r = neutron.position.length();    // Region-based energy transition (independent of scattering)
    // This helps match the visual behavior of the static scene
    if (neutron.energyGroup < ENERGY_GROUPS.THERMAL) {
      let transitionProb = 0;
      
      // Make transitions more frequent to match static scene visuals
      if (r < p.coreRadius) {
        // High chance for fast neutrons to transition to epithermal in the core
        // This matches static scene where most neutrons exit core as epithermal (yellow)
        if (neutron.energyGroup === ENERGY_GROUPS.FAST) {
          // As neutrons spend more time in core, steadily increase transition probability
          transitionProb = 0.06 * p.simulationSpeed;
        }
      } else if (r < p.reflectorRadius) {
        // Very high chance in reflector (main moderating region)
        // Fast → Epithermal transition in reflector (almost guaranteed)
        if (neutron.energyGroup === ENERGY_GROUPS.FAST) {
          transitionProb = 0.15 * p.simulationSpeed;
        }
        // Epithermal → Thermal in reflector (high chance)
        else if (neutron.energyGroup === ENERGY_GROUPS.EPITHERMAL) {
          transitionProb = 0.08 * p.simulationSpeed;
        }
      } else {
        // Outside reflector - some chance to slow down further
        if (neutron.energyGroup === ENERGY_GROUPS.EPITHERMAL) {
          transitionProb = 0.04 * p.simulationSpeed;
        }
      }
      
      if (transitionProb > 0 && Math.random() < transitionProb) {
        // Transition to next slower energy group
        neutron.energyGroup++;
        
        // Update color and appearance
        const energyColor = new THREE.Color(COLORS.ENERGY[neutron.energyGroup]);
        let finalColor = energyColor.clone();
        
        if (r < p.coreRadius) {
          finalColor.lerp(new THREE.Color(COLORS.CORE), 0.15);
        } else if (r < p.reflectorRadius) {
          finalColor.lerp(new THREE.Color(COLORS.REFLECTOR), 0.15);
        } else {
          finalColor.lerp(new THREE.Color(COLORS.OUTER), 0.15);
        }
          neutron.mesh.material.color.copy(finalColor);
        neutron.mesh.material.emissive.setHex(COLORS.ENERGY[neutron.energyGroup]);
        
        // Adjust size based on energy - using the same ratio as in addNeutron
        const baseSize = 0.15; // Consistent base size
        const newSize = baseSize * (1.0 + 0.05 * (2 - neutron.energyGroup));
        neutron.mesh.scale.set(newSize, newSize, newSize);
      }
    }
    
    // Check for out of bounds
    if (r > p.reflectorRadius * 1.5) {
      neutron.absorbed = true;
      // Create a small fade-out effect at boundary
      if (neutron.mesh) {
        const fadeOutEffect = () => {
          if (!neutron.mesh || neutron.mesh.material.opacity <= 0.1) {
            if (neutron.mesh && neutron.mesh.parent) {
              neutron.mesh.parent.remove(neutron.mesh);
            }
            return;
          }
          neutron.mesh.material.opacity -= 0.1;
          requestAnimationFrame(fadeOutEffect);
        };
        neutron.mesh.material.transparent = true;
        fadeOutEffect();
      }
      continue;
    }
      // Calculate interaction probability based on mean free path
    // Increased mean free path to reduce interaction frequency, especially for fast neutrons
    const baseFreePath = DEFAULT_PARAMS.MEAN_FREE_PATH * 1.5;
    const energyFactor = 1.0 + neutron.energyGroup * 0.3;
    
    // Region-specific adjustments
    let regionFactor = 1.0;
    if (r < p.coreRadius) {
      regionFactor = 1.2; // Fewer interactions in core
    } else if (r < p.reflectorRadius) {
      regionFactor = 0.9; // More interactions in reflector (moderating region)
    }
    
    const meanFreePath = baseFreePath * energyFactor * regionFactor;
    const interactionProb = 1.0 - Math.exp(-deltaTime / meanFreePath);// Check for interaction (scattering, absorption, fission)
    if (Math.random() < interactionProb) {
      const rnd = Math.random();
        // Adjust absorption probabilities based on energy group and region
      let absorptionProb = DEFAULT_PARAMS.CORE_ABSORPTION;
      
      // Lower absorption for fast and epithermal neutrons
      if (neutron.energyGroup === ENERGY_GROUPS.FAST) {
        absorptionProb *= 0.4; // Fast neutrons have lower absorption probability
      } else if (neutron.energyGroup === ENERGY_GROUPS.EPITHERMAL) {
        absorptionProb *= 0.7; // Epithermal neutrons have moderate absorption probability
      }
      
      // Different absorption rates for different regions
      if (r < p.coreRadius) {
        // Core region - already using default core absorption
      } else if (r < p.reflectorRadius) {
        // Use reflector absorption instead
        absorptionProb = DEFAULT_PARAMS.REFLECTOR_ABSORPTION * 0.6; // Reduced to allow more neutrons to reach outer region
      } else {
        // Outer region - higher absorption
        absorptionProb = DEFAULT_PARAMS.OUTER_ABSORPTION;
      }
      
      if (rnd < absorptionProb) {
        // Absorption
        neutron.absorbed = true;
      }
      else if (rnd < absorptionProb + p.fissionProb && r < p.coreRadius) {
        // Fission (only in core)
        this.createFissionEvent(neutron.position.clone());
        neutron.absorbed = true;
        this.trackCount++;
      }
      else {
        // Scattering - change direction
        const randDir = randomUnitVector3();
        neutron.direction.set(randDir[0], randDir[1], randDir[2]);
        
        // Check for energy group change based on scattering matrix
        const scatterRnd = Math.random();
        let cumulativeProb = 0;
        
        // Modify probability based on region - increase chance of slowing down in core and reflector
        let regionModifier = 1.0;
        if (r < p.coreRadius) {
          // In core, increase chance of slowing down
          regionModifier = 2.0;
        } else if (r < p.reflectorRadius) {
          // In reflector, also increase chance of slowing down
          regionModifier = 1.5;
        }
        
        for (let targetGroup = 0; targetGroup < 3; targetGroup++) {
          // If it's a transition to a slower energy group, apply the modifier
          let transitionProb = SCATTERING_PROBABILITIES[neutron.energyGroup][targetGroup];
          if (targetGroup > neutron.energyGroup) {
            transitionProb *= regionModifier;
          }
          cumulativeProb += transitionProb;
          
          if (scatterRnd < cumulativeProb) {
            if (targetGroup !== neutron.energyGroup) {
              neutron.energyGroup = targetGroup;
              
              // Get region-based color influence
              const distance = neutron.position.length();
              const energyColor = new THREE.Color(COLORS.ENERGY[neutron.energyGroup]);
              let finalColor = energyColor.clone();
              
              // Blend with region color like in static tracks
              if (distance < p.coreRadius) {
                finalColor.lerp(new THREE.Color(COLORS.CORE), 0.15);
              } else if (distance < p.reflectorRadius) {
                finalColor.lerp(new THREE.Color(COLORS.REFLECTOR), 0.15);
              } else {
                finalColor.lerp(new THREE.Color(COLORS.OUTER), 0.15);
              }
                // Update visual appearance for new energy group
              neutron.mesh.material.color.copy(finalColor);
              neutron.mesh.material.emissive.setHex(COLORS.ENERGY[neutron.energyGroup]);
              neutron.mesh.material.emissiveIntensity = 0.6;
              
              // Adjust size based on energy - using the same ratio as in addNeutron
              const baseSize = 0.15; // Consistent base size
              const newSize = baseSize * (1.0 + 0.05 * (2 - neutron.energyGroup));
              neutron.mesh.scale.set(newSize, newSize, newSize);
            }
            break;
          }
        }
      }
    }
  }
  
  // Clean up absorbed neutrons
  for (let i = this.neutrons.length - 1; i >= 0; i--) {
    if (this.neutrons[i].absorbed) {
      const neutron = this.neutrons[i];
      this.scene.remove(neutron.mesh);
      if (neutron.mesh.geometry) neutron.mesh.geometry.dispose();
      if (neutron.mesh.material) neutron.mesh.material.dispose();
      this.neutrons.splice(i, 1);
      this.trackCount++;
    }
  }
  
  // Add new neutrons to maintain population
  const targetCount = Math.min(p.numTracks / 5, 50); // Limit to reasonable number
  
  if (this.neutrons.length < targetCount && Math.random() < 0.1) {
    this.addNeutron();
  }
  
  // Update statistics display
  this.updateStatsDisplay();
};

// Reset the dynamic simulation
NeutronSimViewer.prototype.resetDynamicSimulation = function() {
  // Clean up existing neutrons
  if (this.neutrons) {
    this.neutrons.forEach(neutron => {
      if (neutron.mesh) {
        this.scene.remove(neutron.mesh);
        if (neutron.mesh.geometry) neutron.mesh.geometry.dispose();
        if (neutron.mesh.material) neutron.mesh.material.dispose();
      }
    });
  }
  
  // Clean up fission events
  if (this.fissionEvents) {
    this.fissionEvents.forEach(event => {
      if (event.mesh) {
        this.scene.remove(event.mesh);
        if (event.mesh.geometry) event.mesh.geometry.dispose();
        if (event.mesh.material) event.mesh.material.dispose();
      }
    });
  }
  
  this.neutrons = [];
  this.fissionEvents = [];
  this.trackCount = 0;
  this.simulationTime = 0;
  
  // Re-initialize
  this.setupDynamicSimulation();
};

// Update the statistics display for dynamic mode
NeutronSimViewer.prototype.updateStatsDisplay = function() {
  if (!this.statsDisplay) return;
  
  const currentNeutrons = this.neutrons.length;
  const totalTracks = this.trackCount;
  const simTime = this.simulationTime.toFixed(1);
  
  this.statsDisplay.textContent = `Neutrons: ${currentNeutrons} | Tracks: ${totalTracks} | Time: ${simTime}`;
};

NeutronSimViewer.prototype.reset = function() {
  // Save current mode
  const currentMode = this.params.dynamicMode;
  
  // Reset parameters to defaults
  this.params = {
    numTracks: DEFAULT_PARAMS.NUM_TRACKS,
    pointsPerTrack: DEFAULT_PARAMS.POINTS_PER_TRACK,
    coreRadius: DEFAULT_PARAMS.CORE_RADIUS,
    reflectorRadius: DEFAULT_PARAMS.REFLECTOR_RADIUS,
    sourceRadius: DEFAULT_PARAMS.SOURCE_RADIUS,
    curvature: DEFAULT_PARAMS.CURVATURE_FACTOR,
    trackLength: DEFAULT_PARAMS.TRACK_LENGTH,
    fissionProb: DEFAULT_PARAMS.FISSION_PROBABILITY,
    simulationSpeed: DEFAULT_PARAMS.SIMULATION_SPEED,
    dynamicMode: currentMode // Keep current mode
  };
  
  // Clean up everything
  this.cleanupScene();
  
  // Recreate UI
  this.createControls();
  this.createReactorVisualization();
  
  // Reset visualization
  if (currentMode) {
    this.setupDynamicSimulation();
  } else {
    this.generateTracks();
  }
};

// Reset to initial state
NeutronSimViewer.prototype.resetSimulation = function() {
  this.pauseSimulation();
  this.clearScene();
  this.setupScene();
  this.createControls();
  this.parameters = Object.assign({}, DEFAULT_PARAMS);
  
  // Re-initialize static or dynamic simulation
  this.initializeSimulation();
  
  // Force render
  this.renderer.render(this.scene, this.camera);
};

// Capture the current view as an image
NeutronSimViewer.prototype.captureImage = function(callback) {
  // Force render to ensure the current state is captured
  this.renderer.render(this.scene, this.camera);
  
  // Get the data URL from the canvas
  const dataURL = this.renderer.domElement.toDataURL('image/png');
  
  if (callback && typeof callback === 'function') {
    callback(dataURL);
  }
  
  return dataURL;
};

// Handle tab visibility change - pause/resume animation when tab is hidden/visible
document.addEventListener('visibilitychange', () => {
  const viewers = window._sceneViewers || [];
  
  viewers.forEach(viewer => {
    if (viewer instanceof NeutronSimViewer) {
      // Only affect dynamic simulations
      if (viewer.params.dynamicMode) {
        viewer.animationActive = !document.hidden && viewer._wasActiveBeforeHidden;
      }
    }
  });
});

// Make available globally
window.NeutronSimViewer = NeutronSimViewer;
