
import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BodyMeasurements } from '../types';

interface ModelViewerProps {
  measurements: BodyMeasurements;
}

const ModelViewer: React.FC<ModelViewerProps> = ({ measurements }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    modelGroup: THREE.Group;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const backLight = new THREE.PointLight(0x6366f1, 1);
    backLight.position.set(-5, 2, -5);
    scene.add(backLight);

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
    
    // Clear previous model
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

    // Scale factor: assume 2 meters height fits in the screen nicely at 1 unit = 1 meter
    const scaleFactor = userHeight / 100;
    
    // Create body silhouette points for LatheGeometry
    // These points define the Y, X profile of the body
    const points: THREE.Vector2[] = [];
    const segments = 20;
    
    // Simple parametric mannequin profile based on ratios
    // Height units in meters (0 to scaleFactor)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // normalized height 0 to 1
      const y = t * scaleFactor;
      let x = 0.15; // default radius

      if (t < 0.1) { // Feet/Ankles
        x = 0.08 * scaleFactor;
      } else if (t < 0.45) { // Legs to Hips
        const legT = (t - 0.1) / 0.35;
        x = THREE.MathUtils.lerp(0.08, hipWidth / 2, legT);
      } else if (t < 0.55) { // Waist
        const waistT = (t - 0.45) / 0.1;
        x = THREE.MathUtils.lerp(hipWidth / 2, waistWidth / 2, waistT);
      } else if (t < 0.75) { // Chest
        const chestT = (t - 0.55) / 0.2;
        x = THREE.MathUtils.lerp(waistWidth / 2, chestWidth / 2, chestT);
      } else if (t < 0.9) { // Shoulders/Neck
        const shoulderT = (t - 0.75) / 0.15;
        x = THREE.MathUtils.lerp(shoulderWidth / 2, 0.06 * scaleFactor, shoulderT);
      } else { // Head
        const headT = (t - 0.9) / 0.1;
        x = Math.sqrt(1 - Math.pow((headT - 0.5) * 2, 2)) * 0.1 * scaleFactor;
      }

      points.push(new THREE.Vector2(x, y));
    }

    const geometry = new THREE.LatheGeometry(points, 32);
    // Flatten the body slightly to make it more human-like (less cylindrical)
    geometry.scale(1, 1, 0.7);
    
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x4f46e5, 
      wireframe: true,
      transparent: true,
      opacity: 0.8,
      emissive: 0x1e1b4b
    });
    
    const bodyMesh = new THREE.Mesh(geometry, material);
    modelGroup.add(bodyMesh);

    // Measuring Tapes (Visual Lines)
    const createTape = (yPos: number, radiusX: number, radiusZ: number, label: string) => {
      const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusZ, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(50);
      const tapeGeom = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, yPos, p.y)));
      const tapeMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, linewidth: 2 });
      const tapeLine = new THREE.Line(tapeGeom, tapeMat);
      modelGroup.add(tapeLine);
    };

    // Waist Tape
    createTape(0.5 * scaleFactor, waistWidth / 2 + 0.01, (waistWidth / 2) * 0.7 + 0.01, "Cintura");
    // Hip Tape
    createTape(0.4 * scaleFactor, hipWidth / 2 + 0.01, (hipWidth / 2) * 0.7 + 0.01, "Cadera");

    // Center model
    modelGroup.position.y = -scaleFactor / 2;

  }, [measurements]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        <div className="bg-cyan-500/20 border border-cyan-500/50 backdrop-blur-md px-3 py-1 rounded text-cyan-300 text-sm font-bold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          MODO ESCANEO 3D ACTIVO
        </div>
      </div>
    </div>
  );
};

export default ModelViewer;
