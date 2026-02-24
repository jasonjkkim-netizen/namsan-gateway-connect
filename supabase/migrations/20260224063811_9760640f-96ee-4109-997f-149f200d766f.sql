
-- Update handle_new_user to reactivate deleted profiles instead of creating duplicates
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  clean_name TEXT;
  existing_profile_id UUID;
BEGIN
  -- Get and sanitize full_name from metadata
  clean_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  -- Limit length to 100 characters
  IF length(clean_name) > 100 THEN
    clean_name := left(clean_name, 100);
  END IF;
  
  -- Strip control characters
  clean_name := regexp_replace(clean_name, '[\x00-\x1F\x7F]', '', 'g');
  
  -- Ensure name is not empty after sanitization
  IF clean_name IS NULL OR length(trim(clean_name)) = 0 THEN
    clean_name := NEW.email;
  END IF;

  -- Check if a deleted profile exists for this email
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email AND is_deleted = true
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Reactivate the existing deleted profile
    UPDATE public.profiles
    SET user_id = NEW.id,
        full_name = trim(clean_name),
        is_deleted = false,
        deleted_at = NULL,
        deleted_by = NULL,
        is_approved = false,
        is_rejected = false,
        rejected_at = NULL,
        rejected_by = NULL,
        approved_at = NULL,
        approved_by = NULL,
        updated_at = now()
    WHERE id = existing_profile_id;
  ELSE
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, trim(clean_name));
  END IF;

  RETURN NEW;
END;
$function$;
