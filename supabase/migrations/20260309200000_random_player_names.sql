-- Revert handle_new_user to original — player names are generated client-side
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, 'New Senator');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
