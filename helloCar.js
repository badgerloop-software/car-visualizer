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

  // Add OrbitControls for mouse interaction
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 20;

  // Variables for the car and wheels
  let car = null;
  let wheels = [];

  // Load a car model from the internet
  // Using a free GLTF model from Sketchfab or similar sources
  const loader = new THREE.GLTFLoader();
  
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

  // Load the local Ferrari F40 GLTF model
  loader.load(
    'ferrari_f40/scene.gltf', // Local model path
    (gltf) => {
      console.log('✅ Model loaded successfully!', gltf);
      
      // Remove the simple car if it exists
      if (car) {
        scene.remove(car);
        wheels = [];
      }
      
      car = gltf.scene;
      car.scale.set(1, 1, 1); // Adjust scale as needed
      car.position.y = -0.5; // Position on the ground
      
      car.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
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
      console.log('Falling back to simple car...');
      createSimpleCar();
    }
  );

  // Animation loop
  const animate = () => {
    requestAnimationFrame(animate);

    // Rotate wheels automatically
    wheels.forEach(wheel => {
      wheel.rotation.x += 0.05; // Adjust speed as needed
    });

    // Update controls
    controls.update();

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
