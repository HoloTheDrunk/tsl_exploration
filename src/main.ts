import './style.css';
import * as THREE from 'three';
import * as wgpu from 'three/webgpu';
import * as tsl from 'three/tsl';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let controls: OrbitControls;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;

init();
requestAnimationFrame(tick);

function init() {
  // Camera
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    10,
    300,
  );
  camera.position.set(-70, 20, 70);

  // Scene
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0x292929);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setNodesHandler(new WebGLNodesHandler());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.render(scene, camera);
  renderer.domElement.style.zIndex = "1";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.left = "0";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.position = "absolute";
  document.body.appendChild(renderer.domElement);

  // Fog
  // FIXME: Three raises a fogDensity undefined error when points are in the scene
  // scene.fog = new THREE.FogExp2(0x94acb0, 0.009);

  setupLights();
  setupOrbitControls();
  setupEventListeners();

  // ***** setup our scene *******

  const positions = [
    -1, -1, 0,
    -1, 1, 0,
    1, 1, 0,
    1, -1, 0,
  ].map(v => v * 5.);
  const positionAttribute = new wgpu.InstancedBufferAttribute(new Float32Array(positions), 3);

  const colors: number[] = [
    .5, .1, .1, 1.,
    .1, .5, .1, 1.,
    .1, .1, .5, 1.,
    .5, .5, .5, 1.,
  ];
  const colorAttribute = new wgpu.InstancedBufferAttribute(new Float32Array(colors), 4);

  const material = new wgpu.SpriteNodeMaterial({
    positionNode: tsl.instancedBufferAttribute(positionAttribute),
    opacityNode: tsl.shapeCircle(),
    colorNode: tsl.instancedBufferAttribute(colorAttribute),
    scaleNode: tsl.uniform(0.08),
    vertexColors: true,
    sizeAttenuation: false,
  });

  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, 4);

  scene.add(mesh);

}

// RAF Update the screen
function tick(): void {
  renderer.render(scene, camera);
  controls.update();
  window.requestAnimationFrame(tick);
}

function setupLights() {
  // ***** Lights ****** //
  const ambLight = new THREE.AmbientLight(0xfefefe, 0.1);
  const rectLight = new THREE.DirectionalLight(0x00fff0, 0.6);
  rectLight.position.set(20, 30, -20);
  const dirLight = new THREE.DirectionalLight(0xfefefe, 1.5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.far = 100;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.top = 40;
  dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.bottom = -40;
  dirLight.shadow.camera.left = -40;

  dirLight.position.set(20, 30, 20);
  scene.add(ambLight, dirLight, rectLight);
}

function setupOrbitControls() {
  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.enableDamping = true;
  controls.autoRotate = false;
  controls.rotateSpeed = 1;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 120;
  controls.target.set(0, 20, 0);
  controls.maxPolarAngle = 6 * (Math.PI / 7);
  controls.minPolarAngle = 1 * (Math.PI / 7);
}

function setupEventListeners() {
  // Handle `resize` events
  window.addEventListener(
    'resize',
    () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    },
    false,
  );
}

