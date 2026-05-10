import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Map as MapIcon, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  MousePointer2, 
  Hand,
  Presentation,
  X,
  Layers,
  Settings,
  CircleHelp,
  Download
} from 'lucide-react';
import { cn } from './lib/utils';

// --- Types ---

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface Scene {
  id: string;
  name: string;
  viewState: ViewState;
}

// --- Constants ---

const INITIAL_VIEW_STATE: ViewState = { x: 0, y: 0, scale: 1 };
const SAMPLE_SVG = `
<svg width="2000" height="2000" viewBox="0 0 2000 2000" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="2000" height="2000" fill="#0f172a"/>
  <circle cx="200" cy="200" r="120" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="4"/>
  <circle cx="200" cy="200" r="40" fill="#3b82f6" />
  
  <rect x="1500" y="200" width="300" height="200" rx="20" fill="#ef4444" fill-opacity="0.2" stroke="#ef4444" stroke-width="4"/>
  <text x="1550" y="320" font-family="sans-serif" font-weight="bold" font-size="40" fill="#ef4444">END ZONE</text>
  
  <polygon points="1000,1000 1200,1400 800,1400" fill="#10b981" fill-opacity="0.3" stroke="#10b981" stroke-width="4" />
  <text x="920" y="1500" font-family="sans-serif" font-size="32" fill="#10b981">THE PYRAMID</text>

  <path d="M200 200 L 1000 1200 L 1650 300" stroke="#475569" stroke-width="4" stroke-dasharray="20 20" fill="none" />
  
  <text x="100" y="1900" font-family="monospace" font-size="24" fill="#475569">SVG ENGINE v1.0 | HIGH PERFORMANCE VECTORS</text>
  <rect x="50" y="50" width="1900" height="1900" stroke="#1e293b" stroke-width="4" fill="transparent" />
</svg>
`;

export default function App() {
  const [svgContent, setSvgContent] = useState<string>(SAMPLE_SVG);
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'edit' | 'present'>('edit');
  const [tool, setTool] = useState<'move' | 'select'>('move');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLinkedImages, setHasLinkedImages] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [svgElementRef, setSvgElementRef] = useState<SVGSVGElement | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement> | DragEvent) => {
    let file: File | undefined;
    setIsDraggingFile(false);
    
    if ('target' in event && (event.target as HTMLInputElement).files) {
      file = (event.target as HTMLInputElement).files?.[0];
    } else if ('dataTransfer' in event && event.dataTransfer?.files) {
      file = event.dataTransfer.files[0];
    }

    if (file) {
      if (!file.name.toLowerCase().endsWith('.svg')) {
        alert('Please upload a .svg file. (.ai files must be exported as SVG from Illustrator)');
        return;
      }
      
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        let text = e.target?.result as string;
        
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'image/svg+xml');
          const svg = doc.querySelector('svg');
          
          if (!svg) {
            alert('Could not find SVG content in this file.');
            setIsLoading(false);
            return;
          }

          // Force responsive and visible
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');
          svg.style.overflow = 'visible';
          svg.style.pointerEvents = 'all';
          
          // Master Unhider: Remove any display:none or visibility:hidden from ANY element
          const hiddenElements = Array.from(svg.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"], [display="none"], [visibility="hidden"]'));
          hiddenElements.forEach(el => {
            (el as HTMLElement).style.display = '';
            (el as HTMLElement).style.visibility = '';
            el.removeAttribute('display');
            el.removeAttribute('visibility');
          });

          // Deep scan for all images including those in defs/patterns
          const allImages = Array.from(svg.querySelectorAll('image'));
          setImageCount(allImages.length);
          
          allImages.forEach(img => {
            const href = img.getAttribute('xlink:href') || img.getAttribute('href');
            if (href) {
              img.setAttribute('href', href);
              img.setAttribute('xlink:href', href); // Keep both for safety
            }
            // Ensure dimension existence
            if (!img.getAttribute('width') || img.getAttribute('width') === '0') img.setAttribute('width', '1000');
            if (!img.getAttribute('height') || img.getAttribute('height') === '0') img.setAttribute('height', '1000');
            
            img.style.opacity = '1';
            img.style.visibility = 'visible';
            img.setAttribute('visibility', 'visible');
            img.removeAttribute('display');
            img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          });

          // Ensure viewBox exists
          if (!svg.getAttribute('viewBox')) {
            const w = svg.getAttribute('width') || '1000';
            const h = svg.getAttribute('height') || '1000';
            svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
          }

          setSvgContent(svg.outerHTML);
          console.log(`SVG Parsed: Found ${allImages.length} images.`);
          
          // Check for linked images
          let linked = false;
          allImages.forEach(img => {
            const href = img.getAttribute('xlink:href') || img.getAttribute('href');
            if (href && (href.startsWith('file:') || (!href.startsWith('data:') && !href.startsWith('http')))) {
              linked = true;
            }
          });
          setHasLinkedImages(linked);

          setTimeout(() => {
            fitToScreen();
            setIsLoading(false);
          }, 300);
          setScenes([]);
          setActiveSceneIndex(null);
        } catch (err) {
          console.error('SVG Parsing failed', err);
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    handleFileUpload(e.nativeEvent);
  };

  const fitToScreen = () => {
    const container = containerRef.current;
    const svgElement = container?.querySelector('svg');
    if (!container || !svgElement) return;

    // Force SVG to have relative dimensions for calculation
    svgElement.style.maxWidth = 'none';
    svgElement.style.maxHeight = 'none';

    const containerRect = container.getBoundingClientRect();
    let svgBBox;
    
    try {
      svgBBox = (svgElement as any).getBBox();
    } catch (e) {
      // Fallback for elements not yet in BBox calculation state
      const w = parseFloat(svgElement.getAttribute('width') || '1000');
      const h = parseFloat(svgElement.getAttribute('height') || '1000');
      svgBBox = { x: 0, y: 0, width: w, height: h };
    }
    
    const padding = 80;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;
    
    const scaleX = availableWidth / svgBBox.width;
    const scaleY = availableHeight / svgBBox.height;
    // Base scale on the smaller dimension to ensure it fits
    const scale = Math.min(scaleX, scaleY, 2); 

    setViewState({
      x: (containerRect.width / 2) - (svgBBox.x + svgBBox.width / 2) * scale,
      y: (containerRect.height / 2) - (svgBBox.y + svgBBox.height / 2) * scale,
      scale: scale
    });
  };

  const bringImagesToFront = () => {
    if (!svgContent) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return;

    const images = svg.querySelectorAll('image');
    images.forEach(img => {
      // Append each image to the end of the root SVG or its parent
      svg.appendChild(img);
    });

    setSvgContent(svg.outerHTML);
  };

  const disableMasks = () => {
    if (!svgContent) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return;

    // Remove all masking and clipping
    const elementsWithMasks = svg.querySelectorAll('[mask], [clip-path]');
    elementsWithMasks.forEach(el => {
      el.removeAttribute('mask');
      el.removeAttribute('clip-path');
    });

    setSvgContent(svg.outerHTML);
  };

  const resetToCenter = () => {
    fitToScreen();
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const exportStandalone = () => {
    if (!svgContent || scenes.length === 0) return;

    const standaloneHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SVG Map Presentation</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #020617; font-family: sans-serif; }
        #viewport { width: 100%; height: 100%; position: relative; }
        #svg-container { position: absolute; top: 0; left: 0; transform-origin: 0 0; transition: transform 1.2s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform; transition-delay: 0.1s; }
        #controls { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px; align-items: center; background: rgba(15, 23, 42, 0.8); padding: 15px 25px; border-radius: 20px; border: 1px solid rgba(51, 65, 85, 0.5); backdrop-filter: blur(10px); z-index: 100; }
        .btn { border: none; background: #6366f1; color: white; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .btn:hover { background: #4f46e5; transform: scale(1.1); }
        .btn:active { transform: scale(0.9); }
        #counter { color: #94a3b8; font-size: 12px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; min-width: 120px; text-align: center; }
        #title-overlay { position: fixed; top: 30px; left: 30px; color: white; background: rgba(15, 23, 42, 0.8); padding: 10px 20px; border-radius: 12px; font-weight: bold; border: 1px solid rgba(51, 65, 85, 0.5); z-index: 50; }
    </style>
</head>
<body>
    <div id="viewport">
        <div id="svg-container">
            ${svgContent}
        </div>
    </div>
    <div id="title-overlay">SVG Presentation Player</div>
    <div id="controls">
        <button class="btn" onclick="prev()">←</button>
        <div id="counter">Scene 1 / ${scenes.length}</div>
        <button class="btn" onclick="next()">→</button>
    </div>

    <script>
        const scenes = ${JSON.stringify(scenes)};
        let currentIdx = 0;
        const container = document.getElementById('svg-container');
        const counter = document.getElementById('counter');

        function update() {
            const scene = scenes[currentIdx];
            container.style.transform = \`translate(\${scene.viewState.x}px, \${scene.viewState.y}px) scale(\${scene.viewState.scale})\`;
            counter.innerText = \`Scene \${currentIdx + 1} / \${scenes.length}\`;
        }

        function next() {
            currentIdx = (currentIdx + 1) % scenes.length;
            update();
        }

        function prev() {
            currentIdx = (currentIdx - 1 + scenes.length) % scenes.length;
            update();
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') next();
            if (e.key === 'ArrowLeft' || e.key === 'Backspace') prev();
        });

        window.onload = () => {
             const svg = container.querySelector('svg');
             if(svg) {
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.overflow = 'visible';
             }
             update();
        };
    </script>
</body>
</html>
    `;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presentation_${new Date().getTime()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool !== 'move') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewState.x, y: e.clientY - viewState.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setViewState(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 0.1;
    const scrollDelta = -e.deltaY;
    const zoomMultiplier = 1 + (scrollDelta > 0 ? scaleFactor : -scaleFactor);
    
    const newScale = Math.max(0.01, Math.min(viewState.scale * zoomMultiplier, 50));
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewState(prev => {
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        x: mouseX - (mouseX - prev.x) * ratio,
        y: mouseY - (mouseY - prev.y) * ratio,
      };
    });
  };

  const addScene = () => {
    const newScene: Scene = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Scene ${scenes.length + 1}`,
      viewState: { ...viewState }
    };
    setScenes([...scenes, newScene]);
    setActiveSceneIndex(scenes.length);
  };

  const deleteScene = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newScenes = scenes.filter(s => s.id !== id);
    setScenes(newScenes);
    if (activeSceneIndex !== null) {
      if (scenes[activeSceneIndex].id === id) setActiveSceneIndex(null);
      else {
        const remainingIdx = newScenes.findIndex(s => s.id === scenes[activeSceneIndex].id);
        setActiveSceneIndex(remainingIdx === -1 ? null : remainingIdx);
      }
    }
  };

  const goToScene = (index: number) => {
    setViewState(scenes[index].viewState);
    setActiveSceneIndex(index);
  };

  const nextScene = () => {
    if (scenes.length === 0) return;
    const nextIdx = (activeSceneIndex === null ? 0 : activeSceneIndex + 1) % scenes.length;
    goToScene(nextIdx);
  };

  const prevScene = () => {
    if (scenes.length === 0) return;
    const prevIdx = (activeSceneIndex === null ? scenes.length - 1 : activeSceneIndex - 1 + scenes.length) % scenes.length;
    goToScene(prevIdx);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'present') {
        if (e.key === 'ArrowRight' || e.key === ' ') nextScene();
        if (e.key === 'ArrowLeft') prevScene();
        if (e.key === 'Escape') setMode('edit');
      } else {
        if (e.key === '+' && !e.ctrlKey) addScene();
        if (e.key === 'p' && e.ctrlKey) {
          e.preventDefault();
          setMode('present');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scenes, activeSceneIndex, mode, viewState]);

  return (
    <div className="flex h-screen w-screen bg-[#020617] text-slate-100 overflow-hidden font-sans">
      
      {/* Action Sidebar */}
      <aside className="w-16 border-r border-slate-800/50 flex flex-col items-center py-6 gap-6 bg-slate-950/80 backdrop-blur-md z-30">
        <div className="flex flex-col gap-3">
          <ToolButton active={tool === 'move'} onClick={() => setTool('move')} icon={<Hand size={20} />} label="Pan Tool (Default)" />
          <ToolButton active={tool === 'select'} onClick={() => setTool('select')} icon={<MousePointer2 size={20} />} label="Inspector Mode" />
        </div>
        <div className="h-px w-8 bg-slate-800" />
        <div className="flex flex-col gap-3">
          <button 
            onClick={triggerUpload}
            className="p-3 rounded-xl hover:bg-slate-800 transition-all cursor-pointer group relative text-blue-400"
          >
            <Upload size={20} />
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".svg,image/svg+xml" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <div className="absolute left-16 bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-2xl uppercase tracking-widest font-bold">Import SVG</div>
          </button>
          
          <button 
            onClick={fitToScreen}
            className="p-3 rounded-xl hover:bg-slate-800 transition-all cursor-pointer group relative text-emerald-400"
          >
            <MapIcon size={20} />
            <div className="absolute left-16 bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-2xl uppercase tracking-widest font-bold">Fit to Screen</div>
          </button>

          <button 
            onClick={bringImagesToFront}
            className="p-3 rounded-xl hover:bg-slate-800 transition-all cursor-pointer group relative text-yellow-400"
          >
            <Layers size={20} />
            <div className="absolute left-16 bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-2xl uppercase tracking-widest font-bold">Bring Images to Front</div>
          </button>

          <button 
            onClick={disableMasks}
            className="p-3 rounded-xl hover:bg-slate-800 transition-all cursor-pointer group relative text-red-400"
          >
            <X size={20} />
            <div className="absolute left-16 bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-2xl uppercase tracking-widest font-bold">Disable Masks/Clips</div>
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-3">
           <button className="p-3 text-slate-500 hover:text-slate-300 transition-colors"><Settings size={20}/></button>
           <button className="p-3 text-slate-500 hover:text-slate-300 transition-colors"><CircleHelp size={20}/></button>
        </div>
      </aside>

      {/* Navigation / Scene List */}
      <aside className="w-80 border-r border-slate-800/50 flex flex-col bg-[#020617]/40 backdrop-blur-2xl z-20">
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
          <div>
            <h1 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Navigation</h1>
            <h2 className="font-bold flex items-center gap-2 text-lg">
              <Layers size={18} className="text-indigo-400" />
              Keyframes
            </h2>
          </div>
          <button 
            onClick={addScene}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-90"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {scenes.length === 0 ? (
            <div className="text-center py-20 text-slate-600 flex flex-col items-center gap-4 transition-all animate-pulse">
              <div className="p-4 rounded-full bg-slate-900/50 border border-slate-800">
                <MapIcon size={40} strokeWidth={1} />
              </div>
              <p className="text-xs uppercase tracking-widest leading-loose">No keyframes defined.<br/>Frame a view and tap +</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scenes.map((scene, idx) => (
                <div 
                  key={scene.id}
                  onClick={() => goToScene(idx)}
                  className={cn(
                    "group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
                    activeSceneIndex === idx 
                      ? "bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.1)] ring-1 ring-indigo-500/20" 
                      : "bg-slate-900/20 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                  )}
                >
                   {/* Background Number */}
                   <span className="absolute -right-2 -bottom-4 text-7xl font-black text-slate-800/20 select-none">{idx + 1}</span>
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Keyframe {idx + 1}</span>
                      <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">{scene.name}</span>
                    </div>
                    <button 
                      onClick={(e) => deleteScene(scene.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all hover:bg-red-400/10 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800 px-4">
          <button 
            disabled={scenes.length < 2}
            onClick={() => setMode('present')}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:grayscale transition-all font-bold tracking-wider uppercase text-xs shadow-xl active:scale-95 mb-3"
          >
            <Presentation size={18} />
            Start Presentation
          </button>

          <button 
            disabled={scenes.length === 0}
            onClick={exportStandalone}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:grayscale transition-all font-bold tracking-wider uppercase text-xs shadow-xl active:scale-95 border border-slate-700"
          >
            <Download size={18} />
            Export Standalone (.html)
          </button>
        </div>
      </aside>

      {/* Viewport */}
      <main className="flex-1 relative bg-slate-950 overflow-hidden flex items-center justify-center">
        
        {/* HUD Overlay */}
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
          <div className="px-4 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 text-[10px] font-black tracking-widest uppercase flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/> Zoom Level</span>
            <span className="text-white">{(viewState.scale * 100).toFixed(0)}%</span>
            <div className="w-px h-3 bg-slate-800 mx-2" />
            <div className="flex items-center gap-2 text-slate-400">
               <Layers size={12} className="text-blue-400" />
               <span>Images: <span className="text-white">{imageCount}</span></span>
            </div>
            <div className="w-px h-3 bg-slate-800 mx-2" />
            <button 
              onClick={resetToCenter}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1"
            >
              <MapIcon size={12} /> Reset View
            </button>
          </div>
        </div>

        <AnimatePresence>
          {hasLinkedImages && (
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-orange-500/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-orange-400 shadow-2xl flex items-center gap-4 text-white pointer-events-auto"
            >
              <div className="bg-white/20 p-2 rounded-full"><CircleHelp size={18} /></div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Linked Images Detected</span>
                <span className="text-[10px] opacity-90">Please use "Embed" in Illustrator before exporting.</span>
              </div>
              <button onClick={() => setHasLinkedImages(false)} className="ml-4 hover:bg-white/10 p-1 rounded-lg"><X size={16}/></button>
            </motion.div>
          )}
          {mode === 'present' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-[#020617] pointer-events-none"
            >
              {/* Virtual Camera Viewport Frame */}
              <div className="absolute inset-10 border border-slate-800/50 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] z-10 pointer-events-none" />
              
              <div className="absolute top-10 left-10 right-10 flex justify-between items-center z-50 pointer-events-auto">
                <button 
                  onClick={() => setMode('edit')}
                  className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-white hover:text-black border border-slate-800 text-white font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Exit Theater
                </button>
                <div className="flex gap-4">
                  <button onClick={prevScene} className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl transition-all active:scale-90"><ChevronLeft size={24}/></button>
                  <button onClick={nextScene} className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl transition-all active:scale-90"><ChevronRight size={24}/></button>
                </div>
              </div>
              
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                <div className="bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-2xl flex items-center gap-6 backdrop-blur-md">
                   <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Step {activeSceneIndex !== null ? activeSceneIndex + 1 : 0} / {scenes.length}</span>
                   <div className="flex gap-2">
                    {scenes.map((s, i) => (
                      <div 
                        key={s.id}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-500",
                          activeSceneIndex === i ? "bg-indigo-500 w-6" : "bg-slate-700"
                        )}
                      />
                    ))}
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Interface */}
        <div 
          ref={containerRef}
          className="w-full h-full relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <AnimatePresence>
            {isDraggingFile && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm flex items-center justify-center pointer-events-none"
              >
                <div className="p-12 rounded-[3rem] border-4 border-dashed border-indigo-400 bg-slate-900 flex flex-col items-center gap-6 shadow-2xl">
                   <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center animate-bounce">
                     <Upload size={40} className="text-white" />
                   </div>
                   <h2 className="text-2xl font-black uppercase tracking-widest text-indigo-400">Drop SVG Here</h2>
                </div>
              </motion.div>
            )}

            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Processing Illustrator paths...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            animate={{
              x: viewState.x,
              y: viewState.y,
              scale: viewState.scale,
            }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 90,
              mass: 1.2
            }}
            style={{ transformOrigin: '0 0' }}
            className="absolute top-0 left-0 will-change-transform"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {/* Cinematic Overlay */}
          <div className="absolute inset-0 pointer-events-none border-[1px] border-slate-800/20" style={{ 
            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.05) 1px, transparent 1px)`,
            backgroundSize: `${50 * viewState.scale}px ${50 * viewState.scale}px`,
            backgroundPosition: `${viewState.x}px ${viewState.y}px`
          }} />
          
          {/* Subtle vignette */}
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.4)]" />
          
          {svgContent === SAMPLE_SVG && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 text-center max-w-sm pointer-events-none">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                 <Upload className="text-blue-400" size={32}/>
              </div>
              <h3 className="text-xl font-bold mb-2">Welcome to Morph Map</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Drag your Illustrator or SVG file here to start creating cinematic transitions.
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs font-black uppercase tracking-widest">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">1. Zoom & Pan</div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">2. Save Scene (+)</div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-2xl transition-all group relative duration-300",
        active 
          ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] scale-105" 
          : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-200"
      )}
    >
      {icon}
      <div className="absolute left-16 bg-slate-900 border border-slate-800 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-2xl uppercase tracking-widest font-bold">{label}</div>
    </button>
  );
}
