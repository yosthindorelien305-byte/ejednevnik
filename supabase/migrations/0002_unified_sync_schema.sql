-- ============================================================================
-- МИГРАЦИЯ: ЕДИНАЯ СХЕМА СИНХРОНИЗАЦИИ САЙТА (iPhone PWA) И TELEGRAM-БОТА
-- Поддерживает запуск как с нуля в новой БД Supabase, так и поверх базовой схемы
-- ============================================================================

-- ============================================================================
-- 1. УНИВЕРСАЛЬНАЯ ФУНКЦИЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ updated_at
-- ============================================================================
-- Использует clock_timestamp(), чтобы даже несколько изменений внутри одной
-- транзакции получали строго возрастающую метку времени для сортировки на сайте.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := COALESCE(NEW.created_at, clock_timestamp());
        NEW.updated_at := clock_timestamp();
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
        NEW.updated_at := clock_timestamp();
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_updated_at() IS
    'Автоматически проставляет актуальный updated_at при любой записи с сайта или из Telegram-бота';


-- ============================================================================
-- 2. ТАБЛИЦА ПРОФИЛЕЙ (profiles): СВЯЗКА SUPABASE AUTH + TELEGRAM ID + SYNC TOKEN
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE,
    sync_token TEXT UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10)),
    display_name TEXT,
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',

    -- Дневные ориентиры КБЖУ для прогресс-баров на iPhone и сводки /stats в боте
    daily_calories_goal INTEGER NOT NULL DEFAULT 2200 CHECK (daily_calories_goal > 0),
    daily_protein_goal NUMERIC(6, 1) NOT NULL DEFAULT 150.0 CHECK (daily_protein_goal >= 0),
    daily_fats_goal NUMERIC(6, 1) NOT NULL DEFAULT 70.0 CHECK (daily_fats_goal >= 0),
    daily_carbs_goal NUMERIC(6, 1) NOT NULL DEFAULT 240.0 CHECK (daily_carbs_goal >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Гарантируем наличие всех ключевых колонок при накате поверх шаблона Supabase (User Management Starter) или старой схемы
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
    ADD COLUMN IF NOT EXISTS sync_token TEXT UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10)),
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
    ADD COLUMN IF NOT EXISTS daily_calories_goal INTEGER NOT NULL DEFAULT 2200,
    ADD COLUMN IF NOT EXISTS daily_protein_goal NUMERIC(6, 1) NOT NULL DEFAULT 150.0,
    ADD COLUMN IF NOT EXISTS daily_fats_goal NUMERIC(6, 1) NOT NULL DEFAULT 70.0,
    ADD COLUMN IF NOT EXISTS daily_carbs_goal NUMERIC(6, 1) NOT NULL DEFAULT 240.0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Заполняем пустые sync_token, если строки в profiles были созданы раньше без токена
UPDATE public.profiles
SET sync_token = upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10))
WHERE sync_token IS NULL;

COMMENT ON TABLE public.profiles IS 'Профиль пользователя с уникальным telegram_id и кодом привязки sync_token';

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Автосоздание профиля со сгенерированным sync_token при регистрации через Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            split_part(NEW.email, '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Серверная функция привязки Telegram-бота к профилю по sync_token (с автосменой использованного кода)
CREATE OR REPLACE FUNCTION public.link_telegram_by_sync_token(
    p_sync_token TEXT,
    p_telegram_id BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Если этот telegram_id был привязан к другому тестовому профилю — освобождаем связку
    UPDATE public.profiles
    SET telegram_id = NULL
    WHERE telegram_id = p_telegram_id;

    -- Находим пользователя по sync_token, записываем telegram_id и сразу вращаем sync_token
    UPDATE public.profiles
    SET
        telegram_id = p_telegram_id,
        sync_token = upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10))
    WHERE sync_token = upper(trim(p_sync_token))
    RETURNING id INTO v_user_id;

    RETURN v_user_id;
END;
$$;

-- Вызывать привязку по sync_token разрешено только серверному ключу бота (service_role)
REVOKE ALL ON FUNCTION public.link_telegram_by_sync_token(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_telegram_by_sync_token(TEXT, BIGINT) TO service_role;


-- ============================================================================
-- 3. ЕДИНАЯ ТАБЛИЦА КНИГ И КОРАНА (books_and_quran)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.books_and_quran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Раздел записи: обычная книга или сура/чтение Корана
    category TEXT NOT NULL CHECK (category IN ('book', 'quran')),

    -- Название книги или суры (например: «Атомные привычки» или «Сура 18 Аль-Кахф»)
    title TEXT NOT NULL,

    -- Текущий номер страницы (для книг) или номер аята / страницы мусхафа (для Корана)
    current_position INTEGER NOT NULL DEFAULT 0 CHECK (current_position >= 0),

    -- Целевой объем: всего страниц в книге или всего аятов/страниц
    total_target INTEGER NOT NULL CHECK (total_target > 0),

    -- Автоматически рассчитываемый процент прогресса (0.00 - 100.00)
    progress_percent NUMERIC(5, 2) GENERATED ALWAYS AS (
        COALESCE(ROUND((current_position::NUMERIC / NULLIF(total_target::NUMERIC, 0)) * 100.0, 2), 0)
    ) STORED,

    -- Текстовые заметки, цитаты или размышления над аятами (тадаббур)
    notes TEXT,

    -- Массив полезных ссылок (веб-статьи, тафсир, аудиочтение, конспекты)
    resource_urls TEXT[] NOT NULL DEFAULT '{}',

    -- Массив путей/URL загруженных скриншотов страниц из Supabase Storage
    media_urls TEXT[] NOT NULL DEFAULT '{}',

    -- Маркер источника последнего изменения ('web' с iPhone или 'telegram' из бота)
    last_updated_by TEXT NOT NULL DEFAULT 'web' CHECK (last_updated_by IN ('web', 'telegram')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_position_within_target CHECK (current_position <= total_target)
);

COMMENT ON TABLE public.books_and_quran IS
    'Унифицированный трекер чтения книг и Корана со ссылками на материалы и массивом скриншотов';

DROP TRIGGER IF EXISTS trg_books_and_quran_updated_at ON public.books_and_quran;
CREATE TRIGGER trg_books_and_quran_updated_at
    BEFORE INSERT OR UPDATE ON public.books_and_quran
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- 4. ТАБЛИЦЫ ТРЕНИРОВОК (workouts И workout_sets: ВЕС, ПОВТОРЕНИЯ, ФОТО)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL DEFAULT 'Силовая тренировка',
    notes TEXT, -- Заметки о самочувствии и технике

    -- Массив фото прогресса формы из Supabase Storage (с камеры iPhone или из чата бота)
    photo_urls TEXT[] NOT NULL DEFAULT '{}',

    -- Суммарный тоннаж тренировки в кг (автоматически пересчитывается триггером из подходов)
    total_tonnage NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_tonnage >= 0),

    last_updated_by TEXT NOT NULL DEFAULT 'web' CHECK (last_updated_by IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Совместимость при запуске поверх предыдущей миграции
ALTER TABLE public.workouts
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS last_updated_by TEXT NOT NULL DEFAULT 'web';

DROP TRIGGER IF EXISTS trg_workouts_updated_at ON public.workouts;
CREATE TRIGGER trg_workouts_updated_at
    BEFORE INSERT OR UPDATE ON public.workouts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Рабочие подходы внутри тренировки (вес, повторения, авторасчет тоннажа)
CREATE TABLE IF NOT EXISTS public.workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    sets_count SMALLINT NOT NULL DEFAULT 1 CHECK (sets_count > 0),
    reps INTEGER NOT NULL CHECK (reps > 0),
    weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),

    -- Автоподсчет тоннажа: подходы * повторения * рабочий вес
    tonnage NUMERIC(10, 2) GENERATED ALWAYS AS (
        ROUND((sets_count::NUMERIC * reps::NUMERIC * weight_kg), 2)
    ) STORED,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workout_sets IS 'Силовые подходы тренировки с весом, повторениями и автотоннажем';

DROP TRIGGER IF EXISTS trg_workout_sets_updated_at ON public.workout_sets;
CREATE TRIGGER trg_workout_sets_updated_at
    BEFORE INSERT OR UPDATE ON public.workout_sets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Триггер пересчета тоннажа тренировки и поднятия workouts.updated_at при изменении подходов
CREATE OR REPLACE FUNCTION public.sync_parent_workout_on_set_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_workout_ids UUID[] := '{}';
    v_wid UUID;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_workout_ids := array_append(v_workout_ids, NEW.workout_id);
    END IF;

    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        IF NOT (OLD.workout_id = ANY(v_workout_ids)) THEN
            v_workout_ids := array_append(v_workout_ids, OLD.workout_id);
        END IF;
    END IF;

    FOREACH v_wid IN ARRAY v_workout_ids LOOP
        UPDATE public.workouts
        SET
            total_tonnage = COALESCE((
                SELECT SUM(tonnage)
                FROM public.workout_sets
                WHERE workout_id = v_wid
            ), 0),
            updated_at = clock_timestamp()
        WHERE id = v_wid;
    END LOOP;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_parent_workout ON public.workout_sets;
CREATE TRIGGER trg_sync_parent_workout
    AFTER INSERT OR UPDATE OR DELETE ON public.workout_sets
    FOR EACH ROW EXECUTE FUNCTION public.sync_parent_workout_on_set_change();


-- ============================================================================
-- 5. ТАБЛИЦА ПИТАНИЯ (nutrition_logs: ОПИСАНИЕ ЕДЫ, КАЛОРИИ, БЖУ)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT NOT NULL DEFAULT 'lunch' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_description TEXT NOT NULL, -- Описание рациона / граммовки продуктов
    calories NUMERIC(7, 1) NOT NULL DEFAULT 0 CHECK (calories >= 0),
    protein NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (protein >= 0),
    fats NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (fats >= 0),
    carbs NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (carbs >= 0),
    recipe_url TEXT, -- Опциональная ссылка на рецепт
    photo_url TEXT,  -- Опциональное фото блюда из Storage
    last_updated_by TEXT NOT NULL DEFAULT 'web' CHECK (last_updated_by IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nutrition_logs IS 'Дневник приемов пищи с расчетом калорий и БЖУ';

DROP TRIGGER IF EXISTS trg_nutrition_logs_updated_at ON public.nutrition_logs;
CREATE TRIGGER trg_nutrition_logs_updated_at
    BEFORE INSERT OR UPDATE ON public.nutrition_logs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- 5.1. БАЗА ПОЛЕЗНЫХ ССЫЛОК (saved_links: СТАТЬИ, МАТЕРИАЛЫ, ВАЙБКОДИНГ)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    comment TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    last_updated_by TEXT NOT NULL DEFAULT 'telegram' CHECK (last_updated_by IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_links IS 'База полезных ссылок с комментариями из чата Telegram и веб-приложения';

DROP TRIGGER IF EXISTS trg_saved_links_updated_at ON public.saved_links;
CREATE TRIGGER trg_saved_links_updated_at
    BEFORE INSERT OR UPDATE ON public.saved_links
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_saved_links_user_updated
    ON public.saved_links(user_id, updated_at DESC);

ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Полезные ссылки: доступ владельцу" ON public.saved_links;
CREATE POLICY "Полезные ссылки: доступ владельцу"
    ON public.saved_links FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));


-- ============================================================================
-- 6. ИНДЕКСЫ ДЛЯ МГНОВЕННОЙ ВЫБОРКИ СВЕЖИХ ЗАПИСЕЙ НА САЙТЕ И В БОТЕ
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id
    ON public.profiles(telegram_id) WHERE telegram_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_books_and_quran_user_updated
    ON public.books_and_quran(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_and_quran_user_category
    ON public.books_and_quran(user_id, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workouts_user_updated
    ON public.workouts(user_id, workout_date DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_sets_workout
    ON public.workout_sets(workout_id);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date
    ON public.nutrition_logs(user_id, meal_date DESC, updated_at DESC);


-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS): ПОЛНАЯ ИЗОЛЯЦИЯ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books_and_quran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

-- Политики profiles
DROP POLICY IF EXISTS "Профиль: доступ владельцу" ON public.profiles;
CREATE POLICY "Профиль: доступ владельцу"
    ON public.profiles FOR ALL TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- Политики books_and_quran
DROP POLICY IF EXISTS "Книги и Коран: доступ владельцу" ON public.books_and_quran;
CREATE POLICY "Книги и Коран: доступ владельцу"
    ON public.books_and_quran FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Политики workouts и workout_sets
DROP POLICY IF EXISTS "Тренировки: доступ владельцу" ON public.workouts;
CREATE POLICY "Тренировки: доступ владельцу"
    ON public.workouts FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Подходы тренировок: доступ владельцу" ON public.workout_sets;
CREATE POLICY "Подходы тренировок: доступ владельцу"
    ON public.workout_sets FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Политики nutrition_logs
DROP POLICY IF EXISTS "Питание: доступ владельцу" ON public.nutrition_logs;
CREATE POLICY "Питание: доступ владельцу"
    ON public.nutrition_logs FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));


-- ============================================================================
-- 8. ХРАНИЛИЩЕ ФАЙЛОВ (SUPABASE STORAGE) ДЛЯ СКРИНШОТОВ И ФОТО ФОРМЫ
-- Папка хранения: {user_id}/{раздел}/{имя_файла}
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('diary-media', 'diary-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    ('workout-photos', 'workout-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    ('quran-pages', 'quran-pages', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Медиа ежедневника: чтение своих файлов" ON storage.objects;
CREATE POLICY "Медиа ежедневника: чтение своих файлов"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Медиа ежедневника: загрузка в свою папку" ON storage.objects;
CREATE POLICY "Медиа ежедневника: загрузка в свою папку"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Медиа ежедневника: обновление своих файлов" ON storage.objects;
CREATE POLICY "Медиа ежедневника: обновление своих файлов"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    )
    WITH CHECK (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Медиа ежедневника: удаление своих файлов" ON storage.objects;
CREATE POLICY "Медиа ежедневника: удаление своих файлов"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );


-- ============================================================================
-- 9. ПОДКЛЮЧЕНИЕ SUPABASE REALTIME ДЛЯ LIVE-ОБНОВЛЕНИЯ ЭКРАНА НА iPHONE
-- Когда бот обновляет страницу книги/Корана, записывает сет или прием пищи,
-- открытое PWA на iPhone мгновенно получает событие через postgres_changes.
-- ============================================================================

DO $$
DECLARE
    tbl TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl IN ARRAY ARRAY['books_and_quran', 'workouts', 'workout_sets', 'nutrition_logs', 'saved_links']
        LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename = tbl
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
            END IF;
        END LOOP;
    END IF;
END;
$$;
