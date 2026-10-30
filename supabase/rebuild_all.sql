-- ============================================================================
-- ПОЛНАЯ ЧИСТАЯ ПЕРЕСБОРКА БАЗЫ ДАННЫХ SUPABASE (ЕЖЕДНЕВНИК + TELEGRAM-БОТ)
-- Запускается единым скриптом в Supabase -> SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. СБРОС СТАРЫХ ТАБЛИЦ И ТРИГГЕРОВ (CASCADE)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.link_telegram_by_sync_token(TEXT, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.sync_parent_workout_on_set_change() CASCADE;

DROP TABLE IF EXISTS public.saved_links CASCADE;
DROP TABLE IF EXISTS public.nutrition_logs CASCADE;
DROP TABLE IF EXISTS public.workout_sets CASCADE;
DROP TABLE IF EXISTS public.workout_exercises CASCADE;
DROP TABLE IF EXISTS public.workout_photos CASCADE;
DROP TABLE IF EXISTS public.workouts CASCADE;
DROP TABLE IF EXISTS public.books_and_quran CASCADE;
DROP TABLE IF EXISTS public.telegram_link_tokens CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ----------------------------------------------------------------------------
-- 2. СЛУЖЕБНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ updated_at
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. ТАБЛИЦА ПРОФИЛЕЙ (profiles: пользователь, telegram_id, sync_token, цели)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE,
    sync_token TEXT UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10)),
    display_name TEXT,
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',

    -- Дневные нормы КБЖУ для шкал прогресса на сайте и сводки в боте
    daily_calories_goal INTEGER NOT NULL DEFAULT 2200 CHECK (daily_calories_goal > 0),
    daily_protein_goal NUMERIC(6, 1) NOT NULL DEFAULT 150.0 CHECK (daily_protein_goal >= 0),
    daily_fats_goal NUMERIC(6, 1) NOT NULL DEFAULT 70.0 CHECK (daily_fats_goal >= 0),
    daily_carbs_goal NUMERIC(6, 1) NOT NULL DEFAULT 240.0 CHECK (daily_carbs_goal >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Автоматическое создание профиля при регистрации через Supabase Auth
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Создаем профили для уже существующих пользователей в auth.users (если есть)
INSERT INTO public.profiles (id, display_name)
SELECT
    id,
    COALESCE(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. RPC-ФУНКЦИЯ ПРИВЯЗКИ TELEGRAM К АККАУНТУ ПО sync_token
-- ----------------------------------------------------------------------------
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
    -- Если этот telegram_id уже был привязан к другому профилю — сбрасываем старую связку
    UPDATE public.profiles
    SET telegram_id = NULL
    WHERE telegram_id = p_telegram_id;

    -- Находим профиль по sync_token, записываем telegram_id и сразу генерируем новый sync_token
    UPDATE public.profiles
    SET
        telegram_id = p_telegram_id,
        sync_token = upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10))
    WHERE sync_token = upper(trim(p_sync_token))
    RETURNING id INTO v_user_id;

    RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_telegram_by_sync_token(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_telegram_by_sync_token(TEXT, BIGINT) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. ТАБЛИЦА КНИГ И КОРАНА (books_and_quran)
-- ----------------------------------------------------------------------------
CREATE TABLE public.books_and_quran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('book', 'quran')),
    title TEXT NOT NULL,
    current_position INTEGER NOT NULL DEFAULT 0 CHECK (current_position >= 0),
    total_target INTEGER NOT NULL CHECK (total_target > 0),
    progress_percent NUMERIC(5, 2) GENERATED ALWAYS AS (
        COALESCE(ROUND((current_position::NUMERIC / NULLIF(total_target::NUMERIC, 0)) * 100.0, 2), 0)
    ) STORED,
    notes TEXT,
    resource_urls TEXT[] NOT NULL DEFAULT '{}',
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    last_updated_by TEXT NOT NULL DEFAULT 'web' CHECK (last_updated_by IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_position_within_target CHECK (current_position <= total_target)
);

CREATE TRIGGER trg_books_and_quran_updated_at
    BEFORE INSERT OR UPDATE ON public.books_and_quran
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 6. ТАБЛИЦЫ ТРЕНИРОВОК (workouts И workout_sets)
-- ----------------------------------------------------------------------------
CREATE TABLE public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL DEFAULT 'Силовая тренировка',
    notes TEXT,
    photo_urls TEXT[] NOT NULL DEFAULT '{}',
    total_tonnage NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_tonnage >= 0),
    last_updated_by TEXT NOT NULL DEFAULT 'web' CHECK (last_updated_by IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_workouts_updated_at
    BEFORE INSERT OR UPDATE ON public.workouts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    sets_count SMALLINT NOT NULL DEFAULT 1 CHECK (sets_count > 0),
    reps INTEGER NOT NULL CHECK (reps > 0),
    weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
    tonnage NUMERIC(10, 2) GENERATED ALWAYS AS (
        ROUND((sets_count::NUMERIC * reps::NUMERIC * weight_kg), 2)
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_workout_sets_updated_at
    BEFORE INSERT OR UPDATE ON public.workout_sets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Автоматический пересчет общего тоннажа тренировки при добавлении/изменении сетов
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

CREATE TRIGGER trg_sync_parent_workout
    AFTER INSERT OR UPDATE OR DELETE ON public.workout_sets
    FOR EACH ROW EXECUTE FUNCTION public.sync_parent_workout_on_set_change();

-- ----------------------------------------------------------------------------
-- 7. ТАБЛИЦА ПИТАНИЯ (nutrition_logs: рацион, калории, БЖУ)
-- ----------------------------------------------------------------------------
CREATE TABLE public.nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT NOT NULL DEFAULT 'lunch' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_description TEXT NOT NULL,
    calories NUMERIC(7, 1) NOT NULL DEFAULT 0 CHECK (calories >= 0),
    protein NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (protein >= 0),
    fats NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (fats >= 0),
    carbs NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (carbs >= 0),
    recipe_url TEXT,
    photo_url TEXT,
    last_updated_by TEXT NOT NULL DEFAULT 'web' CHECK (last_updated_by IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_nutrition_logs_updated_at
    BEFORE INSERT OR UPDATE ON public.nutrition_logs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 8. ТАБЛИЦА ПОЛЕЗНЫХ ССЫЛОК (saved_links: ссылки с комментариями)
-- ----------------------------------------------------------------------------
CREATE TABLE public.saved_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    comment TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    last_updated_by TEXT NOT NULL DEFAULT 'telegram' CHECK (last_updated_by IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_saved_links_updated_at
    BEFORE INSERT OR UPDATE ON public.saved_links
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 9. ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ----------------------------------------------------------------------------
CREATE INDEX idx_profiles_telegram_id ON public.profiles(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX idx_books_and_quran_user ON public.books_and_quran(user_id, updated_at DESC);
CREATE INDEX idx_workouts_user ON public.workouts(user_id, workout_date DESC, updated_at DESC);
CREATE INDEX idx_workout_sets_workout ON public.workout_sets(workout_id);
CREATE INDEX idx_nutrition_logs_user ON public.nutrition_logs(user_id, meal_date DESC, updated_at DESC);
CREATE INDEX idx_saved_links_user ON public.saved_links(user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS: изоляция данных пользователя)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books_and_quran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_owner_rw" ON public.profiles FOR ALL TO authenticated
    USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "books_owner_rw" ON public.books_and_quran FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "workouts_owner_rw" ON public.workouts FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "sets_owner_rw" ON public.workout_sets FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "nutrition_owner_rw" ON public.nutrition_logs FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "links_owner_rw" ON public.saved_links FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ----------------------------------------------------------------------------
-- 11. ХРАНИЛИЩЕ SUPABASE STORAGE (бакеты для скриншотов и фото формы)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('diary-media', 'diary-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    ('workout-photos', 'workout-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    ('quran-pages', 'quran-pages', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "storage_select_own" ON storage.objects;
CREATE POLICY "storage_select_own" ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "storage_insert_own" ON storage.objects;
CREATE POLICY "storage_insert_own" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "storage_update_own" ON storage.objects;
CREATE POLICY "storage_update_own" ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    )
    WITH CHECK (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "storage_delete_own" ON storage.objects;
CREATE POLICY "storage_delete_own" ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id IN ('diary-media', 'workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

-- ----------------------------------------------------------------------------
-- 12. ПОДКЛЮЧЕНИЕ SUPABASE REALTIME ДЛЯ ОНЛАЙН-СИНХРОНИЗАЦИИ С iPHONE
-- ----------------------------------------------------------------------------
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

-- Перезагрузка PostgREST схемы
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 13. РЕЗУЛЬТАТ: ВЫВОД КОМАНДЫ ПРИВЯЗКИ ДЛЯ БОТА
-- ----------------------------------------------------------------------------
SELECT
    id AS user_id,
    display_name,
    telegram_id,
    sync_token,
    '/start ' || sync_token AS command_for_telegram_bot
FROM public.profiles;
