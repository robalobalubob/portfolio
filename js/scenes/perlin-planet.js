/**
 * Perlin Planet Visualization
 *
 * This script generates a procedural planet using multiple octaves of 3D Perlin noise
 * to displace the vertices of an icosphere. It is designed to be instantiated by
 * the common.js script.
 */

// --- Seedable Perlin Noise Implementation ---
class SeedablePerlinNoise {
  constructor(seed = 'default') {
    // Simple string-to-number hash for the seed
    let numSeed = 0;
    for (let i = 0; i < seed.length; i++) {
      numSeed = (numSeed << 5) - numSeed + seed.charCodeAt(i);
      numSeed |= 0; // Convert to 32bit integer
    }

    // Simple LCG pseudo-random number generator
    const prng = () => {
      numSeed = (numSeed * 1664525 + 1013904223) | 0;
      return (numSeed >>> 0) / 4294967296;
    };

    // Create a shuffled permutation table using the PRNG
    const permutation = [];
    for (let i = 0; i < 256; i++) {
      permutation.push(i);
    }
    // Fisher-Yates shuffle
    for (let i = permutation.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }

    // Double the permutation array for wrapping
    this.p = new Array(512);
    for (let i = 0; i < 256; i++) {
      this.p[256 + i] = this.p[i] = permutation[i];
    }
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }
  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);
    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;
    return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)), this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))), this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)), this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
  }
}

class PerlinPlanetViewer {
  constructor(containerId, controlsId) {
    this.container = document.getElementById(containerId);
    this.controlsContainer = document.getElementById(controlsId);
    if (!this.container || !this.controlsContainer) {
      console.error("Container or controls element not found!");
      return;
    }

    this.params = {
      seed: 'portfolio',
      resolution: 6,
      noiseScale: 1.5,
      octaves: 6,
      persistence: 0.5,
      lacunarity: 2.0,
      strength: 0.2,
      oceanLevel: 0.05,
      showWireframe: false,
    };

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101020);
    this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
    this.camera.position.z = 2.5;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 3, 5);
    this.scene.add(directionalLight);
    
    this.noiseGen = new SeedablePerlinNoise(this.params.seed);
    
    this.createUI();
    this.generatePlanet();
    this.animate();
    window.addEventListener("resize", () => this.onWindowResize(), false);
  }

  createUI() {
    this.controlsContainer.innerHTML = ''; // Clear any previous controls

    const createSeedControl = (id, text, value) => {
        const control = document.createElement('div');
        control.className = 'control';
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = text;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.value = value;
        const button = document.createElement('button');
        button.textContent = 'Generate New Planet';
        button.addEventListener('click', () => {
            this.params.seed = input.value;
            this.noiseGen = new SeedablePerlinNoise(this.params.seed);
            this.generatePlanet();
        });
        control.appendChild(label);
        control.appendChild(input);
        control.appendChild(button);
        this.controlsContainer.appendChild(control);
    };

    const createSlider = (id, text, min, max, step, value) => {
      const control = document.createElement('div');
      control.className = 'control';
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = text;
      const valueSpan = document.createElement('span');
      valueSpan.textContent = value;
      label.appendChild(valueSpan);
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = id;
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = value;
      slider.addEventListener('input', (e) => {
        this.params[id] = parseFloat(e.target.value);
        valueSpan.textContent = e.target.value;
        this.generatePlanet();
      });
      control.appendChild(label);
      control.appendChild(slider);
      this.controlsContainer.appendChild(control);
    };

    const createCheckbox = (id, text, value) => {
      const control = document.createElement('div');
      control.className = 'control';
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = text;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = id;
      checkbox.checked = value;
      checkbox.addEventListener('change', (e) => {
        this.params[id] = e.target.checked;
        this.toggleWireframe();
      });
      label.prepend(checkbox);
      control.appendChild(label);
      this.controlsContainer.appendChild(control);
    };

    createSeedControl('seed', 'Planet Seed', this.params.seed);
    createSlider('noiseScale', 'Noise Scale', 0.1, 5.0, 0.1, this.params.noiseScale);
    createSlider('octaves', 'Octaves', 1, 8, 1, this.params.octaves);
    createSlider('persistence', 'Persistence', 0.1, 1.0, 0.05, this.params.persistence);
    createSlider('lacunarity', 'Lacunarity', 1.5, 3.5, 0.1, this.params.lacunarity);
    createSlider('strength', 'Strength', 0.05, 1.0, 0.01, this.params.strength);
    createSlider('oceanLevel', 'Ocean Level', 0.0, 0.5, 0.01, this.params.oceanLevel);
    createCheckbox('showWireframe', 'Wireframe', this.params.showWireframe);
  }

  generatePlanet() {
    if (this.planet) {
      this.scene.remove(this.planet);
      this.planet.geometry.dispose();
      this.planet.material.dispose();
    }
    const geometry = new THREE.IcosahedronGeometry(1, this.params.resolution);
    const positions = geometry.attributes.position;
    const colors = [];
    const colorDeepWater = new THREE.Color(0x003366);
    const colorShallowWater = new THREE.Color(0x006699);
    const colorSand = new THREE.Color(0xc2b280);
    const colorGrass = new THREE.Color(0x559020);
    const colorRock = new THREE.Color(0x808080);
    const colorSnow = new THREE.Color(0xffffff);
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      tempVec.fromBufferAttribute(positions, i).normalize();
      let noiseValue = 0;
      let frequency = 1.0;
      let amplitude = 1.0;
      for (let j = 0; j < this.params.octaves; j++) {
        let p = tempVec.clone().multiplyScalar(frequency * this.params.noiseScale);
        let v = this.noiseGen.noise(p.x, p.y, p.z);
        noiseValue += v * amplitude;
        frequency *= this.params.lacunarity;
        amplitude *= this.params.persistence;
      }
      const elevation = this.params.strength * noiseValue;
      const finalElevation = Math.max(0, elevation);
      const newPos = tempVec.clone().multiplyScalar(1 + finalElevation);
      positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
      let color;
      if (finalElevation < this.params.oceanLevel) { color = colorDeepWater; }
      else if (finalElevation < this.params.oceanLevel + 0.02) { color = colorShallowWater; }
      else if (finalElevation < this.params.oceanLevel + 0.06) { color = colorSand; }
      else if (finalElevation < 0.2) { color = colorGrass; }
      else if (finalElevation < 0.3) { color = colorRock; }
      else { color = colorSnow; }
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    positions.needsUpdate = true;
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, wireframe: this.params.showWireframe });
    this.planet = new THREE.Mesh(geometry, material);
    this.scene.add(this.planet);
  }
  
  toggleWireframe() {
    if (this.planet) {
      this.planet.material.wireframe = this.params.showWireframe;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    if (this.planet) {
      this.planet.rotation.y += 0.0005;
    }
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
}

window.PerlinPlanetViewer = PerlinPlanetViewer;