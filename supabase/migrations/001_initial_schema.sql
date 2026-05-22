create table captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  transcript text,
  summary text,
  audio_url text,
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  capture_id uuid references captures(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  status text default 'pending',
  confidence numeric,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  capture_id uuid references captures(id) on delete cascade,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  confidence numeric
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  capture_id uuid references captures(id) on delete cascade,
  title text not null,
  content text,
  created_at timestamptz default now()
);