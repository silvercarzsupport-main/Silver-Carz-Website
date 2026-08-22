-- Add a base city to each fleet vehicle so customer browse can filter
-- by the city of booking. Existing rows are stationed in Nagpur.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS city text;

UPDATE public.vehicles
SET city = 'Nagpur'
WHERE city IS NULL OR btrim(city) = '';

ALTER TABLE public.vehicles
  ALTER COLUMN city SET DEFAULT 'Nagpur';

ALTER TABLE public.vehicles
  ALTER COLUMN city SET NOT NULL;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_city_not_blank;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_city_not_blank
  CHECK (char_length(btrim(city)) > 0 AND char_length(btrim(city)) <= 80);

COMMENT ON COLUMN public.vehicles.city IS
  'Base city where this vehicle is stationed. Customer Book a Car lists only vehicles in the visitor city.';

CREATE INDEX IF NOT EXISTS vehicles_city_idx ON public.vehicles (city);
