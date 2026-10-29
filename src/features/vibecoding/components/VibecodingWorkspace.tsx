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
} from 'lucide-react';

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

export function VibecodingWorkspace() {
  // Живой секундомер спринта вайбкодинга
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [sprintGoal, setSprintGoal] = useState<string>(
    'Интеграция iOS PWA и серверного вебхука Telegram'
  );

  // Трекер проектов
  const [projects, setProjects] = useState<DevProjectItem[]>([
    {
      id: 'proj-1',
      name: 'Умный ежедневник (PWA + Bot)',
      type: 'Пет-проект',
      status: 'В работе',
      progress: 75,
    },
    {
      id: 'proj-2',
      name: 'Лендинг + CRM для студии фитнеса',
      type: 'Коммерческий заказ',
      status: 'Ревью',
      progress: 90,
    },
  ]);

  // Полезные ссылки (документация, AI-инструменты, референсы)
  const [links, setLinks] = useState<UsefulDevLink[]>([
    {
      id: 'lnk-1',
      title: 'Next.js App Router — PWA & Metadata Docs',
      url: 'https://nextjs.org/docs/app/guides/progressive-web-apps',
    },
    {
      id: 'lnk-2',
      title: 'Supabase RLS & Storage Security',
      url: 'https://supabase.com/docs/guides/storage/security/access-control',
    },
  ]);
  const [newLinkTitle, setNewLinkTitle] = useState<string>('');
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');

  // Заметки по коду и удачным промптам
  const [notes, setNotes] = useState<CodeNoteItem[]>([
    {
      id: 'note-1',
      title: 'Фикс автозума инпутов в iOS Safari',
      snippet: 'На экранах <= 768px задавать font-size: 16px для input/select/textarea.',
      createdAt: 'Сегодня',
    },
  ]);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteBody, setNoteBody] = useState<string>('');

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

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
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

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
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

  const bumpProjectProgress = (id: string) => {
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

  return (
    <div className="space-y-5">
      {/* Таймер спринта разработки */}
      <section className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950 p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            <Terminal className="h-3.5 w-3.5" />
            Спринт вайбкодинга
          </span>
          <span className="font-mono text-2xl font-bold tracking-wider text-emerald-400">
            {formatTimer(elapsedSeconds)}
          </span>
        </div>

        <input
          type="text"
          value={sprintGoal}
          onChange={(e) => setSprintGoal(e.target.value)}
          placeholder="Цель текущего спринта..."
          className="mt-3 w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:border-emerald-400 focus:outline-none"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setIsRunning((prev) => !prev)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-semibold transition active:scale-97 ${
              isRunning
                ? 'bg-rose-500 text-white'
                : 'bg-emerald-500 text-zinc-950'
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

      {/* Трекер проектов и коммерческих заказов */}
      <section className="space-y-2.5 rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FolderGit2 className="h-4 w-4 text-emerald-500" />
          Трекер проектов
        </h2>

        <div className="space-y-3">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{proj.name}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {proj.type} · {proj.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => bumpProjectProgress(proj.id)}
                  className="rounded-xl bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 active:scale-95 dark:text-emerald-400"
                >
                  {proj.progress}% (+10%)
                </button>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  style={{ width: `${proj.progress}%` }}
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Заметки по коду и промптам */}
      <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="h-4 w-4 text-violet-500" />
          Заметки по коду
        </h2>

        <form onSubmit={handleAddNote} className="space-y-2">
          <input
            type="text"
            placeholder="Заголовок (напр. Паттерн RLS в Supabase)"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
          <textarea
            rows={2}
            placeholder="Сниппет кода, архитектурная мысль или рабочий промпт..."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white active:scale-97 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Сохранить заметку
          </button>
        </form>

        <div className="space-y-2 pt-1">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {n.title}
                </span>
                <span className="text-[10px] text-zinc-400">{n.createdAt}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                {n.snippet}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Полезные ссылки */}
      <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-sky-500" />
          Полезные ссылки
        </h2>

        <form onSubmit={handleAddLink} className="grid grid-cols-1 gap-2">
          <input
            type="text"
            placeholder="Название ресурса или репозитория"
            value={newLinkTitle}
            onChange={(e) => setNewLinkTitle(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://..."
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              type="submit"
              className="shrink-0 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white active:scale-97"
            >
              Добавить
            </button>
          </div>
        </form>

        <ul className="space-y-2">
          {links.map((lnk) => (
            <li key={lnk.id}>
              <a
                href={lnk.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-3.5 py-2.5 text-xs font-medium text-zinc-800 transition hover:border-emerald-500/40 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-200"
              >
                <span className="truncate pr-2">{lnk.title}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
