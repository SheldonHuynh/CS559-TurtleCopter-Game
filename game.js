// --- GLOBALS ---
let scene, camera, renderer, clock = new THREE.Clock();
let player, particleSys;
let ais = [];
let life = {}; // Holds birds, fish, etc.
let obstacles = [], buoys = [], decorations = [], sharks = [];
let waterUniforms, trackCurve, trackPoints;

const gameState = {
    lap: 1,
    inputs: { up: false, down: false, left: false, right: false, drift: false },
    isResetting: false,
    gameActive: true,
    playerT: 0
};

// --- INIT ---
function init() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); 
    scene.fog = new THREE.Fog(0x87CEEB, 200, 1500);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 30, -50);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(100, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight, new THREE.AmbientLight(0xffffff, 0.5));

    // --- GENERATE WORLD ---
    // Note: WorldGen is defined in world_gen.js
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
    sharks = WorldGen.createSharks(scene, trackCurve);
    particleSys = new ParticleSystem(scene);

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

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
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
};

function handleInput(e, isDown) {
    switch(e.key) {
        case 'ArrowUp': gameState.inputs.up = isDown; break;
        case 'ArrowDown': gameState.inputs.down = isDown; break;
        case 'ArrowLeft': gameState.inputs.left = isDown; break;
        case 'ArrowRight': gameState.inputs.right = isDown; break;
        case ' ': gameState.inputs.drift = isDown; break;
    }
}

function resetPlayer(message = "UNDERWATER!") {
    gameState.isResetting = false;
    document.getElementById('respawn-msg').innerText = message;
    document.getElementById('respawn-msg').style.display = 'none';
    document.getElementById('underwater-overlay').style.display = 'none';
    
    let bestT = 0;
    if (player.mesh.position.lengthSq() > 10) {
        let minD = Infinity;
        for(let i=0; i<200; i++) {
            let t = i/200;
            let d = player.mesh.position.distanceToSquared(trackCurve.getPointAt(t));
            if(d < minD) { minD = d; bestT = t; }
        }
    }
    gameState.playerT = bestT;
    player.velocity.set(0,0,0);
    player.mesh.position.copy(trackCurve.getPointAt(bestT));
    player.mesh.position.y = 30; player.verticalSpeed = 0; player.bankAngle = 0;
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
    life.clouds.forEach(c => { c.position.x += c.userData.velocity * dt; if(c.position.x > 1500) c.position.x = -1500; });
    
    // ERROR FIXED: Removed life.driftWoods.forEach loop here.
    
    // Animate Track Obstacles (Mines bob, Wood drifts)
    obstacles.forEach(o => { 
        o.position.y = Utils.getWaterHeight(o.position.x, o.position.z, time) + (o.userData.type === 'mine' ? 2 : 0);
        if(o.userData.type === 'mine') {
            o.rotation.y += dt;
            o.rotation.x = Math.sin(time * 2) * 0.2;
        } else {
            o.rotation.x += dt * 0.5; 
        }
    });

    // --- PHYSICS ---
    let turnRate = gameState.inputs.left ? CONFIG.turnSpeed : (gameState.inputs.right ? -CONFIG.turnSpeed : 0);
    let targetBank = gameState.inputs.drift ? (turnRate * CONFIG.driftTurnMult > 0 ? Math.PI/3 : -Math.PI/3) : turnRate * 0.2;
    if(gameState.inputs.drift) turnRate *= CONFIG.driftTurnMult;

    player.mesh.rotation.y += turnRate * dt;
    player.bankAngle = THREE.MathUtils.lerp(player.bankAngle, targetBank, dt * 5);
    player.mesh.rotation.z = player.bankAngle;

    const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.mesh.rotation.y);
    if (gameState.inputs.up) player.velocity.add(forwardDir.multiplyScalar(CONFIG.acceleration * dt));
    else if (gameState.inputs.down) player.velocity.add(forwardDir.multiplyScalar(-CONFIG.acceleration * 0.5 * dt));
    player.velocity.multiplyScalar(gameState.inputs.drift ? 0.99 : CONFIG.friction);
    player.mesh.position.add(player.velocity.clone().multiplyScalar(dt));

    // --- LAP LOGIC ---
    let closestT = gameState.playerT, minD = Infinity;
    for(let i=0; i<20; i++) {
        let testT = (gameState.playerT + (i - 10) * 0.005);
        if(testT < 0) testT += 1; if(testT > 1) testT -= 1;
        const d = player.mesh.position.distanceToSquared(trackCurve.getPointAt(testT));
        if(d < minD) { minD = d; closestT = testT; }
    }
    if(gameState.playerT > 0.9 && closestT < 0.1) {
        gameState.lap++;
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
    
    // 1. Decoration Collision (Bounce off Rocks/Statues)
    decorations.forEach(deco => {
        // Simple circle check using x/z
        const distSq = new THREE.Vector2(player.mesh.position.x, player.mesh.position.z)
            .distanceToSquared(new THREE.Vector2(deco.position.x, deco.position.z));
            
        if(distSq < (deco.userData.radius + 5)**2) {
            const normal = player.mesh.position.clone().sub(deco.position).normalize();
            normal.y = 0; // Keep bounce horizontal
            player.mesh.position.add(normal.multiplyScalar(1.5)); 
            player.velocity.reflect(normal).multiplyScalar(0.5); 
            particleSys.spawn(player.mesh.position, 10, 'spark');
        }
    });

    // 2. Obstacle Collision (Mines/Driftwood -> CRASH)
    obstacles.forEach(obs => {
        if(player.mesh.position.distanceTo(obs.position) < (obs.userData.radius || 5) + 3) {
            gameState.isResetting = true;
            const msg = obs.userData.type === 'mine' ? "BOOM!" : "CRASH!";
            document.getElementById('respawn-msg').innerText = msg; 
            document.getElementById('respawn-msg').style.display = 'block';
            particleSys.spawn(player.mesh.position, 30, 'spark'); 
            setTimeout(() => resetPlayer("UNDERWATER!"), 1500);
        }
    });

    // 3. Shark Collision
    sharks.forEach(s => {
        s.update(dt, time, Utils.getWaterHeight);
        if(player.mesh.position.distanceTo(s.mesh.position) < 8) { 
            gameState.isResetting = true;
            document.getElementById('respawn-msg').innerText = "CHOMP!"; document.getElementById('respawn-msg').style.display = 'block';
            particleSys.spawn(player.mesh.position, 20, 'splash'); setTimeout(() => resetPlayer("UNDERWATER!"), 1500);
        }
    });

    // Track Check (Falling off)
    let minDistSqT = Infinity;
    for(let pt of trackPoints) minDistSqT = Math.min(minDistSqT, new THREE.Vector2(player.mesh.position.x-pt.x, player.mesh.position.z-pt.z).lengthSq());
    const waveH = Utils.getWaterHeight(player.mesh.position.x, player.mesh.position.z, time);

    if (minDistSqT > (CONFIG.trackWidth + 5) ** 2) {
        player.verticalSpeed -= 40 * dt; player.mesh.position.y += player.verticalSpeed * dt; player.isFalling = true;
        document.getElementById('underwater-overlay').style.display = (player.mesh.position.y < waveH - 2) ? 'block' : 'none';
        if(player.mesh.position.y < waveH - 2 && Math.random() > 0.5) particleSys.spawn(player.mesh.position, 1, 'bubble');
        if (player.mesh.position.y < CONFIG.resetHeight) {
            gameState.isResetting = true;
            document.getElementById('respawn-msg').innerText = "SPLASH!"; document.getElementById('respawn-msg').style.display = 'block';
            setTimeout(() => resetPlayer("UNDERWATER!"), 1500); 
        }
    } else {
        document.getElementById('underwater-overlay').style.display = 'none';
        player.verticalSpeed = 0; player.isFalling = false;
        player.mesh.position.y = THREE.MathUtils.lerp(player.mesh.position.y, 10 + waveH, dt * 3);
    }

    player.update(dt);

    // --- AI LOGIC ---
    let playerRank = 1;
    ais.forEach((ai, i) => {
        if(ai.isResetting) return;
        if((ai.lap * 10 + ai.t) > (gameState.lap * 10 + gameState.playerT)) playerRank++;
        let targetSpeed = ai.baseSpeed * (playerRank === 1 ? 1.3 : 0.8);
        ai.speed = THREE.MathUtils.lerp(ai.speed, targetSpeed, dt * 0.5);
        ai.t += (ai.speed * 0.08) * dt;
        if(ai.t > 1) { ai.t -= 1; ai.lap++; if(ai.lap > CONFIG.totalLaps) ai.finished = true; }
        
        const targetPos = trackCurve.getPointAt(ai.t);
        const normal = new THREE.Vector3().crossVectors(trackCurve.getTangent(ai.t), new THREE.Vector3(0,1,0)).normalize();
        let sideOffset = Math.sin(time + i) * 15;
        
        // AI Avoidance (Mines & Driftwood)
        obstacles.forEach(obs => {
            const dist = ai.mesh.position.distanceTo(obs.position);
            // 1. Hit detection
            if(dist < (obs.userData.radius || 5) + 3) {
                particleSys.spawn(ai.mesh.position, 20, 'spark'); ai.isResetting = true;
                setTimeout(() => { ai.isResetting = false; ai.mesh.position.y = 20; }, 1000);
            }
            // 2. Avoidance steering
            if(dist < 40) {
                 // Steer away from obstacle
                 sideOffset += 50 * (ai.mesh.position.x < obs.position.x ? 1 : -1);
            }
        });

        ai.mesh.position.lerp(targetPos.add(normal.multiplyScalar(sideOffset)), dt * 2);
        ai.mesh.lookAt(trackCurve.getPointAt((ai.t + 0.05) % 1));
        ai.mesh.position.y = 10 + Utils.getWaterHeight(ai.mesh.position.x, ai.mesh.position.z, time);
        ai.update(dt);
    });

    document.getElementById('rank').innerText = playerRank;
    buoys.forEach((b, i) => { b.position.y = 1.5 + Utils.getWaterHeight(b.position.x, b.position.z, time); b.rotation.z = Math.sin(time+i)*0.1; });
    decorations.forEach(d => { 
        d.position.y = (d.userData.type === 'coral' ? -5 : (d.userData.type === 'statue' || d.userData.type === 'seaweed' ? 5 : -2)) 
                        + Utils.getWaterHeight(d.position.x, d.position.z, time); 
        if(d.userData.type === 'seaweed') {
             d.children.forEach((blade, k) => blade.rotation.z = Math.sin(time * 2 + k) * 0.2);
        } else {
             d.rotation.z += 0.05 * dt; 
        }
    });
    particleSys.update(dt);

    if(!gameState.isResetting) {
        const idealOffset = new THREE.Vector3(0, 15, -35).applyQuaternion(player.mesh.quaternion).add(player.mesh.position);
        camera.position.lerp(idealOffset, dt * 3); camera.lookAt(player.mesh.position);
    }
    document.getElementById('speed').innerText = Math.floor(player.velocity.length() * 2) + " KM/H";
    renderer.render(scene, camera);
}

init();