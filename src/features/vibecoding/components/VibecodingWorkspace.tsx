'use client';

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Link2,
  ExternalLink,
  Plus,
  Play,
  Square,
  FolderGit2,
  Code2,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react';
import { hapticImpact, hapticNotification } from '@/lib/telegram/webapp';

interface DevProjectItem {
  id: string;
  name: string;
  type: 'Пет-проект' | 'Коммерческий заказ';
  status: 'В работе' | 'Ревью' | 'Готово';
  progress: number;
}

interface UsefulDevLink {
  id: string;
  title: string;
  url: string;
}

interface CodeNoteItem {
  id: string;
  title: string;
  snippet: string;
  createdAt: string;
}

const DEFAULT_PROJECTS: DevProjectItem[] = [
  {
    id: 'proj-1',
    name: 'Умный ежедневник (PWA + Bot)',
    type: 'Пет-проект',
    status: 'В работе',
    progress: 85,
  },
  {
    id: 'proj-2',
    name: 'FitFusion Dark Luxury Dashboard',
    type: 'Коммерческий заказ',
    status: 'Ревью',
    progress: 95,
  },
];

const DEFAULT_LINKS: UsefulDevLink[] = [
  {
    id: 'lnk-1',
    title: 'Next.js App Router — PWA & Metadata Docs',
    url: 'https://nextjs.org/docs/app/guides/progressive-web-apps',
  },
  {
    id: 'lnk-2',
    title: 'Supabase RLS & Storage Security Guidelines',
    url: 'https://supabase.com/docs/guides/storage/security/access-control',
  },
  {
    id: 'lnk-3',
    title: 'Telegram Mini Apps SDK Official Documentation',
    url: 'https://core.telegram.org/bots/webapps',
  },
];

const DEFAULT_NOTES: CodeNoteItem[] = [
  {
    id: 'note-1',
    title: 'Фикс автозума инпутов в iOS Safari',
    snippet: 'На экранах <= 768px задавать font-size: 16px для input/select/textarea, чтобы Safari не приближал экран.',
    createdAt: 'Сегодня',
  },
  {
    id: 'note-2',
    title: 'Telegram InputFile Multipart',
    snippet: 'Передавать буфер файла в new InputFile(buffer, name) вместо signed URL для 100% надежной доставки фото в бот.',
    createdAt: 'Сегодня',
  },
];

export function VibecodingWorkspace() {
  // Секундомер спринта вайбкодинга
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [sprintGoal, setSprintGoal] = useState<string>(
    'Редизайн интерфейса в стиле FitFusion Dark Luxury'
  );

  // Трекер проектов с сохранением в localStorage
  const [projects, setProjects] = useState<DevProjectItem[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_PROJECTS;
    try {
      const raw = localStorage.getItem('ejednevnik_vibecoding_projects');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROJECTS;
  });

  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectType, setNewProjectType] = useState<'Пет-проект' | 'Коммерческий заказ'>('Пет-проект');
  const [isAddingProject, setIsAddingProject] = useState<boolean>(false);

  // Полезные ссылки с сохранением в localStorage
  const [links, setLinks] = useState<UsefulDevLink[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_LINKS;
    try {
      const raw = localStorage.getItem('ejednevnik_vibecoding_links');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_LINKS;
  });
  const [newLinkTitle, setNewLinkTitle] = useState<string>('');
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');

  // Заметки по коду с сохранением в localStorage
  const [notes, setNotes] = useState<CodeNoteItem[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_NOTES;
    try {
      const raw = localStorage.getItem('ejednevnik_vibecoding_notes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_NOTES;
  });
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteBody, setNoteBody] = useState<string>('');

  // Сохранение при изменениях
  useEffect(() => {
    try {
      localStorage.setItem('ejednevnik_vibecoding_projects', JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('ejednevnik_vibecoding_links', JSON.stringify(links));
    } catch {
      // ignore
    }
  }, [links]);

  useEffect(() => {
    try {
      localStorage.setItem('ejednevnik_vibecoding_notes', JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const toggleSprint = () => {
    hapticImpact('medium');
    if (!isRunning) {
      hapticNotification('success');
    }
    setIsRunning((prev) => !prev);
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    hapticImpact('medium');

    const newProj: DevProjectItem = {
      id: `proj-${Date.now()}`,
      name: newProjectName.trim(),
      type: newProjectType,
      status: 'В работе',
      progress: 0,
    };

    setProjects((prev) => [newProj, ...prev]);
    setNewProjectName('');
    setIsAddingProject(false);
  };

  const bumpProjectProgress = (id: string) => {
    hapticImpact('light');
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = Math.min(100, p.progress + 10);
        return {
          ...p,
          progress: next,
          status: next === 100 ? 'Готово' : p.status,
        };
      })
    );
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    hapticImpact('light');
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    hapticImpact('medium');
    const normalizedUrl = /^https?:\/\//i.test(newLinkUrl.trim())
      ? newLinkUrl.trim()
      : `https://${newLinkUrl.trim()}`;

    setLinks((prev) => [
      { id: `${Date.now()}`, title: newLinkTitle.trim(), url: normalizedUrl },
      ...prev,
    ]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  const deleteLink = (id: string) => {
    hapticImpact('light');
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    hapticImpact('medium');

    setNotes((prev) => [
      {
        id: `${Date.now()}`,
        title: noteTitle.trim() || 'Заметка по коду',
        snippet: noteBody.trim(),
        createdAt: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      ...prev,
    ]);
    setNoteTitle('');
    setNoteBody('');
  };

  const deleteNote = (id: string) => {
    hapticImpact('light');
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* 1. ТАЙМЕР СПРИНТА ВАЙБКОДИНГА В СТИЛЕ FITFUSION DARK LUXURY */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#26211F] via-[#201C1A] to-[#141211] p-5 text-white shadow-2xl shadow-black/60">
        {/* Декоративный теплый блик */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#F5BA42]/10 blur-3xl"
        />

        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5BA42] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-stone-950 uppercase">
            <Terminal className="h-3 w-3" />
            Спринт вайбкодинга
          </span>
          <span className="font-mono text-3xl font-black tracking-widest text-[#F5BA42] tabular-nums">
            {formatTimer(elapsedSeconds)}
          </span>
        </div>

        <input
          type="text"
          value={sprintGoal}
          onChange={(e) => setSprintGoal(e.target.value)}
          placeholder="Цель текущего спринта..."
          className="relative mt-3.5 w-full rounded-2xl border border-white/10 bg-[#141211] px-3.5 py-2.5 text-sm text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none"
        />

        <div className="relative mt-3 flex gap-2">
          <button
            type="button"
            onClick={toggleSprint}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black tracking-wider uppercase transition active:scale-97 ${
              isRunning
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40 hover:bg-rose-500'
                : 'bg-[#F5BA42] text-stone-950 shadow-xl shadow-[#F5BA42]/20 hover:bg-[#e5aa32]'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                Остановить спринт
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Старт спринта
              </>
            )}
          </button>
        </div>
      </section>

      {/* 2. ТРЕКЕР ПРОЕКТОВ */}
      <section className="space-y-3 rounded-3xl border border-white/5 bg-[#24201E] p-5 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
            <FolderGit2 className="h-4 w-4 text-[#F5BA42]" />
            Трекер проектов ({projects.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              setIsAddingProject((v) => !v);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-[#F5BA42] px-2.5 py-1 text-xs font-bold text-stone-950 shadow-md shadow-[#F5BA42]/15 active:scale-95"
          >
            <Plus className="h-3 w-3" />
            Проект
          </button>
        </div>

        {/* Форма добавления проекта */}
        {isAddingProject && (
          <form
            onSubmit={handleAddProject}
            className="space-y-2.5 rounded-2xl border border-white/10 bg-[#1E1A18] p-3.5"
          >
            <input
              type="text"
              required
              placeholder="Название проекта..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#141211] px-3 py-2 text-xs text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <select
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value as 'Пет-проект' | 'Коммерческий заказ')}
                className="rounded-xl border border-white/10 bg-[#141211] px-2.5 py-1.5 text-xs text-[#FAF7F5] focus:border-[#F5BA42] focus:outline-none"
              >
                <option value="Пет-проект">Пет-проект</option>
                <option value="Коммерческий заказ">Коммерческий заказ</option>
              </select>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingProject(false)}
                  className="rounded-xl px-2.5 py-1 text-xs font-bold text-[#A8A199] hover:text-[#FAF7F5]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#F5BA42] px-3 py-1 text-xs font-bold text-stone-950 shadow-md active:scale-95"
                >
                  Создать
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="rounded-2xl border border-white/5 bg-[#1E1A18] p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-[#FAF7F5]">{proj.name}</p>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-[#5B1626] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#F5BA42]">
                      {proj.type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#A8A199]">
                    Статус: <span className="font-semibold text-[#FAF7F5]">{proj.status}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => bumpProjectProgress(proj.id)}
                    className="rounded-xl border border-[#F5BA42]/30 bg-[#F5BA42]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#F5BA42] tabular-nums transition hover:bg-[#F5BA42]/20 active:scale-95"
                  >
                    {proj.progress}% (+10%)
                  </button>

                  <button
                    type="button"
                    onClick={(e) => deleteProject(proj.id, e)}
                    className="rounded-lg p-1 text-stone-500 transition hover:bg-rose-500/15 hover:text-rose-400"
                    title="Удалить проект"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Золотой прогресс-бар */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#141211] ring-1 ring-white/5">
                <div
                  style={{ width: `${proj.progress}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-[#F5BA42] via-[#f7cb68] to-[#F5BA42] transition-all duration-300"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. ЗАМЕТКИ ПО КОДУ И ПРОМПТАМ */}
      <section className="space-y-3 rounded-3xl border border-white/5 bg-[#24201E] p-5 shadow-2xl shadow-black/50">
        <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
          <Code2 className="h-4 w-4 text-[#F5BA42]" />
          Заметки по коду и промпты ({notes.length})
        </h2>

        <form onSubmit={handleAddNote} className="space-y-2">
          <input
            type="text"
            placeholder="Заголовок (напр. Паттерн RLS в Supabase)"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1A1615] px-3.5 py-2 text-xs text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none"
          />
          <textarea
            rows={2}
            placeholder="Сниппет кода, архитектурная мысль или рабочий промпт..."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1A1615] p-3 text-xs leading-relaxed text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none font-mono"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!noteBody.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5BA42] px-3.5 py-2 text-xs font-bold text-stone-950 shadow-md shadow-[#F5BA42]/15 transition hover:bg-[#e5aa32] active:scale-95 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Сохранить заметку
            </button>
          </div>
        </form>

        <div className="space-y-2 pt-1">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-white/5 bg-[#1E1A18] p-3.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#FAF7F5]">{n.title}</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-[#A8A199]">{n.createdAt}</span>
                  <button
                    type="button"
                    onClick={() => deleteNote(n.id)}
                    className="rounded p-1 text-stone-500 hover:text-rose-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#A8A199] whitespace-pre-wrap">
                {n.snippet}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. ПОЛЕЗНЫЕ ССЫЛКИ */}
      <section className="space-y-3 rounded-3xl border border-white/5 bg-[#24201E] p-5 shadow-2xl shadow-black/50">
        <h2 className="flex items-center gap-2 text-xs font-black tracking-wider text-[#FAF7F5] uppercase">
          <Link2 className="h-4 w-4 text-[#F5BA42]" />
          Полезные ссылки ({links.length})
        </h2>

        <form onSubmit={handleAddLink} className="grid grid-cols-1 gap-2">
          <input
            type="text"
            placeholder="Название ресурса или репозитория"
            value={newLinkTitle}
            onChange={(e) => setNewLinkTitle(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1A1615] px-3.5 py-2 text-xs text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://..."
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#1A1615] px-3.5 py-2 text-xs text-[#FAF7F5] placeholder:text-stone-500 focus:border-[#F5BA42] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
              className="shrink-0 rounded-xl bg-[#F5BA42] px-4 py-2 text-xs font-bold text-stone-950 shadow-md shadow-[#F5BA42]/15 transition hover:bg-[#e5aa32] active:scale-95 disabled:opacity-40"
            >
              Добавить
            </button>
          </div>
        </form>

        <ul className="space-y-2 pt-1">
          {links.map((lnk) => (
            <li key={lnk.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#1E1A18] px-3.5 py-2.5 text-xs">
              <a
                href={lnk.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 font-medium text-[#FAF7F5] hover:text-[#F5BA42] transition"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#F5BA42]" />
                <span className="truncate">{lnk.title}</span>
              </a>
              <button
                type="button"
                onClick={() => deleteLink(lnk.id)}
                className="rounded p-1 text-stone-500 hover:text-rose-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}