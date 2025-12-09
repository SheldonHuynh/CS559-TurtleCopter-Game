// --- WORLD GENERATION ---

const WorldGen = {
    createTrack: function(scene) {
        const trackCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0), new THREE.Vector3(150, 0, 250),
            new THREE.Vector3(400, 0, 100), new THREE.Vector3(500, 0, -150),
            new THREE.Vector3(250, 0, -400), new THREE.Vector3(-250, 0, -400),
            new THREE.Vector3(-500, 0, -100), new THREE.Vector3(-250, 0, 150),
            new THREE.Vector3(-100, 0, 50)
        ], true);

        const trackPoints = trackCurve.getSpacedPoints(200);
        const points = trackCurve.getSpacedPoints(150);
        const buoyGeo = new THREE.CylinderGeometry(1, 1, 3);
        const buoyMatLeft = new THREE.MeshToonMaterial({ color: 0xff0000 });
        const buoyMatRight = new THREE.MeshToonMaterial({ color: 0xffffff });
        const buoys = [];

        for(let i=0; i < points.length; i++) {
            const pt = points[i];
            const tangent = trackCurve.getTangent(i / points.length);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            const w = CONFIG.trackWidth;

            const buoyL = new THREE.Mesh(buoyGeo, buoyMatLeft);
            buoyL.position.copy(pt).add(normal.clone().multiplyScalar(w));
            scene.add(buoyL);
            buoys.push(buoyL);

            const buoyR = new THREE.Mesh(buoyGeo, buoyMatRight);
            buoyR.position.copy(pt).add(normal.clone().multiplyScalar(-w));
            scene.add(buoyR);
            buoys.push(buoyR);
        }
        return { trackCurve, trackPoints, buoys };
    },

    createStartLine: function(scene, trackCurve) {
        const pt = trackCurve.getPointAt(0);
        const tangent = trackCurve.getTangent(0).normalize();
        const axis = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, tangent);

        const startLineGroup = new THREE.Group();
        startLineGroup.position.copy(pt);
        startLineGroup.applyQuaternion(quaternion);

        const dist = CONFIG.trackWidth * 2.2; 
        const postGeo = new THREE.CylinderGeometry(1.5, 1.5, 50);
        const postMat = new THREE.MeshToonMaterial({ color: 0x444444 });
        const leftPost = new THREE.Mesh(postGeo, postMat); leftPost.position.set(-dist, 10, 0); 
        const rightPost = new THREE.Mesh(postGeo, postMat); rightPost.position.set(dist, 10, 0);

        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,128,32);
        ctx.fillStyle = '#000000';
        for(let y=0; y<2; y++) for(let x=0; x<8; x++) if((x+y)%2===0) ctx.fillRect(x*16, y*16, 16, 16);
        
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 1); 

        const banner = new THREE.Mesh(new THREE.BoxGeometry(dist * 2, 6, 2), new THREE.MeshBasicMaterial({ map: tex }));
        banner.position.set(0, 30, 0);
        startLineGroup.add(leftPost, rightPost, banner);
        scene.add(startLineGroup);
    },

    createEnvironment: function(scene) {
        const waterUniforms = {
            uTime: { value: 0 },
            uPlayerPos: { value: new THREE.Vector3() },
            uSunPosition: { value: new THREE.Vector3(100, 200, 50) },
            uColorDeep: { value: new THREE.Color(0x001e36) },      
            uColorShallow: { value: new THREE.Color(0x006994) }    
        };
        const waterMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(3000, 3000, 256, 256).rotateX(-Math.PI / 2),
            new THREE.ShaderMaterial({
                uniforms: waterUniforms,
                vertexShader: waterVertexShader,
                fragmentShader: waterFragmentShader,
                transparent: true,
                side: THREE.DoubleSide
            })
        );
        scene.add(waterMesh);
        return { waterMesh, waterUniforms };
    },

    createObstacles: function(scene, trackCurve) {
        const obstacles = [];
        const mineGeo = new THREE.DodecahedronGeometry(2.5);
        const mineMat = new THREE.MeshToonMaterial({ color: 0x330000, emissive: 0x550000 }); 
        const spikeGeo = new THREE.ConeGeometry(0.5, 2.5, 8);
        const spikeMat = new THREE.MeshToonMaterial({ color: 0x999999 });

        // Helper to make a Mine
        function createMine() {
            const g = new THREE.Group();
            g.add(new THREE.Mesh(mineGeo, mineMat));
            for(let j=0; j<8; j++) {
                const spike = new THREE.Mesh(spikeGeo, spikeMat);
                const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
                spike.position.copy(dir.multiplyScalar(2.2));
                spike.lookAt(spike.position.clone().add(dir)); 
                g.add(spike);
            }
            return g;
        }

        // Helper to make Floating Driftwood
        const woodGeo = new THREE.CylinderGeometry(0.6, 0.6, 8);
        const woodMat = new THREE.MeshToonMaterial({color: 0x5c4033}); 
        function createDriftwood() {
            const wood = new THREE.Mesh(woodGeo, woodMat);
            wood.rotation.z = Math.PI/2;
            wood.rotation.y = Math.random() * Math.PI;
            return wood;
        }

        for(let i=0; i<40; i++) { // Increased count
            const t = 0.05 + (Math.random() * 0.9); // Avoid start line
            const pt = trackCurve.getPointAt(t);
            const tangent = trackCurve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            // Randomly choose Mine or Wood
            const type = Math.random() > 0.5 ? 'mine' : 'wood';
            const obj = type === 'mine' ? createMine() : createDriftwood();
            
            // Place ON TRACK (random offset within width)
            const offset = (Math.random() - 0.5) * CONFIG.trackWidth * 1.5;
            
            obj.position.copy(pt).add(normal.multiplyScalar(offset));
            obj.userData.t = t;
            obj.userData.radius = type === 'mine' ? 5 : 4;
            obj.userData.type = type;
            
            scene.add(obj);
            obstacles.push(obj);
        }
        return obstacles;
    },

    createDecorations: function(scene, trackPoints) {
        const decorations = [];
        
        // Geometries
        const rockGeo = new THREE.DodecahedronGeometry(10, 0); 
        const coralGeo = new THREE.TorusKnotGeometry(5, 1.5, 64, 8, 2, 3);
        const pillarGeo = new THREE.CylinderGeometry(2, 2, 20, 6);
        
        // Materials
        const rockMat = new THREE.MeshToonMaterial({ color: 0x555555 });
        const coralMat = new THREE.MeshToonMaterial({ color: 0xff7f50 });
        const statueMat = new THREE.MeshToonMaterial({ color: 0x888888 });

        // Seaweed Builder
        const weedGeo = new THREE.PlaneGeometry(4, 20, 2, 8);
        const weedMat = new THREE.MeshBasicMaterial({ color: 0x228b22, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        
        for(let i=0; i<120; i++) { // More objects
            const x = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            
            // Check if too close to track
            let onTrack = false;
            for(let pt of trackPoints) {
                if(new THREE.Vector3(x,0,z).distanceTo(pt) < CONFIG.trackWidth + 30) { onTrack = true; break; }
            }
            if(onTrack) continue;

            // Pick Type
            const rand = Math.random();
            let mesh;
            
            if (rand < 0.4) { // 40% Rocks
                mesh = new THREE.Mesh(rockGeo, rockMat);
                mesh.scale.set(2+Math.random()*3, 2+Math.random()*2, 2+Math.random()*3);
                mesh.userData.type = 'rock';
            } else if (rand < 0.7) { // 30% Coral
                mesh = new THREE.Mesh(coralGeo, coralMat);
                mesh.scale.setScalar(1 + Math.random());
                mesh.position.y = -5;
                mesh.userData.type = 'coral';
            } else if (rand < 0.85) { // 15% Statues
                mesh = new THREE.Mesh(pillarGeo, statueMat);
                mesh.scale.setScalar(2);
                mesh.position.y = 5;
                mesh.userData.type = 'statue';
            } else { // 15% Seaweed Clump
                mesh = new THREE.Group();
                for(let k=0; k<5; k++) {
                   const blade = new THREE.Mesh(weedGeo, weedMat);
                   blade.position.x = (Math.random()-0.5)*5;
                   blade.rotation.y = Math.random() * Math.PI;
                   mesh.add(blade);
                }
                mesh.position.y = 5;
                mesh.userData.type = 'seaweed';
            }

            mesh.position.set(x, 0, z);
            mesh.rotation.set(0, Math.random() * Math.PI, 0); // Only rotate Y for most things
            if(mesh.userData.type === 'rock') mesh.rotation.set(Math.random(), Math.random(), Math.random());

            mesh.userData.radius = 15; 
            scene.add(mesh);
            decorations.push(mesh);
        }
        return decorations;
    },

    createLife: function(scene) {
        const life = { seagulls: [], fishSchools: [], dolphins: [], clouds: [], sharks: [] };
        
        for(let i=0; i<20; i++) { const b = new Seagull(); scene.add(b.mesh); life.seagulls.push(b); }
        for(let i=0; i<10; i++) { const f = new FishSchool(); scene.add(f.mesh); life.fishSchools.push(f); }
        for(let i=0; i<5; i++) { const d = new Dolphin(); scene.add(d.mesh); life.dolphins.push(d); }
        
        const cloudGeo = new THREE.DodecahedronGeometry(25, 0);
        const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        for(let i=0; i<40; i++) {
            const c = new THREE.Mesh(cloudGeo, cloudMat);
            c.position.set((Math.random()-0.5)*2000, 200+Math.random()*100, (Math.random()-0.5)*2000);
            c.scale.set(1+Math.random(), 0.5+Math.random(), 1+Math.random());
            c.userData.velocity = (Math.random()*5)+2;
            scene.add(c);
            life.clouds.push(c);
        }
        return life;
    },

    createSharks: function(scene, trackCurve) {
        const sharks = [];
        for(let i=0; i<8; i++) {
            const shark = new Shark();
            const pt = trackCurve.getPointAt(i / 8);
            shark.center.copy(pt).add(new THREE.Vector3((Math.random()-0.5)*100, 0, (Math.random()-0.5)*100));
            scene.add(shark.mesh);
            sharks.push(shark);
        }
        return sharks;
    }
};