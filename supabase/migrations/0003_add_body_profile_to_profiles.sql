-- ============================================================================
-- МИГРАЦИЯ 0003: ПАРАМЕТРЫ ТЕЛА (ВЕС, РОСТ) И ТАЙМЕР ОТДЫХА В ТАБЛИЦЕ PROFILES
-- ============================================================================

-- Добавляем колонки для антропометрии и тренировочных параметров в public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS body_weight NUMERIC(5, 2) DEFAULT 75.0 CHECK (body_weight IS NULL OR body_weight > 0),
ADD COLUMN IF NOT EXISTS body_height NUMERIC(5, 1) DEFAULT 178.0 CHECK (body_height IS NULL OR body_height > 0),
ADD COLUMN IF NOT EXISTS default_rest_seconds INTEGER DEFAULT 90 CHECK (default_rest_seconds IS NULL OR default_rest_seconds >= 10);

COMMENT ON COLUMN public.profiles.body_weight IS 'Текущий вес тела пользователя (кг) для расчетов тоннажа и калорий';
COMMENT ON COLUMN public.profiles.body_height IS 'Рост пользователя (см) для расчета ИМТ';
COMMENT ON COLUMN public.profiles.default_rest_seconds IS 'Время отдыха между подходами по умолчанию (в секундах)';
