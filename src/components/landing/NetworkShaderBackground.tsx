'use client';

import { useEffect, useRef } from 'react';

interface NetworkShaderBackgroundProps {
  className?: string;
}

export default function NetworkShaderBackground({ className = '' }: NetworkShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported');
      return;
    }

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader - flowing nodes and organic waves
    const fragmentShaderSource = `
      precision highp float;
      
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec3 u_color1; // Primary brand color
      uniform vec3 u_color2; // Secondary color
      uniform vec3 u_color3; // Accent color
      
      #define PI 3.14159265359
      #define NUM_NODES 8.0
      
      // Smooth noise function
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      // Fractal Brownian Motion for organic feel
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p * frequency);
          amplitude *= 0.5;
          frequency *= 2.0;
        }
        return value;
      }
      
      // Node positions with flowing motion
      vec2 getNodePos(float id, float time) {
        float angle = id * PI * 2.0 / NUM_NODES + time * 0.1;
        float radius = 0.25 + 0.15 * sin(id * 1.7 + time * 0.3);
        float offsetX = 0.5 + radius * cos(angle + sin(time * 0.2 + id) * 0.5);
        float offsetY = 0.5 + radius * sin(angle + cos(time * 0.15 + id * 0.7) * 0.5);
        return vec2(offsetX, offsetY);
      }
      
      // Connection line with glow
      float connectionLine(vec2 uv, vec2 p1, vec2 p2, float time) {
        vec2 pa = uv - p1;
        vec2 ba = p2 - p1;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float d = length(pa - ba * h);
        
        // Flowing pulse along the connection
        float pulse = sin(h * 10.0 - time * 2.0) * 0.5 + 0.5;
        float intensity = smoothstep(0.008, 0.0, d) * (0.3 + 0.7 * pulse);
        
        return intensity;
      }
      
      // Node glow
      float nodeGlow(vec2 uv, vec2 nodePos, float time, float id) {
        float d = length(uv - nodePos);
        float pulse = sin(time * 1.5 + id * 2.0) * 0.3 + 0.7;
        float glow = smoothstep(0.08, 0.0, d) * pulse;
        float core = smoothstep(0.02, 0.0, d);
        return glow + core * 0.8;
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        float aspect = u_resolution.x / u_resolution.y;
        vec2 uvAspect = vec2(uv.x * aspect, uv.y);
        
        float time = u_time * 0.5;
        
        // Organic wave background
        float wave1 = fbm(uv * 3.0 + time * 0.1);
        float wave2 = fbm(uv * 5.0 - time * 0.15 + 100.0);
        float wave3 = sin(uv.x * 8.0 + time + wave1 * 2.0) * 0.5 + 0.5;
        float wave4 = sin(uv.y * 6.0 - time * 0.7 + wave2 * 2.0) * 0.5 + 0.5;
        
        float wavePattern = mix(wave1, wave2, 0.5) * mix(wave3, wave4, 0.5);
        
        // Base color from waves
        vec3 bgColor = mix(u_color1 * 0.1, u_color2 * 0.15, wavePattern);
        
        // Add flowing gradient
        float gradient = fbm(uv * 2.0 + vec2(time * 0.05, time * 0.08));
        bgColor += u_color3 * gradient * 0.1;
        
        // Calculate nodes and connections
        float totalConnections = 0.0;
        float totalNodes = 0.0;
        
        // Store node positions
        vec2 nodes[8];
        for (int i = 0; i < 8; i++) {
          nodes[i] = getNodePos(float(i), time);
          nodes[i].x *= aspect;
        }
        
        // Draw connections between nearby nodes
        for (int i = 0; i < 8; i++) {
          for (int j = i + 1; j < 8; j++) {
            float dist = length(nodes[i] - nodes[j]);
            if (dist < 0.6) {
              float conn = connectionLine(uvAspect, nodes[i], nodes[j], time);
              float fade = 1.0 - smoothstep(0.3, 0.6, dist);
              totalConnections += conn * fade;
            }
          }
        }
        
        // Draw nodes
        for (int i = 0; i < 8; i++) {
          totalNodes += nodeGlow(uvAspect, nodes[i], time, float(i));
        }
        
        // Combine everything
        vec3 connectionColor = mix(u_color1, u_color2, sin(time * 0.5) * 0.5 + 0.5);
        vec3 nodeColor = u_color3;
        
        vec3 finalColor = bgColor;
        finalColor += connectionColor * totalConnections * 0.6;
        finalColor += nodeColor * totalNodes * 0.8;
        
        // Add subtle vignette
        float vignette = 1.0 - length(uv - 0.5) * 0.8;
        finalColor *= vignette;
        
        // Security/unity pulse from center
        float centerPulse = sin(time * 0.8) * 0.5 + 0.5;
        float centerGlow = smoothstep(0.5, 0.0, length(uv - 0.5)) * centerPulse * 0.15;
        finalColor += u_color1 * centerGlow;
        
        // Ensure we have bright areas for blend mode
        float brightness = (finalColor.r + finalColor.g + finalColor.b) / 3.0;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // Create and compile shaders
    function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    // Create program
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    // Set up geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const color1Location = gl.getUniformLocation(program, 'u_color1');
    const color2Location = gl.getUniformLocation(program, 'u_color2');
    const color3Location = gl.getUniformLocation(program, 'u_color3');

    // Brand colors (olive-grey palette from CSS)
    // Primary: hsl(53, 12%, 38%) -> #6b6a5c
    // These are normalized RGB values
    const color1 = [0.42, 0.42, 0.36]; // Primary brand olive
    const color2 = [0.35, 0.35, 0.30]; // Darker variant
    const color3 = [0.55, 0.54, 0.48]; // Lighter accent

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const startTime = performance.now();

    const render = () => {
      const time = (performance.now() - startTime) / 1000;

      gl.useProgram(program);
      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, time);
      gl.uniform3fv(color1Location, color1);
      gl.uniform3fv(color2Location, color2);
      gl.uniform3fv(color3Location, color3);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
}
