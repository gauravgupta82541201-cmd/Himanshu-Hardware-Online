create extension if not exists pgcrypto;

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(12,2) default 0,
  unit text default '',
  description text default '',
  image_url text default '',
  available boolean default true,
  stock integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists shop_settings (
  id integer primary key default 1 check (id = 1),
  name text default 'Himanshu Hardware',
  phone text default '6200908356',
  whatsapp text default '6200908356',
  address text default 'AT+PO – REMBA (KANIBAZZAR), Near Bank of India, PS – Hirodih, Via – Rajdhanwar, Dist – Giridih, Jharkhand – 825412',
  maps_url text default 'https://maps.app.goo.gl/LFuJDqKL6UYEtwBH8?g_st=aw',
  logo_url text default '',
  cover_url text default '',
  instagram_url text default '',
  facebook_url text default '',
  youtube_url text default '',
  website_url text default '',
  open_time text default '7:00 AM',
  close_time text default '9:00 PM',
  google_rating text default '4.0',
  description text default 'Hardware, construction items, paint accessories, plywood aur daily repair needs — sab ek jagah.',
  updated_at timestamptz default now()
);

insert into shop_settings (id) values (1) on conflict (id) do nothing;