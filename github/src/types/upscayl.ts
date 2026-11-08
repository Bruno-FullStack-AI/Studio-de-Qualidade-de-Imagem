/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UpscaylModelId =
  | 'realesrgan-x4plus'
  | 'remacri'
  | 'ultramix_balanced'
  | 'ultrasharp'
  | 'realesrgan-x4plus-anime'
  | 'high-fidelity-4x';

export interface UpscaylModelPreset {
  id: UpscaylModelId;
  name: string;
  subtitle: string;
  description: string;
  recommendedFor: string;
  params: {
    sharpenAmount: number;
    sharpenRadius: number;
    denoiseStrength: number;
    edgePreservation: number;
    microContrast: number;
    vibranceBoost: number;
    highlightRecovery: number;
    shadowLift: number;
  };
}

export interface EnhancementConfig {
  modelId: UpscaylModelId;
  scaleFactor: 1 | 2 | 3 | 4;
  doubleUpscayl: boolean; // Simulates Upscayl's Double Upscayl mode (up to 8x or extra multi-pass detail)
  exportFormat: 'png' | 'jpeg' | 'webp';
  compressionQuality: number; // 10 - 100
  sharpenOverride: number; // 0 - 100
  denoiseOverride: number; // 0 - 100
  microContrastOverride: number; // 0 - 100
  colorBalanceOverride: number; // -50 to +50
  brightnessOverride: number; // -50 to +50
}

export interface RepositoryItem {
  id: string;
  title: string;
  originalDataUrl: string;
  upscaledDataUrl: string;
  originalWidth: number;
  originalHeight: number;
  upscaledWidth: number;
  upscaledHeight: number;
  modelId: UpscaylModelId;
  modelName: string;
  scaleFactor: number;
  exportFormat: 'png' | 'jpeg' | 'webp';
  processingTimeMs: number;
  createdAt: string;
  fileSizeEstimateKb: number;
  tags: string[];
}

export interface BatchQueueItem {
  id: string;
  name: string;
  originalDataUrl: string;
  upscaledDataUrl?: string;
  originalWidth: number;
  originalHeight: number;
  upscaledWidth?: number;
  upscaledHeight?: number;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  processingTimeMs?: number;
  errorMessage?: string;
}

export const UPSCAYL_MODELS: UpscaylModelPreset[] = [
  {
    id: 'realesrgan-x4plus',
    name: 'Upscayl Padrão (Real-ESRGAN)',
    subtitle: 'Fotografia Geral e Retratos',
    description:
      'Equilíbrio versátil inspirado no modelo padrão Real-ESRGAN x4plus do Upscayl. Reconstrói bordas naturais, remove ruído de compressão JPEG e preserva tons de pele realistas.',
    recommendedFor: 'Fotos de câmera, retratos, celulares e imagens do dia a dia',
    params: {
      sharpenAmount: 58,
      sharpenRadius: 1.2,
      denoiseStrength: 42,
      edgePreservation: 75,
      microContrast: 26,
      vibranceBoost: 8,
      highlightRecovery: 15,
      shadowLift: 8,
    },
  },
  {
    id: 'remacri',
    name: 'Remacri (Texturas Naturais)',
    subtitle: 'Paisagens, Folhagens e Detalhes Finos',
    description:
      'Focado na recuperação de micro-texturas orgânicas como poros, tecidos, pedras e vegetação sem gerar halos artificiais nas bordas de alto contraste.',
    recommendedFor: 'Natureza, fotografia macro, arquitetura e texturas ricas',
    params: {
      sharpenAmount: 72,
      sharpenRadius: 1.0,
      denoiseStrength: 28,
      edgePreservation: 82,
      microContrast: 38,
      vibranceBoost: 12,
      highlightRecovery: 20,
      shadowLift: 12,
    },
  },
  {
    id: 'ultramix_balanced',
    name: 'Ultramix Balanced',
    subtitle: 'Fusão Balanceada de Nitidez e Suavidade',
    description:
      'Combina suavização inteligente em áreas planas com acentuação seletiva de detalhes. Ideal para fotos com iluminação mista ou leve granulação.',
    recommendedFor: 'Fotos internas, eventos noturnos e imagens antigas',
    params: {
      sharpenAmount: 52,
      sharpenRadius: 1.4,
      denoiseStrength: 55,
      edgePreservation: 78,
      microContrast: 24,
      vibranceBoost: 10,
      highlightRecovery: 18,
      shadowLift: 16,
    },
  },
  {
    id: 'ultrasharp',
    name: 'Ultrasharp (Alta Definição)',
    subtitle: 'Nitidez Cristalina e Contornos Precisos',
    description:
      'Maximiza a acutância e definição de linhas, tipografia e estruturas geométricas. Excelente para recuperar fotos levemente desfocadas ou de baixa resolução.',
    recommendedFor: 'Produtos, e-commerce, arquitetura moderna e textos',
    params: {
      sharpenAmount: 88,
      sharpenRadius: 1.1,
      denoiseStrength: 32,
      edgePreservation: 88,
      microContrast: 44,
      vibranceBoost: 6,
      highlightRecovery: 12,
      shadowLift: 5,
    },
  },
  {
    id: 'realesrgan-x4plus-anime',
    name: 'Arte Digital (Real-ESRGAN Anime)',
    subtitle: 'Ilustrações, Anime, Vetores e Jogos',
    description:
      'Remove artefatos de bloco em cores chapadas e reconstrói traços de contorno com precisão limpa, evitando textura granulada indesejada em desenhos.',
    recommendedFor: 'Ilustrações digitais, anime, logotipos, quadrinhos e renders 3D',
    params: {
      sharpenAmount: 78,
      sharpenRadius: 0.9,
      denoiseStrength: 68,
      edgePreservation: 92,
      microContrast: 32,
      vibranceBoost: 16,
      highlightRecovery: 10,
      shadowLift: 4,
    },
  },
  {
    id: 'high-fidelity-4x',
    name: 'High Fidelity 4x (Fidelidade de Estúdio)',
    subtitle: 'Preservação Fiel ao Original Sem Artefatos',
    description:
      'Ampliação cirúrgica que respeita rigorosamente a gradação de cor e granulação original da fotografia, adicionando densidade de pixels com mínima alteração tonal.',
    recommendedFor: 'Fotografia profissional, impressões fine-art e arquivo histórico',
    params: {
      sharpenAmount: 48,
      sharpenRadius: 1.0,
      denoiseStrength: 22,
      edgePreservation: 85,
      microContrast: 18,
      vibranceBoost: 3,
      highlightRecovery: 10,
      shadowLift: 4,
    },
  },
];
