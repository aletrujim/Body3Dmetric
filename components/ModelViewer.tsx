
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import { BodyMeasurements } from '../types';

interface ModelViewerProps {
  measurements: BodyMeasurements;
}

export interface ModelViewerHandle {
  exportToOBJ: () => void;
}

const ModelViewer = forwardRef<ModelViewerHandle, ModelViewerProps>(({ measurements }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    modelGroup: THREE.Group;
  } | null>(null);

  // Expose export function to parent
  useImperativeHandle(ref, () => ({
    exportToOBJ: () => {
      if (!sceneRef.current) return;
      const exporter = new OBJExporter();
      const result = exporter.parse(sceneRef.current.modelGroup);
      const blob = new Blob([result], { type: 'text/plain' });
      const link = document.createElement('a');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.href = URL.createObjectURL(blob);
      link.download = 'Body3DMetric_Scan.obj';
      link.click();
      document.body.removeChild(link);
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.2, 3.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 10, 7);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x6366f1, 0.5);
    rimLight.position.set(-5, 5, -5);
    scene.add(rimLight);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    sceneRef.current = { scene, camera, renderer, controls, modelGroup };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { modelGroup } = sceneRef.current;
    
    while (modelGroup.children.length > 0) {
      modelGroup.remove(modelGroup.children[0]);
    }

    const { 
      height: userHeight, 
      shoulderWidth, 
      chestWidth, 
      waistWidth, 
      hipWidth 
    } = measurements;

    const scaleFactor = userHeight / 100;
    
    // Improved Anatomical Silhouette Profile
    const points: THREE.Vector2[] = [];
    
    // Key proportions based on anthropometric landmarks
    const landmarks = [
      { t: 0.00, r: 0.00 },                         // Ground
      { t: 0.10, r: hipWidth * 0.4 },               // Ankle/Base
      { t: 0.35, r: hipWidth * 0.45 },              // Knees area
      { t: 0.45, r: hipWidth * 0.5 },               // Widest Hips
      { t: 0.58, r: waistWidth * 0.5 },             // Narrowest Waist
      { t: 0.72, r: chestWidth * 0.5 },             // Full Chest
      { t: 0.80, r: shoulderWidth * 0.5 },          // Shoulders
      { t: 0.83, r: 0.045 * scaleFactor },          // Neck Base
      { t: 0.86, r: 0.040 * scaleFactor },          // Mid Neck
    ];

    // Smooth spline-like interpolation (linear for simplicity but with higher point density)
    const density = 40;
    for (let i = 0; i <= density; i++) {
      const currentT = i / density;
      
      // Find segments
      let r = 0;
      for (let j = 0; j < landmarks.length - 1; j++) {
        if (currentT >= landmarks[j].t && currentT <= landmarks[j+1].t) {
          const localT = (currentT - landmarks[j].t) / (landmarks[j+1].t - landmarks[j].t);
          r = THREE.MathUtils.lerp(landmarks[j].r, landmarks[j+1].r, localT);
          break;
        }
      }

      // Handle the head separately to ensure it looks like a head
      if (currentT > 0.86) {
        const headT = (currentT - 0.86) / (1.0 - 0.86);
        const headRadius = 0.08 * scaleFactor;
        // Profile of a sphere centered at the top
        r = Math.sqrt(Math.max(0, 1 - Math.pow((headT * 2 - 1), 2))) * headRadius;
        if (isNaN(r)) r = 0.005;
      }
      
      points.push(new THREE.Vector2(r, currentT * scaleFactor));
    }

    const geometry = new THREE.LatheGeometry(points, 48);
    // Depth scaling to differentiate between front/back and side silhouettes
    geometry.scale(1, 1, 0.7);
    
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x6366f1, 
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });

    const mesh = new THREE.Mesh(geometry, material);
    modelGroup.add(mesh);

    // Measuring Tapes (UX Highlights)
    const createTape = (yPos: number, rx: number, rz: number, color: number) => {
      const curve = new THREE.EllipseCurve(0, 0, rx, rz, 0, 2 * Math.PI, false, 0);
      const pts = curve.getPoints(64);
      const tapeGeom = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, yPos, p.y)));
      const tapeMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(tapeGeom, tapeMat);
      modelGroup.add(line);
    };

    // Anatomically placed visual aids
    createTape(0.72 * scaleFactor, (chestWidth / 2) + 0.005, (chestWidth / 2) * 0.7 + 0.005, 0xec4899); // Chest (pink)
    createTape(0.58 * scaleFactor, (waistWidth / 2) + 0.005, (waistWidth / 2) * 0.7 + 0.005, 0x22d3ee); // Waist (cyan)
    createTape(0.45 * scaleFactor, (hipWidth / 2) + 0.005, (hipWidth / 2) * 0.7 + 0.005, 0x818cf8);   // Hips (indigo)

    // Floor Grid
    const grid = new THREE.GridHelper(6, 30, 0x334155, 0x1e293b);
    grid.position.y = 0;
    modelGroup.add(grid);

    // Center the model vertically in the view
    modelGroup.position.y = -0.45 * scaleFactor;

  }, [measurements]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        <div className="bg-indigo-500/20 border border-indigo-500/50 backdrop-blur-md px-3 py-1 rounded text-indigo-300 text-[10px] font-bold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          ANÁLISIS VOLUMÉTRICO REFINADO
        </div>
      </div>
    </div>
  );
});

export default ModelViewer;
