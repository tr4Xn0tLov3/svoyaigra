import * as THREE from './vendor/three.module.min.js';

const SPECIES = {
  cat: { fur: '#7f899b', light: '#e5d8ce', inner: '#e997a5', ears: 'point', tail: 'curl', muzzle: 'cat' },
  fox: { fur: '#df7937', light: '#fff0d7', inner: '#efb3a2', ears: 'point', tail: 'fox', muzzle: 'fox' },
  hyena: { fur: '#b99a68', light: '#e4d1aa', inner: '#5a4435', ears: 'round', tail: 'brush', muzzle: 'dog' },
  gorilla: { fur: '#393944', light: '#a9958d', inner: '#51424a', ears: 'round', tail: 'none', muzzle: 'gorilla' },
  eagle: { fur: '#79513b', light: '#e4c58c', inner: '#d9a838', ears: 'tuft', tail: 'wings', muzzle: 'beak' },
  monkey: { fur: '#986442', light: '#e8c79e', inner: '#a06b55', ears: 'round', tail: 'curl', muzzle: 'monkey' },
  goat: { fur: '#e3d5bd', light: '#fff1d4', inner: '#c99080', ears: 'horns', tail: 'brush', muzzle: 'goat' },
  pig: { fur: '#e9a0a2', light: '#ffe0d5', inner: '#c66b79', ears: 'floppy', tail: 'curl', muzzle: 'pig' },
  elephant: { fur: '#879ba6', light: '#d5dfe0', inner: '#bd7c7c', ears: 'elephant', tail: 'none', muzzle: 'trunk' },
  rabbit: { fur: '#eadfce', light: '#fff6e8', inner: '#e8a3ad', ears: 'long', tail: 'puff', muzzle: 'rabbit' },
  penguin: { fur: '#243c56', light: '#f4f5f5', inner: '#ee9c43', ears: 'none', tail: 'none', muzzle: 'beak' },
  shark: { fur: '#5e8fa8', light: '#d8e7e9', inner: '#a8ced5', ears: 'fin', tail: 'shark', muzzle: 'shark' }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function colorMaterial(color, roughness = 0.43, metalness = 0.02, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat: 0.16,
    clearcoatRoughness: 0.32,
    ...extra
  });
}

function sphere(parent, material, position, scale, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(16, Math.floor(segments * 0.72))), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function capsule(parent, material, position, radius, length, rotationZ = 0) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 20), material);
  mesh.position.set(...position);
  mesh.rotation.z = rotationZ;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cone(parent, material, position, radius, height, rotation = [0, 0, 0], radialSegments = 32) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, radialSegments, 2), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tube(parent, points, material, radius = 0.06, segments = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 10, false), material);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addEar(parent, type, side, fur, inner) {
  const x = side * 0.48;
  if (type === 'none') return;
  if (type === 'point' || type === 'long' || type === 'tuft' || type === 'horns') {
    const height = type === 'long' ? 0.92 : type === 'horns' ? 0.55 : type === 'tuft' ? 0.45 : 0.62;
    const ear = cone(parent, fur, [x, 3.27 + height * 0.27, 0.02], type === 'long' ? 0.19 : 0.22, height,
      [0, 0, side * (type === 'long' ? -0.12 : 0.17)]);
    if (type !== 'horns' && type !== 'tuft') {
      const inset = sphere(parent, inner, [x, 3.30 + height * 0.23, 0.16], [0.105, height * 0.28, 0.045], 24);
      inset.rotation.z = side * (type === 'long' ? -0.12 : 0.17);
    }
    if (type === 'horns') ear.rotation.z = side * 0.38;
    return;
  }
  if (type === 'elephant') {
    const ear = sphere(parent, fur, [side * 0.69, 2.57, -0.01], [0.45, 0.52, 0.14], 32);
    ear.rotation.z = side * -0.25;
    const innerEar = sphere(parent, inner, [side * 0.70, 2.57, 0.13], [0.33, 0.39, 0.045], 28);
    innerEar.rotation.z = side * -0.25;
    return;
  }
  if (type === 'floppy') {
    const ear = sphere(parent, fur, [side * 0.58, 2.92, 0.04], [0.24, 0.43, 0.13], 32);
    ear.rotation.z = side * -0.72;
    const inset = sphere(parent, inner, [side * 0.61, 2.91, 0.16], [0.13, 0.32, 0.04], 24);
    inset.rotation.z = side * -0.72;
    return;
  }
  if (type === 'fin') {
    cone(parent, fur, [side * 0.43, 3.13, 0.05], 0.2, 0.52, [0, 0, side * 0.32]);
    return;
  }
  const ear = sphere(parent, fur, [x, 2.91, 0], [0.24, 0.23, 0.16], 28);
  sphere(parent, inner, [x, 2.92, 0.13], [0.13, 0.13, 0.045], 24);
}

function addMuzzle(parent, kind, light, dark) {
  if (kind === 'beak') {
    cone(parent, dark, [0, 2.31, 0.82], 0.21, 0.48, [Math.PI / 2, 0, 0], 28);
    sphere(parent, colorMaterial('#f2b341', 0.38), [0, 2.43, 0.77], [0.18, 0.11, 0.16], 24);
    return;
  }
  if (kind === 'trunk') {
    sphere(parent, light, [0, 2.28, 0.72], [0.27, 0.25, 0.19], 28);
    tube(parent, [[0,2.28,0.85],[0.04,2.02,0.96],[0.10,1.82,0.94],[0.02,1.72,0.88]], light, 0.15, 24);
    return;
  }
  if (kind === 'pig') {
    sphere(parent, light, [0, 2.33, 0.78], [0.35, 0.24, 0.14], 32);
    const nostril = colorMaterial('#9c5263', 0.7);
    sphere(parent, nostril, [-0.105,2.34,0.91], [0.043,0.067,0.025], 18);
    sphere(parent, nostril, [0.105,2.34,0.91], [0.043,0.067,0.025], 18);
    return;
  }
  if (kind === 'shark') {
    sphere(parent, light, [0, 2.27, 0.68], [0.43, 0.18, 0.20], 28);
    tube(parent, [[-0.29,2.09,0.72],[-0.15,2.02,0.80],[0,2.00,0.82],[0.17,2.03,0.79],[0.29,2.11,0.70]], dark, 0.035, 16);
    return;
  }
  const width = kind === 'gorilla' ? 0.40 : kind === 'fox' ? 0.28 : 0.30;
  const height = kind === 'gorilla' ? 0.24 : 0.19;
  sphere(parent, light, [0, 2.28, 0.72], [width, height, 0.18], 28);
  if (kind === 'cat' || kind === 'rabbit' || kind === 'fox' || kind === 'dog' || kind === 'monkey' || kind === 'goat') {
    sphere(parent, light, [-0.12,2.32,0.85], [0.16,0.13,0.12], 24);
    sphere(parent, light, [0.12,2.32,0.85], [0.16,0.13,0.12], 24);
  }
  sphere(parent, dark, [0, 2.39, 0.89], [kind === 'fox' ? 0.085 : 0.07, 0.055, 0.05], 20);
  tube(parent, [[0,2.22,0.89],[0,2.16,0.91],[-0.08,2.13,0.88]], dark, 0.025, 12);
  tube(parent, [[0,2.16,0.91],[0.08,2.13,0.88]], dark, 0.025, 12);
}

function addCharacter(speciesKey, accentColor) {
  const config = SPECIES[speciesKey] || SPECIES.fox;
  const fur = colorMaterial(config.fur, 0.46);
  const light = colorMaterial(config.light, 0.52);
  const inner = colorMaterial(config.inner, 0.55);
  const dark = colorMaterial(speciesKey === 'gorilla' ? '#211e24' : speciesKey === 'shark' ? '#263c51' : '#382d33', 0.55);
  const accent = colorMaterial(accentColor, 0.32, 0.08, { clearcoat: 0.45, clearcoatRoughness: 0.24 });
  const gold = colorMaterial('#f1c76b', 0.25, 0.5, { metalness: 0.42, clearcoat: 0.4 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Tail silhouette first, so it sits naturally behind the body.
  if (config.tail === 'fox' || config.tail === 'brush' || config.tail === 'puff') {
    const tailMat = config.tail === 'fox' ? fur : light;
    const tail = sphere(body, tailMat, [0.53, 1.03, -0.42], [0.26, config.tail === 'fox' ? 0.70 : 0.42, 0.24], 32);
    tail.rotation.z = -0.52;
    if (config.tail === 'fox') {
      const tip = sphere(body, light, [0.85, 1.57, -0.40], [0.17,0.25,0.17],24);
      tip.rotation.z = -0.52;
    }
  } else if (config.tail === 'curl') {
    const tail = tube(body, [[0.38,1.05,-0.4],[0.72,1.0,-0.67],[0.85,1.22,-0.77],[0.72,1.38,-0.73],[0.61,1.31,-0.68]], fur, 0.09, 24);
    tail.userData.tail = true;
  } else if (config.tail === 'shark') {
    const fin = cone(body, fur, [0.43,1.09,-0.48], 0.28, 0.86, [0,0,-0.55], 28);
    fin.scale.set(0.65,1,0.45);
  }

  // Shoes, legs, round torso and a tailored vest give the avatar a full standing silhouette.
  capsule(body, dark, [-0.24,0.55,0], 0.16, 0.43, 0.03);
  capsule(body, dark, [0.24,0.55,0], 0.16, 0.43, -0.03);
  sphere(body, dark, [-0.24,0.28,0.16], [0.26,0.13,0.36], 26);
  sphere(body, dark, [0.24,0.28,0.16], [0.26,0.13,0.36], 26);
  const bodyScale = speciesKey === 'gorilla' ? [0.77,0.74,0.53] : [0.63,0.80,0.48];
  sphere(body, fur, [0,1.40,0], bodyScale, 36);
  sphere(body, accent, [0,1.45,0.43], [0.43,0.55,0.10], 32);
  sphere(body, gold, [0,1.61,0.535], [0.095,0.095,0.025], 20);
  sphere(body, light, [0,1.36,0.54], [0.29,0.34,0.035], 28);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.57,1.80,0.02); body.add(leftArm);
  capsule(leftArm, fur, [-0.04,-0.27,0], 0.17, 0.45, -0.33);
  sphere(leftArm, light, [-0.13,-0.55,0.04], [0.18,0.16,0.17], 24);
  const rightArm = new THREE.Group();
  rightArm.position.set(0.57,1.80,0.02); body.add(rightArm);
  capsule(rightArm, fur, [0.04,-0.27,0], 0.17, 0.45, 0.33);
  sphere(rightArm, light, [0.13,-0.55,0.04], [0.18,0.16,0.17], 24);

  // Neck and sculpted head.
  capsule(body, light, [0,2.08,0], 0.24, 0.18);
  sphere(body, fur, [0,2.66,0], [0.78,0.72,0.66], 40);
  addEar(body, config.ears, -1, fur, inner);
  addEar(body, config.ears, 1, fur, inner);
  if (speciesKey === 'goat') {
    sphere(body, light, [0,2.10,0.15], [0.16,0.23,0.14], 24);
  }
  addMuzzle(body, config.muzzle, light, dark);

  // Large readable eyes with catchlights, tuned for small game-card viewports.
  const eyeWhite = colorMaterial('#fff9ef', 0.24);
  const irisColor = colorMaterial(speciesKey === 'gorilla' ? '#b8733b' : '#49352e', 0.22);
  const pupil = colorMaterial('#151820', 0.14);
  for (const side of [-1, 1]) {
    sphere(body, eyeWhite, [side*0.245,2.69,0.575], [0.145,0.19,0.12], 28);
    sphere(body, irisColor, [side*0.225,2.68,0.681], [0.078,0.112,0.046], 24);
    sphere(body, pupil, [side*0.215,2.68,0.718], [0.044,0.075,0.024], 20);
    sphere(body, eyeWhite, [side*0.238,2.72,0.741], [0.025,0.032,0.015], 16);
    const brow = sphere(body, fur, [side*0.25,2.91,0.57], [0.19,0.052,0.06], 20);
    brow.rotation.z = side*0.12;
  }
  if (speciesKey === 'elephant') {
    // Tusks frame the trunk and catch the key light.
    cone(body, light, [-0.25,2.19,0.69], 0.08, 0.28, [Math.PI*0.86,0,0.16], 18);
    cone(body, light, [0.25,2.19,0.69], 0.08, 0.28, [Math.PI*0.86,0,-0.16], 18);
  }
  if (speciesKey === 'gorilla') {
    sphere(body, light, [0,2.03,0.42], [0.25,0.25,0.16], 24);
  }

  // A tiny medal and shoe highlights make the selected frame color feel intentional.
  sphere(body, gold, [-0.31,1.67,0.52], [0.07,0.07,0.03], 18);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.76,0.82,0.13,64,1), colorMaterial('#121c2e',0.27,0.42));
  platform.position.y = 0.10; platform.castShadow = true; body.add(platform);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.73,0.035,10,64), colorMaterial(accentColor,0.23,0.35,{emissive:accentColor,emissiveIntensity:0.12}));
  rim.rotation.x = Math.PI/2; rim.position.y = 0.17; body.add(rim);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75,48), new THREE.MeshBasicMaterial({color:'#050914',transparent:true,opacity:0.42,depthWrite:false}));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = 0.172; shadow.scale.set(1,0.56,1); body.add(shadow);

  return { root, body, leftArm, rightArm, tail: body.children.find((node) => node.userData.tail), speciesKey };
}

export function createScene(speciesKey, accentColor) {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.add(new THREE.HemisphereLight('#eaf2ff','#251e32',2.1));
  const key = new THREE.DirectionalLight('#fff4df',3.2); key.position.set(-3.8,6.5,6.5); scene.add(key);
  const fill = new THREE.DirectionalLight('#84b9ff',1.6); fill.position.set(4,3,2); scene.add(fill);
  const rim = new THREE.PointLight(accentColor,2.4,9,1.9); rim.position.set(0.8,2.6,-2.5); scene.add(rim);
  const warm = new THREE.PointLight('#ffc982',0.8,7,1.7); warm.position.set(-2,1.8,3); scene.add(warm);
  const avatar = addCharacter(speciesKey, accentColor);
  scene.add(avatar.root);
  const camera = new THREE.PerspectiveCamera(30,1,0.1,60);
  camera.position.set(0,2.02,8.6);
  camera.lookAt(0,1.92,0);
  return { scene, camera, avatar, accentColor, speciesKey, previousScore: null, cheerUntil: 0, phase: Math.random()*Math.PI*2, lastSize: '' };
}

function disposeObject(object) {
  object.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
    }
  });
}

export class AvatarStageManager {
  constructor() {
    this.renderer = null;
    this.canvas = null;
    this.row = null;
    this.models = new Map();
    this.disabled = false;
    this.lastFrame = 0;
    this.lastWidth = 0;
    this.lastHeight = 0;
    this._animate = this._animate.bind(this);
    this.frameHandle = requestAnimationFrame(this._animate);
    this.onContextLost = (event) => {
      event.preventDefault();
      this.disabled = true;
      this.canvas?.classList.add('avatar-3d-unavailable');
      this.row?.querySelectorAll('.avatar-3d-ready').forEach((stage) => stage.classList.remove('avatar-3d-ready'));
    };
  }

  _ensureRenderer(row) {
    if (this.disabled || this.renderer) return Boolean(this.renderer);
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'player-avatars-canvas';
      this.canvas.setAttribute('aria-hidden','true');
      this.canvas.addEventListener('webglcontextlost',this.onContextLost,false);
      this.renderer = new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:true});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
      this.renderer.setClearColor(0x000000,0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.enabled = false;
      this.renderer.autoClear = false;
      row.appendChild(this.canvas);
      return true;
    } catch (error) {
      console.warn('3D-аватары недоступны; оставлены портреты-подсказки:',error);
      this.disabled = true;
      this.canvas?.classList.add('avatar-3d-unavailable');
      return false;
    }
  }

  sync(row) {
    if (!row || !row.isConnected) {
      this.row = null;
      this.canvas?.remove();
      for (const model of this.models.values()) {
        this.sceneRemove(model);
        disposeObject(model.avatar.root);
      }
      this.models.clear();
      return;
    }
    this.row = row;
    const stages = [...row.querySelectorAll('[data-avatar-stage]')];
    if (!stages.length || !this._ensureRenderer(row)) return;
    if (this.canvas.parentElement !== row) row.appendChild(this.canvas);
    const liveIds = new Set();
    for (const stage of stages) {
      const id = stage.dataset.playerId;
      liveIds.add(id);
      const speciesKey = (stage.dataset.avatar || '').match(/animal-([a-z]+)\./i)?.[1] || 'fox';
      const accentColor = /^#[0-9a-f]{6}$/i.test(stage.dataset.color || '') ? stage.dataset.color : '#f5c451';
      let model = this.models.get(id);
      if (!model || model.speciesKey !== speciesKey || model.accentColor.toLowerCase() !== accentColor.toLowerCase()) {
        if (model) { this.sceneRemove(model); disposeObject(model.avatar.root); }
        model = createScene(speciesKey,accentColor);
        this.models.set(id,model);
      }
      const score = Number(stage.dataset.score) || 0;
      if (model.previousScore !== null && score > model.previousScore) model.cheerUntil = performance.now()+1100;
      model.previousScore = score;
      model.answering = stage.dataset.answering === 'true';
      stage.classList.add('avatar-3d-ready');
    }
    for (const [id,model] of this.models) {
      if (!liveIds.has(id)) { this.sceneRemove(model); disposeObject(model.avatar.root); this.models.delete(id); }
    }
  }

  sceneRemove(model) {
    model.scene.remove(model.avatar.root);
  }

  _animate(now) {
    this.frameHandle = requestAnimationFrame(this._animate);
    if (!this.renderer || this.disabled || document.hidden || now-this.lastFrame < 30 || !this.row?.isConnected) return;
    this.lastFrame = now;
    const rowRect = this.row.getBoundingClientRect();
    const width = Math.max(1,Math.round(rowRect.width));
    const height = Math.max(1,Math.round(rowRect.height));
    if (this.lastWidth !== width || this.lastHeight !== height) {
      this.renderer.setSize(width,height,false);
      this.lastWidth = width;
      this.lastHeight = height;
    }
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.renderer.setScissorTest(false);
    this.renderer.clear(true,true,true);
    this.renderer.setScissorTest(true);
    const time = now*0.001;
    for (const stage of this.row.querySelectorAll('[data-avatar-stage]')) {
      const model = this.models.get(stage.dataset.playerId);
      if (!model) continue;
      const rect = stage.getBoundingClientRect();
      const x = Math.round(rect.left-rowRect.left);
      const yTop = Math.round(rect.top-rowRect.top);
      const w = Math.max(1,Math.round(rect.width));
      const h = Math.max(1,Math.round(rect.height));
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.width < 8 || rect.height < 8) continue;
      const y = height-yTop-h;
      this.renderer.setViewport(x,y,w,h);
      this.renderer.setScissor(x,y,w,h);
      model.camera.aspect = w/h;
      model.camera.updateProjectionMatrix();
      const bob = Math.sin(time*2.1+model.phase)*0.045;
      model.avatar.body.position.y = bob;
      model.avatar.root.rotation.y = Math.sin(time*0.7+model.phase)*0.08;
      model.avatar.leftArm.rotation.z = -0.12+Math.sin(time*1.7+model.phase)*0.07;
      model.avatar.rightArm.rotation.z = 0.12+Math.sin(time*1.7+model.phase+1.4)*0.07;
      if (model.answering) {
        model.avatar.rightArm.rotation.z = -0.72+Math.sin(time*4)*0.1;
        model.avatar.root.rotation.z = Math.sin(time*2.8)*0.018;
      } else if (now < model.cheerUntil) {
        const progress = clamp((model.cheerUntil-now)/1100,0,1);
        model.avatar.rightArm.rotation.z = -1.15+progress*0.36;
        model.avatar.leftArm.rotation.z = 0.55-progress*0.35;
        model.avatar.root.rotation.z = Math.sin(time*7)*0.045*progress;
      } else {
        model.avatar.root.rotation.z = 0;
      }
      model.avatar.tail && (model.avatar.tail.rotation.y = Math.sin(time*2.6+model.phase)*0.16);
      this.renderer.render(model.scene,model.camera);
    }
    this.renderer.setScissorTest(false);
  }
}
