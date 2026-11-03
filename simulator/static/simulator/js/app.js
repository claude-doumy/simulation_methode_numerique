/**
 * Application principale du Simulateur Numérique 3D
 * Intègre Three.js, rendu WebGL réactif, API Django et HUD physique
 */

// État global
const state = {
  currentTab: 'drone',
  theme: localStorage.getItem('theme') || 'dark',
  wireframe: false,
  isPlaying: true,
  playSpeed: 1.0,
  currentTime: 0.0,
  maxTime: 12.0,
  droneData: null,
  damData: null,
  mcData: null,
  bmData: null
};

// -----------------------------------------------------------------------------
// 1. GESTION DU THÈME
// -----------------------------------------------------------------------------
function applyTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = t === 'dark' ? '☀️ Thème Clair' : '🌙 Thème Sombre';
  if (scene) {
    scene.background = new THREE.Color(t === 'dark' ? 0x050811 : 0xe2e8f0);
    if (gridHelper) {
      gridHelper.material.color.setHex(t === 'dark' ? 0x22344f : 0x94a3b8);
    }
  }
}

document.getElementById('theme-toggle-btn').addEventListener('click', () => {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
});

// -----------------------------------------------------------------------------
// 2. INITIALISATION SCÈNE THREE.JS 3D
// -----------------------------------------------------------------------------
const container = document.getElementById('canvas3d-container');
let scene, camera, renderer, controls;
let active3DGroup = null;
let gridHelper = null;
let animReqId = null;

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(state.theme === 'dark' ? 0x050811 : 0xe2e8f0);

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(30, 25, 35);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lumières
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(40, 60, 40);
  scene.add(dirLight);

  // Grille au sol
  gridHelper = new THREE.GridHelper(80, 40, 0x3b82f6, 0x22344f);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  window.addEventListener('resize', onWindowResize);

  animate3D();
}

function onWindowResize() {
  if (!container || !renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

document.getElementById('btn-reset-cam').addEventListener('click', () => {
  if (state.currentTab === 'drone') {
    camera.position.set(25, 20, 30);
    controls.target.set(0, 5, 0);
  } else if (state.currentTab === 'dam') {
    camera.position.set(120, 90, 140);
    controls.target.set(100, 0, 0);
  } else if (state.currentTab === 'montecarlo') {
    camera.position.set(12, 10, 14);
    controls.target.set(0, 2, 0);
  } else {
    camera.position.set(20, 20, 25);
    controls.target.set(0, 0, 0);
  }
  controls.update();
});

document.getElementById('btn-toggle-wireframe').addEventListener('click', () => {
  state.wireframe = !state.wireframe;
  if (active3DGroup) {
    active3DGroup.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.wireframe = state.wireframe;
      }
    });
  }
});

function clearActive3D() {
  if (active3DGroup) {
    scene.remove(active3DGroup);
    active3DGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    active3DGroup = null;
  }
}

// -----------------------------------------------------------------------------
// 3. LOGIQUE DES SCÉNARIOS 3D
// -----------------------------------------------------------------------------

// --- SCÉNARIO 1 : DRONE 3D (DÉRIVATION) ---
let droneMesh = null;
let velocityArrow = null;
let accelerationArrow = null;

function setupDroneControls() {
  const container = document.getElementById('controls-container');
  container.innerHTML = `
    <div class="form-group">
      <label for="drone-dt">Pas d'échantillonnage temporel Δt (s) : <span class="val" id="val-drone-dt">0.10s</span></label>
      <input type="range" id="drone-dt" min="0.01" max="1.0" step="0.01" value="0.10">
      <small style="color:var(--muted); font-size:11px;">Plus Δt est petit, plus la dérivation centrée est précise avant le bruit machine.</small>
    </div>
    <div class="form-group">
      <label for="drone-noise">Bruit de capteur IMU/GPS : <span class="val" id="val-drone-noise">0.00</span></label>
      <input type="range" id="drone-noise" min="0.0" max="0.5" step="0.05" value="0.0">
      <small style="color:var(--muted); font-size:11px;">Simule l'impact de l'arrondi et du bruit de mesure réel sur la dérivation.</small>
    </div>
  `;

  document.getElementById('drone-dt').addEventListener('input', e => {
    document.getElementById('val-drone-dt').textContent = parseFloat(e.target.value).toFixed(2) + 's';
    loadDroneSimulation();
  });
  document.getElementById('drone-noise').addEventListener('input', e => {
    document.getElementById('val-drone-noise').textContent = parseFloat(e.target.value).toFixed(2);
    loadDroneSimulation();
  });

  document.getElementById('drone-animation-bar').style.display = 'flex';
  document.getElementById('overlay-scenario-name').textContent = '🚁 Cinématique 3D de Drone (Différences Finies)';

  document.getElementById('guide-info').innerHTML = `
    <h4>Problème Aéronautique Réel :</h4>
    <p>Un drone de cartographie enregistre sa position 3D GPS <code>r(t)</code>. Pour calculer sa vitesse <code>v(t) = r'(t)</code> et son accélération <code>a(t) = r''(t)</code>, le contrôleur de vol utilise la dérivation numérique.</p>
    <h4>Méthodes comparées :</h4>
    <ul>
      <li><b>Avant O(Δt) :</b> Retard de phase important.</li>
      <li><b>Centrée O(Δt²) :</b> Symétrie annulant le premier ordre d'erreur.</li>
      <li><b>Richardson O(Δt⁴) :</b> Haute précision annulant l'erreur d'ordre 2.</li>
    </ul>
    <p style="margin-top:6px; color:var(--muted);"><b>Courbe en V :</b> Pour Δt très petit, le bruit de mesure et les arrondis flottants IEEE 754 font remonter l'erreur.</p>
  `;
}

function loadDroneSimulation() {
  const dt = document.getElementById('drone-dt') ? document.getElementById('drone-dt').value : 0.1;
  const noise = document.getElementById('drone-noise') ? document.getElementById('drone-noise').value : 0.0;

  fetch(`/api/drone/?dt=${dt}&noise=${noise}`)
    .then(r => r.json())
    .then(data => {
      state.droneData = data;
      renderDrone3D(data);
      updateDroneHUD(data);
      renderDroneVChart(data.v_curve, dt);
    });
}

function renderDrone3D(data) {
  clearActive3D();
  active3DGroup = new THREE.Group();

  // 1. Trajectoire 3D continue (ligne bleue brillante)
  const points = data.ref_path.map(p => new THREE.Vector3(p[0], p[2], p[1])); // Swap Y/Z for vertical
  const geomLine = new THREE.BufferGeometry().setFromPoints(points);
  const matLine = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
  const pathLine = new THREE.Line(geomLine, matLine);
  active3DGroup.add(pathLine);

  // 2. Modèle 3D simplifié du drone (Châssis quadricoptère + 4 rotors)
  droneMesh = new THREE.Group();

  // Corps central
  const bodyGeom = new THREE.BoxGeometry(1.6, 0.4, 1.6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  droneMesh.add(body);

  // Dôme caméra
  const sphereGeom = new THREE.SphereGeometry(0.5, 16, 16);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, roughness: 0.3 });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.y = 0.3;
  droneMesh.add(sphere);

  // 4 Bras & Rotors
  const armMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x10b981, transparent: true, opacity: 0.8 });

  [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(([rx, rz]) => {
    const armGeom = new THREE.CylinderGeometry(0.1, 0.1, 1.8);
    const arm = new THREE.Mesh(armGeom, armMat);
    arm.rotation.z = Math.PI / 4;
    arm.position.set(rx * 0.5, 0, rz * 0.5);
    droneMesh.add(arm);

    const rotorGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 16);
    const rotor = new THREE.Mesh(rotorGeom, rotorMat);
    rotor.position.set(rx, 0.2, rz);
    droneMesh.add(rotor);
  });

  active3DGroup.add(droneMesh);

  // 3. Vecteurs flèches 3D (Vitesse = Jaune, Accélération = Rouge)
  velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 4, 0xf59e0b, 1, 0.4);
  accelerationArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 3, 0xef4444, 1, 0.4);
  active3DGroup.add(velocityArrow);
  active3DGroup.add(accelerationArrow);

  scene.add(active3DGroup);
}

function updateDroneHUD(data) {
  const cur = data.current_state;
  document.getElementById('kpi-container').innerHTML = `
    <div class="kpi-card good">
      <div class="kpi-title">Vitesse Centrée (O(Δt²))</div>
      <div class="kpi-value">${cur.speed_centered.toFixed(2)} m/s</div>
      <div class="kpi-sub">Exact: ${cur.exact_speed.toFixed(2)} m/s</div>
    </div>
    <div class="kpi-card ${cur.error_centered < 0.05 ? 'good' : 'warn'}">
      <div class="kpi-title">Erreur Centrée</div>
      <div class="kpi-value">${cur.error_centered.toExponential(2)}</div>
      <div class="kpi-sub">Δt = ${data.dt}s</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Vitesse Richardson (O(Δt⁴))</div>
      <div class="kpi-value">${cur.speed_richardson.toFixed(2)} m/s</div>
      <div class="kpi-sub">Err: ${cur.error_richardson.toExponential(2)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Accélération Norme</div>
      <div class="kpi-value">${cur.acc_centered_norm.toFixed(2)} m/s²</div>
      <div class="kpi-sub">Err a: ${cur.error_acc.toExponential(2)}</div>
    </div>
  `;
}

function renderDroneVChart(vCurve, userDt) {
  document.getElementById('chart-title').textContent = '📈 Courbe en V (Troncature vs Arrondi Flottant)';
  const svg = document.getElementById('svg-chart');
  const w = 300, h = 170;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };

  // Echelle Log10
  const logH = vCurve.h.map(x => Math.log10(x));
  const minLogH = Math.min(...logH), maxLogH = Math.max(...logH);

  const allErr = [...vCurve.err_fwd, ...vCurve.err_cen, ...vCurve.err_rich].filter(x => x > 1e-16);
  const minLogE = -14, maxLogE = 1;

  const scaleX = x => padding.left + (Math.log10(x) - minLogH) / (maxLogH - minLogH) * (w - padding.left - padding.right);
  const scaleY = y => h - padding.bottom - (Math.log10(Math.max(y, 1e-14)) - minLogE) / (maxLogE - minLogE) * (h - padding.top - padding.bottom);

  const makePath = arr => {
    return vCurve.h.map((valH, i) => {
      const px = scaleX(valH);
      const py = scaleY(arr[i]);
      return (i === 0 ? 'M' : 'L') + `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  };

  const pathFwd = makePath(vCurve.err_fwd);
  const pathCen = makePath(vCurve.err_cen);
  const pathRich = makePath(vCurve.err_rich);

  const userX = scaleX(parseFloat(userDt));

  svg.innerHTML = `
    <!-- Axes et graduations -->
    <line x1="${padding.left}" y1="${h - padding.bottom}" x2="${w - padding.right}" y2="${h - padding.bottom}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${h - padding.bottom}" stroke="var(--border)" stroke-width="1"/>
    <text x="${w / 2}" y="${h - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">Pas Δt (log10)</text>
    <text x="12" y="${h / 2}" font-size="9" fill="var(--muted)" text-anchor="middle" transform="rotate(-90 12 ${h / 2})">Erreur (log10)</text>

    <!-- Courbes -->
    <path d="${pathFwd}" fill="none" stroke="#ef4444" stroke-width="1.8"/>
    <path d="${pathCen}" fill="none" stroke="#3b82f6" stroke-width="2"/>
    <path d="${pathRich}" fill="none" stroke="#10b981" stroke-width="2"/>

    <!-- Ligne repère du Δt actuel choisi -->
    <line x1="${userX}" y1="${padding.top}" x2="${userX}" y2="${h - padding.bottom}" stroke="#f59e0b" stroke-dasharray="3 3" stroke-width="1.5"/>

    <!-- Légende -->
    <g transform="translate(${padding.left + 5}, ${padding.top + 5})" font-size="8.5" fill="var(--text)">
      <circle cx="5" cy="5" r="3" fill="#ef4444"/><text x="12" y="8">Avant O(Δt)</text>
      <circle cx="70" cy="5" r="3" fill="#3b82f6"/><text x="77" y="8">Centrée O(Δt²)</text>
      <circle cx="145" cy="5" r="3" fill="#10b981"/><text x="152" y="8">Richardson O(Δt⁴)</text>
    </g>
  `;
}


// --- SCÉNARIO 2 : BARRAGE HYDRAULIQUE (INTÉGRATION 3D) ---
function setupDamControls() {
  const container = document.getElementById('controls-container');
  container.innerHTML = `
    <div class="form-group">
      <label for="dam-method">Méthode Numérique d'Intégration :</label>
      <select id="dam-method" class="form-control">
        <option value="simpson" selected>Simpson Composite (O(h⁴))</option>
        <option value="trapezoid">Trapèzes Composite (O(h²))</option>
        <option value="romberg">Romberg Extrapolé</option>
        <option value="gauss">Gauss–Legendre (Quadrature Optimale)</option>
        <option value="adaptive">Simpson Adaptatif (Maillage variable)</option>
      </select>
    </div>
    <div class="form-group" id="group-dam-slices">
      <label for="dam-slices">Nombre de sections transversales N : <span class="val" id="val-dam-slices">10</span></label>
      <input type="range" id="dam-slices" min="2" max="64" step="2" value="10">
      <small style="color:var(--muted); font-size:11px;">Nombre de tranches de discrétisation le long des 200m du réservoir.</small>
    </div>
    <div class="form-group" id="group-dam-tol" style="display:none;">
      <label for="dam-tol">Tolérance ε : <span class="val" id="val-dam-tol">1e-5</span></label>
      <input type="range" id="dam-tol" min="2" max="9" step="1" value="5">
    </div>
  `;

  document.getElementById('dam-method').addEventListener('change', e => {
    const isAdaptive = e.target.value === 'adaptive';
    document.getElementById('group-dam-slices').style.display = isAdaptive ? 'none' : 'block';
    document.getElementById('group-dam-tol').style.display = isAdaptive ? 'block' : 'none';
    loadDamSimulation();
  });

  document.getElementById('dam-slices').addEventListener('input', e => {
    document.getElementById('val-dam-slices').textContent = e.target.value;
    loadDamSimulation();
  });

  document.getElementById('dam-tol').addEventListener('input', e => {
    document.getElementById('val-dam-tol').textContent = '1e-' + e.target.value;
    loadDamSimulation();
  });

  document.getElementById('drone-animation-bar').style.display = 'none';
  document.getElementById('overlay-scenario-name').textContent = '🌊 Volume de Retenue d’un Barrage Hydraulique (Intégration 3D)';

  document.getElementById('guide-info').innerHTML = `
    <h4>Problème de Génie Civil Réel :</h4>
    <p>Calculer avec précision le volume de retenue d'eau d'un barrage de vallée de 200m de long pour prédire la production hydroélectrique et prévenir les crues.</p>
    <h4>Intérêt de l'Analyse Numérique :</h4>
    <ul>
      <li><b>Tranches 3D :</b> La vallée a une section parabolique <code>A(x)</code> dont la largeur et la profondeur varient non linéairement.</li>
      <li><b>Gauss vs Simpson :</b> Gauss-Legendre atteint une précision quasi-analytique avec seulement 8 nœuds, là où les trapèzes nécessitent des dizaines de mesures bathymétriques.</li>
    </ul>
  `;
}

function loadDamSimulation() {
  const method = document.getElementById('dam-method').value;
  const slices = document.getElementById('dam-slices').value;
  const tolExp = document.getElementById('dam-tol').value;
  const tol = Math.pow(10, -tolExp);

  fetch(`/api/dam/?method=${method}&slices=${slices}&tolerance=${tol}`)
    .then(r => r.json())
    .then(data => {
      state.damData = data;
      renderDam3D(data);
      updateDamHUD(data);
      renderDamSlicesChart(data);
    });
}

function renderDam3D(data) {
  clearActive3D();
  active3DGroup = new THREE.Group();

  const scaleX = 0.3, scaleY = 0.5, scaleZ = 0.3; // Scale down 200m dam to fit screen

  // 1. Fond de vallée rocheux (Mesh 3D)
  const meshData = data.terrain_mesh;
  const nx = meshData.nx;
  const ny = meshData.ny;
  const geomTerrain = new THREE.PlaneGeometry(
    data.dam_dimensions.length * scaleX,
    data.dam_dimensions.max_width * scaleZ,
    nx - 1,
    ny - 1
  );

  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    wireframe: state.wireframe,
    roughness: 0.8,
    side: THREE.DoubleSide
  });

  const terrainMesh = new THREE.Mesh(geomTerrain, terrainMat);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.position.set(data.dam_dimensions.length * scaleX / 2, 0, 0);

  // Mise à jour de la profondeur du terrain
  const posAttr = geomTerrain.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const orig = meshData.vertices[i];
    if (orig) {
      posAttr.setZ(i, orig[2] * scaleY);
    }
  }
  geomTerrain.computeVertexNormals();
  active3DGroup.add(terrainMesh);

  // 2. Nappe d'eau transparente
  const waterGeom = new THREE.PlaneGeometry(
    data.dam_dimensions.length * scaleX,
    data.dam_dimensions.max_width * scaleZ,
    nx - 1,
    ny - 1
  );
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.65,
    roughness: 0.1,
    metalness: 0.1,
    side: THREE.DoubleSide
  });
  const waterMesh = new THREE.Mesh(waterGeom, waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(data.dam_dimensions.length * scaleX / 2, 0, 0);
  active3DGroup.add(waterMesh);

  // 3. Mur du barrage en béton en x = 0
  const wallGeom = new THREE.BoxGeometry(3, data.dam_dimensions.max_depth * scaleY + 2, data.dam_dimensions.max_width * scaleZ);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 });
  const damWall = new THREE.Mesh(wallGeom, wallMat);
  damWall.position.set(0, -data.dam_dimensions.max_depth * scaleY / 2, 0);
  active3DGroup.add(damWall);

  // 4. Sections de discrétisation numérique (Tranches verticales interactives en 3D)
  data.slices.forEach(sl => {
    const sliceGeom = new THREE.BufferGeometry();
    const w = sl.width * scaleZ;
    const h = sl.height * scaleY;
    const xPos = sl.x * scaleX;

    // Profil parabolique de la tranche
    const curvePoints = [];
    for (let t = -1; t <= 1; t += 0.1) {
      const y = (t * w) / 2;
      const z = -h * (1 - t * t);
      curvePoints.push(new THREE.Vector3(xPos, z, y));
    }
    curvePoints.push(new THREE.Vector3(xPos, 0, w / 2));
    curvePoints.push(new THREE.Vector3(xPos, 0, -w / 2));

    sliceGeom.setFromPoints(curvePoints);
    const sliceLine = new THREE.Line(sliceGeom, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 }));
    active3DGroup.add(sliceLine);
  });

  scene.add(active3DGroup);

  // Centrage caméra sur le barrage
  controls.target.set(data.dam_dimensions.length * scaleX / 2, -10, 0);
}

function updateDamHUD(data) {
  document.getElementById('kpi-container').innerHTML = `
    <div class="kpi-card good">
      <div class="kpi-title">Volume Calculé</div>
      <div class="kpi-value">${Math.round(data.calculated_volume).toLocaleString('fr-FR')} m³</div>
      <div class="kpi-sub">Exact: ${Math.round(data.exact_volume).toLocaleString('fr-FR')} m³</div>
    </div>
    <div class="kpi-card ${data.relative_error_percent < 0.1 ? 'good' : 'warn'}">
      <div class="kpi-title">Erreur Relative</div>
      <div class="kpi-value">${data.relative_error_percent.toFixed(4)} %</div>
      <div class="kpi-sub">Abs: ${data.absolute_error.toFixed(1)} m³</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Évaluations (N_eval)</div>
      <div class="kpi-value">${data.evaluations}</div>
      <div class="kpi-sub">Tranches bathymétriques</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Efficacité Numérique</div>
      <div class="kpi-value">${(data.calculated_volume / 1000).toFixed(1)} km³</div>
      <div class="kpi-sub">Retenue maximale</div>
    </div>
  `;
}

function renderDamSlicesChart(data) {
  document.getElementById('chart-title').textContent = '📈 Aire de la Section Transversale A(x)';
  const svg = document.getElementById('svg-chart');
  const w = 300, h = 170;
  const padding = { top: 15, right: 15, bottom: 25, left: 45 };

  const maxA = 2400.0;
  const maxL = 200.0;

  const scaleX = x => padding.left + (x / maxL) * (w - padding.left - padding.right);
  const scaleY = y => h - padding.bottom - (y / maxA) * (h - padding.top - padding.bottom);

  // Courbe continue exacte
  let pathD = '';
  for (let x = 0; x <= maxL; x += 5) {
    const u = x / maxL;
    const ax = maxA * (1 - Math.pow(u, 1.5)) * (1 - u);
    pathD += (x === 0 ? 'M' : 'L') + `${scaleX(x).toFixed(1)},${scaleY(ax).toFixed(1)}`;
  }

  // Points de discrétisation des tranches
  let pointsCircles = '';
  data.slices.forEach(s => {
    const cx = scaleX(s.x);
    const cy = scaleY(s.area);
    pointsCircles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="#f59e0b" stroke="#fff" stroke-width="1"/>`;
  });

  svg.innerHTML = `
    <line x1="${padding.left}" y1="${h - padding.bottom}" x2="${w - padding.right}" y2="${h - padding.bottom}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${h - padding.bottom}" stroke="var(--border)" stroke-width="1"/>
    <text x="${w / 2}" y="${h - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">Distance axe vallée x (m)</text>
    <text x="14" y="${h / 2}" font-size="9" fill="var(--muted)" text-anchor="middle" transform="rotate(-90 14 ${h / 2})">Aire A(x) (m²)</text>

    <!-- Surface intégrée colorée -->
    <path d="${pathD} L${scaleX(maxL)},${h - padding.bottom} L${scaleX(0)},${h - padding.bottom} Z" fill="rgba(59, 130, 246, 0.2)"/>
    <path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="2"/>
    ${pointsCircles}
  `;
}


// --- SCÉNARIO 3 : MONTE-CARLO 3D (FORMES COMPLEXES) ---
function setupMonteCarloControls() {
  const container = document.getElementById('controls-container');
  container.innerHTML = `
    <div class="form-group">
      <label for="mc-shape">Géométrie 3D à intégrer :</label>
      <select id="mc-shape" class="form-control">
        <option value="dome" selected>Dôme Géodésique (Hémisphère R=5m)</option>
        <option value="torus">Réservoir Toroïdal Tokamak (R=4m, r=1.5m)</option>
        <option value="dam_vault">Voûte Parabolique Asymétrique de Barrage</option>
        <option value="sphere">Sphère Unité Mathématique</option>
      </select>
    </div>
    <div class="form-group">
      <label for="mc-samples">Nombre de tirages stochastiques N : <span class="val" id="val-mc-samples">3000</span></label>
      <input type="range" id="mc-samples" min="500" max="10000" step="500" value="3000">
      <small style="color:var(--muted); font-size:11px;">Convergence stochastique en O(1/√N) indépendante de la géométrie.</small>
    </div>
    <button id="btn-mc-resample" class="btn btn-sm btn-primary" style="width:100%; justify-content:center; margin-top:8px;">
      🎲 Nouveau Tirage Aléatoire
    </button>
  `;

  document.getElementById('mc-shape').addEventListener('change', loadMonteCarloSimulation);
  document.getElementById('mc-samples').addEventListener('input', e => {
    document.getElementById('val-mc-samples').textContent = e.target.value;
    loadMonteCarloSimulation();
  });
  document.getElementById('btn-mc-resample').addEventListener('click', () => {
    loadMonteCarloSimulation(Math.floor(Math.random() * 100000));
  });

  document.getElementById('drone-animation-bar').style.display = 'none';
  document.getElementById('overlay-scenario-name').textContent = '🎲 Intégration de Monte-Carlo 3D (Nuage de Points Stochastique)';

  document.getElementById('guide-info').innerHTML = `
    <h4>Cas d'Application Haute Technologie :</h4>
    <p>Estimation du volume et de la dose de radiation dans des géométries 3D complexes (ex: enceinte de confinement, tokamak de fusion ou dômes géodésiques).</p>
    <h4>Principe Stochastique :</h4>
    <ul>
      <li>On enferme la forme dans une boîte englobante de volume connu <code>V_box</code>.</li>
      <li>On génère <code>N</code> points uniformément distribués en 3D.</li>
      <li><b>Points Verts :</b> À l'intérieur de la forme.</li>
      <li><b>Points Rouges :</b> À l'extérieur.</li>
      <li>Volume estimé = <code>V_box * (N_in / N)</code>.</li>
    </ul>
  `;
}

function loadMonteCarloSimulation(customSeed = null) {
  const shape = document.getElementById('mc-shape').value;
  const samples = document.getElementById('mc-samples').value;
  const seed = customSeed !== null ? customSeed : 42;

  fetch(`/api/monte-carlo/?shape=${shape}&samples=${samples}&seed=${seed}`)
    .then(r => r.json())
    .then(data => {
      state.mcData = data;
      renderMonteCarlo3D(data);
      updateMonteCarloHUD(data);
      renderMonteCarloConvergenceChart(data);
    });
}

function renderMonteCarlo3D(data) {
  clearActive3D();
  active3DGroup = new THREE.Group();

  // 1. Boîte englobante transparente
  const b = data.bbox;
  const boxGeom = new THREE.BoxGeometry(b.xmax - b.xmin, b.zmax - b.zmin, b.ymax - b.ymin);
  const boxMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true, transparent: true, opacity: 0.25 });
  const boxMesh = new THREE.Mesh(boxGeom, boxMat);
  boxMesh.position.set(
    (b.xmax + b.xmin) / 2,
    (b.zmax + b.zmin) / 2,
    (b.ymax + b.ymin) / 2
  );
  active3DGroup.add(boxMesh);

  // 2. Modèle géométrique théorique transparent pour repère
  let shapeGeom = null;
  if (data.shape_type === 'dome') {
    shapeGeom = new THREE.SphereGeometry(5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const shapeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const shapeMesh = new THREE.Mesh(shapeGeom, shapeMat);
    active3DGroup.add(shapeMesh);
  } else if (data.shape_type === 'torus') {
    shapeGeom = new THREE.TorusGeometry(4, 1.5, 16, 32);
    const shapeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25 });
    const shapeMesh = new THREE.Mesh(shapeGeom, shapeMat);
    shapeMesh.rotation.x = Math.PI / 2;
    active3DGroup.add(shapeMesh);
  }

  // 3. Nuage de points 3D stochastique (Verts = Inside, Rouges = Outside)
  const insideGeom = new THREE.BufferGeometry();
  const outsideGeom = new THREE.BufferGeometry();

  const insidePts = [];
  const outsidePts = [];

  data.points.forEach(p => {
    // Note: swapping Y and Z to keep vertical convention in Three.js
    if (p.inside) {
      insidePts.push(p.x, p.z, p.y);
    } else {
      outsidePts.push(p.x, p.z, p.y);
    }
  });

  insideGeom.setAttribute('position', new THREE.Float32BufferAttribute(insidePts, 3));
  outsideGeom.setAttribute('position', new THREE.Float32BufferAttribute(outsidePts, 3));

  const insideMat = new THREE.PointsMaterial({ color: 0x10b981, size: 0.35 });
  const outsideMat = new THREE.PointsMaterial({ color: 0xef4444, size: 0.25, transparent: true, opacity: 0.5 });

  active3DGroup.add(new THREE.Points(insideGeom, insideMat));
  active3DGroup.add(new THREE.Points(outsideGeom, outsideMat));

  scene.add(active3DGroup);

  controls.target.set(0, (b.zmax + b.zmin) / 2, 0);
}

function updateMonteCarloHUD(data) {
  document.getElementById('kpi-container').innerHTML = `
    <div class="kpi-card good">
      <div class="kpi-title">Volume Estimé</div>
      <div class="kpi-value">${data.estimated_volume.toFixed(2)} m³</div>
      <div class="kpi-sub">Exact: ${data.exact_volume.toFixed(2)} m³</div>
    </div>
    <div class="kpi-card ${data.relative_error_percent < 2.0 ? 'good' : 'warn'}">
      <div class="kpi-title">Erreur Relative</div>
      <div class="kpi-value">${data.relative_error_percent.toFixed(2)} %</div>
      <div class="kpi-sub">Abs: ${data.absolute_error.toFixed(2)} m³</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Intervalle Confiance 95%</div>
      <div class="kpi-value">± ${data.ci95.toFixed(2)} m³</div>
      <div class="kpi-sub">[${(data.estimated_volume - data.ci95).toFixed(1)} ; ${(data.estimated_volume + data.ci95).toFixed(1)}]</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Points Intérieurs</div>
      <div class="kpi-value">${data.n_inside} / ${data.n_samples}</div>
      <div class="kpi-sub">Ratio: ${(data.n_inside / data.n_samples * 100).toFixed(1)}%</div>
    </div>
  `;
}

function renderMonteCarloConvergenceChart(data) {
  document.getElementById('chart-title').textContent = '📈 Intervalle Statistique à 95% (Loi des Grands Nombres)';
  const svg = document.getElementById('svg-chart');
  const w = 300, h = 170;
  const padding = { top: 20, right: 20, bottom: 25, left: 45 };

  const exact = data.exact_volume;
  const estim = data.estimated_volume;
  const ci = data.ci95;

  const minV = exact * 0.75, maxV = exact * 1.25;

  const scaleY = v => h - padding.bottom - (v - minV) / (maxV - minV) * (h - padding.top - padding.bottom);

  const exactY = scaleY(exact);
  const estimY = scaleY(estim);
  const topCI = scaleY(estim + ci);
  const botCI = scaleY(estim - ci);

  svg.innerHTML = `
    <!-- Ligne référence exacte -->
    <line x1="${padding.left}" y1="${exactY}" x2="${w - padding.right}" y2="${exactY}" stroke="#10b981" stroke-width="2"/>
    <text x="${w - padding.right}" y="${exactY - 5}" font-size="9" fill="#10b981" text-anchor="end">Volume Exact : ${exact.toFixed(1)} m³</text>

    <!-- Barre d'intervalle de confiance -->
    <line x1="${w / 2}" y1="${topCI}" x2="${w / 2}" y2="${botCI}" stroke="#3b82f6" stroke-width="3"/>
    <line x1="${w / 2 - 15}" y1="${topCI}" x2="${w / 2 + 15}" y2="${topCI}" stroke="#3b82f6" stroke-width="2"/>
    <line x1="${w / 2 - 15}" y1="${botCI}" x2="${w / 2 + 15}" y2="${botCI}" stroke="#3b82f6" stroke-width="2"/>

    <!-- Point de l'estimation -->
    <circle cx="${w / 2}" cy="${estimY}" r="6" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
    <text x="${w / 2 + 15}" y="${estimY + 4}" font-size="10" fill="var(--text)" font-weight="700">${estim.toFixed(1)} m³</text>

    <!-- Annotations -->
    <text x="${w / 2}" y="${h - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">Tirage N = ${data.n_samples} points 3D</text>
  `;
}


// --- SCÉNARIO 4 : BANC D'ESSAI COMPARATIF À COÛT ÉGAL (N_eval) ---
function setupBenchmarkControls() {
  const container = document.getElementById('controls-container');
  container.innerHTML = `
    <div class="form-group">
      <label for="bm-shape">Scénario physique comparatif :</label>
      <select id="bm-shape" class="form-control">
        <option value="dam" selected>Retenue de Barrage Hydraulique (L=200m)</option>
        <option value="sphere">Demi-Sphère Réservoir d'Hydrogène</option>
      </select>
    </div>
    <div class="panel-card" style="margin-top:10px; background:rgba(255,255,255,0.02);">
      <div style="font-size:12px; font-weight:600; color:var(--text); margin-bottom:6px;">Légende des Méthodes :</div>
      <div style="font-size:11.5px; display:flex; flex-direction:column; gap:4px;">
        <span style="color:#64748b;">■ Trapèzes O(h²)</span>
        <span style="color:#ef4444;">■ Simpson O(h⁴)</span>
        <span style="color:#8b5cf6;">■ Romberg Extrapolé</span>
        <span style="color:#3b82f6; font-weight:bold;">■ Gauss–Legendre (Championne)</span>
        <span style="color:#10b981;">■ Simpson Adaptatif</span>
        <span style="color:#f59e0b;">■ Monte-Carlo O(1/√N)</span>
      </div>
    </div>
  `;

  document.getElementById('bm-shape').addEventListener('change', loadBenchmarkSimulation);

  document.getElementById('drone-animation-bar').style.display = 'none';
  document.getElementById('overlay-scenario-name').textContent = '⚖️ Comparaison Rigoureuse à Coût Égal (Évaluations N_eval)';

  document.getElementById('guide-info').innerHTML = `
    <h4>Pourquoi le Coût Réel (N_eval) ?</h4>
    <p>En ingénierie et recherche, comparer des méthodes au même pas <code>h</code> est trompeur car chaque méthode demande un nombre d'appels différent à la fonction.</p>
    <h4>Le Véritable Banc d'Essai :</h4>
    <p>Quelle méthode atteint la précision voulue (ex: 10⁻⁸) avec le <b>minimum absolu de mesures réelles</b> ?</p>
    <ul>
      <li><b>Gauss-Legendre</b> pulvérise toutes les méthodes pour les fonctions régulières.</li>
      <li><b>Simpson Adaptatif</b> excelle dès qu'il y a des variations localisées.</li>
      <li><b>Monte-Carlo</b> est indispensable en grande dimension 3D+.</li>
    </ul>
  `;
}

function loadBenchmarkSimulation() {
  const shape = document.getElementById('bm-shape').value;

  fetch(`/api/benchmark/?shape=${shape}`)
    .then(r => r.json())
    .then(data => {
      state.bmData = data;
      renderBenchmark3D();
      updateBenchmarkHUD(data);
      renderBenchmarkChart(data);
    });
}

function renderBenchmark3D() {
  clearActive3D();
  active3DGroup = new THREE.Group();

  // Affichage d'un podium / comparateur 3D symbolique
  const colors = [0x64748b, 0xef4444, 0x8b5cf6, 0x3b82f6, 0x10b981, 0xf59e0b];
  const heights = [4, 7, 12, 16, 11, 3];
  const labels = ['Trap', 'Simp', 'Romb', 'Gauss', 'Adapt', 'MC'];

  heights.forEach((h, i) => {
    const colGeom = new THREE.CylinderGeometry(1.2, 1.2, h, 24);
    const colMat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3, metalness: 0.2 });
    const colMesh = new THREE.Mesh(colGeom, colMat);
    colMesh.position.set((i - 2.5) * 4, h / 2, 0);
    active3DGroup.add(colMesh);
  });

  scene.add(active3DGroup);
  controls.target.set(0, 6, 0);
}

function updateBenchmarkHUD(data) {
  document.getElementById('kpi-container').innerHTML = `
    <div class="kpi-card good">
      <div class="kpi-title">Méthode N°1 (Efficacité)</div>
      <div class="kpi-value">Gauss–Legendre</div>
      <div class="kpi-sub">Précision machine à N=16</div>
    </div>
    <div class="kpi-card good">
      <div class="kpi-title">Méthode N°2 (Régularité)</div>
      <div class="kpi-value">Romberg</div>
      <div class="kpi-sub">Gain d'ordre itératif</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Adaptative</div>
      <div class="kpi-value">Simpson Adapt.</div>
      <div class="kpi-sub">Optimise les gradients</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Multi-Dimensionnel</div>
      <div class="kpi-value">Monte-Carlo</div>
      <div class="kpi-sub">Robuste en dimension D</div>
    </div>
  `;
}

function renderBenchmarkChart(data) {
  document.getElementById('chart-title').textContent = '📈 Erreur en fonction du nombre total d’évaluations (N_eval)';
  const svg = document.getElementById('svg-chart');
  const w = 300, h = 170;
  const padding = { top: 15, right: 15, bottom: 25, left: 40 };

  const minLogN = 0.5, maxLogN = 3.5; // 3 to 3000 evals
  const minLogE = -15, maxLogE = 2;

  const scaleX = n => padding.left + (Math.log10(n) - minLogN) / (maxLogN - minLogN) * (w - padding.left - padding.right);
  const scaleY = err => h - padding.bottom - (Math.log10(Math.max(err, 1e-15)) - minLogE) / (maxLogE - minLogE) * (h - padding.top - padding.bottom);

  const seriesColors = {
    trapezoid: '#64748b',
    simpson: '#ef4444',
    romberg: '#8b5cf6',
    gauss: '#3b82f6',
    adaptive_simpson: '#10b981',
    monte_carlo: '#f59e0b'
  };

  let paths = '';
  Object.keys(data.series).forEach(key => {
    const s = data.series[key];
    const pts = s.evals.map((n, i) => [scaleX(n), scaleY(s.errors[i])]);
    const pathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    paths += `<path d="${pathD}" fill="none" stroke="${seriesColors[key]}" stroke-width="${key === 'gauss' ? '2.5' : '1.5'}" ${key === 'monte_carlo' ? 'stroke-dasharray="3 3"' : ''}/>`;
  });

  svg.innerHTML = `
    <line x1="${padding.left}" y1="${h - padding.bottom}" x2="${w - padding.right}" y2="${h - padding.bottom}" stroke="var(--border)" stroke-width="1"/>
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${h - padding.bottom}" stroke="var(--border)" stroke-width="1"/>
    <text x="${w / 2}" y="${h - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">Nombre d'évaluations N_eval (log10)</text>
    <text x="12" y="${h / 2}" font-size="9" fill="var(--muted)" text-anchor="middle" transform="rotate(-90 12 ${h / 2})">Erreur absolue (log10)</text>
    ${paths}
  `;
}


// -----------------------------------------------------------------------------
// 4. ANIMATION ET BOUCLE DE RENDU 3D
// -----------------------------------------------------------------------------
let clock = new THREE.Clock();

function animate3D() {
  requestAnimationFrame(animate3D);

  const delta = clock.getDelta();

  if (controls) controls.update();

  // Animation spécifique Drone
  if (state.currentTab === 'drone' && state.droneData && droneMesh) {
    if (state.isPlaying) {
      state.currentTime += delta * state.playSpeed;
      if (state.currentTime > state.maxTime) state.currentTime = 0;
      updateDroneTimelineUI();
    }

    const t = state.currentTime;
    // Position et vitesse temps réel
    const px = 15.0 * Math.cos(0.5 * t);
    const pz = 15.0 * Math.sin(0.5 * t);
    const py = 3.0 + 2.0 * Math.sin(1.2 * t) + 0.5 * t;

    const vx = -7.5 * Math.sin(0.5 * t);
    const vz = 7.5 * Math.cos(0.5 * t);
    const vy = 2.4 * Math.cos(1.2 * t) + 0.5;

    const ax = -3.75 * Math.cos(0.5 * t);
    const az = -3.75 * Math.sin(0.5 * t);
    const ay = -2.88 * Math.sin(1.2 * t);

    droneMesh.position.set(px, py, pz);
    droneMesh.rotation.y = -0.5 * t + Math.PI / 2;

    // Vecteur vitesse (Jaune)
    const vDir = new THREE.Vector3(vx, vy, vz).normalize();
    const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz) * 0.4;
    velocityArrow.position.set(px, py, pz);
    velocityArrow.setDirection(vDir);
    velocityArrow.setLength(vLen, 0.8, 0.3);

    // Vecteur accélération (Rouge)
    const aDir = new THREE.Vector3(ax, ay, az).normalize();
    const aLen = Math.sqrt(ax * ax + ay * ay + az * az) * 0.6;
    accelerationArrow.position.set(px, py, pz);
    accelerationArrow.setDirection(aDir);
    accelerationArrow.setLength(aLen, 0.6, 0.25);
  }

  renderer.render(scene, camera);
}

function updateDroneTimelineUI() {
  const timeVal = document.getElementById('anim-time-val');
  const scrubber = document.getElementById('anim-scrubber');
  if (timeVal) timeVal.textContent = state.currentTime.toFixed(1);
  if (scrubber) scrubber.value = (state.currentTime / state.maxTime) * 100;
}

// Contrôles animation Drone
document.getElementById('btn-play-pause').addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  document.getElementById('btn-play-pause').textContent = state.isPlaying ? '⏸️ Pause' : '▶️ Lecture';
});

document.getElementById('anim-scrubber').addEventListener('input', e => {
  state.currentTime = (parseFloat(e.target.value) / 100) * state.maxTime;
  updateDroneTimelineUI();
});

document.getElementById('anim-speed').addEventListener('change', e => {
  state.playSpeed = parseFloat(e.target.value);
});


// -----------------------------------------------------------------------------
// 5. SAUVEGARDE & HISTORIQUE DJANGO
// -----------------------------------------------------------------------------
document.getElementById('btn-save-simulation').addEventListener('click', () => {
  const statusMsg = document.getElementById('save-status-msg');
  statusMsg.textContent = 'Enregistrement en cours...';

  let payload = {
    title: `Run ${new Date().toLocaleTimeString()}`,
    scenario: 'dam_volume',
    method: 'simpson',
    parameters: {},
    results: {},
    evaluations: 10,
    relative_error_percent: 0.01
  };

  if (state.currentTab === 'drone' && state.droneData) {
    payload.scenario = 'drone_derivative';
    payload.title = `Drone Δt=${state.droneData.dt}s`;
    payload.method = 'Différences Centrées & Richardson';
    payload.parameters = { dt: state.droneData.dt };
    payload.results = state.droneData.current_state;
    payload.evaluations = 4;
    payload.relative_error_percent = (state.droneData.current_state.error_centered / state.droneData.current_state.exact_speed) * 100;
  } else if (state.currentTab === 'dam' && state.damData) {
    payload.scenario = 'dam_volume';
    payload.title = `Barrage ${state.damData.method} N=${state.damData.n_slices}`;
    payload.method = state.damData.method;
    payload.parameters = { method: state.damData.method, slices: state.damData.n_slices };
    payload.results = { volume: state.damData.calculated_volume, exact: state.damData.exact_volume };
    payload.evaluations = state.damData.evaluations;
    payload.relative_error_percent = state.damData.relative_error_percent;
  } else if (state.currentTab === 'montecarlo' && state.mcData) {
    payload.scenario = 'monte_carlo_3d';
    payload.title = `Monte-Carlo 3D ${state.mcData.shape_type} N=${state.mcData.n_samples}`;
    payload.method = 'Monte-Carlo 3D';
    payload.parameters = { shape: state.mcData.shape_type, samples: state.mcData.n_samples };
    payload.results = { estimated: state.mcData.estimated_volume, exact: state.mcData.exact_volume };
    payload.evaluations = state.mcData.n_samples;
    payload.relative_error_percent = state.mcData.relative_error_percent;
  } else if (state.currentTab === 'benchmark') {
    payload.scenario = 'benchmark';
    payload.title = 'Banc d’essai coût égal';
    payload.method = 'Multi-méthodes';
    payload.evaluations = 1000;
    payload.relative_error_percent = 0.0001;
  }

  fetch('/api/save/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(res => {
      if (res.status === 'success') {
        statusMsg.textContent = `✅ Enregistré avec succès (ID #${res.id}) à ${res.created_at}`;
        refreshHistoryTable();
      } else {
        statusMsg.textContent = '❌ Erreur de sauvegarde';
      }
    })
    .catch(() => {
      statusMsg.textContent = '❌ Erreur de communication serveur';
    });
});

function refreshHistoryTable() {
  fetch('/api/history/')
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById('history-body');
      if (!tbody || !data.history) return;
      if (data.history.length === 0) return;

      tbody.innerHTML = data.history.map(item => `
        <tr>
          <td>${item.scenario.substring(0, 14)}</td>
          <td>${item.evaluations}</td>
          <td>${item.error_pct ? item.error_pct.toFixed(4) + '%' : 'N/A'}</td>
          <td>${item.created_at.split(' ')[1] || ''}</td>
        </tr>
      `).join('');
    });
}


// -----------------------------------------------------------------------------
// 6. GESTION DES ONGLETS DE NAVIGATION
// -----------------------------------------------------------------------------
const tabButtons = document.querySelectorAll('.tabs-bar .tab-btn');

function switchTab(tabKey) {
  state.currentTab = tabKey;
  tabButtons.forEach(btn => {
    const isActive = btn.dataset.tab === tabKey;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (tabKey === 'drone') {
    setupDroneControls();
    loadDroneSimulation();
  } else if (tabKey === 'dam') {
    setupDamControls();
    loadDamSimulation();
  } else if (tabKey === 'montecarlo') {
    setupMonteCarloControls();
    loadMonteCarloSimulation();
  } else if (tabKey === 'benchmark') {
    setupBenchmarkControls();
    loadBenchmarkSimulation();
  }
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});


// -----------------------------------------------------------------------------
// 7. DÉMARRAGE INITIAL
// -----------------------------------------------------------------------------
init3D();
applyTheme(state.theme);
switchTab('drone');
