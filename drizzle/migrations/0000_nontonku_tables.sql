-- Data tontonan pengguna: riwayat & daftar tersimpan
CREATE TABLE public.watch_history (
  user_id uuid NOT NULL,
  media_type text NOT NULL DEFAULT 'movie' CHECK (media_type IN ('movie','tv')),
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  poster_path text,
  season_number integer,
  episode_number integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, media_type, tmdb_id)
);

CREATE TABLE public.watchlist (
  user_id uuid NOT NULL,
  media_type text NOT NULL DEFAULT 'movie' CHECK (media_type IN ('movie','tv')),
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  poster_path text,
  overview text,
  release_date text,
  vote_average numeric,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, media_type, tmdb_id)
);

-- Profil ringkas untuk ID pengguna (username)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_history TO authenticated;
GRANT ALL ON public.watch_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pengguna membaca riwayatnya" ON public.watch_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Pengguna menambah riwayatnya" ON public.watch_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pengguna mengubah riwayatnya" ON public.watch_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pengguna menghapus riwayatnya" ON public.watch_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Pengguna membaca daftarnya" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Pengguna menambah daftarnya" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pengguna mengubah daftarnya" ON public.watchlist FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pengguna menghapus daftarnya" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Profil terbaca untuk cek ID" ON public.profiles FOR SELECT TO anon, authenticated USING (true);

-- Buat profil otomatis saat akun dibuat
CREATE OR REPLACE FUNCTION public.buat_profil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN unique_violation THEN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, left(coalesce(new.raw_user_meta_data->>'username','pengguna'), 20) || '_' || substr(new.id::text, 1, 4))
  ON CONFLICT (id) DO NOTHING;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.buat_profil_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.buat_profil_row(new);
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.buat_profil_row(_user auth.users)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (_user.id, coalesce(_user.raw_user_meta_data->>'username', split_part(_user.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN unique_violation THEN
  INSERT INTO public.profiles (id, username)
  VALUES (_user.id, left(coalesce(_user.raw_user_meta_data->>'username','pengguna'), 20) || '_' || substr(_user.id::text, 1, 4))
  ON CONFLICT (id) DO NOTHING;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.buat_profil_trigger();