/**
 * Simulateur 3D d'Analyse Numérique - Frontend Three.js
 * Scénarios : Drone 3D paramétrable, Barrage, Éolienne, Rentrée Spatiale, Monte-Carlo 3D, Benchmark
 * Graphes SVG ultra-visibles, HUD Télémétrie, Thèmes, Contrôles 3D
 */

(function () {
  'use strict';

  // --- ÉTAT GLOBAL ---
  let currentScenario = 'drone';
  let isWireframe = false;
  let scene, camera, renderer, controls;
  let dynamicGroup = new THREE.Group();
  let animationFrameId = null;

  // Variables animation drone
  let droneData = null;
  let isDronePlaying = false;
  let droneAnimIndex = 0;
  let droneMeshGroup = null;
  let velArrowHelper = null;
  let accArrowHelper = null;

  // Variables animation rentrée spatiale
  let rocketData = null;
  let isRocketPlaying = false;
  let rocketAnimIndex = 0;
  let rocketMesh = null;
  let rocketTrail = null;

  // Variables animation éolienne
  let turbineRotorGroup = null;
  let turbineData = null;

  // --- PÉDAGOGIE TEXTUELLE ---
  const PEDAGOGY_DATA = {
    drone: `
      <p><strong>🛸 Dérivation Numérique 3D & Trajectoire de Drone :</strong></p>
      <p>Un drone autonome mesure sa position spatiale <strong>(x, y, z)</strong> via GPS et IMU discrètement dans le temps. Pour stabiliser son vol ou prédire sa trajectoire, le contrôleur de vol doit dériver numériquement la position pour obtenir la <strong>vitesse v(t)</strong> et l'<strong>accélération a(t)</strong>.</p>
      <p><strong>Courbe en V de la Dérivation :</strong></p>
      <ul>
        <li><strong>Si Δt est grand :</strong> L'erreur de troncature domine en <em>O(h)</em> ou <em>O(h²)</em>.</li>
        <li><strong>Si Δt est minuscule :</strong> La soustraction de valeurs quasi-identiques entraîne une perte de précision catastrophique par <strong>erreur d'arrondi machine</strong> (ε_machine ~ 10⁻¹⁶).</li>
        <li>L'extrapolation de <strong>Richardson O(h⁴)</strong> réduit drastiquement l'erreur pour un pas intermédiaire !</li>
      </ul>
    `,
    dam: `
      <p><strong>🌊 Intégration Numérique 3D & Volume de Barrage :</strong></p>
      <p>Calculer la capacité d'une retenue hydraulique (en millions de m³) est crucial pour prévenir les crues et dimensionner les turbines hydroélectriques.</p>
      <p>Le volume s'obtient en intégrant les aires des sections transversales bathymétriques le long de la vallée : <em>V = ∫ A(x) dx</em>.</p>
      <ul>
        <li><strong>Trapèzes O(h²) :</strong> Simple mais sous-estime les courbures géologiques.</li>
        <li><strong>Simpson O(h⁴) :</strong> Approche parabolique très performante.</li>
        <li><strong>Gauss-Legendre :</strong> Atteint une précision analytique quasi-parfaite avec seulement quelques points de mesure judicieusement placés.</li>
      </ul>
    `,
    turbine: `
      <p><strong>💨 Éolienne & Théorie de l'Élément de Pale (BEM) :</strong></p>
      <p>La puissance totale extraite par un rotor d'éolienne moderne (pales de 50 à 90m) se calcule en intégrant la force aérodynamique le long du rayon : <em>P = 3 × ∫ dP(r) dr</em>.</p>
      <ul>
        <li>La vitesse relative du vent augmente linéairement vers le bout de la pale (<em>v_tan = ω × r</em>).</li>
        <li>L'intégration de Gauss ou Simpson permet de calculer avec exactitude la production en mégawatts (MW) en tenant compte des pertes en bout de pale (Prandtl tip loss).</li>
      </ul>
    `,
    rocket: `
      <p><strong>🚀 Rentrée Atmosphérique Guidée & Facteur de Charge (G) :</strong></p>
      <p>Lors de la rentrée d'une capsule spatiale ou d'un booster réutilisable, la télémétrie doit dériver deux fois la trajectoire pour surveiller la décélération brutale (Max-Q).</p>
      <p>La double dérivation numérique <em>a(t) = [p(t+h) - 2p(t) + p(t-h)] / h²</em> est ultra-sensible au bruit des capteurs !</p>
    `,
    monte_carlo: `
      <p><strong>🎲 Intégration Stochastique de Monte-Carlo 3D :</strong></p>
      <p>Pour des volumes géométriques complexes ou des enceintes de confinement (ex: réacteur Tokamak ou dôme géodésique), l'intégration analytique ou par maillage régulier devient trop lourde (malédiction de la dimension).</p>
      <p>La méthode de Monte-Carlo enferme la forme dans une boîte englobante de volume <em>V_box</em> connu et tire <em>N</em> points aléatoires : <em>V ≈ V_box × (N_in / N)</em> avec un intervalle de confiance à 95% en <em>O(1/√N)</em>.</p>
    `,
    benchmark: `
      <p><strong>⚖️ Banc d'Essai Rigoureux à Coût Égal (N_eval) :</strong></p>
      <p>En ingénierie, comparer deux méthodes numériques au même "pas h" est un piège car chaque méthode n'a pas le même nombre d'évaluations de la fonction !</p>
      <p>Le véritable critère d'efficacité est le compromis <strong>Précision vs Nombre Total d'Évaluations (N_eval)</strong>.</p>
    `
  };

  // --- INITIALISATION DU RENDU THREE.JS ---
  function initThree() {
    const container = document.getElementById('webglContainer');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050b14);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(30, 25, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lumières de base
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(40, 60, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 0.5, 150);
    pointLight.position.set(-20, 30, -20);
    scene.add(pointLight);

    scene.add(dynamicGroup);

    // Animation loop
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      // Rotation continue du rotor de l'éolienne si visible
      if (turbineRotorGroup && currentScenario === 'turbine') {
        turbineRotorGroup.rotation.z += 0.04;
      }

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    const container = document.getElementById('webglContainer');
    if (!container || !renderer || !camera) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function clearDynamicScene() {
    while (dynamicGroup.children.length > 0) {
      const obj = dynamicGroup.children[0];
      dynamicGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    droneMeshGroup = null;
    velArrowHelper = null;
    accArrowHelper = null;
    rocketMesh = null;
    rocketTrail = null;
    turbineRotorGroup = null;
  }

  // --- CHARGEMENT DES DIFFÉRENTS SCÉNARIOS ---

  // 1. DRONE 3D
  async function loadDroneScenario() {
    clearDynamicScene();
    document.getElementById('currentScenarioName').textContent = "Cinématique 3D de Drone & Dérivation Numérique";
    document.getElementById('chartTitle').textContent = "📈 COURBE EN V D'ERREUR (TRONCATURE vs ARRONDI)";

    const traj = document.getElementById('droneTrajectorySelect').value;
    const r = document.getElementById('droneRadiusRange').value;
    const alt = document.getElementById('droneAltitudeRange').value;
    const spd = document.getElementById('droneSpeedRange').value;
    const dt = document.getElementById('droneDtRange').value;
    const noise = document.getElementById('droneNoiseRange').value;

    const res = await fetch(`/api/drone/?trajectory=${traj}&radius=${r}&altitude=${alt}&speed_factor=${spd}&dt=${dt}&noise=${noise}`);
    droneData = await res.json();

    // Grille au sol
    const grid = new THREE.GridHelper(60, 30, 0x38bdf8, 0x1e293b);
    grid.position.y = 0;
    dynamicGroup.add(grid);

    // Tracé 3D de la trajectoire
    const points = droneData.ref_path.map(p => new THREE.Vector3(p[0], p[2], p[1]));
    const curveGeom = new THREE.BufferGeometry().setFromPoints(points);
    const curveMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const pathLine = new THREE.Line(curveGeom, curveMat);
    dynamicGroup.add(pathLine);

    // Modèle 3D de drone quadricoptère
    droneMeshGroup = new THREE.Group();
    const bodyGeom = new THREE.BoxGeometry(1.6, 0.35, 1.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    droneMeshGroup.add(body);

    // 4 bras et rotors
    const armMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8), armMat);
    arm1.rotation.z = Math.PI / 2;
    arm1.rotation.y = Math.PI / 4;
    const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8), armMat);
    arm2.rotation.z = Math.PI / 2;
    arm2.rotation.y = -Math.PI / 4;
    droneMeshGroup.add(arm1);
    droneMeshGroup.add(arm2);

    [-1, 1].forEach(dx => {
      [-1, 1].forEach(dz => {
        const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04), rotorMat);
        rotor.position.set(dx * 1.0, 0.22, dz * 1.0);
        droneMeshGroup.add(rotor);
      });
    });

    dynamicGroup.add(droneMeshGroup);

    // Vecteur Vitesse (Vert) et Accélération (Rouge)
    velArrowHelper = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 3, 0x10b981, 0.8, 0.4);
    accArrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 2.5, 0xf43f5e, 0.6, 0.3);
    dynamicGroup.add(velArrowHelper);
    dynamicGroup.add(accArrowHelper);

    // Positionnement initial
    const kf0 = droneData.flight_keyframes[0];
    droneMeshGroup.position.set(kf0.pos[0], kf0.pos[2], kf0.pos[1]);

    // Slider timeline
    const timeline = document.getElementById('droneTimelineRange');
    timeline.max = droneData.t_end;
    timeline.value = 0;
    droneAnimIndex = 0;

    camera.position.set(r * 1.8, alt * 1.4, r * 1.8);
    controls.target.set(0, alt * 0.4, 0);

    updateDroneTelemetry();
    renderHighVisVCurve(droneData.v_curve, parseFloat(dt));
  }

  function updateDroneTelemetry() {
    if (!droneData) return;
    const cur = droneData.current_state;
    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Vitesse Exacte (m/s)</span>
        <span class="kpi-value">${cur.exact_speed.toFixed(3)} m/s</span>
        <span class="kpi-sub">Norme ||v(t)||</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Diff. Centrées O(h²)</span>
        <span class="kpi-value" style="color: var(--accent-blue);">${cur.speed_centered.toFixed(3)} m/s</span>
        <span class="kpi-sub">Err: ${cur.error_centered.toExponential(2)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Richardson O(h⁴)</span>
        <span class="kpi-value" style="color: var(--accent-purple);">${cur.speed_richardson.toFixed(3)} m/s</span>
        <span class="kpi-sub">Err: ${cur.error_richardson.toExponential(2)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Accélération a(t)</span>
        <span class="kpi-value" style="color: var(--accent-rose);">${cur.acc_centered_norm.toFixed(2)} m/s²</span>
        <span class="kpi-sub">Exact: ${cur.exact_acc_norm.toFixed(2)} m/s²</span>
      </div>
    `;
  }

  // 2. BARRAGE HYDRAULIQUE
  async function loadDamScenario() {
    clearDynamicScene();
    document.getElementById('currentScenarioName').textContent = "Intégration 3D de Retenue & Capacité de Barrage";
    document.getElementById('chartTitle').textContent = "📈 PROFIL BATHYMÉTRIQUE DES SECTIONS A(x)";

    const method = document.getElementById('damMethodSelect').value;
    const slices = document.getElementById('damSlicesRange').value;

    const res = await fetch(`/api/dam/?method=${method}&slices=${slices}`);
    const data = await res.json();

    const L = data.dam_dimensions.length;
    const scaleX = 0.35, scaleY = 0.5, scaleZ = 0.5;

    // Relief de la gorge / vallée
    const tm = data.terrain_mesh;
    const geom = new THREE.PlaneGeometry(L * scaleX, 80 * scaleY, tm.nx - 1, tm.ny - 1);
    const posAttr = geom.attributes.position;
    for (let i = 0; i < tm.vertices.length; i++) {
      const v = tm.vertices[i];
      posAttr.setXYZ(i, (v[0] - L / 2) * scaleX, v[2] * scaleZ, v[1] * scaleY);
    }
    geom.computeVertexNormals();
    const valleyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: isWireframe
    });
    const valleyMesh = new THREE.Mesh(geom, valleyMat);
    dynamicGroup.add(valleyMesh);

    // Surface de l'eau
    const waterGeom = new THREE.PlaneGeometry(L * scaleX, 80 * scaleY);
    waterGeom.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.8
    });
    const water = new THREE.Mesh(waterGeom, waterMat);
    water.position.y = 0.1;
    dynamicGroup.add(water);

    // Mur du barrage en béton à x = 0
    const damWallGeom = new THREE.BoxGeometry(3, 46 * scaleZ, 82 * scaleY);
    const damWallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    const damWall = new THREE.Mesh(damWallGeom, damWallMat);
    damWall.position.set(-L * scaleX / 2, -23 * scaleZ, 0);
    dynamicGroup.add(damWall);

    // Tranches transversales d'intégration
    data.slices.forEach((s, idx) => {
      const sliceGeom = new THREE.PlaneGeometry(s.height * scaleZ, s.width * scaleY);
      sliceGeom.rotateY(Math.PI / 2);
      const sliceMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? 0x38bdf8 : 0x10b981,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      });
      const sliceMesh = new THREE.Mesh(sliceGeom, sliceMat);
      sliceMesh.position.set((s.x - L / 2) * scaleX, -s.height * scaleZ / 2, 0);
      dynamicGroup.add(sliceMesh);
    });

    camera.position.set(45, 35, 55);
    controls.target.set(0, -10, 0);

    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Volume Estimé (m³)</span>
        <span class="kpi-value">${data.calculated_volume.toLocaleString('fr-FR', {maximumFractionDigits: 1})} m³</span>
        <span class="kpi-sub">Exact: ${data.exact_volume.toLocaleString('fr-FR', {maximumFractionDigits: 1})} m³</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Erreur Relative</span>
        <span class="kpi-value" style="color: ${data.relative_error_percent < 0.1 ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">
          ${data.relative_error_percent.toFixed(4)} %
        </span>
        <span class="kpi-sub">Abs: ${data.absolute_error.toFixed(2)} m³</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Nombre de Tranches</span>
        <span class="kpi-value" style="color: var(--accent-blue);">${data.n_slices}</span>
        <span class="kpi-sub">Évaluations: ${data.evaluations}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Méthode Utilisée</span>
        <span class="kpi-value" style="font-size: 0.95rem; color: var(--accent-purple);">${data.method.toUpperCase()}</span>
        <span class="kpi-sub">Quadrature de volume</span>
      </div>
    `;

    renderHighVisBathymetry(data.slices);
  }

  // 3. ÉOLIENNE AÉRODYNAMIQUE (NOUVEAU CAS RÉEL)
  async function loadTurbineScenario() {
    clearDynamicScene();
    document.getElementById('currentScenarioName').textContent = "Éolienne & Puissance par Élément de Pale (BEM)";
    document.getElementById('chartTitle').textContent = "📈 DENSITÉ DE PUISSANCE AÉRODYNAMIQUE dP/dr (W/m)";

    const method = document.getElementById('turbineMethodSelect').value;
    const r = document.getElementById('turbineRadiusRange').value;
    const wind = document.getElementById('turbineWindRange').value;
    const elements = document.getElementById('turbineElementsRange').value;

    const res = await fetch(`/api/turbine/?method=${method}&radius=${r}&wind_speed=${wind}&elements=${elements}`);
    turbineData = await res.json();

    const scale = 0.5;
    const R = turbineData.blade_radius * scale;

    // Mat de l'éolienne
    const towerGeom = new THREE.CylinderGeometry(0.8, 1.6, 50, 32);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    const tower = new THREE.Mesh(towerGeom, towerMat);
    tower.position.set(0, 25, 0);
    dynamicGroup.add(tower);

    // Nacelle
    const nacelleGeom = new THREE.BoxGeometry(4, 3, 8);
    const nacelleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const nacelle = new THREE.Mesh(nacelleGeom, nacelleMat);
    nacelle.position.set(0, 50, 0);
    dynamicGroup.add(nacelle);

    // Hub et Rotor rotatif
    turbineRotorGroup = new THREE.Group();
    turbineRotorGroup.position.set(0, 50, 4.2);

    const hub = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 16), new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
    turbineRotorGroup.add(hub);

    // 3 pales à 120 degrés
    [0, 1, 2].forEach(i => {
      const angle = (i * 2 * Math.PI) / 3;
      const bladeGeom = new THREE.ConeGeometry(1.1, R, 16);
      bladeGeom.translate(0, R / 2, 0);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      const blade = new THREE.Mesh(bladeGeom, bladeMat);
      blade.rotation.z = angle;
      turbineRotorGroup.add(blade);
    });

    dynamicGroup.add(turbineRotorGroup);

    // Grille terrain
    const ground = new THREE.GridHelper(100, 20, 0x10b981, 0x1e293b);
    dynamicGroup.add(ground);

    camera.position.set(40, 60, 65);
    controls.target.set(0, 45, 0);

    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Puissance Mécanique</span>
        <span class="kpi-value">${(turbineData.power_kw / 1000).toFixed(3)} MW</span>
        <span class="kpi-sub">Total 3 Pales</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Erreur Quadrature</span>
        <span class="kpi-value" style="color: var(--accent-emerald);">${turbineData.relative_error_percent.toFixed(4)} %</span>
        <span class="kpi-sub">Abs: ${turbineData.absolute_error_kw.toFixed(2)} kW</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Rayon du Rotor</span>
        <span class="kpi-value" style="color: var(--accent-blue);">${turbineData.blade_radius} m</span>
        <span class="kpi-sub">Vent: ${turbineData.wind_speed} m/s</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Anneaux (N_eval)</span>
        <span class="kpi-value" style="color: var(--accent-purple);">${turbineData.evaluations}</span>
        <span class="kpi-sub">Méthode: ${turbineData.method.toUpperCase()}</span>
      </div>
    `;

    renderHighVisTurbine(turbineData.blade_elements);
  }

  // 4. RENTRÉE SPATIALE & DÉCÉLÉRATION G (NOUVEAU CAS RÉEL)
  async function loadRocketScenario() {
    clearDynamicScene();
    document.getElementById('currentScenarioName').textContent = "Rentrée Atmosphérique Guidée & Facteur de Charge G";
    document.getElementById('chartTitle').textContent = "📈 DÉCÉLÉRATION ET CHARGE G(t) EN FONCTION DU TEMPS";

    const dt = document.getElementById('rocketDtRange').value;
    const noise = document.getElementById('rocketNoiseRange').value;

    const res = await fetch(`/api/rocket/?dt=${dt}&noise=${noise}`);
    rocketData = await res.json();

    // Ligne de trajectoire atmosphérique
    const pts = rocketData.ref_path.map(p => new THREE.Vector3(p[0] * 0.4, p[2] * 0.4, p[1] * 0.4));
    const curveGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const curveMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3 });
    dynamicGroup.add(new THREE.Line(curveGeom, curveMat));

    // Capsule spatiale
    const capGeom = new THREE.ConeGeometry(1.6, 2.5, 32);
    capGeom.rotateX(Math.PI);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4, metalness: 0.6 });
    rocketMesh = new THREE.Mesh(capGeom, capMat);
    dynamicGroup.add(rocketMesh);

    // Bouclier thermique incandescent
    const shieldGeom = new THREE.SphereGeometry(1.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 4);
    const shieldMat = new THREE.MeshBasicMaterial({ color: 0xff4500, wireframe: true });
    const shield = new THREE.Mesh(shieldGeom, shieldMat);
    shield.position.y = 1.25;
    shield.rotateX(Math.PI);
    rocketMesh.add(shield);

    const ground = new THREE.GridHelper(80, 20, 0x475569, 0x1e293b);
    dynamicGroup.add(ground);

    camera.position.set(40, 30, 45);
    controls.target.set(0, 15, 0);

    const cur = rocketData.current_state;
    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Facteur de Charge G</span>
        <span class="kpi-value" style="color: var(--accent-rose);">${cur.g_force_numerical.toFixed(2)} G</span>
        <span class="kpi-sub">Exact: ${cur.g_force_exact.toFixed(2)} G</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Erreur Accélération</span>
        <span class="kpi-value" style="color: var(--accent-amber);">${cur.error_g_force.toFixed(3)} G</span>
        <span class="kpi-sub">Pas Δt = ${rocketData.dt}s</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Vitesse Capsule</span>
        <span class="kpi-value" style="color: var(--accent-blue);">${cur.exact_speed.toFixed(1)} m/s</span>
        <span class="kpi-sub">Mach ~ ${(cur.exact_speed / 340).toFixed(1)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Diff. Centrées a(t)</span>
        <span class="kpi-value" style="color: var(--accent-purple);">${(cur.g_force_numerical * 9.81).toFixed(1)} m/s²</span>
        <span class="kpi-sub">Double dérivation O(h²)</span>
      </div>
    `;

    renderHighVisRocket(rocketData.keyframes);
  }

  // 5. MONTE-CARLO 3D
  async function loadMonteCarloScenario() {
    clearDynamicScene();
    document.getElementById('currentScenarioName').textContent = "Intégration Stochastique de Monte-Carlo 3D (Nuage de Points)";
    document.getElementById('chartTitle').textContent = "📈 INTERVALLE STATISTIQUE À 95% (LOI DES GRANDS NOMBRES)";

    const shape = document.getElementById('mcShapeSelect').value;
    const samples = document.getElementById('mcSamplesRange').value;

    const res = await fetch(`/api/monte-carlo/?shape=${shape}&samples=${samples}`);
    const data = await res.json();

    // Rendu du nuage de points 3D (Verts = In, Rouges = Out)
    const pts = data.points;
    const geomIn = new THREE.BufferGeometry();
    const geomOut = new THREE.BufferGeometry();
    const coordsIn = [], coordsOut = [];

    pts.forEach(p => {
      if (p.inside) coordsIn.push(p.x, p.z, p.y);
      else coordsOut.push(p.x, p.z, p.y);
    });

    geomIn.setAttribute('position', new THREE.Float32BufferAttribute(coordsIn, 3));
    geomOut.setAttribute('position', new THREE.Float32BufferAttribute(coordsOut, 3));

    const matIn = new THREE.PointsMaterial({ color: 0x10b981, size: 0.35 });
    const matOut = new THREE.PointsMaterial({ color: 0xf43f5e, size: 0.25, transparent: true, opacity: 0.4 });

    dynamicGroup.add(new THREE.Points(geomIn, matIn));
    dynamicGroup.add(new THREE.Points(geomOut, matOut));

    // Boîte englobante en fil de fer
    const b = data.bbox;
    const dx = b.xmax - b.xmin, dy = b.ymax - b.ymin, dz = b.zmax - b.zmin;
    const boxGeom = new THREE.BoxGeometry(dx, dz, dy);
    const boxMat = new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true, transparent: true, opacity: 0.5 });
    const boxMesh = new THREE.Mesh(boxGeom, boxMat);
    boxMesh.position.set((b.xmin + b.xmax) / 2, (b.zmin + b.zmax) / 2, (b.ymin + b.ymax) / 2);
    dynamicGroup.add(boxMesh);

    // Forme transparente témoin
    if (shape === 'dome') {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
      );
      dynamicGroup.add(dome);
    } else if (shape === 'torus') {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(4, 1.5, 16, 40),
        new THREE.MeshStandardMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.3 })
      );
      torus.rotateX(Math.PI / 2);
      dynamicGroup.add(torus);
    }

    camera.position.set(12, 15, 20);
    controls.target.set(0, 3, 0);

    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Volume Estimé</span>
        <span class="kpi-value">${data.estimated_volume.toFixed(2)} m³</span>
        <span class="kpi-sub">Exact: ${data.exact_volume.toFixed(2)} m³</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Erreur Relative</span>
        <span class="kpi-value" style="color: var(--accent-emerald);">${data.relative_error_percent.toFixed(2)} %</span>
        <span class="kpi-sub">Abs: ${data.absolute_error.toFixed(2)} m³</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Intervalle Confiance 95%</span>
        <span class="kpi-value" style="color: var(--accent-blue);">± ${data.ci95.toFixed(2)} m³</span>
        <span class="kpi-sub">[${(data.estimated_volume - data.ci95).toFixed(1)} ; ${(data.estimated_volume + data.ci95).toFixed(1)}]</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Points Intérieurs</span>
        <span class="kpi-value" style="color: var(--accent-purple);">${data.n_inside} / ${data.n_samples}</span>
        <span class="kpi-sub">Ratio: ${(data.n_inside / data.n_samples * 100).toFixed(1)}%</span>
      </div>
    `;

    renderHighVisMonteCarlo(data);
  }

  // 6. BENCHMARK COÛT ÉGAL
  async function loadBenchmarkScenario() {
    clearDynamicScene();
    document.getElementById('currentScenarioName').textContent = "Comparaison Rigoureuse à Coût Égal (Évaluations N_eval)";
    document.getElementById('chartTitle').textContent = "📈 ERREUR EN FONCTION DU NOMBRE TOTAL D'ÉVALUATIONS";

    const shape = document.getElementById('benchmarkShapeSelect').value;
    const res = await fetch(`/api/benchmark/?shape=${shape}`);
    const data = await res.json();

    // Barres 3D représentant la précision des méthodes
    const methods = [
      { name: "Trapèzes", color: 0x94a3b8, score: 3 },
      { name: "Simpson", color: 0xf87171, score: 5 },
      { name: "Romberg", color: 0xc084fc, score: 8 },
      { name: "Gauss-Legendre", color: 0x38bdf8, score: 10 },
      { name: "Simpson Adapt.", color: 0x34d399, score: 7 },
      { name: "Monte-Carlo", color: 0xfbbf24, score: 2 }
    ];

    methods.forEach((m, idx) => {
      const h = m.score * 2.2;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, h, 32),
        new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.3, metalness: 0.5 })
      );
      bar.position.set((idx - 2.5) * 4.5, h / 2, 0);
      dynamicGroup.add(bar);
    });

    const floor = new THREE.GridHelper(35, 10, 0x475569, 0x1e293b);
    dynamicGroup.add(floor);

    camera.position.set(0, 18, 30);
    controls.target.set(0, 8, 0);

    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Méthode N°1 (Efficacité)</span>
        <span class="kpi-value" style="color: var(--accent-blue);">Gauss–Legendre</span>
        <span class="kpi-sub">Précision machine à N=16</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Méthode N°2 (Régularité)</span>
        <span class="kpi-value" style="color: var(--accent-emerald);">Romberg</span>
        <span class="kpi-sub">Gain d'ordre itératif</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Adaptative</span>
        <span class="kpi-value" style="color: var(--accent-purple); font-size: 1rem;">Simpson Adapt.</span>
        <span class="kpi-sub">Optimise les gradients</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Multi-Dimensionnel</span>
        <span class="kpi-value" style="color: var(--accent-amber); font-size: 1rem;">Monte-Carlo</span>
        <span class="kpi-sub">Robuste en dimension D</span>
      </div>
    `;

    renderHighVisBenchmark(data.series);
  }

  // --- MOTEUR DE GRAPHIQUES SVG ULTRA-VISIBLES ---

  function clearSvg() {
    const svg = document.getElementById('svgChart');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    return svg;
  }

  function createSvgElement(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (let k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  // Graphique 1 : V-Curve Dérivation
  function renderHighVisVCurve(vcurve, currentDt) {
    const svg = clearSvg();
    const W = 460, H = 280, padL = 60, padB = 40, padT = 30, padR = 20;
    const plotW = W - padL - padR, plotH = H - padB - padT;

    // Fond
    svg.appendChild(createSvgElement('rect', { x: 0, y: 0, width: W, height: H, class: 'chart-bg', rx: 8 }));

    // Grille et Axes
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      svg.appendChild(createSvgElement('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, class: 'chart-grid-line' }));
      const labelVal = `10^${-16 + (16 / 4) * (4 - i)}`;
      const txt = createSvgElement('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-text' });
      txt.textContent = labelVal;
      svg.appendChild(txt);
    }

    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT + plotH, x2: padL + plotW, y2: padT + plotH, class: 'chart-axis-line' }));
    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT, x2: padL, y2: padT + plotH, class: 'chart-axis-line' }));

    // Titres des axes
    const xLabel = createSvgElement('text', { x: padL + plotW / 2, y: H - 8, 'text-anchor': 'middle', class: 'chart-axis-text' });
    xLabel.textContent = "Pas de discrétisation h = Δt (log10)";
    svg.appendChild(xLabel);

    const yLabel = createSvgElement('text', { x: 14, y: padT + plotH / 2, 'text-anchor': 'middle', class: 'chart-axis-text', transform: `rotate(-90, 14, ${padT + plotH / 2})` });
    yLabel.textContent = "Erreur ||v_num - v_exact||";
    svg.appendChild(yLabel);

    // Tracé des 3 courbes
    const hArr = vcurve.h;
    const logMinH = -12, logMaxH = 0;
    const logMinE = -16, logMaxE = 2;

    function toCoord(hVal, errVal) {
      const logH = Math.log10(Math.max(hVal, 1e-12));
      const logE = Math.log10(Math.max(errVal, 1e-16));
      const nx = (logH - logMinH) / (logMaxH - logMinH);
      const ny = (logE - logMinE) / (logMaxE - logMinE);
      return [padL + nx * plotW, padT + (1 - ny) * plotH];
    }

    function buildPath(errArray) {
      return errArray.map((e, i) => {
        const [x, y] = toCoord(hArr[i], e);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
    }

    // Courbe Avant O(h) en Rouge
    svg.appendChild(createSvgElement('path', { d: buildPath(vcurve.err_fwd), fill: 'none', stroke: '#f87171', 'stroke-width': 2 }));
    // Courbe Centrée O(h²) en Bleu
    svg.appendChild(createSvgElement('path', { d: buildPath(vcurve.err_cen), fill: 'none', stroke: '#38bdf8', 'stroke-width': 2.5 }));
    // Courbe Richardson O(h⁴) en Violet
    svg.appendChild(createSvgElement('path', { d: buildPath(vcurve.err_rich), fill: 'none', stroke: '#c084fc', 'stroke-width': 3 }));

    // Ligne verticale du pas actuel choisi
    const [curX] = toCoord(currentDt, 1e-8);
    svg.appendChild(createSvgElement('line', { x1: curX, y1: padT, x2: curX, y2: padT + plotH, stroke: '#fbbf24', 'stroke-width': 2.5, 'stroke-dasharray': '4,4' }));

    // Légende
    const leg = createSvgElement('g', { transform: `translate(${padL + 10}, ${padT + 15})` });
    leg.innerHTML = `
      <circle cx="5" cy="0" r="4" fill="#f87171" />
      <text x="14" y="4" class="chart-axis-text">Avant O(h)</text>
      <circle cx="105" cy="0" r="4" fill="#38bdf8" />
      <text x="114" y="4" class="chart-axis-text">Centré O(h²)</text>
      <circle cx="215" cy="0" r="4" fill="#c084fc" />
      <text x="224" y="4" class="chart-axis-text">Richardson O(h⁴)</text>
    `;
    svg.appendChild(leg);
  }

  // Graphique 2 : Profil de sections A(x) du barrage
  function renderHighVisBathymetry(slices) {
    const svg = clearSvg();
    const W = 460, H = 280, padL = 60, padB = 40, padT = 30, padR = 20;
    const plotW = W - padL - padR, plotH = H - padB - padT;

    svg.appendChild(createSvgElement('rect', { x: 0, y: 0, width: W, height: H, class: 'chart-bg', rx: 8 }));

    const maxArea = 2500;
    const maxL = 200;

    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      svg.appendChild(createSvgElement('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, class: 'chart-grid-line' }));
      const val = Math.round(maxArea * (1 - i / 4));
      const txt = createSvgElement('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-text' });
      txt.textContent = `${val} m²`;
      svg.appendChild(txt);
    }

    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT + plotH, x2: padL + plotW, y2: padT + plotH, class: 'chart-axis-line' }));
    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT, x2: padL, y2: padT + plotH, class: 'chart-axis-line' }));

    // Polygone d'intégration
    let dArea = `M ${padL} ${padT + plotH}`;
    slices.forEach(s => {
      const nx = s.x / maxL;
      const ny = s.area / maxArea;
      const x = padL + nx * plotW;
      const y = padT + (1 - ny) * plotH;
      dArea += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      // Marqueur tranche
      svg.appendChild(createSvgElement('circle', { cx: x, cy: y, r: 4.5, fill: '#38bdf8', stroke: '#ffffff', 'stroke-width': 1.5 }));
    });
    dArea += ` L ${padL + plotW} ${padT + plotH} Z`;

    svg.appendChild(createSvgElement('path', { d: dArea, fill: 'rgba(56, 189, 248, 0.25)', stroke: '#38bdf8', 'stroke-width': 2.5 }));

    const xLabel = createSvgElement('text', { x: padL + plotW / 2, y: H - 8, 'text-anchor': 'middle', class: 'chart-axis-text' });
    xLabel.textContent = "Axe longitudinal de la retenue x (mètres) de 0 à 200m";
    svg.appendChild(xLabel);
  }

  // Graphique 3 : Éolienne BEM
  function renderHighVisTurbine(elements) {
    const svg = clearSvg();
    const W = 460, H = 280, padL = 60, padB = 40, padT = 30, padR = 20;
    const plotW = W - padL - padR, plotH = H - padB - padT;

    svg.appendChild(createSvgElement('rect', { x: 0, y: 0, width: W, height: H, class: 'chart-bg', rx: 8 }));

    const maxP = Math.max(...elements.map(e => e.dP_dr), 100);
    const maxR = Math.max(...elements.map(e => e.r), 50);

    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      svg.appendChild(createSvgElement('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, class: 'chart-grid-line' }));
      const val = Math.round(maxP * (1 - i / 4));
      const txt = createSvgElement('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-text' });
      txt.textContent = `${val}`;
      svg.appendChild(txt);
    }

    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT + plotH, x2: padL + plotW, y2: padT + plotH, class: 'chart-axis-line' }));
    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT, x2: padL, y2: padT + plotH, class: 'chart-axis-line' }));

    let dCurve = '';
    elements.forEach((el, idx) => {
      const nx = el.r / maxR;
      const ny = el.dP_dr / maxP;
      const x = padL + nx * plotW;
      const y = padT + (1 - ny) * plotH;
      dCurve += `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      svg.appendChild(createSvgElement('circle', { cx: x, cy: y, r: 4, fill: '#10b981', stroke: '#ffffff', 'stroke-width': 1.5 }));
    });

    svg.appendChild(createSvgElement('path', { d: dCurve, fill: 'none', stroke: '#10b981', 'stroke-width': 3 }));

    const xLabel = createSvgElement('text', { x: padL + plotW / 2, y: H - 8, 'text-anchor': 'middle', class: 'chart-axis-text' });
    xLabel.textContent = "Position radiale r le long de la pale (mètres)";
    svg.appendChild(xLabel);
  }

  // Graphique 4 : Rentrée Spatiale G-Force
  function renderHighVisRocket(keyframes) {
    const svg = clearSvg();
    const W = 460, H = 280, padL = 60, padB = 40, padT = 30, padR = 20;
    const plotW = W - padL - padR, plotH = H - padB - padT;

    svg.appendChild(createSvgElement('rect', { x: 0, y: 0, width: W, height: H, class: 'chart-bg', rx: 8 }));

    const maxG = 12.0;
    const maxT = keyframes[keyframes.length - 1].t;

    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      svg.appendChild(createSvgElement('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, class: 'chart-grid-line' }));
      const val = (maxG * (1 - i / 4)).toFixed(1);
      const txt = createSvgElement('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-text' });
      txt.textContent = `${val} G`;
      svg.appendChild(txt);
    }

    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT + plotH, x2: padL + plotW, y2: padT + plotH, class: 'chart-axis-line' }));
    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT, x2: padL, y2: padT + plotH, class: 'chart-axis-line' }));

    // Ligne limite physiologique humaine (9G)
    const y9G = padT + (1 - 9.0 / maxG) * plotH;
    svg.appendChild(createSvgElement('line', { x1: padL, y1: y9G, x2: padL + plotW, y2: y9G, stroke: '#ef4444', 'stroke-width': 1.5, 'stroke-dasharray': '4,4' }));
    const txt9G = createSvgElement('text', { x: padL + plotW - 10, y: y9G - 4, 'text-anchor': 'end', fill: '#ef4444', class: 'chart-axis-text' });
    txt9G.textContent = "Limite Tolérance Humaine (9G)";
    svg.appendChild(txt9G);

    let dG = '';
    keyframes.forEach((kf, idx) => {
      const nx = kf.t / maxT;
      const ny = kf.g_force / maxG;
      const x = padL + nx * plotW;
      const y = padT + (1 - ny) * plotH;
      dG += `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    svg.appendChild(createSvgElement('path', { d: dG, fill: 'none', stroke: '#f59e0b', 'stroke-width': 3 }));

    const xLabel = createSvgElement('text', { x: padL + plotW / 2, y: H - 8, 'text-anchor': 'middle', class: 'chart-axis-text' });
    xLabel.textContent = "Temps de rentrée atmosphérique t (secondes)";
    svg.appendChild(xLabel);
  }

  // Graphique 5 : Monte-Carlo Intervalle
  function renderHighVisMonteCarlo(data) {
    const svg = clearSvg();
    const W = 460, H = 280, padL = 60, padB = 40, padT = 30, padR = 20;
    const plotW = W - padL - padR, plotH = H - padB - padT;

    svg.appendChild(createSvgElement('rect', { x: 0, y: 0, width: W, height: H, class: 'chart-bg', rx: 8 }));

    const vMin = data.exact_volume * 0.7;
    const vMax = data.exact_volume * 1.3;

    const toY = (val) => padT + (1 - (val - vMin) / (vMax - vMin)) * plotH;

    // Valeur exacte
    const yExact = toY(data.exact_volume);
    svg.appendChild(createSvgElement('line', { x1: padL, y1: yExact, x2: padL + plotW, y2: yExact, stroke: '#10b981', 'stroke-width': 2.5 }));
    const tEx = createSvgElement('text', { x: padL + plotW - 10, y: yExact - 6, 'text-anchor': 'end', fill: '#10b981', class: 'chart-axis-text' });
    tEx.textContent = `Volume Exact : ${data.exact_volume.toFixed(1)} m³`;
    svg.appendChild(tEx);

    // Barre d'erreur IC à 95%
    const yEst = toY(data.estimated_volume);
    const yHigh = toY(data.estimated_volume + data.ci95);
    const yLow = toY(data.estimated_volume - data.ci95);
    const xMid = padL + plotW / 2;

    svg.appendChild(createSvgElement('line', { x1: xMid, y1: yLow, x2: xMid, y2: yHigh, stroke: '#38bdf8', 'stroke-width': 4 }));
    svg.appendChild(createSvgElement('line', { x1: xMid - 25, y1: yHigh, x2: xMid + 25, y2: yHigh, stroke: '#38bdf8', 'stroke-width': 3 }));
    svg.appendChild(createSvgElement('line', { x1: xMid - 25, y1: yLow, x2: xMid + 25, y2: yLow, stroke: '#38bdf8', 'stroke-width': 3 }));
    svg.appendChild(createSvgElement('circle', { cx: xMid, cy: yEst, r: 7, fill: '#fbbf24', stroke: '#ffffff', 'stroke-width': 2 }));

    const tEst = createSvgElement('text', { x: xMid + 15, y: yEst + 5, fill: '#fbbf24', class: 'chart-axis-text' });
    tEst.textContent = `${data.estimated_volume.toFixed(1)} m³`;
    svg.appendChild(tEst);

    const xLabel = createSvgElement('text', { x: padL + plotW / 2, y: H - 10, 'text-anchor': 'middle', class: 'chart-axis-text' });
    xLabel.textContent = `Tirage N = ${data.n_samples} points 3D`;
    svg.appendChild(xLabel);
  }

  // Graphique 6 : Benchmark Log-Log
  function renderHighVisBenchmark(series) {
    const svg = clearSvg();
    const W = 460, H = 280, padL = 60, padB = 40, padT = 30, padR = 20;
    const plotW = W - padL - padR, plotH = H - padB - padT;

    svg.appendChild(createSvgElement('rect', { x: 0, y: 0, width: W, height: H, class: 'chart-bg', rx: 8 }));

    const logMinN = Math.log10(2), logMaxN = Math.log10(2000);
    const logMinE = -16, logMaxE = 2;

    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      svg.appendChild(createSvgElement('line', { x1: padL, y1: y, x2: padL + plotW, y2: y, class: 'chart-grid-line' }));
      const val = `10^${-16 + 4 * (4 - i)}`;
      const txt = createSvgElement('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-text' });
      txt.textContent = val;
      svg.appendChild(txt);
    }

    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT + plotH, x2: padL + plotW, y2: padT + plotH, class: 'chart-axis-line' }));
    svg.appendChild(createSvgElement('line', { x1: padL, y1: padT, x2: padL, y2: padT + plotH, class: 'chart-axis-line' }));

    const colors = {
      trapezoid: '#94a3b8',
      simpson: '#f87171',
      romberg: '#c084fc',
      gauss: '#38bdf8',
      adaptive_simpson: '#34d399',
      monte_carlo: '#fbbf24'
    };

    for (let key in series) {
      const s = series[key];
      let dPath = '';
      s.evals.forEach((nVal, idx) => {
        const err = s.errors[idx];
        const nx = (Math.log10(nVal) - logMinN) / (logMaxN - logMinN);
        const ny = (Math.log10(Math.max(err, 1e-16)) - logMinE) / (logMaxE - logMinE);
        const x = padL + nx * plotW;
        const y = padT + (1 - ny) * plotH;
        dPath += `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      });
      svg.appendChild(createSvgElement('path', { d: dPath, fill: 'none', stroke: colors[key], 'stroke-width': 2.5 }));
    }

    const xLabel = createSvgElement('text', { x: padL + plotW / 2, y: H - 8, 'text-anchor': 'middle', class: 'chart-axis-text' });
    xLabel.textContent = "Nombre d'évaluations N_eval (log10)";
    svg.appendChild(xLabel);
  }

  // --- ANIMATION TIMELINE DU DRONE ---
  function stepDroneAnimation() {
    if (!droneData || !droneMeshGroup) return;
    const kfs = droneData.flight_keyframes;
    if (droneAnimIndex >= kfs.length) {
      droneAnimIndex = 0;
    }
    const kf = kfs[droneAnimIndex];
    droneMeshGroup.position.set(kf.pos[0], kf.pos[2], kf.pos[1]);

    // Orientation et flèches
    if (velArrowHelper && accArrowHelper) {
      const velVec = new THREE.Vector3(kf.vel[0], kf.vel[2], kf.vel[1]);
      const accVec = new THREE.Vector3(kf.acc[0], kf.acc[2], kf.acc[1]);
      const vLen = velVec.length();
      const aLen = accVec.length();

      if (vLen > 0.01) {
        velArrowHelper.position.copy(droneMeshGroup.position);
        velArrowHelper.setDirection(velVec.clone().normalize());
        velArrowHelper.setLength(Math.min(vLen * 0.4, 8));
      }
      if (aLen > 0.01) {
        accArrowHelper.position.copy(droneMeshGroup.position);
        accArrowHelper.setDirection(accVec.clone().normalize());
        accArrowHelper.setLength(Math.min(aLen * 0.4, 6));
      }
    }

    // Mise à jour slider
    const slider = document.getElementById('droneTimelineRange');
    const valBadge = document.getElementById('droneTimelineVal');
    if (slider) slider.value = kf.t;
    if (valBadge) valBadge.textContent = `${kf.t.toFixed(1)} s`;

    droneAnimIndex++;
    if (isDronePlaying) {
      setTimeout(stepDroneAnimation, 50);
    }
  }

  // --- GESTIONNAIRES D'ÉVÉNEMENTS & INITIALISATION ---
  function setupEvents() {
    // Tabs de navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentScenario = tab.dataset.scenario;

        // Mise à jour panneau gauche
        document.querySelectorAll('.scenario-controls').forEach(c => c.classList.remove('active'));
        const ctrl = document.getElementById(`controls-${currentScenario}`);
        if (ctrl) ctrl.classList.add('active');

        // Pédagogie
        document.getElementById('pedagogyContent').innerHTML = PEDAGOGY_DATA[currentScenario] || '';
        document.getElementById('currentScenarioBadge').textContent = tab.textContent.trim();

        // Chargement du scénario 3D correspondant
        if (currentScenario === 'drone') loadDroneScenario();
        else if (currentScenario === 'dam') loadDamScenario();
        else if (currentScenario === 'turbine') loadTurbineScenario();
        else if (currentScenario === 'rocket') loadRocketScenario();
        else if (currentScenario === 'monte_carlo') loadMonteCarloScenario();
        else if (currentScenario === 'benchmark') loadBenchmarkScenario();
      });
    });

    // Thème Sombre / Clair
    const themeBtn = document.getElementById('themeToggleBtn');
    themeBtn.addEventListener('click', () => {
      const html = document.documentElement;
      const isLight = html.getAttribute('data-theme') === 'light';
      html.setAttribute('data-theme', isLight ? 'dark' : 'light');
      document.getElementById('themeIcon').textContent = isLight ? '☀️ Thème Clair' : '🌙 Thème Sombre';
      if (scene) scene.background = new THREE.Color(isLight ? 0x050b14 : 0xf1f5f9);
    });

    // Fil de fer
    document.getElementById('toggleWireframeBtn').addEventListener('click', () => {
      isWireframe = !isWireframe;
      dynamicGroup.traverse(child => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.wireframe = isWireframe);
          else child.material.wireframe = isWireframe;
        }
      });
    });

    // Centrer Caméra
    document.getElementById('resetCameraBtn').addEventListener('click', () => {
      if (currentScenario === 'drone') {
        camera.position.set(30, 25, 40);
        controls.target.set(0, 5, 0);
      } else if (currentScenario === 'dam') {
        camera.position.set(45, 35, 55);
        controls.target.set(0, -10, 0);
      } else if (currentScenario === 'turbine') {
        camera.position.set(40, 60, 65);
        controls.target.set(0, 45, 0);
      } else if (currentScenario === 'rocket') {
        camera.position.set(40, 30, 45);
        controls.target.set(0, 15, 0);
      } else if (currentScenario === 'monte_carlo') {
        camera.position.set(12, 15, 20);
        controls.target.set(0, 3, 0);
      } else {
        camera.position.set(0, 18, 30);
        controls.target.set(0, 8, 0);
      }
    });

    // Drone sliders et trajectoires
    ['droneTrajectorySelect', 'droneRadiusRange', 'droneAltitudeRange', 'droneSpeedRange', 'droneDtRange', 'droneNoiseRange'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'droneRadiusRange') document.getElementById('droneRadiusVal').textContent = `${el.value} m`;
          if (id === 'droneAltitudeRange') document.getElementById('droneAltitudeVal').textContent = `${el.value} m`;
          if (id === 'droneSpeedRange') document.getElementById('droneSpeedVal').textContent = `${el.value}x`;
          if (id === 'droneDtRange') document.getElementById('droneDtVal').textContent = `${parseFloat(el.value).toFixed(3)} s`;
          if (id === 'droneNoiseRange') document.getElementById('droneNoiseVal').textContent = el.value;
          loadDroneScenario();
        });
      }
    });

    // Drone Timeline
    const playBtn = document.getElementById('dronePlayBtn');
    playBtn.addEventListener('click', () => {
      isDronePlaying = !isDronePlaying;
      playBtn.textContent = isDronePlaying ? '⏸ Pause' : '▶ Lecture';
      if (isDronePlaying) stepDroneAnimation();
    });

    document.getElementById('droneResetTimelineBtn').addEventListener('click', () => {
      isDronePlaying = false;
      playBtn.textContent = '▶ Lecture';
      droneAnimIndex = 0;
      stepDroneAnimation();
    });

    document.getElementById('droneTimelineRange').addEventListener('input', (e) => {
      isDronePlaying = false;
      playBtn.textContent = '▶ Lecture';
      if (!droneData) return;
      const tTarget = parseFloat(e.target.value);
      const idx = droneData.flight_keyframes.findIndex(k => k.t >= tTarget);
      droneAnimIndex = idx >= 0 ? idx : 0;
      stepDroneAnimation();
    });

    // Barrage inputs
    ['damMethodSelect', 'damSlicesRange'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'damSlicesRange') document.getElementById('damSlicesVal').textContent = el.value;
          loadDamScenario();
        });
      }
    });

    // Éolienne inputs
    ['turbineMethodSelect', 'turbineRadiusRange', 'turbineWindRange', 'turbineElementsRange'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'turbineRadiusRange') document.getElementById('turbineRadiusVal').textContent = `${el.value} m`;
          if (id === 'turbineWindRange') document.getElementById('turbineWindVal').textContent = `${el.value} m/s`;
          if (id === 'turbineElementsRange') document.getElementById('turbineElementsVal').textContent = el.value;
          loadTurbineScenario();
        });
      }
    });

    // Rentrée Spatiale inputs
    ['rocketDtRange', 'rocketNoiseRange'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'rocketDtRange') document.getElementById('rocketDtVal').textContent = `${el.value} s`;
          if (id === 'rocketNoiseRange') document.getElementById('rocketNoiseVal').textContent = el.value;
          loadRocketScenario();
        });
      }
    });

    // Monte-Carlo inputs
    ['mcShapeSelect', 'mcSamplesRange'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (id === 'mcSamplesRange') document.getElementById('mcSamplesVal').textContent = el.value;
          loadMonteCarloScenario();
        });
      }
    });
    document.getElementById('mcResampleBtn').addEventListener('click', loadMonteCarloScenario);

    // Benchmark input
    document.getElementById('benchmarkShapeSelect').addEventListener('change', loadBenchmarkScenario);

    // Sauvegarde run
    document.getElementById('saveRunBtn').addEventListener('click', async () => {
      const payload = {
        title: `Run ${currentScenario.toUpperCase()}`,
        scenario: currentScenario === 'drone' ? 'drone_differentiation' :
                  currentScenario === 'dam' ? 'dam_volume' :
                  currentScenario === 'monte_carlo' ? 'monte_carlo_volume' : 'cost_benchmark',
        method: currentScenario,
        parameters: { scenario: currentScenario },
        evaluations: 10,
        relative_error_percent: 0.05
      };

      const res = await fetch('/api/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        const tbody = document.getElementById('historyTableBody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${payload.title}</td>
          <td>${payload.evaluations}</td>
          <td>${payload.relative_error_percent}%</td>
          <td>${data.created_at}</td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
        alert('Simulation enregistrée avec succès en base de données Django !');
      }
    });
  }

  // --- DÉMARRAGE ---
  window.addEventListener('DOMContentLoaded', () => {
    initThree();
    setupEvents();
    document.getElementById('pedagogyContent').innerHTML = PEDAGOGY_DATA['drone'];
    loadDroneScenario();
  });

})();
