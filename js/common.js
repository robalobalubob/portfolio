// common.js - shared JS for navigation and tab switching

// Store viewer instances for cleanup
const viewers = {
  superquadrics: null,
  neutron: null,
  terrain: null,
  planet: null
};

// Store globally for visibility change handler
window._sceneViewers = [];

function initViewer(tab) {
  console.log(`[Common] Initializing viewer for tab: ${tab}`);

  // Force renderer size update (helps fix tab switching issues)
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 50);

  if (tab === 'superquadrics') {
    if (viewers.superquadrics) {
      console.log('[Common] Superquadrics viewer already initialized');
      return;
    }
    try {
      if (window.SuperquadricsViewer) {
        console.log('[Common] Creating new SuperquadricsViewer');
        viewers.superquadrics = new window.SuperquadricsViewer('superquadrics-canvas', 'superquadrics-controls');
        window._sceneViewers.push(viewers.superquadrics);
      }
    } catch (e) { 
      console.error('[Init] Error initializing SuperquadricsViewer:', e); 
    }
  } else if (tab === 'neutron') {
    if (viewers.neutron) {
      console.log('[Common] Neutron viewer already initialized');
      return;
    }
    try {
      if (window.NeutronSimViewer) {
        console.log('[Common] Creating new NeutronSimViewer');
        viewers.neutron = new window.NeutronSimViewer('neutron-canvas', 'neutron-controls');
        window._sceneViewers.push(viewers.neutron);
      }
    } catch (e) { 
      console.error('[Init] Error initializing NeutronSimViewer:', e); 
    }
  } else if (tab === 'terrain') {
    if (viewers.terrain) {
      console.log('[Common] Terrain viewer already initialized');
      return;
    }
    try {
      if (window.FractalTerrainViewer) {
        console.log('[Common] Creating new FractalTerrainViewer');
        viewers.terrain = new window.FractalTerrainViewer('terrain-canvas', 'terrain-controls');
        window._sceneViewers.push(viewers.terrain);
      }
    } catch (e) { 
      console.error('[Init] Error initializing FractalTerrainViewer:', e); 
    }
  } else if (tab === 'planet') {
    if (viewers.planet) {
      console.log('[Common] Planet viewer already initialized');
      return;
    }
    try {
      if (window.PerlinPlanetViewer) {
        console.log('[Common] Creating new PerlinPlanetViewer');
        viewers.planet = new window.PerlinPlanetViewer('planet-canvas', 'planet-controls');
        window._sceneViewers.push(viewers.planet);
      }
    } catch (e) { 
      console.error('[Init] Error initializing PerlinPlanetViewer:', e); 
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Tab switching for scenes.html
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  tabLinks.forEach(link => {
    link.addEventListener('click', function() {
      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(tc => tc.style.display = 'none');
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).style.display = '';
      // Initialize the viewer for the selected tab if not already done
      initViewer(tabId);
    });
  });
  // Initialize the default (first) tab's viewer
  const firstTab = document.querySelector('.tab-link.active');
  if (firstTab) {
    initViewer(firstTab.getAttribute('data-tab'));
  }
  
  // Handle preview image capture if button exists
  const captureButtons = document.querySelectorAll('.capture-preview');
  captureButtons.forEach(button => {
    button.addEventListener('click', function() {
      const sceneType = this.getAttribute('data-scene');
      capturePreviewImage(sceneType);
    });
  });
});

/**
 * Captures a preview image from a scene viewer
 * @param {string} sceneType - The type of scene ('superquadrics', 'neutron', 'terrain')
 */
function capturePreviewImage(sceneType) {
  console.log(`[Common] Capturing preview image for: ${sceneType}`);
  
  const viewer = viewers[sceneType];
  if (!viewer || !viewer.captureImage) {
    console.error(`[Preview] No viewer found for ${sceneType} or it doesn't support image capture`);
    return;
  }
  
  try {
    // Capture the image using the viewer's method
    const dataURL = viewer.captureImage();
    
    // Create a download link for the image
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `${sceneType}-preview.png`;
    document.body.appendChild(link);
    
    // Trigger the download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    console.log(`[Preview] Image for ${sceneType} created and download started`);
    
    // Optionally, display the image in a modal or preview element
    const previewElement = document.getElementById(`${sceneType}-preview`);
    if (previewElement) {
      if (previewElement.tagName === 'IMG') {
        previewElement.src = dataURL;
      } else {
        previewElement.style.backgroundImage = `url(${dataURL})`;
      }
    }
  } catch (e) {
    console.error('[Preview] Error capturing image:', e);
  }
}
