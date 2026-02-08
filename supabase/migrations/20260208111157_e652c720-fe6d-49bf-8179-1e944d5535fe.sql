-- Fix: Add input validation to handle_new_user() function
-- Fix: Add server-side validation triggers for profiles table

-- 1. Update handle_new_user() to validate and sanitize input
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_name TEXT;
BEGIN
  -- Get and sanitize full_name from metadata
  clean_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  -- Limit length to 100 characters
  IF length(clean_name) > 100 THEN
    clean_name := left(clean_name, 100);
  END IF;
  
  -- Strip control characters (0x00-0x1F and 0x7F)
  clean_name := regexp_replace(clean_name, '[\x00-\x1F\x7F]', '', 'g');
  
  -- Ensure name is not empty after sanitization
  IF clean_name IS NULL OR length(trim(clean_name)) = 0 THEN
    clean_name := NEW.email;
  END IF;
  
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    trim(clean_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create a validation trigger function for profiles table
CREATE OR REPLACE FUNCTION public.validate_profile_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate full_name: required, 1-100 characters
  IF NEW.full_name IS NULL OR length(trim(NEW.full_name)) < 1 THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF length(NEW.full_name) > 100 THEN
    RAISE EXCEPTION 'Full name must be 100 characters or less';
  END IF;
  
  -- Strip control characters from full_name
  NEW.full_name := regexp_replace(NEW.full_name, '[\x00-\x1F\x7F]', '', 'g');
  
  -- Validate full_name_ko if provided: max 100 characters
  IF NEW.full_name_ko IS NOT NULL THEN
    IF length(NEW.full_name_ko) > 100 THEN
      RAISE EXCEPTION 'Korean name must be 100 characters or less';
    END IF;
    NEW.full_name_ko := regexp_replace(NEW.full_name_ko, '[\x00-\x1F\x7F]', '', 'g');
  END IF;
  
  -- Validate phone if provided: 10-20 characters
  IF NEW.phone IS NOT NULL AND length(NEW.phone) > 0 THEN
    IF length(NEW.phone) < 10 OR length(NEW.phone) > 20 THEN
      RAISE EXCEPTION 'Phone must be between 10 and 20 characters';
    END IF;
    -- Strip non-allowed characters (keep only digits, spaces, hyphens, plus, parentheses)
    NEW.phone := regexp_replace(NEW.phone, '[^0-9+\-() ]', '', 'g');
  END IF;
  
  -- Validate address if provided: 5-500 characters
  IF NEW.address IS NOT NULL AND length(NEW.address) > 0 THEN
    IF length(NEW.address) < 5 OR length(NEW.address) > 500 THEN
      RAISE EXCEPTION 'Address must be between 5 and 500 characters';
    END IF;
    -- Strip control characters
    NEW.address := regexp_replace(NEW.address, '[\x00-\x1F\x7F]', '', 'g');
  END IF;
  
  -- Validate email format
  IF NEW.email IS NULL OR NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  IF length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'Email must be 255 characters or less';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Create or replace the validation trigger on profiles table
DROP TRIGGER IF EXISTS validate_profile_before_insert_update ON public.profiles;
CREATE TRIGGER validate_profile_before_insert_update
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_data();