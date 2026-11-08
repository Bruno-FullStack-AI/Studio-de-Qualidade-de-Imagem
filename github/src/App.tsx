/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  Sliders,
  Trash2,
  FolderPlus,
  RefreshCw,
  Check,
  Sun,
  Moon,
  Layers,
  Image as ImageIcon,
  Search,
  Maximize2,
  X,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import {
  EnhancementConfig,
  RepositoryItem,
  BatchQueueItem,
  UPSCAYL_MODELS,
  UpscaylModelId,
} from './types/upscayl';
import {
  processImageUpscayl,
  createLowResSampleInput,
  loadImageElement,
} from './utils/upscaylEngine';
import {
  saveEnhancedPhoto,
  deleteEnhancedPhoto,
  loadAllPhotos,
  subscribeToUserPhotos,
  clearLocalRepoItems,
} from './utils/cloudSync';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  testFirestoreConnection,
} from './firebase/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ImageComparator } from './components/ImageComparator';
import { SelfHostGuide } from './components/SelfHostGuide';

interface SamplePreset {
  id: string;
  title: string;
  category: string;
  src: string;
  recommendedModel: UpscaylModelId;
}

const SAMPLE_PHOTOS: SamplePreset[] = [
  {
    id: 'sample-portrait',
    title: 'Retrato Editorial em Estúdio',
    category: 'Fotografia & Pele',
    src: '/src/assets/images/sample_portrait_studio_1794150700809.jpg',
    recommendedModel: 'realesrgan-x4plus',
  },
  {
    id: 'sample-architecture',
    title: 'Pavilhão Brutalista na Montanha',
    category: 'Arquitetura & Paisagem',
    src: '/src/assets/images/sample_landscape_architecture_1794150701683.jpg',
    recommendedModel: 'remacri',
  },
  {
    id: 'sample-illustration',
    title: 'Ilustração Botânica e Beija-Flor',
    category: 'Arte Digital & Traços',
    src: '/src/assets/images/sample_digital_illustration_1794150702447.jpg',
    recommendedModel: 'realesrgan-x4plus-anime',
  },
];

export default function App() {
  // Theme state synced with <html class="dark">
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Workspace Mode: Single Studio vs Batch Mode
  const [workspaceTab, setWorkspaceTab] = useState<'single' | 'batch'>('single');

  // Active Image State
  const [currentTitle, setCurrentTitle] = useState<string>('Retrato Editorial em Estúdio');
  const [originalDataUrl, setOriginalDataUrl] = useState<string>(SAMPLE_PHOTOS[0].src);
  const [upscaledDataUrl, setUpscaledDataUrl] = useState<string>(SAMPLE_PHOTOS[0].src);
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number }>({
    width: 640,
    height: 480,
  });
  const [upscaledDims, setUpscaledDims] = useState<{ width: number; height: number }>({
    width: 2560,
    height: 1920,
  });
  const [lastProcessingMs, setLastProcessingMs] = useState<number>(140);
  const [lastFileSizeKb, setLastFileSizeKb] = useState<number>(820);

  // Processing & Error State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stageLabel, setStageLabel] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  // Enhancement Configuration
  const [config, setConfig] = useState<EnhancementConfig>({
    modelId: 'realesrgan-x4plus',
    scaleFactor: 4,
    doubleUpscayl: false,
    exportFormat: 'png',
    compressionQuality: 94,
    sharpenOverride: 55,
    denoiseOverride: 40,
    microContrastOverride: 30,
    colorBalanceOverride: 5,
    brightnessOverride: 0,
  });

  // Personal Repository State (IndexedDB)
  const [repoItems, setRepoItems] = useState<RepositoryItem[]>([]);
  const [repoSearch, setRepoSearch] = useState<string>('');
  const [repoModelFilter, setRepoModelFilter] = useState<string>('all');
  const [lightboxItem, setLightboxItem] = useState<RepositoryItem | null>(null);

  // Batch Queue State
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // Firebase User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // File Inputs
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const importRepoInputRef = useRef<HTMLInputElement>(null);

  // Test Firestore connection on mount
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen to Firebase Auth state and sync photos
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);

      if (user) {
        // Subscribe to live changes in Firestore
        const unsubPhotos = subscribeToUserPhotos(user.uid, (cloudItems) => {
          if (cloudItems.length > 0) {
            setRepoItems(cloudItems);
          }
        });
        const all = await loadAllPhotos();
        setRepoItems(all);
        return () => unsubPhotos();
      } else {
        const all = await loadAllPhotos();
        setRepoItems(all);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Run Upscayl enhancement pipeline on current image
  const runEnhancement = useCallback(
    async (
      srcUrl: string,
      activeConfig: EnhancementConfig,
      autoSaveToRepo = false,
      titleForRepo = currentTitle,
      knownOrigW = originalDims.width,
      knownOrigH = originalDims.height
    ) => {
      if (!srcUrl) return;
      setIsProcessing(true);
      setErrorMessage(null);
      setProgress(5);
      setStageLabel('Iniciando pipeline Upscayl Web...');

      try {
        const result = await processImageUpscayl(
          srcUrl,
          activeConfig,
          (pct, label) => {
            setProgress(pct);
            setStageLabel(label);
          }
        );

        setUpscaledDataUrl(result.dataUrl);
        setUpscaledDims({ width: result.width, height: result.height });
        setLastProcessingMs(result.processingTimeMs);
        setLastFileSizeKb(result.fileSizeEstimateKb);

        if (autoSaveToRepo) {
          const modelObj =
            UPSCAYL_MODELS.find((m) => m.id === activeConfig.modelId) ||
            UPSCAYL_MODELS[0];
          const effectiveScale = activeConfig.doubleUpscayl
            ? activeConfig.scaleFactor * 2
            : activeConfig.scaleFactor;

          const newItem: RepositoryItem = {
            id: `upscayl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: titleForRepo || 'Foto Melhorada',
            originalDataUrl: srcUrl,
            upscaledDataUrl: result.dataUrl,
            originalWidth: knownOrigW,
            originalHeight: knownOrigH,
            upscaledWidth: result.width,
            upscaledHeight: result.height,
            modelId: activeConfig.modelId,
            modelName: modelObj.name,
            scaleFactor: effectiveScale,
            exportFormat: activeConfig.exportFormat,
            processingTimeMs: result.processingTimeMs,
            createdAt: new Date().toISOString(),
            fileSizeEstimateKb: result.fileSizeEstimateKb,
            tags: [modelObj.subtitle, `${effectiveScale}x`],
          };
          await saveEnhancedPhoto(newItem);
          const updated = await loadAllPhotos();
          setRepoItems(updated);
          setSavedNotice(true);
          setTimeout(() => setSavedNotice(false), 2500);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao processar imagem';
        console.error('Erro ao processar imagem:', err);
        setErrorMessage(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [currentTitle, originalDims.height, originalDims.width]
  );

  // Load sample photo with authentic degradation to showcase super-resolution
  const loadSamplePhoto = useCallback(
    async (sample: SamplePreset) => {
      setIsProcessing(true);
      setErrorMessage(null);
      setProgress(10);
      setStageLabel(`Carregando amostra: ${sample.title}...`);
      try {
        const lowRes = await createLowResSampleInput(sample.src, 2.6);
        setCurrentTitle(sample.title);
        setOriginalDataUrl(lowRes.dataUrl);
        setOriginalDims({ width: lowRes.width, height: lowRes.height });

        const nextConfig: EnhancementConfig = {
          ...config,
          modelId: sample.recommendedModel,
        };
        setConfig(nextConfig);

        const result = await processImageUpscayl(
          lowRes.dataUrl,
          nextConfig,
          (pct, label) => {
            setProgress(pct);
            setStageLabel(label);
          }
        );
        setUpscaledDataUrl(result.dataUrl);
        setUpscaledDims({ width: result.width, height: result.height });
        setLastProcessingMs(result.processingTimeMs);
        setLastFileSizeKb(result.fileSizeEstimateKb);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar amostra';
        console.error('Erro ao carregar amostra:', err);
        setErrorMessage(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [config]
  );

  useEffect(() => {
    loadSamplePhoto(SAMPLE_PHOTOS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Single File Upload
  const handleSingleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      try {
        const img = await loadImageElement(dataUrl);
        const maxInputDim = 1200;
        let w = img.naturalWidth || 640;
        let h = img.naturalHeight || 480;
        let normalizedDataUrl = dataUrl;

        if (Math.max(w, h) > maxInputDim) {
          const ratio = maxInputDim / Math.max(w, h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          normalizedDataUrl = c.toDataURL('image/png');
        }

        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setCurrentTitle(cleanName);
        setOriginalDataUrl(normalizedDataUrl);
        setOriginalDims({ width: w, height: h });
        setWorkspaceTab('single');

        await runEnhancement(normalizedDataUrl, config, true, cleanName, w, h);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao ler imagem enviada';
        console.error('Erro ao ler imagem:', err);
        setErrorMessage(msg);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save current result to Personal Repository manually
  const handleSaveCurrentToRepo = async () => {
    if (!originalDataUrl || !upscaledDataUrl) return;
    const modelObj =
      UPSCAYL_MODELS.find((m) => m.id === config.modelId) || UPSCAYL_MODELS[0];
    const effectiveScale = config.doubleUpscayl
      ? config.scaleFactor * 2
      : config.scaleFactor;

    const newItem: RepositoryItem = {
      id: `upscayl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: currentTitle || 'Foto Restaurada',
      originalDataUrl,
      upscaledDataUrl,
      originalWidth: originalDims.width,
      originalHeight: originalDims.height,
      upscaledWidth: upscaledDims.width,
      upscaledHeight: upscaledDims.height,
      modelId: config.modelId,
      modelName: modelObj.name,
      scaleFactor: effectiveScale,
      exportFormat: config.exportFormat,
      processingTimeMs: lastProcessingMs,
      createdAt: new Date().toISOString(),
      fileSizeEstimateKb: lastFileSizeKb,
      tags: [modelObj.subtitle, `${effectiveScale}x`],
    };
    await saveEnhancedPhoto(newItem);
    const updated = await loadAllPhotos();
    setRepoItems(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  // Download current enhanced image
  const handleDownloadCurrent = () => {
    if (!upscaledDataUrl) return;
    const link = document.createElement('a');
    const ext = config.exportFormat === 'jpeg' ? 'jpg' : config.exportFormat;
    const safeName = (currentTitle || 'upscayl-image')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-');
    link.download = `${safeName}-upscayl-${config.scaleFactor}x.${ext}`;
    link.href = upscaledDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Batch Files Selection
  const handleBatchFilesSelect = async (files: FileList) => {
    const newItems: BatchQueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = (ev) => resolve((ev.target?.result as string) || '');
        r.readAsDataURL(f);
      });
      if (!dataUrl) continue;
      try {
        const img = await loadImageElement(dataUrl);
        newItems.push({
          id: `batch-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name.replace(/\.[^/.]+$/, ''),
          originalDataUrl: dataUrl,
          originalWidth: img.naturalWidth || 640,
          originalHeight: img.naturalHeight || 480,
          status: 'queued',
          progress: 0,
        });
      } catch {
        // skip invalid image
      }
    }
    setBatchQueue((prev) => [...prev, ...newItems]);
  };

  // Execute Batch Upscayl Queue
  const runBatchQueue = async () => {
    if (isBatchRunning || batchQueue.length === 0) return;
    setIsBatchRunning(true);

    const modelObj =
      UPSCAYL_MODELS.find((m) => m.id === config.modelId) || UPSCAYL_MODELS[0];

    for (let i = 0; i < batchQueue.length; i++) {
      const item = batchQueue[i];
      if (item.status === 'completed') continue;

      setBatchQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: 'processing', progress: 15 } : q
        )
      );

      try {
        const res = await processImageUpscayl(
          item.originalDataUrl,
          config,
          (pct) => {
            setBatchQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, progress: pct } : q))
            );
          }
        );

        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'completed',
                  progress: 100,
                  upscaledDataUrl: res.dataUrl,
                  upscaledWidth: res.width,
                  upscaledHeight: res.height,
                  processingTimeMs: res.processingTimeMs,
                }
              : q
          )
        );

        // Save each completed batch photo into user's personal repository
        const repoEntry: RepositoryItem = {
          id: `repo-${item.id}`,
          title: item.name,
          originalDataUrl: item.originalDataUrl,
          upscaledDataUrl: res.dataUrl,
          originalWidth: item.originalWidth,
          originalHeight: item.originalHeight,
          upscaledWidth: res.width,
          upscaledHeight: res.height,
          modelId: config.modelId,
          modelName: modelObj.name,
          scaleFactor: config.scaleFactor,
          exportFormat: config.exportFormat,
          processingTimeMs: res.processingTimeMs,
          createdAt: new Date().toISOString(),
          fileSizeEstimateKb: res.fileSizeEstimateKb,
          tags: ['Lote', modelObj.subtitle],
        };
        await saveEnhancedPhoto(repoEntry);
      } catch {
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', errorMessage: 'Erro ao processar' }
              : q
          )
        );
      }
    }

    const updatedRepo = await loadAllPhotos();
    setRepoItems(updatedRepo);
    setIsBatchRunning(false);
  };

  // Export Personal Repository JSON Manifest
  const handleExportRepoBackup = () => {
    const payload = {
      repositoryName: 'Meu Repositório Pessoal Upscayl Studio Web',
      exportedAt: new Date().toISOString(),
      totalPhotos: repoItems.length,
      items: repoItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meu-repositorio-upscayl-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Personal Repository JSON Manifest
  const handleImportRepoBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse((e.target?.result as string) || '{}');
        const list: RepositoryItem[] = Array.isArray(parsed.items)
          ? parsed.items
          : Array.isArray(parsed)
          ? parsed
          : [];
        for (const item of list) {
          if (item && item.id && item.upscaledDataUrl) {
            await saveEnhancedPhoto(item);
          }
        }
        const updated = await loadAllPhotos();
        setRepoItems(updated);
      } catch (err) {
        console.error('Erro ao importar backup do repositório:', err);
      }
    };
    reader.readAsText(file);
  };

  const activeModelObj =
    UPSCAYL_MODELS.find((m) => m.id === config.modelId) || UPSCAYL_MODELS[0];

  const filteredRepoItems = repoItems.filter((item) => {
    const matchesSearch =
      !repoSearch.trim() ||
      item.title.toLowerCase().includes(repoSearch.toLowerCase()) ||
      item.modelName.toLowerCase().includes(repoSearch.toLowerCase());
    const matchesModel =
      repoModelFilter === 'all' || item.modelId === repoModelFilter;
    return matchesSearch && matchesModel;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Hidden File Inputs */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleSingleFileSelect(f);
          e.target.value = '';
        }}
      />
      <input
        ref={batchFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleBatchFilesSelect(e.target.files);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={importRepoInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportRepoBackup(f);
          e.target.value = '';
        }}
      />

      {/* TOP BAR CONTRACT: Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-4 bg-white/90 dark:bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#estacao-upscayl"
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 font-display flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Upscayl Studio Web</span>
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a
            href="#estacao-upscayl"
            onClick={() => setWorkspaceTab('single')}
            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Estúdio Upscayl
          </a>
          <a
            href="#estacao-upscayl"
            onClick={() => setWorkspaceTab('batch')}
            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Lote Ilimitado
          </a>
          <a
            href="#meu-repositorio-fotos"
            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Meu Repositório ({repoItems.length})
          </a>
          <a
            href="#meu-repositorio-github"
            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Auto-Hospedagem
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => singleFileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            Enviar Foto Agora
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">
        {/* SECTION 1: WORKSPACE STUDIO & HERO BAR */}
        <section id="estacao-upscayl" className="max-w-7xl mx-auto px-6 pt-8 pb-12">
          {/* Compact Studio Header & Mode Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>Motor Web Real-ESRGAN / Remacri</span>
                <span aria-hidden="true">·</span>
                <span>100% Gratuito e Ilimitado</span>
                <span aria-hidden="true">·</span>
                <span>Sem necessidade de GPU Vulkan</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Melhore e amplie suas fotos com qualidade de estúdio no seu próprio site
              </h1>
            </div>

            {/* Interactive Workspace Controls (Mode Tabs + Theme Toggle) */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-[#151D30] rounded-lg border border-slate-300/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('single')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    workspaceTab === 'single'
                      ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Imagem Única
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('batch')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    workspaceTab === 'batch'
                      ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Processamento em Lote ({batchQueue.length})
                </button>
              </div>

              {/* Firebase Cloud Sync Auth Button */}
              {!isAuthLoading && (
                currentUser ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#151D30] border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Conectado ao Firebase" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[140px] truncate">
                      {currentUser.displayName || currentUser.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => logoutUser()}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-white underline cursor-pointer ml-1"
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => loginWithGoogle()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-[#151D30] border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                  >
                    <span>Sincronizar com Google</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setIsDark((d) => !d)}
                title={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-[#151D30] border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Modo Claro
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                    Modo Escuro
                  </>
                )}
              </button>
            </div>
          </div>

          {/* WORKSPACE VIEW: SINGLE IMAGE STUDIO */}
          {workspaceTab === 'single' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* LEFT SIDEBAR: Upscayl Model & Parameter Controls */}
              <aside className="lg:col-span-4 flex flex-col justify-between bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6 shadow-xs">
                <div className="space-y-6">
                  {/* Step 1: Select or Drop Image */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-900 dark:text-white">
                        1. Selecionar Imagem
                      </label>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        PNG · JPG · WEBP
                      </span>
                    </div>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleSingleFileSelect(f);
                      }}
                      onClick={() => singleFileInputRef.current?.click()}
                      className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/70 dark:bg-[#0D121F] rounded-lg p-4 text-center cursor-pointer transition-colors"
                    >
                      <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Clique ou arraste sua foto aqui
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Ativa: {currentTitle}
                      </p>
                    </div>

                    {/* Built-in Test Presets */}
                    <div className="mt-3">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                        Ou teste com amostras de referência:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {SAMPLE_PHOTOS.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => loadSamplePhoto(s)}
                            className={`text-left p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              currentTitle === s.title
                                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <img
                              src={s.src}
                              alt={s.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-11 object-cover rounded mb-1"
                            />
                            <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                              {s.title.split(' ')[0]}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Select Upscayl Neural Profile */}
                  <div>
                    <label
                      htmlFor="upscayl-model-select"
                      className="block text-xs font-semibold text-slate-900 dark:text-white mb-2"
                    >
                      2. Modelo de Super-Resolução Upscayl
                    </label>
                    <select
                      id="upscayl-model-select"
                      value={config.modelId}
                      onChange={(e) => {
                        const newModelId = e.target.value as UpscaylModelId;
                        const nextConfig = { ...config, modelId: newModelId };
                        setConfig(nextConfig);
                        runEnhancement(originalDataUrl, nextConfig, false);
                      }}
                      className="w-full px-3 py-2.5 text-xs font-medium bg-slate-50 dark:bg-[#0D121F] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      {UPSCAYL_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.subtitle}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {activeModelObj.description}
                    </p>
                  </div>

                  {/* Step 3: Scale Factor & Double Upscayl */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-900 dark:text-white">
                        3. Escala de Ampliação
                      </label>
                      <span className="text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        Saída: {upscaledDims.width}×{upscaledDims.height} px
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {([1, 2, 3, 4] as const).map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => {
                            const nextConfig = { ...config, scaleFactor: scale };
                            setConfig(nextConfig);
                            runEnhancement(originalDataUrl, nextConfig, false);
                          }}
                          className={`py-2 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                            config.scaleFactor === scale
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 dark:bg-[#0D121F] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          {scale}x {scale === 1 ? '(Restaurar)' : ''}
                        </button>
                      ))}
                    </div>

                    {/* Double Upscayl Toggle */}
                    <label className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 cursor-pointer">
                      <div>
                        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Duplo Upscayl (Ultra Definição)
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          Aplica passagem dupla de reconstrução de bordas
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.doubleUpscayl}
                        onChange={(e) => {
                          const nextConfig = {
                            ...config,
                            doubleUpscayl: e.target.checked,
                          };
                          setConfig(nextConfig);
                          runEnhancement(originalDataUrl, nextConfig, false);
                        }}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Step 4: Fine-Tuning Sliders */}
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                        <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Ajuste Fino de Restauração
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const resetCfg: EnhancementConfig = {
                            ...config,
                            sharpenOverride: 55,
                            denoiseOverride: 40,
                            microContrastOverride: 30,
                            colorBalanceOverride: 5,
                            brightnessOverride: 0,
                          };
                          setConfig(resetCfg);
                          runEnhancement(originalDataUrl, resetCfg, false);
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
                      >
                        Padrão
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-400">
                          Nitidez de Bordas (Acutância)
                        </span>
                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {config.sharpenOverride}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={config.sharpenOverride}
                        onChange={(e) => {
                          const nextCfg = { ...config, sharpenOverride: Number(e.target.value) };
                          setConfig(nextCfg);
                        }}
                        onMouseUp={() => runEnhancement(originalDataUrl, config, false)}
                        onTouchEnd={() => runEnhancement(originalDataUrl, config, false)}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-400">
                          Redução de Ruído / Artefatos JPEG
                        </span>
                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {config.denoiseOverride}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={config.denoiseOverride}
                        onChange={(e) => {
                          const nextCfg = { ...config, denoiseOverride: Number(e.target.value) };
                          setConfig(nextCfg);
                        }}
                        onMouseUp={() => runEnhancement(originalDataUrl, config, false)}
                        onTouchEnd={() => runEnhancement(originalDataUrl, config, false)}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-400">
                          Micro-Contraste e Textura
                        </span>
                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {config.microContrastOverride}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={config.microContrastOverride}
                        onChange={(e) => {
                          const nextCfg = { ...config, microContrastOverride: Number(e.target.value) };
                          setConfig(nextCfg);
                        }}
                        onMouseUp={() => runEnhancement(originalDataUrl, config, false)}
                        onTouchEnd={() => runEnhancement(originalDataUrl, config, false)}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Format Selector */}
                    <div className="pt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        Formato de Saída:
                      </span>
                      <div className="flex items-center gap-1">
                        {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => {
                              const nextCfg = { ...config, exportFormat: fmt };
                              setConfig(nextCfg);
                              runEnhancement(originalDataUrl, nextCfg, false);
                            }}
                            className={`px-2.5 py-1 text-xs font-mono uppercase rounded border transition-colors cursor-pointer ${
                              config.exportFormat === fmt
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white font-semibold'
                                : 'bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => runEnhancement(originalDataUrl, config, false)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`}
                    />
                    {isProcessing
                      ? 'Processando Melhoria...'
                      : 'Aplicar Upscayl Agora'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCurrentToRepo}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {savedNotice ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          Salvo na Galeria!
                        </>
                      ) : (
                        <>
                          <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          Salvar no Repositório
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadCurrent}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                    >
                      <Download className="w-4 h-4" />
                      Baixar ({lastFileSizeKb} KB)
                    </button>
                  </div>
                </div>
              </aside>

              {/* RIGHT VIEWPORT: Interactive Before / After Split & Loupe Canvas */}
              <div className="lg:col-span-8 flex flex-col">
                <ImageComparator
                  originalUrl={originalDataUrl}
                  upscaledUrl={upscaledDataUrl}
                  originalWidth={originalDims.width}
                  originalHeight={originalDims.height}
                  upscaledWidth={upscaledDims.width}
                  upscaledHeight={upscaledDims.height}
                  modelName={activeModelObj.name}
                  scaleFactor={
                    config.doubleUpscayl
                      ? config.scaleFactor * 2
                      : config.scaleFactor
                  }
                  isProcessing={isProcessing}
                  progress={progress}
                  stageLabel={stageLabel}
                  errorMessage={errorMessage}
                />
              </div>
            </div>
          ) : (
            /* WORKSPACE VIEW: UNLIMITED BATCH PROCESSING */
            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Processamento em Lote Ilimitado (Modo Pasta Upscayl)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Adicione quantas fotos quiser para melhorar todas de uma só vez e salvar automaticamente no seu repositório pessoal.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => batchFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Adicionar Várias Fotos
                  </button>
                  <button
                    type="button"
                    disabled={isBatchRunning || batchQueue.length === 0}
                    onClick={runBatchQueue}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isBatchRunning ? 'animate-spin' : ''}`}
                    />
                    {isBatchRunning
                      ? 'Processando Lote...'
                      : 'Iniciar Melhoria em Lote'}
                  </button>
                </div>
              </div>

              {batchQueue.length === 0 ? (
                <div
                  onClick={() => batchFileInputRef.current?.click()}
                  className="py-16 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <Layers className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Nenhuma foto na fila de lote ainda
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Clique aqui para selecionar múltiplas imagens do seu computador ou celular
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-3">Foto</th>
                        <th className="py-2.5 px-3">Resolução Original</th>
                        <th className="py-2.5 px-3">Resolução Upscayl</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {batchQueue.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                        >
                          <td className="py-2.5 px-3 flex items-center gap-3">
                            <img
                              src={item.upscaledDataUrl || item.originalDataUrl}
                              alt={item.name}
                              className="w-10 h-10 object-cover rounded border border-slate-200 dark:border-slate-700"
                            />
                            <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                              {item.name}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {item.originalWidth}×{item.originalHeight} px
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-blue-600 dark:text-blue-400">
                            {item.upscaledWidth
                              ? `${item.upscaledWidth}×${item.upscaledHeight} px`
                              : `${item.originalWidth * config.scaleFactor}×${
                                  item.originalHeight * config.scaleFactor
                                } px (previsto)`}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            {item.status === 'queued' && (
                              <span className="text-slate-500">Aguardando na fila</span>
                            )}
                            {item.status === 'processing' && (
                              <span className="text-amber-500 font-semibold">
                                Processando ({item.progress}%)
                              </span>
                            )}
                            {item.status === 'completed' && (
                              <span className="text-emerald-500 font-semibold">
                                Concluído ({item.processingTimeMs} ms)
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-rose-500 font-semibold">
                                {item.errorMessage || 'Erro'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2">
                            {item.upscaledDataUrl && (
                              <a
                                href={item.upscaledDataUrl}
                                download={`${item.name}-upscayl-${config.scaleFactor}x.${config.exportFormat}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Baixar
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setBatchQueue((prev) =>
                                  prev.filter((q) => q.id !== item.id)
                                )
                              }
                              className="inline-flex items-center p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                              title="Remover da fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Full-width KPI / Capability Strip below workspace split */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Tempo da Última Melhoria
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {lastProcessingMs} ms
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Processado direto no navegador sem fila externa
              </div>
            </div>

            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Ganho de Densidade de Pixels
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
                {(config.doubleUpscayl
                  ? config.scaleFactor * 2
                  : config.scaleFactor) ** 2}
                x mais pixels
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                De {originalDims.width}×{originalDims.height} para{' '}
                {upscaledDims.width}×{upscaledDims.height}
              </div>
            </div>

            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Fotos Salvas no Seu Repositório
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {repoItems.length} arquivos
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Banco local IndexedDB persistente e exportável
              </div>
            </div>

            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Custo & Limite de Uso
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                R$ 0 · Ilimitado
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Código aberto pronto para seu GitHub pessoal
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: PERSONAL PHOTO REPOSITORY (INDEXEDDB PERSISTENT GALLERY) */}
        <section
          id="meu-repositorio-fotos"
          className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 dark:border-slate-800/80"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">
                02. Galeria e Repositório Pessoal de Fotos Melhoradas
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Meu Repositório de Imagens
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Todas as fotos que você envia ou salva ficam guardadas no banco de dados do seu navegador e podem ser baixadas ou exportadas a qualquer momento.
              </p>
            </div>

            {/* Repository Actions: Export / Import / Clear */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportRepoBackup}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                Exportar Backup (.JSON)
              </button>
              <button
                type="button"
                onClick={() => importRepoInputRef.current?.click()}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                Importar Repositório
              </button>
              {repoItems.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await clearLocalRepoItems();
                    setRepoItems([]);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Limpar Galeria
                </button>
              )}
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                placeholder="Buscar foto pelo nome ou modelo Upscayl..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            {/* Interactive Model Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-[#111726] rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRepoModelFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  repoModelFilter === 'all'
                    ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos ({repoItems.length})
              </button>
              {UPSCAYL_MODELS.slice(0, 4).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRepoModelFilter(m.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    repoModelFilter === m.id
                      ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Repository Grid or Empty State */}
          {filteredRepoItems.length === 0 ? (
            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center max-w-2xl mx-auto shadow-xs">
              <FolderPlus className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Seu repositório pessoal está pronto para receber suas fotos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Clique em &ldquo;Salvar no Repositório&rdquo; no estúdio acima ou envie uma foto do seu dispositivo para criar sua coleção particular de imagens restauradas em alta resolução.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveCurrentToRepo}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Salvar Foto Atual no Repositório
                </button>
                <button
                  type="button"
                  onClick={() => singleFileInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Enviar Nova Foto
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRepoItems.map((item) => (
                <article
                  key={item.id}
                  className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between group shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div>
                    {/* Thumbnail Preview */}
                    <div
                      onClick={() => setLightboxItem(item)}
                      className="relative h-52 bg-slate-100 dark:bg-slate-900 overflow-hidden cursor-pointer"
                    >
                      <img
                        src={item.upscaledDataUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                        <span className="text-xs text-white font-medium flex items-center gap-1">
                          <Maximize2 className="w-3.5 h-3.5" />
                          Inspecionar em Tela Cheia
                        </span>
                      </div>
                    </div>

                    {/* Card Content: Leads directly with Title & Clean Unboxed Metadata */}
                    <div className="p-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        <span>
                          {item.originalWidth}×{item.originalHeight} →{' '}
                          <strong className="text-blue-600 dark:text-blue-400">
                            {item.upscaledWidth}×{item.upscaledHeight}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.scaleFactor}x</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.fileSizeEstimateKb} KB</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate">{item.modelName}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-[#0D121F]">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTitle(item.title);
                        setOriginalDataUrl(item.originalDataUrl);
                        setUpscaledDataUrl(item.upscaledDataUrl);
                        setOriginalDims({
                          width: item.originalWidth,
                          height: item.originalHeight,
                        });
                        setUpscaledDims({
                          width: item.upscaledWidth,
                          height: item.upscaledHeight,
                        });
                        setWorkspaceTab('single');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Abrir no Estúdio
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <a
                        href={item.upscaledDataUrl}
                        download={`${item.title}-upscayl-${item.scaleFactor}x.${item.exportFormat}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Baixar
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteEnhancedPhoto(item.id);
                          setRepoItems((prev) =>
                            prev.filter((r) => r.id !== item.id)
                          );
                        }}
                        title="Excluir do repositório"
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: GITHUB REPOSITORY & SELF-HOSTING GUIDE */}
        <SelfHostGuide
          onExportRepoBackup={handleExportRepoBackup}
          repoItemCount={repoItems.length}
        />
      </main>

      {/* FULLSCREEN LIGHTBOX MODAL FOR REPOSITORY ITEMS */}
      {lightboxItem && (
        <div
          onClick={() => setLightboxItem(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl w-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lightboxItem.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  <span>{lightboxItem.modelName}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {lightboxItem.upscaledWidth}×{lightboxItem.upscaledHeight} px (
                    {lightboxItem.scaleFactor}x)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={lightboxItem.upscaledDataUrl}
                  download={`${lightboxItem.title}-upscayl-${lightboxItem.scaleFactor}x.${lightboxItem.exportFormat}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Imagem
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 studio-checkerboard flex items-center justify-center">
              <img
                src={lightboxItem.upscaledDataUrl}
                alt={lightboxItem.title}
                className="max-h-[72vh] w-auto object-contain rounded shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* QUIET FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-6 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            Upscayl Studio Web · Processamento local ilimitado e gratuito no navegador
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.upscayl.org/introduction"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Documentação Upscayl
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/orgs/upscayl/repositories"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Repositórios Oficiais Upscayl
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
