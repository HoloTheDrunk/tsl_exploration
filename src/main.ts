import './style.css';
import * as THREE from 'three';
import * as wgpu from 'three/webgpu';
import * as tsl from 'three/tsl';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
// import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import LASLoader from './LASLoader.js';

const enum RenderMode {
  COLOR,
  CLASSIFICATION,
  RETURN_COUNT,
};

let controls: OrbitControls | FlyControls;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let renderMode: RenderMode = RenderMode.COLOR;

let last_update = Date.now();
let deltas: number[] = [];
let last_fps_display = Date.now();
let last_fps = tsl.uniform(0.);

init();
requestAnimationFrame(tick);

function init() {
  // Camera
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    .01,
    10_000,
  );
  // camera.position.set(-70, 20, 70);
  camera.position.set(0, 5, 0);

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
  const controls = false;
  if (controls) {
    setupOrbitControls();
  } else {
    setupFlyControls();
  }
  setupEventListeners();
  setupFpsDisplay();

  const fileReader = new FileReader();
  const stack: Blob[] = [];

  async function addFiles(event: DragEvent | ClipboardEvent, files: FileList) {
    event.preventDefault();
    for (var i = 0; i < files.length; i++) {
      stack.push(files[i]);
    }

    fileReader.onload = async function onload(e) {
      const data = e.target!.result!;
      if (!(data instanceof ArrayBuffer)) {
        console.error("File not loaded as ArrayBuffer");
        return;
      }

      console.info("Loading point cloud");

      const lasLoader = new LASLoader();
      const { attributes, box } = await lasLoader.parseFile(data);
      const center = new THREE.Vector3(...box.min).add(new THREE.Vector3(...box.max)).divideScalar(2);

      console.log(center);

      console.info("Loaded point cloud");
      console.log(attributes.Classification);

      //! Shader here

      function classification_coloring(classif: wgpu.Node): wgpu.Node {
        return tsl.array([
          tsl.vec3(1, 0, 0),
          tsl.vec3(0, 1, 0),
          tsl.vec3(0, 0, 1),
        ]).element(classif.mod(3));
      }

      const SCALE = 100;
      const positionAttribute = new wgpu.InstancedBufferAttribute(attributes.positions as Float32Array, 3);
      positionAttribute.name = "positionAttributeName";
      const position = tsl.instancedBufferAttribute(positionAttribute)
        .setName("positionAttribute")
        .sub(tsl.vec3(center))
        .mul(tsl.vec3(1 / SCALE, 1 / SCALE, 1 / SCALE))
        .setName("positionCentered");

      const colorAttribute = tsl.instancedBufferAttribute(new wgpu.InstancedBufferAttribute(attributes.colors as Uint8Array, 4)).setName("colorAttribute").div(255).setName("colorFinal");
      const classificationAttribute = classification_coloring(
        tsl.instancedBufferAttribute(
          new wgpu.InstancedBufferAttribute(attributes.Classification as Uint16Array, 1)
        ).setName("classificationAttribute")
      );
      const returnCountAttribute = tsl.instancedBufferAttribute(new wgpu.InstancedBufferAttribute(attributes.NumberOfReturns as Uint16Array, 1)).setName("returnCountAttribute").toFloat();

      renderMode = RenderMode.CLASSIFICATION;
      let color = [colorAttribute, classificationAttribute, returnCountAttribute][renderMode];

      console.debug('color:', renderMode, color);
      console.debug('instancecdBufferAttribute:', tsl.instancedBufferAttribute(new wgpu.InstancedBufferAttribute(attributes.NumberOfReturns as Uint16Array, 1)).type);

      const material = new wgpu.SpriteNodeMaterial({
        positionNode: position,
        opacityNode: tsl.shapeCircle(),
        colorNode: color,
        scaleNode: tsl.float(0.0008),
        vertexColors: true,
        sizeAttenuation: false,
      });

      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, positionAttribute.count).rotateX(-Math.PI / 2);
      console.log('attributes', mesh.geometry.attributes);
      mesh.frustumCulled = false;

      scene.add(mesh);
    };

    const blob = stack.shift()
    if (blob) {
      fileReader.readAsArrayBuffer(blob);
    }
  }

  document.addEventListener('dragenter', function _(e) { e.preventDefault(); }, false);
  document.addEventListener('dragover', function _(e) { e.preventDefault(); }, false);
  document.addEventListener('dragleave', function _(e) { e.preventDefault(); }, false);
  document.addEventListener('drop', function _(e) { addFiles(e, e.dataTransfer!.files); }, false);
  document.addEventListener('paste', function _(e) { addFiles(e, e.clipboardData!.files); }, false);
}

// RAF Update the screen
function tick(): void {
  const now = Date.now();
  const delta = (now - last_update) / 1000.;
  deltas.push(delta);

  if (now - last_fps_display > 200.) {
    const average = 1. / (deltas.reduce((a, b) => a + b, 0) / deltas.length);
    deltas = [];
    last_fps_display = now;
    last_fps.value = average;
  }

  renderer.render(scene, camera);
  controls.update(delta);
  window.requestAnimationFrame(tick);

  last_update = now;
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

function setupFlyControls() {
  controls = new FlyControls(camera, renderer.domElement);
  controls.dragToLook = true;
  controls.movementSpeed = 50;
  controls.rollSpeed = .2;
}

function setupFpsDisplay() {
  const ratio = 1 / .2;
  const geometry = new THREE.PlaneGeometry(1, 1 / ratio);
  const position = tsl.bufferAttribute(geometry.getAttribute("position") as wgpu.BufferAttribute);
  const border = 0.02;
  const innerOpacity = tsl.uv().x.lessThan(last_fps.div(60.).min(1.));
  const centeredUV = tsl.uv().sub(tsl.vec2(.5, .5)).mul(2.).abs();
  const outerOpacity = centeredUV.x.greaterThan(1 - border)
    .or(centeredUV.y.greaterThan(1 - ratio * border));
  const material = new wgpu.MeshBasicNodeMaterial({
    vertexNode: position.add(tsl.vec3(-.45, 1 - .5 / ratio - .05)).toVec4(),
    opacityNode: outerOpacity.or(innerOpacity),
    colorNode: tsl.mix(tsl.vec3(1, .9, 1), tsl.vec3(.7, .7, .7), outerOpacity),
    alphaTest: 0.9,
    transparent: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  console.log("[setupFpsDisplay] Done");
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

