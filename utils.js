// --- UTILITIES & PARTICLES ---

const Utils = {
    getWaterHeight: function(x, z, time) {
        let y = 0;
        y += Math.sin(x * 0.01 + time * 1.0) * 3.0;
        y += Math.cos(z * 0.015 + time * 0.8) * 3.0;
        y += Math.sin(x * 0.03 + time * 1.5) * 1.5;
        y += Math.cos(z * 0.05 + time * 1.2) * 1.5;
        y += Math.sin(x * 0.1 + time * 3.0) * 0.5;
        y += Math.cos(z * 0.12 + time * 2.8) * 0.5;
        return y;
    }
};

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        this.matSpark = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.matSplash = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.matBubble = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
    }

    spawn(position, count, type) {
        const color = type === 'spark' ? 0xffff00 : 0xffffff;
        const size = type === 'spark' ? 1 : 2;
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                pos: position.clone().add(new THREE.Vector3((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2)),
                vel: new THREE.Vector3((Math.random()-0.5)*20, 10+Math.random()*20, (Math.random()-0.5)*20),
                life: 1.0,
                size: size,
                type: type
            });
        }
    }

    update(dt) {
        // Clean up old particle meshes
        this.scene.children = this.scene.children.filter(c => !c.userData.isParticle);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt * 2;
            
            if(p.type === 'bubble') p.vel.y += 10 * dt; 
            else p.vel.y -= 50 * dt; 
            
            p.pos.add(p.vel.clone().multiplyScalar(dt));
            
            if (p.life <= 0 || (p.type !== 'bubble' && p.pos.y < -5)) {
                this.particles.splice(i, 1);
            } else {
                let mat = this.matSplash;
                if(p.type === 'spark') mat = this.matSpark;
                if(p.type === 'bubble') mat = this.matBubble;

                const mesh = new THREE.Mesh(this.geo, mat);
                mesh.position.copy(p.pos);
                mesh.scale.setScalar(p.life * p.size);
                mesh.userData.isParticle = true;
                this.scene.add(mesh);
            }
        }
    }
}