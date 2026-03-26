-- Open up profiles access so everyone can see each other for assignment
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Allow authenticated to read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
