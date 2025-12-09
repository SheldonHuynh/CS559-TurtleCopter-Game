// --- PROCEDURAL AUDIO SYSTEM (HELICOPTER EDITION) ---
// Synthesizes helicopter rotor physics and water effects in real-time.

class AudioSynth {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5; 
        this.masterGain.connect(this.ctx.destination);

        this.initialized = false;
        
        // --- 1. SHARED NOISE BUFFER (Used for Rotor, Splash, Drift) ---
        const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // White noise
        }

        // --- 2. ROTOR "THWOP" SYNTHESIS ---
        // Source: White Noise
        this.rotorSource = this.ctx.createBufferSource();
        this.rotorSource.buffer = this.noiseBuffer;
        this.rotorSource.loop = true;

        // Filter: Lowpass to make it sound like air/wind
        this.rotorFilter = this.ctx.createBiquadFilter();
        this.rotorFilter.type = 'lowpass';
        this.rotorFilter.frequency.value = 150; // Deep thud

        // Gain: This will be pulsed to create the rhythm
        this.rotorGain = this.ctx.createGain();
        this.rotorGain.gain.value = 0; 

        // LFO: The "Chopper" - Modulates the volume of the noise
        this.rotorLFO = this.ctx.createOscillator();
        this.rotorLFO.type = 'sine';
        this.rotorLFO.frequency.value = 4; // Idle speed (4 thwops per second)
        
        // LFO Strength: How distinct the chopping is
        this.lfoGain = this.ctx.createGain();
        this.lfoGain.gain.value = 1.0; 

        // Graph: LFO -> LFO Gain -> Rotor Gain.gain
        this.rotorLFO.connect(this.lfoGain);
        this.lfoGain.connect(this.rotorGain.gain);

        // Graph: Noise -> Filter -> Rotor Gain -> Master
        this.rotorSource.connect(this.rotorFilter);
        this.rotorFilter.connect(this.rotorGain);
        this.rotorGain.connect(this.masterGain);

        this.rotorSource.start();
        this.rotorLFO.start();

        // --- 3. TURBINE WHINE ---
        // A high pitched whine to simulate the jet turbine engine
        this.turbineOsc = this.ctx.createOscillator();
        this.turbineOsc.type = 'triangle';
        this.turbineOsc.frequency.value = 800;
        
        this.turbineGain = this.ctx.createGain();
        this.turbineGain.gain.value = 0; // Starts silent

        this.turbineOsc.connect(this.turbineGain);
        this.turbineGain.connect(this.masterGain);
        this.turbineOsc.start();

        // --- 4. DRIFT (WATER SPRAY) ---
        this.driftSource = this.ctx.createBufferSource();
        this.driftSource.buffer = this.noiseBuffer;
        this.driftSource.loop = true;

        this.driftFilter = this.ctx.createBiquadFilter();
        this.driftFilter.type = 'highpass'; 
        this.driftFilter.frequency.value = 800; // Hissy spray

        this.driftGain = this.ctx.createGain();
        this.driftGain.gain.value = 0;

        this.driftSource.connect(this.driftFilter);
        this.driftFilter.connect(this.driftGain);
        this.driftGain.connect(this.masterGain);
        this.driftSource.start();
    }

    init() {
        if (!this.initialized) {
            this.ctx.resume();
            // Fade in engine volume
            this.rotorGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.0);
            this.turbineGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 1.0);
            this.initialized = true;
        }
    }

    updateEngine(speedRatio) {
        if(!this.initialized) return;
        
        // HELICOPTER LOGIC:
        // 1. Rotor Speed: Goes from 5Hz (idle) to 13Hz (fast)
        const rotorSpeed = 5 + (speedRatio * 8);
        this.rotorLFO.frequency.setTargetAtTime(rotorSpeed, this.ctx.currentTime, 0.1);

        // 2. Rotor Filter: Opens up slightly when fast (louder/brighter)
        this.rotorFilter.frequency.setTargetAtTime(150 + (speedRatio * 100), this.ctx.currentTime, 0.1);

        // 3. Turbine Pitch: Whines higher as you speed up
        this.turbineOsc.frequency.setTargetAtTime(800 + (speedRatio * 400), this.ctx.currentTime, 0.1);
    }

    updateDrift(isDrifting) {
        if(!this.initialized) return;
        const targetVol = isDrifting ? 0.4 : 0.0;
        this.driftGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.2);
    }

    playSfx(type) {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        
        if (type === 'splash') {
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, t);
            filter.frequency.linearRampToValueAtTime(100, t + 1.0);
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.8, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
            
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            src.start();
        } 
        else if (type === 'crash') {
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.7, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            
            src.connect(gain);
            gain.connect(this.masterGain);
            src.start();
        }
        else if (type === 'lap') {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, t); // A5
            osc.frequency.setValueAtTime(1760, t + 0.1); // A6
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.6);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(t + 0.6);
        }
    }
}