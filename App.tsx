
import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Ruler, Save, Download, RefreshCw, ChevronRight, AlertCircle, Info, Weight, Activity, User } from 'lucide-react';
import { BodyMeasurements } from './types';
import { analyzeBodyImage } from './services/bodyAnalysis';
import ModelViewer, { ModelViewerHandle } from './components/ModelViewer';

const App: React.FC = () => {
  const [step, setStep] = useState<'welcome' | 'input' | 'camera' | 'processing' | 'result'>('welcome');
  const [height, setHeight] = useState<number>(170);
  const [weight, setWeight] = useState<number>(70);
  const [age, setAge] = useState<number>(30);
  const [photo, setPhoto] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelViewerRef = useRef<ModelViewerHandle>(null);

  const handleStart = () => setStep('input');

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('camera');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
        processImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    setStep('processing');
    setIsProcessing(true);
    setError(null);

    try {
      const imageData = base64.split(',')[1];
      const analysis = await analyzeBodyImage(imageData, height, age);
      
      const { measurements: ratios } = analysis;
      
      const scale = height; 
      
      const wWidth = ratios.waistRatio * scale;
      const hWidth = ratios.hipRatio * scale;

      // Estimate circumferences using elliptical approximation
      // Adjust depth factor slightly based on age (older age often means more depth in torso)
      const depthFactor = age > 50 ? 0.78 : 0.75;
      
      const calcCircumference = (width: number) => {
        const a = width / 2;
        const b = (width * depthFactor) / 2;
        const h_approx = Math.pow(a - b, 2) / Math.pow(a + b, 2);
        return Math.round(Math.PI * (a + b) * (1 + (3 * h_approx) / (10 + Math.sqrt(4 - 3 * h_approx))));
      };

      const waistCircum = calcCircumference(wWidth);
      const hipCircum = calcCircumference(hWidth);

      const bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
      const whr = Number((waistCircum / hipCircum).toFixed(2));
      const whtr = Number((waistCircum / height).toFixed(2));

      const finalMeasurements: BodyMeasurements = {
        height,
        weight,
        age,
        waistWidth: ratios.waistRatio * scale / 100,
        hipWidth: ratios.hipRatio * scale / 100,
        shoulderWidth: ratios.shoulderRatio * scale / 100,
        chestWidth: ratios.chestRatio * scale / 100,
        waistCircumference: waistCircum,
        hipCircumference: hipCircum,
        bmi,
        whr,
        whtr
      };

      setMeasurements(finalMeasurements);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al procesar la imagen.");
      setStep('camera');
    } finally {
      setIsProcessing(false);
    }
  };

  const getBMIStatus = (val: number) => {
    if (val < 18.5) return { label: 'BAJO PESO', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' };
    if (val < 25) return { label: 'NORMAL', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' };
    if (val < 30) return { label: 'SOBREPESO', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' };
    return { label: 'OBESIDAD', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' };
  };

  const getWHRStatus = (val: number) => {
    if (val <= 0.85) return { label: 'BAJO RIESGO', color: 'text-green-400' };
    if (val <= 0.95) return { label: 'RIESGO MEDIO', color: 'text-yellow-400' };
    return { label: 'RIESGO ALTO', color: 'text-red-400' };
  };

  const getWHtRStatus = (val: number) => {
    if (val <= 0.5) return { label: 'SALUDABLE', color: 'text-green-400' };
    return { label: 'RIESGO ELEVADO', color: 'text-red-400' };
  };

  const reset = () => {
    setPhoto(null);
    setMeasurements(null);
    setError(null);
    setStep('welcome');
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-6xl mx-auto font-sans">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Body3DMetric
          </h1>
        </div>
        {step !== 'welcome' && (
          <button onClick={reset} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> Reiniciar
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col justify-center items-center">
        {step === 'welcome' && (
          <div className="text-center max-w-lg">
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
              <img 
                src="https://raw.githubusercontent.com/aletrujim/Body3Dmetric/faba062d7909df797d406c27bd53f0373234e341/components/result_Body3DMetric.png" 
                alt="Body Scan Visualization" 
                className="relative rounded-3xl shadow-2xl border border-slate-700 w-full object-cover aspect-square"
              />
            </div>
            <h2 className="text-4xl font-extrabold mb-4 leading-tight">Tu antropometría digital en segundos!</h2>
            <p className="text-slate-400 text-lg mb-8">Crea un modelo 3D y obtén medidas antropométricas usando solo una fotografía frontal.</p>
            <button onClick={handleStart} className="group bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 rounded-full inline-flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-indigo-600/30">
              Comenzar Escaneo <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {step === 'input' && (
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Info className="text-indigo-500" /> Datos Antropométricos
            </h3>
            <form onSubmit={handleInputSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                    <Ruler className="w-4 h-4" /> Altura (cm)
                  </label>
                  <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 px-4 text-xl font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                    <Weight className="w-4 h-4" /> Peso (kg)
                  </label>
                  <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 px-4 text-xl font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-2">
                  <User className="w-4 h-4" /> Edad (años)
                </label>
                <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 px-4 text-xl font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                Siguiente Paso
              </button>
            </form>
          </div>
        )}

        {step === 'camera' && (
          <div className="text-center w-full max-w-2xl">
            <h3 className="text-3xl font-bold mb-4">Captura tu forma corporal</h3>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div className="aspect-square mb-4 bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-indigo-500/30">
                  <img src="https://raw.githubusercontent.com/aletrujim/Body3Dmetric/faba062d7909df797d406c27bd53f0373234e341/components/posture.png" alt="Instrucción Postura" className="opacity-70 object-cover h-full" />
                </div>
                <h4 className="font-bold mb-2 text-indigo-400">Instrucciones</h4>
                <ul className="text-sm text-slate-400 text-left space-y-2">
                  <li className="flex items-start gap-2"><span className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">1</span> Ropa ajustada.</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">2</span> Postura en T (brazos) y A (piernas).</li>
                  <li className="flex items-start gap-2"><span className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">3</span> Fondo neutro.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-800 hover:bg-slate-700 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all p-8 group">
                  <div className="p-4 bg-indigo-600/10 rounded-full group-hover:scale-110 transition-transform"><Upload className="text-indigo-500 w-8 h-8" /></div>
                  <span className="font-bold">Subir Foto</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              </div>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-6"><AlertCircle className="shrink-0" /><p className="text-sm">{error}</p></div>}
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center space-y-8 animate-pulse">
            <div className="relative w-48 h-48 mx-auto">
              <div className="absolute inset-0 border-4 border-indigo-500 rounded-full animate-ping" />
              <div className="absolute inset-0 flex items-center justify-center"><Activity className="w-12 h-12 text-indigo-500" /></div>
            </div>
            <div><h3 className="text-2xl font-bold mb-2">Analizando...</h3><p className="text-slate-400">Estimando reconstrucción 3D y antropometría.</p></div>
          </div>
        )}

        {step === 'result' && measurements && (
          <div className="w-full flex flex-col lg:flex-row gap-8 items-start">
            <div className="w-full lg:flex-1 h-[600px] bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden relative shadow-2xl">
              <ModelViewer ref={modelViewerRef} measurements={measurements} />
              <div className="absolute bottom-6 left-6 flex flex-col gap-2 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 flex flex-col pointer-events-auto">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Datos:</span>
                  <span className="text-lg font-mono text-cyan-400">{measurements.age} años | {measurements.height}cm</span>
                </div>
              </div>
              <div className="absolute bottom-6 right-6 flex gap-2">
                <button onClick={() => modelViewerRef.current?.exportToOBJ()} className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-transform hover:scale-105"><Download className="w-6 h-6" /></button>
              </div>
            </div>

            <div className="w-full lg:w-[400px] space-y-6">
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><Activity className="text-indigo-400 w-5 h-5" /> Resultados</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cintura</label>
                    <div className="flex items-baseline gap-1"><span className="text-2xl font-mono text-white">{measurements.waistCircumference}</span><span className="text-xs text-slate-400">cm</span></div>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cadera</label>
                    <div className="flex items-baseline gap-1"><span className="text-2xl font-mono text-white">{measurements.hipCircumference}</span><span className="text-xs text-slate-400">cm</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  {(() => {
                    const status = getBMIStatus(measurements.bmi);
                    return (
                      <div className={`p-4 rounded-2xl border ${status.bg} ${status.border} flex justify-between items-center`}>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">IMC</label><span className="text-2xl font-mono text-white">{measurements.bmi}</span></div>
                        <div className={`px-3 py-1 text-[10px] font-bold rounded-full border ${status.border} ${status.color}`}>{status.label}</div>
                      </div>
                    );
                  })()}
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 flex justify-between items-center">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">ICC</label><span className="text-2xl font-mono text-white">{measurements.whr}</span></div>
                    <div className={`text-[10px] font-bold ${getWHRStatus(measurements.whr).color}`}>{getWHRStatus(measurements.whr).label}</div>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 flex justify-between items-center">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">ICT</label><span className="text-2xl font-mono text-white">{measurements.whtr}</span></div>
                    <div className={`text-[10px] font-bold ${getWHtRStatus(measurements.whtr).color}`}>{getWHtRStatus(measurements.whtr).label}</div>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 flex justify-between items-center">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Los perímetros y volúmenes son estimados. Estos datos son informativos y no sustituyen una evaluación médica profesional.</label></div>
                  </div>
                </div>
              </div>
              <button onClick={() => setStep('input')} className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Nuevo Escaneo</button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-8 pt-8 border-t border-slate-800 text-slate-500 text-xs text-center">
        <p>&copy; 2025 Body3DMetric. Desarrollado por @aletrujim</p>
      </footer>
    </div>
  );
};

export default App;
