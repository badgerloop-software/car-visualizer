const create3DEnvironment = () => {
  // Create the renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x1a1a1a); // Dark showroom background
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Set up the camera
  const fieldOfView = 75;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 1000;

  const camera = new THREE.PerspectiveCamera(fieldOfView, aspect, near, far);
  camera.position.set(5, 3, 5);
  camera.lookAt(0, 0, 0);

  // Create the scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1a1a, 10, 50); // Add fog for depth

  // Add showroom lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Dim ambient light
  scene.add(ambientLight);

  // Main spotlight on the car
  const spotLight1 = new THREE.SpotLight(0xffffff, 1.5);
  spotLight1.position.set(5, 8, 5);
  spotLight1.angle = Math.PI / 6;
  spotLight1.penumbra = 0.3;
  spotLight1.decay = 2;
  spotLight1.distance = 30;
  spotLight1.castShadow = true;
  spotLight1.shadow.mapSize.width = 2048;
  spotLight1.shadow.mapSize.height = 2048;
  scene.add(spotLight1);

  // Secondary spotlight from the other side
  const spotLight2 = new THREE.SpotLight(0xffffff, 1.2);
  spotLight2.position.set(-5, 6, -3);
  spotLight2.angle = Math.PI / 6;
  spotLight2.penumbra = 0.3;
  spotLight2.decay = 2;
  spotLight2.distance = 30;
  spotLight2.castShadow = true;
  scene.add(spotLight2);

  // Rim light from behind
  const rimLight = new THREE.SpotLight(0x4444ff, 0.8);
  rimLight.position.set(0, 4, -8);
  rimLight.angle = Math.PI / 5;
  rimLight.penumbra = 0.5;
  scene.add(rimLight);

  // Extra key light from right-above to brighten top surfaces in showroom mode
  const topRightLight = new THREE.SpotLight(0xffffff, 1.1);
  topRightLight.position.set(2.8, 10, 0.8);
  topRightLight.angle = Math.PI / 4;
  topRightLight.penumbra = 0.35;
  topRightLight.decay = 2;
  topRightLight.distance = 35;
  topRightLight.castShadow = true;
  topRightLight.shadow.mapSize.width = 1024;
  topRightLight.shadow.mapSize.height = 1024;
  scene.add(topRightLight);

  // Add a lighter ground plane (showroom floor)
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    roughness: 1.0,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  // Add animated road for Drive mode
  const roadGeometry = new THREE.PlaneGeometry(4, 100);
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.1
  });
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.y = -0.49; // Slightly above ground to prevent z-fighting
  road.position.z = 0;
  road.visible = false; // Hidden by default (showroom mode)
  scene.add(road);

  // Add road lane markings
  const laneMarkings = [];
  const laneGeometry = new THREE.PlaneGeometry(0.2, 3);
  const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  
  for (let i = 0; i < 20; i++) {
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    lane.rotation.x = -Math.PI / 2;
    lane.position.y = -0.48;
    lane.position.z = i * 10 - 50; // Spread along the road
    lane.visible = false;
    laneMarkings.push(lane);
    scene.add(lane);
  }

  // Add trees/environment objects for Drive mode
  const environmentObjects = [];
  for (let side = -1; side <= 1; side += 2) { // left and right sides
    for (let i = 0; i < 10; i++) {
      // Simple tree representation (cone + cylinder)
      const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3520 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      
      const foliageGeometry = new THREE.ConeGeometry(1.5, 3, 8);
      const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = 2.5;
      
      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(foliage);
      tree.position.set(side * (6 + Math.random() * 2), 0.5, i * 20 - 50);
      tree.castShadow = true;
      tree.visible = false;
      environmentObjects.push(tree);
      scene.add(tree);
    }
  }

  // Animation state for driving mode
  let isDriving = false;
  let roadOffset = 0;
  const BASE_ROAD_SPEED = 0.3; // Base speed multiplier for road animation
  let currentSpeed = 0; // Current speed in MPH (0-75)
  let roadSpeed = 0; // Actual animation speed (calculated from currentSpeed)
  let isDayMode = true; // Day/night mode toggle

  // Resolve controls constructor across different global script builds.
  const OrbitControlsCtor = THREE.OrbitControls || window.OrbitControls;
  if (!OrbitControlsCtor) {
    throw new Error('OrbitControls failed to load. Check index.html script URLs.');
  }

  // Add OrbitControls for mouse interaction
  const controls = new OrbitControlsCtor(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 20;

  // Camera info overlay: press 'I' to toggle an on-screen readout of camera position/angles
  let cameraInfoVisible = false;

  const cameraInfo = document.createElement('div');
  cameraInfo.id = 'camera-info';
  Object.assign(cameraInfo.style, {
    position: 'fixed',
    top: '10px',
    left: '10px',
    padding: '8px 10px',
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '12px',
    borderRadius: '6px',
    zIndex: 10000,
    display: 'none',
    maxWidth: '360px',
    lineHeight: '1.3'
  });

  cameraInfo.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px">Camera Info</div>
    <div id="cam-pos">Pos: --</div>
    <div id="cam-target">Target: --</div>
    <div id="cam-dist">Distance: --</div>
    <div id="cam-angles">Azimuth: --°, Polar: --°</div>
    <div style="margin-top:6px;padding:6px;background:rgba(255,255,255,0.05);border-radius:4px;">
      <div style="font-weight:600;margin-bottom:4px">Speed Simulation</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <input type="range" id="speed-slider" min="0" max="75" value="0" step="1" style="flex:1;"/>
        <span id="speed-display" style="min-width:50px;text-align:right;">0 mph</span>
      </div>
      <div style="font-size:10px;opacity:0.7;">Drag slider or use API to set speed</div>
    </div>
    <div style="margin-top:6px;">
      <button id="btn-copy" title="Copy camera state">Copy</button>
      <button id="btn-day-night" title="Toggle Day/Night Mode">Day Mode</button>
      <button id="btn-recenter-panel" title="Return to default view for current mode">Recenter</button>
    </div>
    <div style="margin-top:6px;font-size:10px;opacity:0.8">Tip: press 'I' to toggle this panel</div>
  `;

  document.body.appendChild(cameraInfo);

  // If an older toggle button exists, remove it (we prefer keyboard only)
  const oldToggle = document.getElementById('camera-toggle-btn');
  if (oldToggle) oldToggle.remove();

  const camPosEl = cameraInfo.querySelector('#cam-pos');
  const camTargetEl = cameraInfo.querySelector('#cam-target');
  const camDistEl = cameraInfo.querySelector('#cam-dist');
  const camAnglesEl = cameraInfo.querySelector('#cam-angles');
  const copyBtn = cameraInfo.querySelector('#btn-copy');
  const dayNightBtn = cameraInfo.querySelector('#btn-day-night');
  const recenterPanelBtn = cameraInfo.querySelector('#btn-recenter-panel');
  const speedSlider = cameraInfo.querySelector('#speed-slider');
  const speedDisplay = cameraInfo.querySelector('#speed-display');

  // Speed calculation: convert MPH to animation speed
  // At 50 MPH (typical highway speed), we want reasonable animation speed (BASE_ROAD_SPEED * 1.0)
  // Speed range: 0-75 MPH (clamped at 75 for speeds above)
  function updateSpeed(mph) {
    // Clamp speed to 0-75 MPH range
    currentSpeed = Math.max(0, Math.min(75, Number(mph) || 0));
    // Linear mapping: 0 MPH = 0 speed, 50 MPH = BASE_ROAD_SPEED, 75 MPH = BASE_ROAD_SPEED * 1.5
    roadSpeed = (currentSpeed / 50) * BASE_ROAD_SPEED;
    if (speedDisplay) speedDisplay.textContent = `${currentSpeed.toFixed(0)} mph`;
    if (speedSlider) speedSlider.value = currentSpeed;
  }

  // Speed slider input
  speedSlider.addEventListener('input', (e) => {
    updateSpeed(e.target.value);
  });

  function fmtVec3(v) {
    return `${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)}`;
  }

  function updateCameraInfo() {
    camPosEl.innerHTML = `Pos: <strong>${fmtVec3(camera.position)}</strong>`;
    camTargetEl.innerHTML = `Target: <strong>${fmtVec3(controls.target)}</strong>`;
    camDistEl.innerHTML = `Distance: <strong>${camera.position.distanceTo(controls.target).toFixed(3)}</strong>`;
    const az = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle());
    const polar = THREE.MathUtils.radToDeg(controls.getPolarAngle());
    camAnglesEl.innerHTML = `Azimuth: <strong>${az.toFixed(2)}°</strong>, Polar: <strong>${polar.toFixed(2)}°</strong>`;
  }

  // Simple toast messages
  let toastTimer = null;
  function showToast(msg) {
    let t = document.getElementById('camera-info-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'camera-info-toast';
      Object.assign(t.style, {
        position: 'fixed',
        bottom: '12px',
        left: '12px',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        padding: '6px 8px',
        borderRadius: '6px',
        fontFamily: 'sans-serif',
        fontSize: '12px',
        zIndex: 10001,
        opacity: '1'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 1400);
  }

  // Copy to clipboard
  copyBtn.addEventListener('click', async () => {
    const payload = {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      distance: Number(camera.position.distanceTo(controls.target).toFixed(6)),
      azimuthDeg: Number(THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()).toFixed(6)),
      polarDeg: Number(THREE.MathUtils.radToDeg(controls.getPolarAngle()).toFixed(6)),
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Camera state copied');
    } catch (err) {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); showToast('Camera state copied'); } catch (e) { showToast('Copy failed'); }
      document.body.removeChild(el);
    }
  });

  // Day/Night mode toggle
  dayNightBtn.addEventListener('click', () => {
    isDayMode = !isDayMode;
    dayNightBtn.textContent = isDayMode ? 'Day Mode' : 'Night Mode';
    updateEnvironmentLighting();
    showToast(isDayMode ? 'Switched to Day Mode' : 'Switched to Night Mode');
  });

  // Update environment lighting based on day/night mode
  function updateEnvironmentLighting() {
    if (isDriving) {
      // Driving mode - update for day/night
      if (isDayMode) {
        // Day: bright blue sky
        renderer.setClearColor(0x87ceeb);
        scene.fog.color.setHex(0x87ceeb);
        ambientLight.intensity = 0.6;
      } else {
        // Night: dark blue/purple sky
        renderer.setClearColor(0x0a0a2e);
        scene.fog.color.setHex(0x0a0a2e);
        ambientLight.intensity = 0.3;
      }
    }
    // Showroom mode is unaffected by day/night toggle
  }

  // --- Presets storage (supports multiple named camera presets) ---
  const PRESETS_KEY = 'cameraPresets';

  function loadPresets() {
    const raw = localStorage.getItem(PRESETS_KEY);
    let presets = {};
    try {
      if (raw) presets = JSON.parse(raw);
    } catch (e) {
      presets = {};
    }
    // Backwards compat: migrate old `cameraHome` if present
    const oldHome = localStorage.getItem('cameraHome');
    if (oldHome) {
      try {
        const home = JSON.parse(oldHome);
        if (!presets.Home && home.position && home.target) {
          presets.Home = { position: home.position, target: home.target };
          localStorage.removeItem('cameraHome');
        }
      } catch (e) {}
    }
    return presets;
  }

  function savePresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  }

  let cameraPresets = loadPresets();

  function normalizePresetData(d) {
    const pos = d && d.position ? d.position : camera.position.toArray();
    const tgt = d && d.target ? d.target : controls.target.toArray();
    const posArr = Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z];
    const tgtArr = Array.isArray(tgt) ? tgt : [tgt.x, tgt.y, tgt.z];
    return { position: posArr, target: tgtArr };
  }

  function setPreset(name, data = null) {
    const d = normalizePresetData(data || {});
    cameraPresets[name] = d;
    savePresets(cameraPresets);
    updatePresetsUI();
    showToast(`${name} saved`);
  }

  function getPreset(name) {
    return cameraPresets[name] || null;
  }

  function goToPreset(name, duration = 1000) {
    const p = getPreset(name);
    if (!p) { showToast('Preset not found'); return; }
    const targetPos = new THREE.Vector3(p.position[0], p.position[1], p.position[2]);
    const targetTarget = new THREE.Vector3(p.target[0], p.target[1], p.target[2]);
    // Set mode immediately so park_brake and UI reflect intent
    setCurrentMode(name);
    return animateCameraTo(targetPos, targetTarget, duration).then(() => {
      updateCameraInfo();
      showToast(`Moved to ${name}`);
    });
  }

  // Smooth camera tween helper (independent of render loop)
  let cameraTweenCancel = null;
  function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }

  function animateCameraTo(targetPosition, targetTarget, duration = 1000) {
    if (cameraTweenCancel) cameraTweenCancel();
    const startTime = performance.now();
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = targetPosition.clone();
    const endTarget = targetTarget.clone();
    let cancelled = false;
    cameraTweenCancel = () => { cancelled = true; cameraTweenCancel = null; };

    return new Promise((resolve) => {
      (function step() {
        if (cancelled) { resolve(); return; }
        const now = performance.now();
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeInOutQuad(t);
        camera.position.lerpVectors(startPos, endPos, eased);
        controls.target.lerpVectors(startTarget, endTarget, eased);
        controls.update();
        if (t < 1) requestAnimationFrame(step);
        else { cameraTweenCancel = null; resolve(); }
      })();
    });
  }

  // --- Presets UI (removed - keeping presets system internal) ---
  function updatePresetsUI() {
    // No-op: UI removed but function kept for compatibility
  }

  // Interaction & mode state
  let currentMode = null; // 'Home' or 'Drive' or null
  let park_brake = null; // 0 or 1
  let userInteracting = false;
  let revertTimer = null;
  const REVERT_DELAY = 10000; // ms — auto-revert after user stops orbiting
  const MIN_CAMERA_Y = ground.position.y + 0.01; // world y floor limit - do not allow camera below this
  let iKeyHandled = false;

  // Forward declarations for UI elements that will be created later
  let signalStatus = null;
  let simBrakeBtn = null;

  function updateParkBrakeUI(val) {
    park_brake = Number(val) ? 1 : 0;
    if (signalStatus) signalStatus.textContent = `park_brake: ${park_brake} (mode: ${currentMode || 'none'})`;
    // Button label shows the ACTION to perform: if brake is engaged (1), show "Release"; if released (0), show "Enable"
    if (simBrakeBtn) simBrakeBtn.textContent = park_brake === 1 ? 'Sim Brake Release' : 'Sim Brake Enable';
  }

  function setCurrentMode(name) {
    currentMode = name;
    if (name === 'Home') {
      updateParkBrakeUI(1);
      setShowroomMode();
    } else if (name === 'Drive') {
      updateParkBrakeUI(0);
      setDrivingMode();
    } else if (park_brake === null) {
      updateParkBrakeUI(0);
    }
    clearRevertCountdown();
    setRecenterVisible(false);
  }

  // Switch to showroom mode (spotlights, static environment)
  function setShowroomMode() {
    isDriving = false;
    
    // Show showroom ground, hide road
    ground.visible = true;
    road.visible = false;
    laneMarkings.forEach(lane => lane.visible = false);
    environmentObjects.forEach(obj => obj.visible = false);
    
    // Enable showroom lighting
    spotLight1.visible = true;
    spotLight2.visible = true;
    rimLight.visible = true;
    topRightLight.visible = true;
    ambientLight.intensity = 0.2;
    
    // Dark showroom background
    renderer.setClearColor(0x1a1a1a);
    scene.fog.color.setHex(0x1a1a1a);
  }

  // Switch to driving mode (natural lighting, moving road)
  function setDrivingMode() {
    isDriving = true;
    roadOffset = 0; // Reset road position
    
    // Hide showroom ground, show road
    ground.visible = false;
    road.visible = true;
    laneMarkings.forEach(lane => lane.visible = true);
    environmentObjects.forEach(obj => obj.visible = true);
    
    // Disable spotlights for more natural outdoor lighting
    spotLight1.visible = false;
    spotLight2.visible = false;
    rimLight.visible = false;
    topRightLight.visible = false;
    
    // Apply day/night lighting
    if (isDayMode) {
      ambientLight.intensity = 0.6; // Bright daylight
      renderer.setClearColor(0x87ceeb); // Sky blue
      scene.fog.color.setHex(0x87ceeb);
    } else {
      ambientLight.intensity = 0.3; // Dim night lighting
      renderer.setClearColor(0x0a0a2e); // Dark night sky
      scene.fog.color.setHex(0x0a0a2e);
    }
  }

  // Floating recenter button (shown after the user moves the camera)
  const recenterBtn = document.createElement('button');
  recenterBtn.id = 'btn-recenter';
  recenterBtn.textContent = 'Recenter View';
  recenterBtn.title = 'Return to default view for current mode';
  Object.assign(recenterBtn.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 14px',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '6px',
    fontFamily: 'sans-serif',
    fontSize: '13px',
    cursor: 'pointer',
    zIndex: 10000,
    display: 'none',
  });
  document.body.appendChild(recenterBtn);

  let revertDeadline = null; // performance.now() when auto-revert fires

  function setRecenterVisible(visible) {
    recenterBtn.style.display = visible ? 'block' : 'none';
    if (recenterPanelBtn) recenterPanelBtn.style.display = visible ? 'inline-block' : 'none';
    if (!visible) updateRecenterCountdown();
  }

  function updateRecenterCountdown() {
    let floatingLabel = 'Recenter View';
    let panelLabel = 'Recenter';
    if (revertDeadline != null && !userInteracting) {
      const secondsLeft = Math.max(0, Math.ceil((revertDeadline - performance.now()) / 1000));
      floatingLabel = `Recenter View (${secondsLeft}s)`;
      panelLabel = `Recenter (${secondsLeft}s)`;
    }
    recenterBtn.textContent = floatingLabel;
    if (recenterPanelBtn) recenterPanelBtn.textContent = panelLabel;
  }

  function clearRevertCountdown() {
    if (revertTimer) {
      clearTimeout(revertTimer);
      revertTimer = null;
    }
    revertDeadline = null;
    updateRecenterCountdown();
  }

  function startRevertCountdown() {
    clearRevertCountdown();
    revertDeadline = performance.now() + REVERT_DELAY;
    updateRecenterCountdown();
    revertTimer = setTimeout(() => {
      revertDeadline = null;
      if (!userInteracting && currentMode && cameraPresets[currentMode]) {
        goToPreset(currentMode, 800);
        showToast(`Reverting to ${currentMode} view`);
        setRecenterVisible(false);
      }
    }, REVERT_DELAY);
  }

  function recenterView() {
    clearRevertCountdown();
    const mode = currentMode || 'Home';
    if (cameraPresets[mode]) {
      goToPreset(mode, 800);
      showToast(`Recentered to ${mode} view`);
    } else {
      showToast('No preset for current mode');
    }
    setRecenterVisible(false);
  }

  recenterBtn.addEventListener('click', recenterView);
  if (recenterPanelBtn) recenterPanelBtn.addEventListener('click', recenterView);
  setRecenterVisible(false);

  // Prevent looking under the floor and auto-revert after interactions
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI / 2 - 0.0001; // disallow going below the horizontal plane

  controls.addEventListener('start', () => {
    userInteracting = true;
    if (cameraTweenCancel) cameraTweenCancel();
    clearRevertCountdown();
    if (currentMode && cameraPresets[currentMode]) {
      setRecenterVisible(true);
      updateRecenterCountdown();
    }
  });

  controls.addEventListener('end', () => {
    userInteracting = false;
    if (currentMode && cameraPresets[currentMode]) {
      startRevertCountdown();
    }
  });

  controls.addEventListener('change', () => {
    let changed = false;
    if (camera.position.y < MIN_CAMERA_Y) {
      camera.position.y = MIN_CAMERA_Y;
      changed = true;
    }
    if (controls.target.y < MIN_CAMERA_Y) {
      controls.target.y = MIN_CAMERA_Y;
      changed = true;
    }
    if (changed) controls.update();
  });

  // Keyboard shortcuts (capture phase): 'I' toggles on key release, 'H' goes Home, 'C' copies state
  (function() {
    // small visual key log to help debugging key input
    const keyLog = document.createElement('div');
    keyLog.id = 'camera-key-log';
    keyLog.style.marginTop = '8px';
    keyLog.style.fontSize = '11px';
    keyLog.style.opacity = '0.95';
    keyLog.style.fontFamily = 'monospace';
    keyLog.textContent = 'Last key: -';
    cameraInfo.appendChild(keyLog);

    // Make canvas focusable so it can receive keyboard events when clicked
    try {
      const canvasEl = renderer.domElement;
      canvasEl.tabIndex = 0; // make focusable
      canvasEl.style.outline = 'none';
      canvasEl.addEventListener('click', () => canvasEl.focus());
    } catch (e) { /* ignore */ }

    function onGlobalKeyDown(e) {
      try {
        const tag = e.target && e.target.tagName ? e.target.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
        if (e.repeat) return; // ignore held-down repeats
        // show last key for debugging
        keyLog.textContent = `Last key: ${e.key || ''} (code: ${e.code || ''})`;
        const k = (e.key || '').toLowerCase();
        // Toggle 'I' on keydown (once) to make behavior persistent after release
        if (k === 'i') {
          if (!iKeyHandled) {
            cameraInfoVisible = !cameraInfoVisible;
            cameraInfo.style.display = cameraInfoVisible ? 'block' : 'none';
            if (cameraInfoVisible) updateCameraInfo();
            iKeyHandled = true;
          }
          e.preventDefault();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          e.stopPropagation();
          return;
        }
        if (k === 'h') {
          if (cameraPresets['Home']) {
            goToPreset('Home', 800);
          } else {
            showToast('No Home set');
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (k === 'c') {
          copyBtn && copyBtn.click();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch (err) {
        console.error('Key handler error', err);
      }
    }

    function onGlobalKeyUp(e) {
      try {
        keyLog.textContent = `Last key: ${e.key || ''} (code: ${e.code || ''})`;
        const k = (e.key || '').toLowerCase();
        if (k === 'i') {
          // reset the handled flag so next press works
          if (iKeyHandled) {
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            e.stopPropagation();
          }
          iKeyHandled = false;
        }
      } catch (err) { /* ignore */ }
    }

    // Use capture=true to catch events before other elements may stop propagation
    window.addEventListener('keydown', onGlobalKeyDown, { capture: true });
    window.addEventListener('keyup', onGlobalKeyUp, { capture: true });

    // also listen on the canvas specifically when it has focus
    try {
      const canvasEl = renderer.domElement;
      canvasEl.addEventListener('keydown', onGlobalKeyDown);
      canvasEl.addEventListener('keyup', onGlobalKeyUp);
    } catch (e) { /* ignore */ }
  })();

  // If a known Drive preset was saved externally (example provided), add it automatically
  if (!cameraPresets['Drive']) {
    cameraPresets['Drive'] = {
      position: [0.12909591647276278, 2.215759854813773, -5.849405778042717],
      target: [0, 0, 0]
    };
    savePresets(cameraPresets);
    console.log('Drive preset added from supplied data');
  }

  // Add default Home preset if not already set
  if (!cameraPresets['Home']) {
    cameraPresets['Home'] = {
      position: [-4.358857444267401, 1.5797084394163963, 3.222751650234066],
      target: [0, 0, 0]
    };
    savePresets(cameraPresets);
    console.log('Home preset added as default');
  }

  // --- Create UI elements for parking brake BEFORE initializing mode ---
  signalStatus = document.createElement('div');
  signalStatus.id = 'signal-status';
  signalStatus.style.marginTop = '8px';
  cameraInfo.appendChild(signalStatus);

  simBrakeBtn = document.createElement('button');
  simBrakeBtn.textContent = 'Sim Brake Release';
  simBrakeBtn.style.marginTop = '6px';
  cameraInfo.appendChild(simBrakeBtn);
  
  // Define handleParkingBrake function and lastParkingBrake tracker
  // Initialize to 1 (engaged) since we start in Home mode
  let lastParkingBrake = 1;
  function handleParkingBrake(value) {
    const val = Number(value) ? 1 : 0;
    // Update UI/state immediately
    updateParkBrakeUI(val);

    // detect edges - now also works on first call since lastParkingBrake is initialized
    if (lastParkingBrake === 1 && val === 0) {
      // 1 -> 0 : released => Drive
      if (cameraPresets['Drive']) {
        setCurrentMode('Drive');
        goToPreset('Drive', 1200);
        showToast('park_brake released — entering Drive view');
      } else {
        showToast('park_brake released — Drive preset not found');
      }
    } else if (lastParkingBrake === 0 && val === 1) {
      // 0 -> 1 : engaged => Home
      if (cameraPresets['Home']) {
        setCurrentMode('Home');
        goToPreset('Home', 1200);
        showToast('park_brake engaged — entering Home view');
      } else {
        showToast('park_brake engaged — Home preset not found');
      }
    }
    lastParkingBrake = val;
  }
  
  simBrakeBtn.addEventListener('click', () => {
    // toggle simulated brake state
    const nextVal = park_brake === 1 ? 0 : 1;
    handleParkingBrake(nextVal);
  });

  // ALWAYS initialize to Home mode on page load (refresh)
  // This ensures consistent starting position regardless of previous state
  if (cameraPresets['Home']) {
    setCurrentMode('Home');
    // Immediately set camera to Home position without animation
    const homePreset = cameraPresets['Home'];
    camera.position.set(homePreset.position[0], homePreset.position[1], homePreset.position[2]);
    controls.target.set(homePreset.target[0], homePreset.target[1], homePreset.target[2]);
    controls.update();
    console.log('Initialized to Home mode on page load');
  } else if (cameraPresets['Drive']) {
    setCurrentMode('Drive');
  }

  // Convenience API: parent project can directly set parking brake state
  window.setParkingBrakeState = function(val) {
    handleParkingBrake(val);
  };

  // Convenience API: parent project can directly set speed
  window.setCarSpeed = function(kmh) {
    updateSpeed(kmh);
  };

  window.receiveVehicleSignal = function(signalName, value) {
    if (!signalName) return;
    const n = signalName.toLowerCase();
    if (n.includes('park')) {
      handleParkingBrake(value);
    } else if (n.includes('speed') || n.includes('velocity')) {
      // Handle speed signals (expecting MPH, clamped at 75)
      updateSpeed(value);
      showToast(`Speed: ${currentSpeed.toFixed(0)} mph`);
    } else {
      showToast(`${signalName}: ${value}`);
    }
  };

  // Expose a small API for external callers
  window.cameraAPI = {
    setPreset: setPreset,
    getPreset: getPreset,
    listPresets: () => Object.keys(cameraPresets),
    goToPreset: goToPreset,
    animateTo: animateCameraTo,
    receiveVehicleSignal: window.receiveVehicleSignal,
    setDayMode: (isDay) => {
      isDayMode = !!isDay;
      if (dayNightBtn) dayNightBtn.textContent = isDayMode ? 'Day Mode' : 'Night Mode';
      updateEnvironmentLighting();
    },
    getDayMode: () => isDayMode,
    toggleDayNight: () => {
      isDayMode = !isDayMode;
      if (dayNightBtn) dayNightBtn.textContent = isDayMode ? 'Day Mode' : 'Night Mode';
      updateEnvironmentLighting();
      return isDayMode;
    },
    setSpeed: (kmh) => {
      updateSpeed(kmh);
    },
    getSpeed: () => currentSpeed,
    getAnimationSpeed: () => roadSpeed
  };

  // Variables for the car and wheels
  let car = null;
  let wheels = [];

  // Load a car model from the internet
  // Using a free GLTF model from Sketchfab or similar sources
  const GLTFLoaderCtor = THREE.GLTFLoader || window.GLTFLoader;
  if (!GLTFLoaderCtor) {
    throw new Error('GLTFLoader failed to load. Check index.html script URLs.');
  }
  const loader = new GLTFLoaderCtor();

  // Newer Blender exports may use Draco mesh compression (KHR_draco_mesh_compression).
  const DRACOLoaderCtor = THREE.DRACOLoader || window.DRACOLoader;
  if (DRACOLoaderCtor) {
    const dracoLoader = new DRACOLoaderCtor();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
    loader.setDRACOLoader(dracoLoader);
  } else {
    console.warn('DRACOLoader not available; Draco-compressed GLBs will fail to load.');
  }

  // For demonstration, let's create a simple car with rotating wheels
  // You can replace this with a real GLTF model URL
  // createSimpleCar(); // Commented out - only use if GLTF fails

  console.log('Attempting to load GLTF car model...');

  function createSimpleCar() {
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 1);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;

    // Car roof
    const roofGeometry = new THREE.BoxGeometry(1.2, 0.6, 0.9);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, 1.1, 0);
    roof.castShadow = true;

    // Create car group
    car = new THREE.Group();
    car.add(body);
    car.add(roof);

    // Create wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // Wheel positions
    const wheelPositions = [
      { x: -0.7, y: 0.3, z: 0.6 },  // Front left
      { x: 0.7, y: 0.3, z: 0.6 },   // Front right
      { x: -0.7, y: 0.3, z: -0.6 }, // Back left
      { x: 0.7, y: 0.3, z: -0.6 }   // Back right
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      wheels.push(wheel);
      car.add(wheel);
    });

    scene.add(car);
  }

  // Load the local Sunburst body GLB model
  const modelUrl = `sunburst-body/sunburst-body.glb?v=${Date.now()}`;
  loader.load(
    modelUrl, // Local model path (cache-busted)
    (gltf) => {
      console.log('✅ Model loaded successfully!', gltf);
      
      // Remove the simple car if it exists
      if (car) {
        scene.remove(car);
        wheels = [];
      }
      
      const model = gltf.scene;
      const carGroup = new THREE.Group();

      // Normalize model size/position so different assets still appear in-frame.
      const bbox = new THREE.Box3().setFromObject(model);
      const size = bbox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = 6.5;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      // Center geometry on the group origin, then sit the bottom on the ground plane.
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      model.position.sub(scaledCenter);
      const groundedBox = new THREE.Box3().setFromObject(model);
      const groundY = -0.5;
      model.position.y += groundY - groundedBox.min.y;

      carGroup.add(model);
      carGroup.rotation.y = 0;
      car = carGroup;
      
      car.traverse((node) => {
        if (node.isMesh) {
          const nodeName = (node.name || '').toLowerCase();

          // Some exports include helper/grid meshes that overlap the body and cause moire artifacts.
          if (nodeName.includes('grid')) {
            node.visible = false;
            console.log('Hid helper mesh:', node.name || '(unnamed mesh)');
            return;
          }

          node.castShadow = true;
          // Avoid heavy self-shadow acne/striping on curved body panels.
          node.receiveShadow = false;

          const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
          const adjustedMaterials = sourceMaterials.map((srcMat) => {
            if (!srcMat) return srcMat;
            const matName = (srcMat.name || '').toLowerCase();
            // Classify by material name only — the combined mesh is named
            // "Aeroshell and Windshield Model_v3", so node-name checks would
            // mis-tag solar/body/wheels as glass.
            const isGlass = matName.includes('glass') || matName.includes('windshield');
            const isSolar = matName.includes('solar') || matName.includes('cell');
            const isWrap = matName.includes('wrap');
            const isBodySide = matName.includes('aeroshell_body');

            if (isGlass) {
              const mat = srcMat.clone();
              mat.transparent = true;
              mat.opacity = 0.55;
              mat.alphaTest = 0.0;
              mat.depthWrite = false;
              mat.side = THREE.DoubleSide;
              if (mat.color && mat.color.setRGB) {
                mat.color.setRGB(0.75, 0.88, 1.0);
              }
              if (typeof mat.transmission === 'number') {
                mat.transmission = 0.7;
              }
              if (typeof mat.roughness === 'number') {
                mat.roughness = 0.1;
              }
              if (typeof mat.metalness === 'number') {
                mat.metalness = 0.0;
              }

              node.castShadow = false;
              node.renderOrder = 3;
              mat.needsUpdate = true;
              return mat;
            }

            if (isBodySide) {
              node.renderOrder = 0;
              return new THREE.MeshStandardMaterial({
                color: new THREE.Color(0xffffff),
                roughness: 0.35,
                metalness: 0.0,
                emissive: new THREE.Color(0x1a1a1a),
                // DoubleSide so side panels stay visible through wrap cutouts
                // even when exported normals face inward.
                side: THREE.DoubleSide,
                transparent: false,
                opacity: 1.0,
                depthWrite: true,
                depthTest: true,
              });
            }

            const mat = srcMat.clone();

            if (isSolar) {
              mat.transparent = false;
              mat.opacity = 1.0;
              mat.depthWrite = true;
              mat.depthTest = true;
              mat.side = THREE.FrontSide;
              mat.color = new THREE.Color(0xffffff);

              mat.polygonOffset = true;
              mat.polygonOffsetFactor = -0.5;
              mat.polygonOffsetUnits = -0.5;

              if (typeof mat.roughness === 'number') {
                mat.roughness = 0.45;
              }
              if (typeof mat.metalness === 'number') {
                mat.metalness = 0.0;
              }
              if (mat.map) {
                const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
                mat.map.anisotropy = Math.max(1, Math.min(8, maxAniso));
                if ('encoding' in mat.map) {
                  mat.map.encoding = THREE.sRGBEncoding;
                }
                if (typeof mat.emissive !== 'undefined') {
                  mat.emissive = new THREE.Color(0x151515);
                  mat.emissiveMap = mat.map;
                }
                mat.map.needsUpdate = true;
              }
              node.renderOrder = 2;
            } else if (isWrap) {
              // Wrap PNGs have large alpha cutouts; use alphaTest instead of blending.
              mat.transparent = true;
              mat.opacity = 1.0;
              mat.alphaTest = 0.45;
              mat.depthWrite = true;
              mat.depthTest = true;
              mat.side = THREE.DoubleSide;
              mat.polygonOffset = true;
              mat.polygonOffsetFactor = -1;
              mat.polygonOffsetUnits = -1;
              if (typeof mat.transmission === 'number') {
                mat.transmission = 0;
              }
              node.renderOrder = 1;
            } else {
              mat.transparent = false;
              mat.opacity = 1.0;
              mat.alphaTest = 0;
              mat.depthWrite = true;
              mat.depthTest = true;
              mat.side = THREE.FrontSide;
              if (typeof mat.transmission === 'number') {
                mat.transmission = 0;
              }
            }

            mat.needsUpdate = true;
            return mat;
          });

          node.material = Array.isArray(node.material) ? adjustedMaterials : adjustedMaterials[0];
        }
        // Find wheels by name (depends on the model structure)
        const nodeName = node.name.toLowerCase();
        if (nodeName.includes('wheel') || nodeName.includes('tire') || nodeName.includes('rim')) {
          console.log('Found wheel:', node.name);
          wheels.push(node);
        }
      });
      scene.add(car);
      console.log('Car added to scene. Total wheels found:', wheels.length);
      console.log('Model structure:', gltf.scene);
    },
    (progress) => {
      const percent = (progress.loaded / progress.total * 100).toFixed(2);
      console.log('Loading model: ' + percent + '%');
    },
    (error) => {
      console.error('❌ Error loading model:', error);
      if (window.location.protocol === 'file:') {
        console.error('GLB/GLTF assets must be served over HTTP. Open via a local server, not file://');
        showToast('Model load failed: use http://127.0.0.1:8000 (not file://)');
      } else {
        showToast('Model load failed, using fallback car');
      }
      console.log('Falling back to simple car...');
      createSimpleCar();
    }
  );

  // ---------------------------------------------------------------------------
  // Dynamic FPS optimization system
  // ---------------------------------------------------------------------------

  // Quality levels: index 0 = highest, 4 = lowest.
  // Each level is applied when rolling-average FPS drops below its threshold.
  const QUALITY_LEVELS = [
    { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowMapSize: 2048, shadows: true,  envObjects: true  }, // 0 – full
    { pixelRatio: 1.5,                                  shadowMapSize: 1024, shadows: true,  envObjects: true  }, // 1 – high
    { pixelRatio: 1.0,                                  shadowMapSize: 512,  shadows: true,  envObjects: false }, // 2 – medium
    { pixelRatio: 1.0,                                  shadowMapSize: 256,  shadows: true,  envObjects: false }, // 3 – low
    { pixelRatio: 0.75,                                 shadowMapSize: 256,  shadows: false, envObjects: false }, // 4 – emergency
  ];

  // FPS thresholds for stepping down / up
  const FPS_DROP_THRESHOLD  = [0, 45, 30, 20, 0];   // step DOWN when avg fps < this (index = current level)
  const FPS_RISE_THRESHOLD  = [Infinity, 55, 45, 30, 20]; // step UP when avg fps > this (index = current level)

  // Hysteresis: require sustained bad/good fps before changing level
  const DOWN_HOLD_MS = 1000;  // 1 s of bad fps → step down
  const UP_HOLD_MS   = 3000;  // 3 s of good fps → step up (slower to restore)

  // Shadow-casting lights whose map size must be updated on quality change
  const shadowLights = [spotLight1, spotLight2, topRightLight];

  // ---------------------------------------------------------------------------
  // Hardware probe — estimate a good starting quality level so we don't open
  // on full quality on a weak device and wait for the FPS sampler to catch up.
  // ---------------------------------------------------------------------------
  function probeHardwareQuality() {
    let score = 0; // higher = better hardware

    // GPU renderer string
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const gpuStr = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        console.log('[perf] GPU renderer:', gpuStr);
        if (/nvidia|geforce|rtx|gtx|quadro/.test(gpuStr))        score += 3; // discrete NVIDIA
        else if (/radeon|rx\s*\d|vega|navi/.test(gpuStr))        score += 3; // discrete AMD
        else if (/arc\s*[a-z]?\d/.test(gpuStr))                  score += 2; // Intel Arc discrete
        else if (/intel/.test(gpuStr))                            score += 1; // integrated Intel
        else if (/apple/.test(gpuStr))                            score += 2; // Apple Silicon iGPU (capable)
        else                                                      score += 1; // unknown / software
      }
    } catch (e) { score += 1; }

    // Device RAM (navigator.deviceMemory: 0.25 | 0.5 | 1 | 2 | 4 | 8 GB, Chrome/Edge only)
    const mem = navigator.deviceMemory;
    if      (mem >= 8)  score += 3;
    else if (mem >= 4)  score += 2;
    else if (mem >= 2)  score += 1;
    else if (mem)       score += 0; // ≤ 1 GB
    else                score += 1; // not reported (Firefox etc.) — neutral

    // Logical CPU cores
    const cores = navigator.hardwareConcurrency || 0;
    if      (cores >= 12) score += 2;
    else if (cores >= 6)  score += 1;

    // Total pixel load (width × height × dpr²) — high-DPI 4K is expensive
    const pixels = screen.width * screen.height * Math.pow(window.devicePixelRatio || 1, 2);
    if      (pixels < 1_000_000)  score += 2; // ≤ 720p-ish
    else if (pixels < 2_500_000)  score += 1; // 1080p area
    // 4K+ → no bonus

    console.log('[perf] Hardware score:', score);

    // Map total score → starting quality level
    if      (score >= 8) return 0; // full
    else if (score >= 6) return 1; // high
    else if (score >= 4) return 2; // medium
    else if (score >= 2) return 3; // low
    else                 return 4; // emergency
  }

  let qualityLevel = 0;
  let downHoldMs   = 0;
  let upHoldMs     = 0;

  function applyQualityLevel(level) {
    const q = QUALITY_LEVELS[level];
    qualityLevel = level;

    renderer.setPixelRatio(q.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.shadowMap.enabled = q.shadows;
    shadowLights.forEach(light => {
      if (light.shadow) {
        light.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
        light.shadow.map = null; // force regeneration
      }
      light.castShadow = q.shadows;
    });

    if (car) {
      car.traverse(node => {
        if (node.isMesh) node.castShadow = q.shadows;
      });
    }

    if (!q.envObjects) {
      environmentObjects.forEach(obj => { obj.visible = false; });
    } else if (isDriving) {
      environmentObjects.forEach(obj => { obj.visible = true; });
    }

    updateFpsHud();
  }

  function adjustQuality(avgFps, dtMs) {
    const drop = FPS_DROP_THRESHOLD[qualityLevel];
    const rise = FPS_RISE_THRESHOLD[qualityLevel];

    if (avgFps < drop) {
      downHoldMs += dtMs;
      upHoldMs = 0;
      if (downHoldMs >= DOWN_HOLD_MS && qualityLevel < QUALITY_LEVELS.length - 1) {
        downHoldMs = 0;
        applyQualityLevel(qualityLevel + 1);
      }
    } else if (avgFps > rise) {
      upHoldMs += dtMs;
      downHoldMs = 0;
      if (upHoldMs >= UP_HOLD_MS && qualityLevel > 0) {
        upHoldMs = 0;
        applyQualityLevel(qualityLevel - 1);
      }
    } else {
      downHoldMs = 0;
      upHoldMs = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // FPS / quality HUD badge
  // ---------------------------------------------------------------------------
  const QUALITY_LABELS = ['Full', 'High', 'Med', 'Low', 'Min'];

  const fpsHud = document.createElement('div');
  fpsHud.id = 'fps-hud';
  Object.assign(fpsHud.style, {
    position:   'fixed',
    bottom:     '12px',
    right:      '12px',
    padding:    '5px 9px',
    background: 'rgba(0,0,0,0.65)',
    color:      '#fff',
    fontFamily: 'monospace',
    fontSize:   '12px',
    borderRadius: '6px',
    zIndex:     10000,
    lineHeight: '1.5',
    userSelect: 'none',
    pointerEvents: 'none',
  });
  document.body.appendChild(fpsHud);

  let hudFps = 0;
  function updateFpsHud() {
    const qLabel = QUALITY_LABELS[qualityLevel];
    const color  = ['#4cff91','#a8ff4c','#ffe44c','#ff944c','#ff4c4c'][qualityLevel];
    fpsHud.innerHTML =
      `<span style="color:${color}">Q${qualityLevel} ${qLabel}</span>` +
      ` &nbsp; ${hudFps.toFixed(0)} fps`;
  }
  updateFpsHud();

  // ---------------------------------------------------------------------------
  // FPS sampler state (declared outside animate so values persist across frames)
  // ---------------------------------------------------------------------------
  const FPS_WINDOW   = 60;   // rolling window in frames
  const frameTimes   = [];
  let   lastFrameTime = performance.now();

  // Apply the initial quality level based on detected hardware.
  applyQualityLevel(probeHardwareQuality());

  // Animation loop
  const animate = () => {
    requestAnimationFrame(animate);

    // --- FPS sampling ---
    const now = performance.now();
    const dtMs = now - lastFrameTime;
    lastFrameTime = now;
    frameTimes.push(dtMs);
    if (frameTimes.length > FPS_WINDOW) frameTimes.shift();

    if (frameTimes.length >= 10) {
      const avgMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      hudFps = 1000 / avgMs;
      adjustQuality(hudFps, dtMs);
      updateFpsHud();
    }

    // Rotate wheels based on speed (base rotation even when stopped)
    const baseWheelSpeed = 0.05;
    wheels.forEach(wheel => {
      wheel.rotation.x += baseWheelSpeed;
    });

    // Animate road and environment in Drive mode
    if (isDriving && roadSpeed > 0) {
      roadOffset += roadSpeed;
      
      // Animate lane markings moving toward the car (negative z)
      laneMarkings.forEach(lane => {
        lane.position.z -= roadSpeed;
        // Reset position when lane marking goes too far behind
        if (lane.position.z < -50) {
          lane.position.z += 100;
        }
      });
      
      // Animate environment objects (trees) moving toward the car (negative z)
      environmentObjects.forEach(obj => {
        obj.position.z -= roadSpeed;
        // Reset position when object goes too far behind
        if (obj.position.z < -50) {
          obj.position.z += 200;
        }
      });
      
      // Make wheels spin faster based on speed (proportional to roadSpeed)
      const extraWheelSpeed = roadSpeed * 0.33;
      wheels.forEach(wheel => {
        wheel.rotation.x += extraWheelSpeed;
      });
    }

    // Update controls
    controls.update();

    // Update camera info if visible
    if (cameraInfoVisible) updateCameraInfo();

    if (revertDeadline != null) updateRecenterCountdown();

    // Render the scene
    renderer.render(scene, camera);
  };

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
};

create3DEnvironment();
