/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Terminal, Globe, Download, FolderGit2, ExternalLink } from 'lucide-react';

interface SelfHostModalProps {
  onClose?: () => void;
  onExportRepoBackup: () => void;
  repoItemCount: number;
}

export const SelfHostGuide: React.FC<SelfHostModalProps> = ({
  onExportRepoBackup,
  repoItemCount,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCommand = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const gitInitCommands = `# 1. Clone ou inicialize seu próprio repositório no GitHub
git init
git add .
git commit -m "feat: Upscayl Studio Web - plataforma ilimitada de super-resolução"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/meu-upscayl-web.git
git push -u origin main`;

  const localRunCommands = `# Rodar localmente ou no seu servidor próprio (100% gratuito e sem necessidade de GPU Vulkan)
npm install
npm run build
npm run preview -- --port 3000 --host`;

  return (
    <section
      id="meu-repositorio-github"
      className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 dark:border-slate-800/80"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Why Desktop Upscayl Fails vs How Web Engine Solves It */}
        <div className="lg:col-span-5 space-y-5">
          <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
            03. Auto-Hospedagem e Repositório Próprio
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Seu próprio site Upscayl funcionando em qualquer computador ou celular
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            O aplicativo desktop oficial do Upscayl depende de uma placa de vídeo dedicada compatível com{' '}
            <strong className="text-slate-900 dark:text-slate-200">Vulkan (ncnn)</strong>. Em muitos computadores com placa integrada Intel/AMD ou drivers antigos, ele trava na hora de converter ou gera imagens pretas.
          </p>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Esta versão web executa o pipeline de reconstrução de bordas, redução de ruído e interpolação multi-estágio diretamente via{' '}
            <strong className="text-slate-900 dark:text-slate-200">WebCanvas / WebGL</strong> no navegador — sem limites de uso, sem mensalidades e sem depender de GPU dedicada.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExportRepoBackup}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exportar Manifesto do Meu Repositório ({repoItemCount} fotos)
            </button>
            <a
              href="https://docs.upscayl.org/introduction"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Documentação Upscayl
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Right Column: Step-by-step GitHub & Free Hosting instructions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FolderGit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Passo 1: Subir para o seu próprio Repositório GitHub</span>
              </div>
              <button
                type="button"
                onClick={() => copyCommand('git', gitInitCommands)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded transition-colors cursor-pointer"
              >
                {copiedId === 'git' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Comandos
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
              {gitInitCommands}
            </pre>
          </div>

          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Passo 2: Executar ou Publicar Gratuitamente (Vercel / GitHub Pages / Cloud Run)</span>
              </div>
              <button
                type="button"
                onClick={() => copyCommand('run', localRunCommands)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded transition-colors cursor-pointer"
              >
                {copiedId === 'run' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Comandos
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
              {localRunCommands}
            </pre>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Compatível com deploy estático gratuito no GitHub Pages, Vercel, Netlify e Cloudflare Pages</span>
              <span aria-hidden="true">·</span>
              <span>Zero custo por imagem</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
