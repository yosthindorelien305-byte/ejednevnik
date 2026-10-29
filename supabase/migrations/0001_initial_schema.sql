-- ============================================================================
-- УМНЫЙ ЕЖЕДНЕВНИК САМОРАЗВИТИЯ — ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ SUPABASE
-- Стек: PostgreSQL 15+ (Supabase), Auth, RLS, Storage
-- ============================================================================

-- ============================================================================
-- 1. ПОЛЬЗОВАТЕЛЬСКИЕ ПЕРЕЧИСЛЕНИЯ (ENUM TYPES)
-- ============================================================================

-- Источник создания записи (веб-приложение PWA или Telegram-бот)
DO $$ BEGIN
    CREATE TYPE public.entry_source AS ENUM ('web', 'telegram');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Типы тренировок
DO $$ BEGIN
    CREATE TYPE public.workout_type AS ENUM (
        'strength',      -- Силовая тренировка
        'cardio',        -- Кардио
        'hiit',          -- Высокоинтенсивная интервальная / функциональная
        'calisthenics',  -- Воркаут / работа с собственным весом
        'stretching',    -- Растяжка / мобилити
        'other'          -- Другое
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Статус чтения книги
DO $$ BEGIN
    CREATE TYPE public.book_status AS ENUM (
        'planned',    -- В планах
        'reading',    -- Читаю
        'completed',  -- Завершено
        'paused'      -- Отложено
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Тип приема пищи
DO $$ BEGIN
    CREATE TYPE public.meal_type AS ENUM (
        'breakfast',  -- Завтрак
        'lunch',      -- Обед
        'dinner',     -- Ужин
        'snack'       -- Перекус
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Категория в разделе Вайбкодинг / Обучение
DO $$ BEGIN
    CREATE TYPE public.learning_category AS ENUM (
        'topic',        -- Изучаемая тема / технология
        'pet_project'   -- Пет-проект
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Статус изучения темы или пет-проекта
DO $$ BEGIN
    CREATE TYPE public.learning_status AS ENUM (
        'backlog',      -- В бэклоге
        'in_progress',  -- В процессе
        'completed',    -- Завершено
        'archived'      -- В архиве
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Статус коммерческого заказа
DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM (
        'lead',         -- Переговоры / оценка
        'in_progress',  -- В разработке
        'review',       -- На ревью / правках у заказчика
        'completed',    -- Сдан
        'paid',         -- Полностью оплачен и закрыт
        'cancelled'     -- Отменен
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- 2. СЛУЖЕБНАЯ ФУНКЦИЯ АВТООБНОВЛЕНИЯ ПОЛЯ updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- ============================================================================
-- 3. ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ И ПРИВЯЗКА TELEGRAM-БОТА
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',

    -- Суточные нормы КБЖУ для построения шкал прогресса за день
    daily_calories_goal INTEGER NOT NULL DEFAULT 2200 CHECK (daily_calories_goal > 0),
    daily_protein_goal NUMERIC(6, 1) NOT NULL DEFAULT 150.0 CHECK (daily_protein_goal >= 0),
    daily_fats_goal NUMERIC(6, 1) NOT NULL DEFAULT 70.0 CHECK (daily_fats_goal >= 0),
    daily_carbs_goal NUMERIC(6, 1) NOT NULL DEFAULT 240.0 CHECK (daily_carbs_goal >= 0),

    -- Поля синхронизации с Telegram-ботом
    telegram_chat_id BIGINT UNIQUE,
    telegram_username TEXT,
    telegram_linked_at TIMESTAMPTZ,
    telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Профили пользователей, дневные нормы КБЖУ и привязка к Telegram-боту';

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Автоматическое создание записи в profiles при регистрации пользователя в Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Одноразовые токены для привязки Telegram-аккаунта через Deep Link (/start <token>)
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telegram_link_tokens IS 'Одноразовые коды для безопасной связки веб-профиля с Telegram-ботом';


-- ============================================================================
-- 4. РАЗДЕЛ «ТРЕНИРОВКИ» (workouts, workout_exercises, workout_photos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    workout_type public.workout_type NOT NULL DEFAULT 'strength',
    title TEXT, -- Например: «Грудь и бицепс» или «Вечерний бег»
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    wellbeing_rating SMALLINT CHECK (wellbeing_rating IS NULL OR wellbeing_rating BETWEEN 1 AND 10),
    wellbeing_notes TEXT, -- Заметки о самочувствии
    total_tonnage NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_tonnage >= 0), -- Сумма тоннажа всех упражнений
    source public.entry_source NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workouts IS 'Журнал тренировок с общим тоннажем и заметками о самочувствии';

DROP TRIGGER IF EXISTS trg_workouts_updated_at ON public.workouts;
CREATE TRIGGER trg_workouts_updated_at
    BEFORE UPDATE ON public.workouts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Упражнения внутри тренировки
CREATE TABLE IF NOT EXISTS public.workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_index SMALLINT NOT NULL DEFAULT 0,
    exercise_name TEXT NOT NULL,
    sets_count SMALLINT NOT NULL CHECK (sets_count > 0),
    reps_count SMALLINT NOT NULL CHECK (reps_count > 0),
    working_weight NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (working_weight >= 0),

    -- Автоматический расчет общего тоннажа упражнения: подходы * повторения * рабочий вес
    total_tonnage NUMERIC(10, 2) GENERATED ALWAYS AS (
        ROUND((sets_count::NUMERIC * reps_count::NUMERIC * working_weight), 2)
    ) STORED,

    -- Опциональная детализация по каждому подходу (например, при работе «пирамидой»)
    sets_detail JSONB NOT NULL DEFAULT '[]'::JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workout_exercises IS 'Упражнения тренировки с автоподсчетом тоннажа';

-- Функция и триггер для пересчета суммарного тоннажа в родительской таблице workouts
CREATE OR REPLACE FUNCTION public.recalculate_workout_tonnage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.workouts
        SET total_tonnage = COALESCE((
            SELECT SUM(total_tonnage)
            FROM public.workout_exercises
            WHERE workout_id = OLD.workout_id
        ), 0)
        WHERE id = OLD.workout_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE public.workouts
        SET total_tonnage = COALESCE((
            SELECT SUM(total_tonnage)
            FROM public.workout_exercises
            WHERE workout_id = NEW.workout_id
        ), 0)
        WHERE id = NEW.workout_id;
    ELSE
        -- UPDATE: учитываем случай переноса упражнения между тренировками
        UPDATE public.workouts
        SET total_tonnage = COALESCE((
            SELECT SUM(total_tonnage)
            FROM public.workout_exercises
            WHERE workout_id = NEW.workout_id
        ), 0)
        WHERE id = NEW.workout_id;

        IF OLD.workout_id IS DISTINCT FROM NEW.workout_id THEN
            UPDATE public.workouts
            SET total_tonnage = COALESCE((
                SELECT SUM(total_tonnage)
                FROM public.workout_exercises
                WHERE workout_id = OLD.workout_id
            ), 0)
            WHERE id = OLD.workout_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_workout_tonnage ON public.workout_exercises;
CREATE TRIGGER trg_recalculate_workout_tonnage
    AFTER INSERT OR UPDATE OR DELETE ON public.workout_exercises
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_workout_tonnage();

-- Фотографии физической формы (прогресса)
CREATE TABLE IF NOT EXISTS public.workout_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL, -- Путь к файлу в приватном бакете workout-photos
    taken_at DATE NOT NULL DEFAULT CURRENT_DATE,
    body_weight NUMERIC(5, 2) CHECK (body_weight IS NULL OR body_weight > 0),
    caption TEXT, -- Ракурс / комментарий к форме
    source public.entry_source NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workout_photos IS 'Фотографии прогресса физической формы, хранящиеся в бакете workout-photos';


-- ============================================================================
-- 5. РАЗДЕЛ «ЧТЕНИЕ КНИГ» (books, book_notes, book_reading_logs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    cover_storage_path TEXT, -- Путь к обложке в бакете book-covers (опционально)
    total_pages INTEGER NOT NULL CHECK (total_pages > 0),
    current_page INTEGER NOT NULL DEFAULT 0 CHECK (current_page >= 0 AND current_page <= total_pages),
    status public.book_status NOT NULL DEFAULT 'reading',

    -- Автоматически вычисляемый процент прогресса чтения (0.00 - 100.00)
    progress_percent NUMERIC(5, 2) GENERATED ALWAYS AS (
        COALESCE(ROUND((current_page::NUMERIC / NULLIF(total_pages::NUMERIC, 0)) * 100.0, 2), 0)
    ) STORED,

    started_at DATE DEFAULT CURRENT_DATE,
    finished_at DATE,
    general_notes TEXT, -- Общая рецензия или ключевые выводы по книге
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.books IS 'Библиотека книг с автоподсчетом процента прочитанного';

-- Триггер автоперевода статуса книги в completed при достижении последней страницы
CREATE OR REPLACE FUNCTION public.sync_book_completion_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.current_page >= NEW.total_pages THEN
        NEW.status := 'completed';
        IF NEW.finished_at IS NULL THEN
            NEW.finished_at := CURRENT_DATE;
        END IF;
    ELSIF NEW.status = 'completed' AND NEW.current_page < NEW.total_pages THEN
        -- Если пользователь вручную отметил книгу завершенной, доводим счетчик до конца
        NEW.current_page := NEW.total_pages;
        IF NEW.finished_at IS NULL THEN
            NEW.finished_at := CURRENT_DATE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_book_completion ON public.books;
CREATE TRIGGER trg_sync_book_completion
    BEFORE INSERT OR UPDATE ON public.books
    FOR EACH ROW EXECUTE FUNCTION public.sync_book_completion_status();

DROP TRIGGER IF EXISTS trg_books_updated_at ON public.books;
CREATE TRIGGER trg_books_updated_at
    BEFORE UPDATE ON public.books
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Цитаты и заметки по книгам
CREATE TABLE IF NOT EXISTS public.book_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_quote BOOLEAN NOT NULL DEFAULT true, -- true = цитата из книги, false = собственная мысль
    page_number INTEGER CHECK (page_number IS NULL OR page_number > 0),
    content TEXT NOT NULL,
    source public.entry_source NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.book_notes IS 'Цитаты и конспекты по книгам';

-- Лог ежедневных сессий чтения (для трекинга привычки по дням)
CREATE TABLE IF NOT EXISTS public.book_reading_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_page INTEGER NOT NULL CHECK (start_page >= 0),
    end_page INTEGER NOT NULL CHECK (end_page >= start_page),
    pages_read INTEGER GENERATED ALWAYS AS (end_page - start_page) STORED,
    source public.entry_source NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.book_reading_logs IS 'Ежедневная история чтения страниц для аналитики в ежедневнике';


-- ============================================================================
-- 6. РАЗДЕЛ «ЧТЕНИЕ КОРАНА» (quran_logs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quran_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Координаты чтения: сура + аяты ИЛИ джуз / страница мусхафа
    surah_number SMALLINT CHECK (surah_number IS NULL OR surah_number BETWEEN 1 AND 114),
    surah_name TEXT,
    ayah_from SMALLINT CHECK (ayah_from IS NULL OR ayah_from >= 1),
    ayah_to SMALLINT CHECK (ayah_to IS NULL OR (ayah_from IS NOT NULL AND ayah_to >= ayah_from)),
    juz_number SMALLINT CHECK (juz_number IS NULL OR juz_number BETWEEN 1 AND 30),
    mushaf_page SMALLINT CHECK (mushaf_page IS NULL OR mushaf_page BETWEEN 1 AND 604),

    -- Скриншот или фото прочитанной страницы в приватном бакете quran-pages
    screenshot_storage_path TEXT,

    -- Поле для глубоких размышлений над аятами (тадаббур)
    tadabbur_notes TEXT,

    source public.entry_source NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Гарантируем, что указан хотя бы один ориентир чтения
    CONSTRAINT chk_quran_reference_present CHECK (
        surah_number IS NOT NULL OR juz_number IS NOT NULL OR mushaf_page IS NOT NULL
    )
);

COMMENT ON TABLE public.quran_logs IS 'Дневник чтения Корана и размышлений над аятами (тадаббур)';

DROP TRIGGER IF EXISTS trg_quran_logs_updated_at ON public.quran_logs;
CREATE TRIGGER trg_quran_logs_updated_at
    BEFORE UPDATE ON public.quran_logs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- 7. РАЗДЕЛ «ПИТАНИЕ (БЖУ)» (food_products, nutrition_meals, nutrition_meal_items)
-- ============================================================================

-- Справочник продуктов (общие продукты при user_id IS NULL + личные продукты пользователя)
CREATE TABLE IF NOT EXISTS public.food_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    calories_per_100g NUMERIC(6, 1) NOT NULL CHECK (calories_per_100g >= 0),
    protein_per_100g NUMERIC(5, 1) NOT NULL CHECK (protein_per_100g >= 0),
    fats_per_100g NUMERIC(5, 1) NOT NULL CHECK (fats_per_100g >= 0),
    carbs_per_100g NUMERIC(5, 1) NOT NULL CHECK (carbs_per_100g >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.food_products IS 'База продуктов с показателями КБЖУ на 100 грамм';

-- Приемы пищи (завтрак, обед, ужин, перекус)
CREATE TABLE IF NOT EXISTS public.nutrition_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type public.meal_type NOT NULL,
    description TEXT, -- Текстовое описание рациона / заметка (в т.ч. из Telegram)

    -- Суммарные показатели КБЖУ за прием пищи
    total_calories NUMERIC(7, 1) NOT NULL DEFAULT 0 CHECK (total_calories >= 0),
    total_protein NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (total_protein >= 0),
    total_fats NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (total_fats >= 0),
    total_carbs NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (total_carbs >= 0),

    -- Если false — итоги пересчитываются автоматически из позиций nutrition_meal_items;
    -- если true — разрешен экспресс-ввод готовых КБЖУ (например, через AI-оценку в боте)
    is_manual_macros BOOLEAN NOT NULL DEFAULT false,

    source public.entry_source NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nutrition_meals IS 'Приемы пищи за день с агрегированными КБЖУ';

DROP TRIGGER IF EXISTS trg_nutrition_meals_updated_at ON public.nutrition_meals;
CREATE TRIGGER trg_nutrition_meals_updated_at
    BEFORE UPDATE ON public.nutrition_meals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Конкретные продукты и граммовки внутри приема пищи
CREATE TABLE IF NOT EXISTS public.nutrition_meal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES public.nutrition_meals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.food_products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    weight_grams NUMERIC(6, 1) NOT NULL CHECK (weight_grams > 0),

    -- Нутриенты на 100 г (копируются из справочника при вставке или задаются вручную)
    calories_per_100g NUMERIC(6, 1) NOT NULL CHECK (calories_per_100g >= 0),
    protein_per_100g NUMERIC(5, 1) NOT NULL CHECK (protein_per_100g >= 0),
    fats_per_100g NUMERIC(5, 1) NOT NULL CHECK (fats_per_100g >= 0),
    carbs_per_100g NUMERIC(5, 1) NOT NULL CHECK (carbs_per_100g >= 0),

    -- Автоматический подсчет КБЖУ конкретной порции от веса в граммах
    calories NUMERIC(7, 1) GENERATED ALWAYS AS (ROUND((calories_per_100g * weight_grams) / 100.0, 1)) STORED,
    protein NUMERIC(6, 1) GENERATED ALWAYS AS (ROUND((protein_per_100g * weight_grams) / 100.0, 1)) STORED,
    fats NUMERIC(6, 1) GENERATED ALWAYS AS (ROUND((fats_per_100g * weight_grams) / 100.0, 1)) STORED,
    carbs NUMERIC(6, 1) GENERATED ALWAYS AS (ROUND((carbs_per_100g * weight_grams) / 100.0, 1)) STORED,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nutrition_meal_items IS 'Позиции продуктов в приеме пищи с авторасчетом КБЖУ от веса порции';

-- Автоподстановка БЖУ на 100 г из справочника food_products, если передан product_id
CREATE OR REPLACE FUNCTION public.populate_meal_item_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    prod RECORD;
BEGIN
    IF NEW.product_id IS NOT NULL AND (
        NEW.product_name IS NULL OR NEW.calories_per_100g IS NULL
    ) THEN
        SELECT name, calories_per_100g, protein_per_100g, fats_per_100g, carbs_per_100g
        INTO prod
        FROM public.food_products
        WHERE id = NEW.product_id;

        IF FOUND THEN
            NEW.product_name := COALESCE(NEW.product_name, prod.name);
            NEW.calories_per_100g := COALESCE(NEW.calories_per_100g, prod.calories_per_100g);
            NEW.protein_per_100g := COALESCE(NEW.protein_per_100g, prod.protein_per_100g);
            NEW.fats_per_100g := COALESCE(NEW.fats_per_100g, prod.fats_per_100g);
            NEW.carbs_per_100g := COALESCE(NEW.carbs_per_100g, prod.carbs_per_100g);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_meal_item ON public.nutrition_meal_items;
CREATE TRIGGER trg_populate_meal_item
    BEFORE INSERT ON public.nutrition_meal_items
    FOR EACH ROW EXECUTE FUNCTION public.populate_meal_item_from_product();

-- Триггер автоматического суммирования КБЖУ позиций в родительский прием пищи (nutrition_meals)
CREATE OR REPLACE FUNCTION public.recalculate_meal_macros()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_meal_id UUID;
    v_old_meal_id UUID := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_meal_id := OLD.meal_id;
    ELSIF TG_OP = 'INSERT' THEN
        v_meal_id := NEW.meal_id;
    ELSE
        v_meal_id := NEW.meal_id;
        IF OLD.meal_id IS DISTINCT FROM NEW.meal_id THEN
            v_old_meal_id := OLD.meal_id;
        END IF;
    END IF;

    UPDATE public.nutrition_meals m
    SET
        total_calories = COALESCE(sub.sum_cal, 0),
        total_protein  = COALESCE(sub.sum_prot, 0),
        total_fats     = COALESCE(sub.sum_fats, 0),
        total_carbs    = COALESCE(sub.sum_carbs, 0),
        is_manual_macros = false
    FROM (
        SELECT
            SUM(calories) AS sum_cal,
            SUM(protein)  AS sum_prot,
            SUM(fats)     AS sum_fats,
            SUM(carbs)    AS sum_carbs
        FROM public.nutrition_meal_items
        WHERE meal_id = v_meal_id
    ) sub
    WHERE m.id = v_meal_id;

    IF v_old_meal_id IS NOT NULL THEN
        UPDATE public.nutrition_meals m
        SET
            total_calories = COALESCE(sub.sum_cal, 0),
            total_protein  = COALESCE(sub.sum_prot, 0),
            total_fats     = COALESCE(sub.sum_fats, 0),
            total_carbs    = COALESCE(sub.sum_carbs, 0),
            is_manual_macros = false
        FROM (
            SELECT
                SUM(calories) AS sum_cal,
                SUM(protein)  AS sum_prot,
                SUM(fats)     AS sum_fats,
                SUM(carbs)    AS sum_carbs
            FROM public.nutrition_meal_items
            WHERE meal_id = v_old_meal_id
        ) sub
        WHERE m.id = v_old_meal_id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_meal_macros ON public.nutrition_meal_items;
CREATE TRIGGER trg_recalculate_meal_macros
    AFTER INSERT OR UPDATE OR DELETE ON public.nutrition_meal_items
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_meal_macros();

-- Представление (VIEW) для итоговых шкал дневной нормы КБЖУ (с соблюдением RLS через security_invoker)
CREATE OR REPLACE VIEW public.daily_nutrition_summary
WITH (security_invoker = true)
AS
SELECT
    m.user_id,
    m.meal_date,
    SUM(m.total_calories) AS consumed_calories,
    SUM(m.total_protein)  AS consumed_protein,
    SUM(m.total_fats)     AS consumed_fats,
    SUM(m.total_carbs)    AS consumed_carbs,
    p.daily_calories_goal,
    p.daily_protein_goal,
    p.daily_fats_goal,
    p.daily_carbs_goal,
    ROUND((SUM(m.total_calories) / NULLIF(p.daily_calories_goal, 0)) * 100.0, 1) AS calories_percent,
    ROUND((SUM(m.total_protein)  / NULLIF(p.daily_protein_goal, 0))  * 100.0, 1) AS protein_percent,
    ROUND((SUM(m.total_fats)     / NULLIF(p.daily_fats_goal, 0))     * 100.0, 1) AS fats_percent,
    ROUND((SUM(m.total_carbs)    / NULLIF(p.daily_carbs_goal, 0))    * 100.0, 1) AS carbs_percent
FROM public.nutrition_meals m
JOIN public.profiles p ON p.id = m.user_id
GROUP BY
    m.user_id,
    m.meal_date,
    p.daily_calories_goal,
    p.daily_protein_goal,
    p.daily_fats_goal,
    p.daily_carbs_goal;

COMMENT ON VIEW public.daily_nutrition_summary IS 'Агрегация дневного потребления КБЖУ и процентов выполнения нормы';


-- ============================================================================
-- 8. РАЗДЕЛ «ВАЙБКОДИНГ / ОБУЧЕНИЕ» (learning_items, commercial_orders, coding_sprints)
-- ============================================================================

-- Изучаемые темы и пет-проекты
CREATE TABLE IF NOT EXISTS public.learning_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category public.learning_category NOT NULL DEFAULT 'topic',
    title TEXT NOT NULL,
    description TEXT,
    tech_stack TEXT[] NOT NULL DEFAULT '{}',
    repo_url TEXT,
    live_url TEXT,
    status public.learning_status NOT NULL DEFAULT 'in_progress',
    progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    total_minutes_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_minutes_spent >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.learning_items IS 'Список изучаемых технологий и собственных пет-проектов';

DROP TRIGGER IF EXISTS trg_learning_items_updated_at ON public.learning_items;
CREATE TRIGGER trg_learning_items_updated_at
    BEFORE UPDATE ON public.learning_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Коммерческие заказы
CREATE TABLE IF NOT EXISTS public.commercial_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_title TEXT NOT NULL,
    client_name TEXT,
    client_contact TEXT,
    description TEXT,
    status public.order_status NOT NULL DEFAULT 'lead',
    budget_amount NUMERIC(12, 2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'RUB',
    deadline DATE,
    total_minutes_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_minutes_spent >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_orders IS 'Учет коммерческих заказов, оплат, дедлайнов и затраченного времени';

DROP TRIGGER IF EXISTS trg_commercial_orders_updated_at ON public.commercial_orders;
CREATE TRIGGER trg_commercial_orders_updated_at
    BEFORE UPDATE ON public.commercial_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Трекер времени / спринтов разработки
CREATE TABLE IF NOT EXISTS public.coding_sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    learning_item_id UUID REFERENCES public.learning_items(id) ON DELETE SET NULL,
    commercial_order_id UUID REFERENCES public.commercial_orders(id) ON DELETE SET NULL,
    sprint_date DATE NOT NULL DEFAULT CURRENT_DATE,
    goal TEXT NOT NULL, -- Задача на спринт
    ai_tools_used TEXT[] NOT NULL DEFAULT '{}', -- Например: {'Antigravity', 'Cursor', 'Claude'}
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ, -- NULL означает, что таймер спринта сейчас активен
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    notes TEXT, -- Итоги спринта, решенные проблемы, удачные промпты
    source public.entry_source NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_sprint_dates CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT chk_single_sprint_target CHECK (
        NOT (learning_item_id IS NOT NULL AND commercial_order_id IS NOT NULL)
    )
);

COMMENT ON TABLE public.coding_sprints IS 'Трекер спринтов разработки и обучения (Deep Work / Pomodoro)';

-- Авторасчет длительности спринта при остановке таймера + пересчет общего времени в темах и заказах
CREATE OR REPLACE FUNCTION public.compute_sprint_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND NEW.duration_minutes IS NULL THEN
        NEW.duration_minutes := GREATEST(
            1,
            ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60.0)::INTEGER
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_sprint_duration ON public.coding_sprints;
CREATE TRIGGER trg_compute_sprint_duration
    BEFORE INSERT OR UPDATE ON public.coding_sprints
    FOR EACH ROW EXECUTE FUNCTION public.compute_sprint_duration();

CREATE OR REPLACE FUNCTION public.recalculate_coding_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_learning_ids UUID[] := '{}';
    v_order_ids UUID[] := '{}';
    v_id UUID;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.learning_item_id IS NOT NULL THEN
            v_learning_ids := array_append(v_learning_ids, NEW.learning_item_id);
        END IF;
        IF NEW.commercial_order_id IS NOT NULL THEN
            v_order_ids := array_append(v_order_ids, NEW.commercial_order_id);
        END IF;
    END IF;

    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        IF OLD.learning_item_id IS NOT NULL AND NOT (OLD.learning_item_id = ANY(v_learning_ids)) THEN
            v_learning_ids := array_append(v_learning_ids, OLD.learning_item_id);
        END IF;
        IF OLD.commercial_order_id IS NOT NULL AND NOT (OLD.commercial_order_id = ANY(v_order_ids)) THEN
            v_order_ids := array_append(v_order_ids, OLD.commercial_order_id);
        END IF;
    END IF;

    FOREACH v_id IN ARRAY v_learning_ids LOOP
        UPDATE public.learning_items
        SET total_minutes_spent = COALESCE((
            SELECT SUM(duration_minutes)
            FROM public.coding_sprints
            WHERE learning_item_id = v_id AND duration_minutes IS NOT NULL
        ), 0)
        WHERE id = v_id;
    END LOOP;

    FOREACH v_id IN ARRAY v_order_ids LOOP
        UPDATE public.commercial_orders
        SET total_minutes_spent = COALESCE((
            SELECT SUM(duration_minutes)
            FROM public.coding_sprints
            WHERE commercial_order_id = v_id AND duration_minutes IS NOT NULL
        ), 0)
        WHERE id = v_id;
    END LOOP;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_coding_totals ON public.coding_sprints;
CREATE TRIGGER trg_recalculate_coding_totals
    AFTER INSERT OR UPDATE OR DELETE ON public.coding_sprints
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_coding_totals();

DROP TRIGGER IF EXISTS trg_coding_sprints_updated_at ON public.coding_sprints;
CREATE TRIGGER trg_coding_sprints_updated_at
    BEFORE UPDATE ON public.coding_sprints
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- 9. ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ (MOBILE-FIRST & RLS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user ON public.telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON public.workouts(user_id, workout_date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON public.workout_exercises(workout_id, order_index);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_user ON public.workout_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_photos_user_date ON public.workout_photos(user_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_user_status ON public.books(user_id, status);
CREATE INDEX IF NOT EXISTS idx_book_notes_book ON public.book_notes(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_notes_user ON public.book_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_book_reading_logs_user_date ON public.book_reading_logs(user_id, read_date DESC);

CREATE INDEX IF NOT EXISTS idx_quran_logs_user_date ON public.quran_logs(user_id, read_date DESC);

CREATE INDEX IF NOT EXISTS idx_food_products_user_name ON public.food_products(user_id, name);
CREATE INDEX IF NOT EXISTS idx_nutrition_meals_user_date ON public.nutrition_meals(user_id, meal_date DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_meal_items_meal ON public.nutrition_meal_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_meal_items_user ON public.nutrition_meal_items(user_id);

CREATE INDEX IF NOT EXISTS idx_learning_items_user_status ON public.learning_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_commercial_orders_user_status ON public.commercial_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coding_sprints_user_date ON public.coding_sprints(user_id, sprint_date DESC);
-- Частичный индекс для мгновенного поиска активного (запущенного) таймера спринта
CREATE INDEX IF NOT EXISTS idx_coding_sprints_active ON public.coding_sprints(user_id) WHERE ended_at IS NULL;


-- ============================================================================
-- 10. ВКЛЮЧЕНИЕ ROW LEVEL SECURITY (RLS) И ПОЛИТИКИ БЕЗОПАСНОСТИ
-- Используется паттерн (SELECT auth.uid()) для кэширования InitPlan в PostgreSQL
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_sprints ENABLE ROW LEVEL SECURITY;

-- 10.1 Профиль пользователя (id = auth.uid())
DROP POLICY IF EXISTS "Профиль: чтение своего профиля" ON public.profiles;
CREATE POLICY "Профиль: чтение своего профиля"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Профиль: обновление своего профиля" ON public.profiles;
CREATE POLICY "Профиль: обновление своего профиля"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Профиль: создание своего профиля" ON public.profiles;
CREATE POLICY "Профиль: создание своего профиля"
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = (SELECT auth.uid()));

-- 10.2 Токены привязки Telegram
DROP POLICY IF EXISTS "Токены Telegram: полный доступ владельцу" ON public.telegram_link_tokens;
CREATE POLICY "Токены Telegram: полный доступ владельцу"
    ON public.telegram_link_tokens FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 10.3 Тренировки, упражнения и фото формы
DROP POLICY IF EXISTS "Тренировки: полный доступ владельцу" ON public.workouts;
CREATE POLICY "Тренировки: полный доступ владельцу"
    ON public.workouts FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Упражнения: полный доступ владельцу" ON public.workout_exercises;
CREATE POLICY "Упражнения: полный доступ владельцу"
    ON public.workout_exercises FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Фото формы: полный доступ владельцу" ON public.workout_photos;
CREATE POLICY "Фото формы: полный доступ владельцу"
    ON public.workout_photos FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 10.4 Чтение книг, цитаты и сессии чтения
DROP POLICY IF EXISTS "Книги: полный доступ владельцу" ON public.books;
CREATE POLICY "Книги: полный доступ владельцу"
    ON public.books FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Заметки к книгам: полный доступ владельцу" ON public.book_notes;
CREATE POLICY "Заметки к книгам: полный доступ владельцу"
    ON public.book_notes FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Логи чтения книг: полный доступ владельцу" ON public.book_reading_logs;
CREATE POLICY "Логи чтения книг: полный доступ владельцу"
    ON public.book_reading_logs FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 10.5 Чтение Корана
DROP POLICY IF EXISTS "Чтение Корана: полный доступ владельцу" ON public.quran_logs;
CREATE POLICY "Чтение Корана: полный доступ владельцу"
    ON public.quran_logs FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 10.6 Питание: справочник продуктов (общие продукты доступны на чтение всем авторизованным)
DROP POLICY IF EXISTS "Продукты: чтение общих и своих продуктов" ON public.food_products;
CREATE POLICY "Продукты: чтение общих и своих продуктов"
    ON public.food_products FOR SELECT TO authenticated
    USING (user_id IS NULL OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Продукты: добавление своих продуктов" ON public.food_products;
CREATE POLICY "Продукты: добавление своих продуктов"
    ON public.food_products FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Продукты: изменение своих продуктов" ON public.food_products;
CREATE POLICY "Продукты: изменение своих продуктов"
    ON public.food_products FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Продукты: удаление своих продуктов" ON public.food_products;
CREATE POLICY "Продукты: удаление своих продуктов"
    ON public.food_products FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Приемы пищи: полный доступ владельцу" ON public.nutrition_meals;
CREATE POLICY "Приемы пищи: полный доступ владельцу"
    ON public.nutrition_meals FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Позиции питания: полный доступ владельцу" ON public.nutrition_meal_items;
CREATE POLICY "Позиции питания: полный доступ владельцу"
    ON public.nutrition_meal_items FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 10.7 Вайбкодинг / Обучение / Коммерческие заказы
DROP POLICY IF EXISTS "Обучение и пет-проекты: полный доступ владельцу" ON public.learning_items;
CREATE POLICY "Обучение и пет-проекты: полный доступ владельцу"
    ON public.learning_items FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Коммерческие заказы: полный доступ владельцу" ON public.commercial_orders;
CREATE POLICY "Коммерческие заказы: полный доступ владельцу"
    ON public.commercial_orders FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Спринты разработки: полный доступ владельцу" ON public.coding_sprints;
CREATE POLICY "Спринты разработки: полный доступ владельцу"
    ON public.coding_sprints FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));


-- ============================================================================
-- 11. SUPABASE STORAGE: БАКЕТЫ ДЛЯ ФОТО И RLS-ПОЛИТИКИ ХРАНИЛИЩА
-- Структура хранения файлов: {user_id}/{год-месяц}/{uuid}.{ext}
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    -- Приватный бакет для фото физической формы (до 10 МБ)
    (
        'workout-photos',
        'workout-photos',
        false,
        10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    ),
    -- Приватный бакет для скриншотов и фото страниц Корана (до 10 МБ)
    (
        'quran-pages',
        'quran-pages',
        false,
        10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    ),
    -- Публичный бакет для обложек книг (до 5 МБ)
    (
        'book-covers',
        'book-covers',
        true,
        5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Политики доступа к приватным бакетам workout-photos и quran-pages
-- Первый сегмент пути (папка) обязан совпадать с UUID текущего пользователя: {user_id}/...
DROP POLICY IF EXISTS "Приватные фото: чтение только из своей папки" ON storage.objects;
CREATE POLICY "Приватные фото: чтение только из своей папки"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id IN ('workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Приватные фото: загрузка только в свою папку" ON storage.objects;
CREATE POLICY "Приватные фото: загрузка только в свою папку"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Приватные фото: обновление только в своей папке" ON storage.objects;
CREATE POLICY "Приватные фото: обновление только в своей папке"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id IN ('workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    )
    WITH CHECK (
        bucket_id IN ('workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Приватные фото: удаление только из своей папки" ON storage.objects;
CREATE POLICY "Приватные фото: удаление только из своей папки"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id IN ('workout-photos', 'quran-pages')
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

-- Политики для публичного бакета обложек книг (book-covers)
DROP POLICY IF EXISTS "Обложки книг: публичное чтение" ON storage.objects;
CREATE POLICY "Обложки книг: публичное чтение"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'book-covers');

DROP POLICY IF EXISTS "Обложки книг: загрузка в свою папку" ON storage.objects;
CREATE POLICY "Обложки книг: загрузка в свою папку"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'book-covers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Обложки книг: обновление в своей папке" ON storage.objects;
CREATE POLICY "Обложки книг: обновление в своей папке"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'book-covers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    )
    WITH CHECK (
        bucket_id = 'book-covers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

DROP POLICY IF EXISTS "Обложки книг: удаление из своей папки" ON storage.objects;
CREATE POLICY "Обложки книг: удаление из своей папки"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'book-covers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );
