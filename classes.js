// --- GAME CLASSES ---

class Shark {
    constructor() {
        this.mesh = new THREE.Group();
        
        const bodyGeo = new THREE.ConeGeometry(2, 10, 8);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshToonMaterial({ color: 0x666666 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.add(body);
        
        const finGeo = new THREE.BufferGeometry();
        const finVertices = new Float32Array([0, 1, 0, -1, -1, 0, 1, -1, 0, 0, -1, 2]);
        finGeo.setAttribute('position', new THREE.BufferAttribute(finVertices, 3));
        finGeo.computeVertexNormals();
        const fin = new THREE.Mesh(finGeo, bodyMat);
        fin.scale.set(1.5, 1.5, 1.5);
        fin.position.y = 1; fin.position.z = -1;
        this.mesh.add(fin);
        
        this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 3), bodyMat);
        this.tail.position.z = -5;
        this.mesh.add(this.tail);
        
        this.speed = 10 + Math.random() * 10;
        this.turnSpeed = 0.5 + Math.random();
        this.angle = Math.random() * Math.PI * 2;
        this.center = new THREE.Vector3(); 
    }

    update(dt, time, waterHeightFn) {
        this.tail.rotation.y = Math.sin(time * 10) * 0.5;

        // Circle behavior
        this.angle += this.turnSpeed * dt;
        const radius = 30;
        this.mesh.position.x = this.center.x + Math.cos(this.angle) * radius;
        this.mesh.position.z = this.center.z + Math.sin(this.angle) * radius;
        this.mesh.lookAt(this.center.x + Math.cos(this.angle + 0.1) * radius, this.mesh.position.y, this.center.z + Math.sin(this.angle + 0.1) * radius);
        
        const h = waterHeightFn(this.mesh.position.x, this.mesh.position.z, time);
        this.mesh.position.y = h - 5; 
    }
}

class PowerFish {
    constructor() {
        this.mesh = new THREE.Group();
        // Glowing body
        const geo = new THREE.ConeGeometry(1, 3, 8);
        geo.rotateX(Math.PI/2);
        const mat = new THREE.MeshToonMaterial({ 
            color: 0xFFFF00, 
            emissive: 0xFFAA00,
            emissiveIntensity: 0.5 
        });
        this.mesh.add(new THREE.Mesh(geo, mat));
        
        this.active = true;
        this.bobOffset = Math.random() * Math.PI;
    }

    update(dt, time) {
        if(!this.active) return;
        this.mesh.rotation.y += 2 * dt;
        this.mesh.position.y += Math.sin(time * 3 + this.bobOffset) * 0.05;
    }
}

class BoostPad {
    constructor() {
        this.mesh = new THREE.Group();
        // A glowing ring
        const geo = new THREE.TorusGeometry(8, 1, 16, 32);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.6 });
        this.mesh.add(new THREE.Mesh(geo, mat));
        
        // Arrows
        const arrowGeo = new THREE.ConeGeometry(2, 6, 4);
        arrowGeo.rotateX(Math.PI/2);
        const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
        arrow.position.y = 0;
        this.mesh.add(arrow);
    }
    
    update(dt, time) {
        this.mesh.scale.setScalar(1 + Math.sin(time * 5) * 0.1);
        this.mesh.children[1].position.z = Math.sin(time * 10) * 2; // Moving arrow
    }
}

class Jellyfish {
    constructor() {
        this.mesh = new THREE.Group();
        const domeGeo = new THREE.SphereGeometry(3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshToonMaterial({ color: 0xFF69B4, transparent: true, opacity: 0.8, emissive: 0x550055 });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        this.mesh.add(dome);

        const tentacleGeo = new THREE.CylinderGeometry(0.2, 0.1, 6);
        for(let i=0; i<6; i++) {
            const t = new THREE.Mesh(tentacleGeo, domeMat);
            t.position.set(Math.cos(i)*1.5, -3, Math.sin(i)*1.5);
            this.mesh.add(t);
        }
        this.basePos = new THREE.Vector3();
        this.phase = Math.random() * Math.PI * 2;
    }

    update(dt, time, waterHeightFn) {
        this.mesh.position.y = -30 + Math.sin(time + this.phase) * 5;
        const scale = 1.0 + Math.sin(time * 5 + this.phase) * 0.1;
        this.mesh.scale.set(scale, scale, scale);
    }
}

class TurtleCopter {
    constructor(maskColor, isPlayer) {
        this.isPlayer = isPlayer;
        this.mesh = new THREE.Group();
        this.velocity = new THREE.Vector3(); 
        this.bankAngle = 0;
        this.pitchAngle = 0; 
        this.verticalSpeed = 0; 
        this.flightEnergy = CONFIG.maxFlightEnergy; 
        
        const shellMat = new THREE.MeshToonMaterial({ color: 0x2E8B57 }); 
        const skinMat = new THREE.MeshToonMaterial({ color: 0x90EE90 }); 
        const maskMat = new THREE.MeshToonMaterial({ color: maskColor });
        const metalMat = new THREE.MeshToonMaterial({ color: 0xCCCCCC });

        const shellGeo = new THREE.SphereGeometry(4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const shell = new THREE.Mesh(shellGeo, shellMat);
        shell.castShadow = true;
        this.mesh.add(shell);
        
        const belly = new THREE.Mesh(new THREE.CircleGeometry(4, 16), new THREE.MeshToonMaterial({color: 0xE0E080}));
        belly.rotation.x = Math.PI / 2; belly.position.y = 0; this.mesh.add(belly);
        
        const headGroup = new THREE.Group();
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 12), skinMat);
        const mask = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.3, 8, 20), maskMat);
        mask.rotation.x = Math.PI / 2; mask.position.y = 0.5;
        headGroup.add(head); headGroup.add(mask);
        headGroup.position.z = 4.5; headGroup.position.y = -0.5; this.mesh.add(headGroup);
        
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3), metalMat);
        mast.position.y = 4; this.mesh.add(mast);
        
        this.rotor = new THREE.Group();
        const bladeGeo = new THREE.BoxGeometry(16, 0.2, 1.5);
        const blade1 = new THREE.Mesh(bladeGeo, metalMat);
        const blade2 = new THREE.Mesh(bladeGeo, metalMat);
        blade2.rotation.y = Math.PI / 2;
        this.rotor.add(blade1); this.rotor.add(blade2);
        this.rotor.position.y = 5.5; this.mesh.add(this.rotor);
        
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 6), skinMat);
        tail.position.z = -6; tail.position.y = 0; this.mesh.add(tail);
        
        this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 0.2), metalMat);
        this.tailRotor.position.z = -8.5; this.tailRotor.position.y = 0; this.mesh.add(this.tailRotor);
        
        const limbGeo = new THREE.CylinderGeometry(0.8, 0.6, 3);
        const fl = new THREE.Mesh(limbGeo, skinMat); fl.position.set(3, -1, 2); fl.rotation.z = -0.5;
        const fr = new THREE.Mesh(limbGeo, skinMat); fr.position.set(-3, -1, 2); fr.rotation.z = 0.5;
        const bl = new THREE.Mesh(limbGeo, skinMat); bl.position.set(3, -1, -2); bl.rotation.z = -0.5;
        const br = new THREE.Mesh(limbGeo, skinMat); br.position.set(-3, -1, -2); br.rotation.z = 0.5;
        this.mesh.add(fl, fr, bl, br);
        
        this.tiltContainer = new THREE.Group();
        this.tiltContainer.add(shell, belly, headGroup, mast, this.rotor, tail, this.tailRotor, fl, fr, bl, br);
        this.mesh.add(this.tiltContainer);
    }

    update(dt) {
        this.rotor.rotation.y -= 25 * dt; 
        this.tailRotor.rotation.x -= 25 * dt;
        const targetPitch = THREE.MathUtils.clamp(this.verticalSpeed * -0.01, -0.8, 0.8);
        this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, dt * 5);
        this.tiltContainer.rotation.x = this.pitchAngle;
    }
}

// Visual classes
class Seagull { constructor() { const geo = new THREE.BufferGeometry(); const vertices = new Float32Array([0, 0, 0, 1, 0, 0.5, -1, 0, 0.5]); geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide})); this.center = new THREE.Vector3((Math.random()-0.5)*1000, 50 + Math.random()*50, (Math.random()-0.5)*1000); this.radius = 50 + Math.random() * 100; this.speed = 0.5 + Math.random() * 0.5; this.angle = Math.random() * Math.PI * 2; } update(dt, time) { this.angle += this.speed * dt; this.mesh.position.x = this.center.x + Math.cos(this.angle) * this.radius; this.mesh.position.z = this.center.z + Math.sin(this.angle) * this.radius; this.mesh.position.y = this.center.y + Math.sin(time + this.angle) * 5; this.mesh.scale.z = Math.sin(time * 15) * 0.5 + 1; this.mesh.lookAt(this.center.x + Math.cos(this.angle+0.1)*this.radius, this.mesh.position.y, this.center.z + Math.sin(this.angle+0.1)*this.radius); } }
class FishSchool { constructor() { this.mesh = new THREE.Group(); this.center = new THREE.Vector3((Math.random()-0.5)*800, -10 - Math.random()*20, (Math.random()-0.5)*800); const fishGeo = new THREE.ConeGeometry(0.5, 2, 4); fishGeo.rotateX(Math.PI/2); const fishMat = new THREE.MeshBasicMaterial({color: 0xffaa00}); for(let i=0; i<10; i++) { const fish = new THREE.Mesh(fishGeo, fishMat); fish.position.set((Math.random()-0.5)*10, (Math.random()-0.5)*5, (Math.random()-0.5)*10); this.mesh.add(fish); } this.velocity = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), Math.random()*Math.PI*2); } update(dt) { this.mesh.position.add(this.velocity.clone().multiplyScalar(10 * dt)); if(this.mesh.position.x > 1500) this.mesh.position.x = -1500; if(this.mesh.position.x < -1500) this.mesh.position.x = 1500; if(this.mesh.position.z > 1500) this.mesh.position.z = -1500; if(this.mesh.position.z < -1500) this.mesh.position.z = 1500; this.mesh.lookAt(this.mesh.position.clone().add(this.velocity)); } }
class Dolphin { constructor() { const geo = new THREE.SphereGeometry(1.5, 16, 16); geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 3, 1)); geo.rotateX(Math.PI/2); this.mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({color: 0x8888cc})); this.basePos = new THREE.Vector3((Math.random()-0.5)*1000, -10, (Math.random()-0.5)*1000); this.timer = Math.random() * 10; } update(dt, time) { this.timer += dt; const cycle = this.timer % 8; if (cycle < 2) { const t = cycle / 2; const height = (-4 * Math.pow(t - 0.5, 2) + 1) * 20; this.mesh.position.y = -5 + height; this.mesh.position.x = this.basePos.x + t * 40; this.mesh.rotation.z = (0.5 - t) * 2.0; if(window.spawnSparks && Math.abs(this.mesh.position.y) < 1) window.spawnSparks(this.mesh.position, 1, 'splash'); } else { this.mesh.position.y = -10; this.mesh.rotation.z = 0; this.basePos.z += 5 * dt; this.mesh.position.x = this.basePos.x; this.mesh.position.z = this.basePos.z; } } }