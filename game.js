// --- GLOBALS ---
let scene, camera, renderer, clock = new THREE.Clock();
let player, particleSys, audioSys;
let ais = [];
let life = {}; 
let obstacles = [], buoys = [], decorations = [], sharks = [], jellyfish = [];
let powerFish = [], boostPads = [];
let waterUniforms, trackCurve, trackPoints;

const gameState = {
    lap: 1,
    inputs: { up: false, down: false, left: false, right: false, drift: false, dive: false, surface: false },
    isResetting: false,
    gameActive: true,
    playerT: 0
};

// --- INIT ---
function init() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); 
    scene.fog = new THREE.Fog(0x87CEEB, 200, 2500);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 30, -50);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -1000;
    dirLight.shadow.camera.right = 1000;
    dirLight.shadow.camera.top = 1000;
    dirLight.shadow.camera.bottom = -1000;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight, new THREE.AmbientLight(0xffffff, 0.5));

    // --- GENERATE WORLD ---
    const trackData = WorldGen.createTrack(scene);
    trackCurve = trackData.trackCurve;
    trackPoints = trackData.trackPoints;
    buoys = trackData.buoys;

    WorldGen.createStartLine(scene, trackCurve);
    const waterData = WorldGen.createEnvironment(scene);
    waterUniforms = waterData.waterUniforms;

    obstacles = WorldGen.createObstacles(scene, trackCurve);
    decorations = WorldGen.createDecorations(scene, trackPoints);
    life = WorldGen.createLife(scene);
    
    const predators = WorldGen.createPredators(scene, trackCurve);
    sharks = predators.sharks;
    jellyfish = predators.jellyfish;

    const rewards = WorldGen.createRewards(scene, trackCurve);
    powerFish = rewards.powerFish;
    boostPads = rewards.boostPads;

    particleSys = new ParticleSystem(scene);
    audioSys = new AudioSynth();

    // --- DOLPHIN MODEL LOADING ---
    let loadedDolphinModel = null;
    const mtlLoader = new THREE.MTLLoader();
    const objLoader = new THREE.OBJLoader();

    // Load MTL and OBJ
    mtlLoader.load('./assets/Dolphin.mtl', (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.load('./assets/Dolphin.obj', (object) => {
            loadedDolphinModel = object;
            console.log("Dolphin Loaded!");
            
            // If the user already clicked the checkbox before load finished:
            const checkbox = document.getElementById('chk-real-dolphin');
            if(checkbox.checked) updateDolphins(true);
        });
    });

    // Handle Checkbox Toggle
    document.getElementById('chk-real-dolphin').addEventListener('change', (e) => {
        updateDolphins(e.target.checked);
    });

    function updateDolphins(useReal) {
        // If we want real dolphins but haven't loaded yet, do nothing (wait for load)
        if (useReal && !loadedDolphinModel) return;

        // Apply to all dolphins in the game
        life.dolphins.forEach(dolphin => {
            // If the dolphin doesn't have the model yet, clone and add it
            if (dolphin.customModel.children.length === 0 && loadedDolphinModel) {
                const modelClone = loadedDolphinModel.clone();
                dolphin.customModel.add(modelClone);
            }
            // Toggle visibility
            dolphin.setMode(useReal);
        });
    }


    // --- PLAYER & AI ---
    player = new TurtleCopter(0xff0000, true); 
    scene.add(player.mesh);
    resetPlayer();

    const aiColors = [0x00ff00, 0x0000ff, 0xff00ff];
    for(let i=0; i<3; i++) {
        const ai = new TurtleCopter(aiColors[i], false);
        scene.add(ai.mesh);
        ai.t = 0.02 + (i * 0.02); 
        ai.baseSpeed = 0.35 + Math.random() * 0.1; 
        ai.speed = ai.baseSpeed;
        ai.lap = 1; ai.finished = false; ai.isResetting = false;
        ai.mesh.position.copy(trackCurve.getPointAt(ai.t));
        ais.push(ai);
    }

    // New Text for Controls
    document.querySelector('.tutorial').innerHTML = 
        "Eat Glowing Fish for ENERGY • Dive for SPEED PADS";

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    window.spawnSparks = (pos, count, type) => particleSys.spawn(pos, count, type);

    document.addEventListener('keydown', (e) => handleInput(e, true));
    document.addEventListener('keyup', (e) => handleInput(e, false));
    animate();
}

window.restartGame = function() {
    document.getElementById('game-over-screen').style.display = 'none';
    gameState.lap = 1; gameState.gameActive = true; gameState.playerT = 0;
    resetPlayer();
    ais.forEach((ai, i) => {
        ai.t = 0.02 + (i * 0.02); ai.lap = 1; ai.finished = false; ai.isResetting = false;
        ai.mesh.position.copy(trackCurve.getPointAt(ai.t)); ai.velocity.set(0,0,0);
    });
    document.getElementById('lap').innerText = "1";
    document.getElementById('rank').innerText = "1";
    audioSys.playSfx('lap'); 
    
    // Reset fish
    powerFish.forEach(f => { f.active = true; f.mesh.visible = true; });
};

function handleInput(e, isDown) {
    if (isDown) audioSys.init();

    switch(e.key) {
        case 'ArrowUp': gameState.inputs.up = isDown; break;
        case 'ArrowDown': gameState.inputs.down = isDown; break;
        case 'ArrowLeft': gameState.inputs.left = isDown; break;
        case 'ArrowRight': gameState.inputs.right = isDown; break;
        case ' ': gameState.inputs.drift = isDown; break;
        case 'Shift': gameState.inputs.dive = isDown; break;
        case 'w': case 'W': gameState.inputs.surface = isDown; break;
    }
}

function resetPlayer(message = "CRASHED!") {
    gameState.isResetting = false;
    document.getElementById('respawn-msg').innerText = message;
    document.getElementById('respawn-msg').style.display = 'none';
    document.getElementById('underwater-overlay').style.display = 'none';
    
    player.flightEnergy = CONFIG.maxFlightEnergy; 
    
    let bestT = 0;
    if (player.mesh.position.lengthSq() > 10) {
        let minD = Infinity;
        for(let i=0; i<200; i++) {
            let t = i/200;
            const pt = trackCurve.getPointAt(t);
            const dx = player.mesh.position.x - pt.x;
            const dz = player.mesh.position.z - pt.z;
            const d = dx*dx + dz*dz;
            if(d < minD) { minD = d; bestT = t; }
        }
    }
    gameState.playerT = bestT;
    player.velocity.set(0,0,0);
    player.verticalSpeed = 0;
    
    const respawnPt = trackCurve.getPointAt(bestT);
    respawnPt.y = 30; 
    player.mesh.position.copy(respawnPt);
    
    const tangent = trackCurve.getTangent(bestT).normalize();
    player.mesh.lookAt(player.mesh.position.clone().add(tangent.multiplyScalar(10)));
    player.mesh.rotation.z = 0; player.mesh.rotation.x = 0;
}

function animate() {
    requestAnimationFrame(animate);
    if(!gameState.gameActive) { renderer.render(scene, camera); return; }

    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime(); 
    if(waterUniforms) { waterUniforms.uTime.value = time; waterUniforms.uPlayerPos.value.copy(player.mesh.position); }

    if (gameState.isResetting) { particleSys.update(dt); renderer.render(scene, camera); return; }

    // --- UPDATE ENTITIES ---
    life.seagulls.forEach(b => b.update(dt, time));
    life.fishSchools.forEach(f => f.update(dt));
    life.dolphins.forEach(d => d.update(dt, time));
    life.clouds.forEach(c => { c.position.x += c.userData.velocity * dt; if(c.position.x > 3000) c.position.x = -3000; });
    
    obstacles.forEach(o => { 
        o.position.y = Utils.getWaterHeight(o.position.x, o.position.z, time) + (o.userData.type === 'mine' ? 2 : 0);
        if(o.userData.type === 'mine') { o.rotation.y += dt; o.rotation.x = Math.sin(time * 2) * 0.2; } 
        else { o.rotation.x += dt * 0.5; }
    });
    
    sharks.forEach(s => s.update(dt, time, Utils.getWaterHeight));
    jellyfish.forEach(j => j.update(dt, time, Utils.getWaterHeight));
    
    powerFish.forEach(f => f.update(dt, time));
    boostPads.forEach(b => b.update(dt, time));

    // --- PLAYER PHYSICS ---
    let turnRate = gameState.inputs.left ? CONFIG.turnSpeed : (gameState.inputs.right ? -CONFIG.turnSpeed : 0);
    if(gameState.inputs.drift) turnRate *= CONFIG.driftTurnMult;
    player.mesh.rotation.y += turnRate * dt;

    let targetBank = gameState.inputs.drift ? (turnRate > 0 ? Math.PI/3 : -Math.PI/3) : turnRate * 0.2;
    player.bankAngle = THREE.MathUtils.lerp(player.bankAngle, targetBank, dt * 5);
    player.mesh.rotation.z = player.bankAngle;

    const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.mesh.rotation.y);
    if (gameState.inputs.up) player.velocity.add(forwardDir.multiplyScalar(CONFIG.acceleration * dt));
    else if (gameState.inputs.down) player.velocity.add(forwardDir.multiplyScalar(-CONFIG.acceleration * 0.5 * dt));

    const waveH = Utils.getWaterHeight(player.mesh.position.x, player.mesh.position.z, time);
    const isUnderwater = player.mesh.position.y < waveH;

    let attemptingFly = gameState.inputs.surface;

    // NEW LOGIC: FLIGHT OVERHEAT
    // 1. If energy hits 0, set overheated to true
    if (player.flightEnergy <= 0) {
        player.isOverheated = true;
    }
    // 2. If energy refills to max, reset overheated to false
    if (player.flightEnergy >= CONFIG.maxFlightEnergy) {
        player.isOverheated = false;
    }
    
    // 3. Can only fly if we have energy AND we are not overheated
    let canFly = player.flightEnergy > 0 && !player.isOverheated;
    
    if (isUnderwater) {
        player.verticalSpeed += CONFIG.buoyancy * dt;
        if (attemptingFly) player.verticalSpeed += CONFIG.surfaceSpeed * dt;
        if (gameState.inputs.dive) player.verticalSpeed -= CONFIG.diveSpeed * dt;
        player.velocity.multiplyScalar(CONFIG.waterDrag); 
        player.verticalSpeed *= CONFIG.waterDrag;
        player.flightEnergy += CONFIG.flightRegen * dt;
    } else {
        player.verticalSpeed -= CONFIG.gravity * dt;
        player.velocity.multiplyScalar(gameState.inputs.drift ? 0.99 : CONFIG.friction);
        if (attemptingFly && canFly) {
            player.verticalSpeed += (CONFIG.gravity + CONFIG.surfaceSpeed) * dt; 
            player.flightEnergy -= CONFIG.flightDrain * dt;
        } else {
            player.flightEnergy += CONFIG.flightRegen * dt;
        }
    }
    
    player.flightEnergy = Math.max(0, Math.min(player.flightEnergy, CONFIG.maxFlightEnergy));
    
    // UI Update with Color change for Overheat
    const pct = (player.flightEnergy / CONFIG.maxFlightEnergy) * 100;
    const barFill = document.getElementById('flight-bar-fill');
    barFill.style.width = pct + "%";
    
    if (player.isOverheated) {
        barFill.style.background = "#ff3333"; // Red warning color
    } else {
        barFill.style.background = "linear-gradient(90deg, #ffcc00, #ff6600)"; // Original color
    }
    
    player.mesh.position.y += player.verticalSpeed * dt;
    if(player.mesh.position.y < CONFIG.floorLimit) {
        player.mesh.position.y = CONFIG.floorLimit;
        player.verticalSpeed = 0;
    }

    player.mesh.position.add(player.velocity.clone().multiplyScalar(dt)); // <--- ADD THIS LINE
    
    player.mesh.position.y += player.verticalSpeed * dt;
    if(player.mesh.position.y < CONFIG.floorLimit) {
        player.mesh.position.y = CONFIG.floorLimit;
        player.verticalSpeed = 0;
    }

    player.update(dt);

    // --- AUDIO & CAMERA ---
    const speed = player.velocity.length();
    const speedRatio = Math.min(speed / 150, 1.0);
    if(audioSys) {
        audioSys.updateEngine(speedRatio);
        const isDrifting = gameState.inputs.drift && speed > 20;
        audioSys.updateDrift(isDrifting);
    }
    
    if(!gameState.isResetting) {
        const idealOffset = new THREE.Vector3(0, 15, -35).applyQuaternion(player.mesh.quaternion).add(player.mesh.position);
        camera.position.lerp(idealOffset, dt * 3); camera.lookAt(player.mesh.position);
        
        const camWaveH = Utils.getWaterHeight(camera.position.x, camera.position.z, time);
        if (camera.position.y < camWaveH) {
            document.getElementById('underwater-overlay').style.display = 'block';
            scene.fog.color.setHex(0x001e36); 
            scene.fog.near = 10; scene.fog.far = 200;
        } else {
            document.getElementById('underwater-overlay').style.display = 'none';
            scene.fog.color.setHex(0x87CEEB); 
            scene.fog.near = 200; scene.fog.far = 2500;
        }
    }

    // --- LAP LOGIC ---
    let closestT = gameState.playerT, minD = Infinity;
    for(let i=0; i<30; i++) { 
        let testT = (gameState.playerT + (i - 15) * 0.002);
        if(testT < 0) testT += 1; if(testT > 1) testT -= 1;
        const pt = trackCurve.getPointAt(testT);
        const dx = player.mesh.position.x - pt.x;
        const dz = player.mesh.position.z - pt.z;
        const d = dx*dx + dz*dz;
        if(d < minD) { minD = d; closestT = testT; }
    }
    if(gameState.playerT > 0.9 && closestT < 0.1) {
        gameState.lap++;
        audioSys.playSfx('lap'); 
        if(gameState.lap > CONFIG.totalLaps) {
            gameState.gameActive = false;
            document.getElementById('game-over-screen').style.display = 'flex';
            let rank = 1;
            ais.forEach(ai => { if(ai.finished || (ai.lap > gameState.lap) || (ai.lap === gameState.lap && ai.t > closestT)) rank++; });
            document.getElementById('final-rank').innerText = "POS: " + rank + "/4";
        } else document.getElementById('lap').innerText = gameState.lap;
    }
    gameState.playerT = closestT;

    // --- COLLISIONS ---
    decorations.forEach(deco => {
        const dx = player.mesh.position.x - deco.position.x;
        const dz = player.mesh.position.z - deco.position.z;
        if (dx*dx + dz*dz < (deco.userData.radius + 5)**2) {
            const normal = new THREE.Vector3(dx, 0, dz).normalize();
            player.mesh.position.add(normal.multiplyScalar(1.5)); 
            player.velocity.reflect(normal).multiplyScalar(0.5); 
            particleSys.spawn(player.mesh.position, 10, 'spark');
            audioSys.playSfx('crash');
        }
    });

    obstacles.forEach(obs => {
        if(player.mesh.position.distanceTo(obs.position) < (obs.userData.radius || 5) + 3) {
            gameState.isResetting = true;
            const msg = obs.userData.type === 'mine' ? "BOOM!" : "CRASH!";
            document.getElementById('respawn-msg').innerText = msg; 
            document.getElementById('respawn-msg').style.display = 'block';
            particleSys.spawn(player.mesh.position, 30, 'spark');
            audioSys.playSfx('crash'); 
            setTimeout(() => resetPlayer(), 1500);
        }
    });

    sharks.forEach(s => {
        s.update(dt, time, Utils.getWaterHeight);
        if(player.mesh.position.distanceTo(s.mesh.position) < 8) { 
            gameState.isResetting = true;
            document.getElementById('respawn-msg').innerText = "CHOMP!"; document.getElementById('respawn-msg').style.display = 'block';
            particleSys.spawn(player.mesh.position, 20, 'splash'); 
            audioSys.playSfx('crash'); 
            setTimeout(() => resetPlayer(), 1500);
        }
    });

    jellyfish.forEach(j => {
        if(player.mesh.position.distanceTo(j.mesh.position) < 7) {
            const normal = player.mesh.position.clone().sub(j.mesh.position).normalize();
            normal.y = 0.5; 
            player.mesh.position.add(normal.multiplyScalar(3.0));
            player.velocity.reflect(normal).multiplyScalar(0.8);
            j.mesh.scale.y = 0.5; 
            particleSys.spawn(player.mesh.position, 15, 'splash');
            audioSys.playSfx('splash'); 
        }
    });
    
    // Check Reward Collisions
    powerFish.forEach(f => {
        if(f.active && player.mesh.position.distanceTo(f.mesh.position) < 8) {
            f.active = false;
            f.mesh.visible = false;
            player.flightEnergy += 50; // Restore energy
            audioSys.playSfx('lap'); // Reuse positive sound
            particleSys.spawn(f.mesh.position, 10, 'spark');
        }
    });
    
    boostPads.forEach(b => {
        if(player.mesh.position.distanceTo(b.mesh.position) < 15) {
             const forward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), b.mesh.rotation.y);
             player.velocity.add(forward.multiplyScalar(300)); // Huge boost
             particleSys.spawn(player.mesh.position, 20, 'bubble');
             audioSys.playSfx('splash');
        }
    });

    let playerRank = 1;
    ais.forEach((ai, i) => {
        if(ai.isResetting) return;
        if((ai.lap * 10 + ai.t) > (gameState.lap * 10 + gameState.playerT)) playerRank++;
        let targetSpeed = ai.baseSpeed * (playerRank === 1 ? 1.3 : 0.8);
        ai.speed = THREE.MathUtils.lerp(ai.speed, targetSpeed, dt * 0.5);
        ai.t += (ai.speed * 0.04) * dt; 
        if(ai.t > 1) { ai.t -= 1; ai.lap++; if(ai.lap > CONFIG.totalLaps) ai.finished = true; }
        
        const targetPos = trackCurve.getPointAt(ai.t);
        const normal = new THREE.Vector3().crossVectors(trackCurve.getTangent(ai.t), new THREE.Vector3(0,1,0)).normalize();
        let sideOffset = Math.sin(time + i) * 15;
        
        obstacles.forEach(obs => {
            const dist = ai.mesh.position.distanceTo(obs.position);
            if(dist < (obs.userData.radius || 5) + 3) {
                particleSys.spawn(ai.mesh.position, 20, 'spark'); ai.isResetting = true;
                setTimeout(() => { ai.isResetting = false; ai.mesh.position.y = 20; }, 1000);
            }
            if(dist < 40) sideOffset += 50 * (ai.mesh.position.x < obs.position.x ? 1 : -1);
        });

        ai.mesh.position.lerp(targetPos.add(normal.multiplyScalar(sideOffset)), dt * 2);
        ai.mesh.lookAt(trackCurve.getPointAt((ai.t + 0.05) % 1));
        const aiWaveH = Utils.getWaterHeight(ai.mesh.position.x, ai.mesh.position.z, time);
        ai.mesh.position.y = THREE.MathUtils.lerp(ai.mesh.position.y, aiWaveH + 2, dt * 2);
        ai.update(dt);
    });

    document.getElementById('rank').innerText = playerRank;
    document.getElementById('speed').innerText = Math.floor(player.velocity.length() * 2) + " KM/H";
    renderer.render(scene, camera);
}

init();