create table if not exists public.project_resources (
    id uuid default gen_random_uuid() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    name text not null,
    role text,
    monthly_cost numeric default 0,
    contact text,
    status text check (status in ('active', 'inactive')) default 'active',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.project_resources enable row level security;

-- Drop existing policies if any
drop policy if exists "Enable all for authenticated users" on public.project_resources;
drop policy if exists "Enable read for authenticated users" on public.project_resources;
drop policy if exists "Enable insert for authenticated users" on public.project_resources;
drop policy if exists "Enable update for authenticated users" on public.project_resources;
drop policy if exists "Enable delete for authenticated users" on public.project_resources;

-- Create policies
create policy "Enable all for authenticated users"
    on public.project_resources for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
