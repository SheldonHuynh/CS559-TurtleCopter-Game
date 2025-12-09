// --- REALISTIC WATER SHADERS ---

const waterVertexShader = `
    uniform float uTime;
    uniform vec3 uPlayerPos;
    varying float vHeight;
    varying vec3 vPos;
    varying vec3 vViewPosition;

    // Wave function to match CPU logic
    float getWaterHeight(vec2 p, float t) {
        float y = 0.0;
        y += sin(p.x * 0.01 + t * 1.0) * 3.0;
        y += cos(p.y * 0.015 + t * 0.8) * 3.0; 
        y += sin(p.x * 0.03 + t * 1.5) * 1.5;
        y += cos(p.y * 0.05 + t * 1.2) * 1.5;
        y += sin(p.x * 0.1 + t * 3.0) * 0.5;
        y += cos(p.y * 0.12 + t * 2.8) * 0.5;
        return y;
    }

    void main() {
        vec3 pos = position;
        
        // Base Waves
        float h = getWaterHeight(pos.xz, uTime);
        
        // Interaction Ripples (Player)
        float d = distance(pos.xz, uPlayerPos.xz);
        float ripple = 0.0;
        // Only affect area near player, fading out
        if(d < 50.0) {
            float intensity = 1.0 - (d / 50.0);
            ripple = sin(d * 1.5 - uTime * 10.0) * 1.5 * intensity;
        }
        h += ripple;

        pos.y += h;

        vPos = (modelMatrix * vec4(pos, 1.0)).xyz;
        vHeight = h;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const waterFragmentShader = `
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform float uTime;
    uniform vec3 uSunPosition;

    varying float vHeight;
    varying vec3 vPos;
    varying vec3 vViewPosition;

    // Simple pseudo-random noise
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main() {
        // 1. Calculate Normal from derivatives + Noise
        vec3 dx = dFdx(vPos);
        vec3 dy = dFdy(vPos);
        vec3 normal = normalize(cross(dx, dy));
        
        // Add surface noise for realism (micro ripples)
        float n = noise(vPos.xz * 0.2 + uTime * 0.5);
        normal.x += (n - 0.5) * 0.2;
        normal.z += (n - 0.5) * 0.2;
        normal = normalize(normal);

        // 2. Base Color mixing (Vertical absorption)
        vec3 viewDir = normalize(vViewPosition);
        vec3 color = mix(uColorDeep, uColorShallow, smoothstep(-5.0, 5.0, vHeight));

        // 3. Specular Highlight (Sun Reflection)
        vec3 lightDir = normalize(uSunPosition);
        vec3 halfVector = normalize(lightDir + viewDir);
        float NdotH = max(0.0, dot(normal, halfVector));
        float specular = pow(NdotH, 100.0); // Sharpness

        // 4. Fresnel Effect (More reflective at angles)
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.0);
        color = mix(color, vec3(0.8, 0.9, 1.0), fresnel * 0.6);

        // Add specular
        color += vec3(1.0) * specular * 0.8;

        gl_FragColor = vec4(color, 0.85); // Slight transparency
    }
`;