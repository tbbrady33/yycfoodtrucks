-- Dev-only seed. NOT a migration — run manually via the Supabase Studio
-- SQL editor against the dev project.
--
-- Idempotent: safe to re-run (uses upserts on truck slug, deletes related
-- child rows before re-inserting).

----------------------------------------------------------------------
-- 6 trucks (one per category) and 2 bonus trucks
----------------------------------------------------------------------
insert into public.trucks (slug, name, description, category_id) values
  ('big-cheese',     'The Big Cheese',     'Smash burgers and grilled cheese.',         1),
  ('two-tacos',      'Dos Tacos',          'Birria, al pastor, and house salsas.',      2),
  ('smokebox',       'Smokebox BBQ',       '14-hour brisket and pulled pork.',          3),
  ('seoulmate',      'Seoulmate',          'Korean fried chicken, bibimbap bowls.',     4),
  ('sugar-shack',    'Sugar Shack',        'Mini donuts and seasonal soft serve.',      5),
  ('green-leaf',     'Green Leaf Kitchen', 'Plant-based bowls and salads.',             6),
  ('phomance',       'Phomance',           'Pho, banh mi, fresh rolls.',                4),
  ('holy-cow',       'Holy Cow',           'Slow-smoked beef rib and beans.',           3)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      category_id = excluded.category_id;

----------------------------------------------------------------------
-- Wipe + re-seed children for these trucks so re-runs stay consistent
----------------------------------------------------------------------
with target as (
  select id from public.trucks
  where slug in (
    'big-cheese','two-tacos','smokebox','seoulmate',
    'sugar-shack','green-leaf','phomance','holy-cow'
  )
)
delete from public.menu_items where truck_id in (select id from target);

with target as (
  select id from public.trucks
  where slug in (
    'big-cheese','two-tacos','smokebox','seoulmate',
    'sugar-shack','green-leaf','phomance','holy-cow'
  )
)
delete from public.schedule_template_slots where truck_id in (select id from target);

with target as (
  select id from public.trucks
  where slug in (
    'big-cheese','two-tacos','smokebox','seoulmate',
    'sugar-shack','green-leaf','phomance','holy-cow'
  )
)
delete from public.schedule_dated_slots where truck_id in (select id from target);

----------------------------------------------------------------------
-- Menus (4 items each, prices in cents)
----------------------------------------------------------------------
-- Helper CTE pattern: look up truck by slug, then insert.
with t as (select id from public.trucks where slug = 'big-cheese')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('Classic Smash',       1200, 1),
  ('Double Smash',        1500, 2),
  ('Grilled 3-Cheese',     900, 3),
  ('Truffle Fries',        700, 4)
) x(name, price, pos);

with t as (select id from public.trucks where slug = 'two-tacos')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('Al Pastor (3)',       1100, 1),
  ('Birria Quesadilla',   1400, 2),
  ('Carnitas (3)',        1100, 3),
  ('Elote',                500, 4)
) x(name, price, pos);

with t as (select id from public.trucks where slug = 'smokebox')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('Brisket Plate',       1800, 1),
  ('Pulled Pork Sandwich',1300, 2),
  ('Burnt Ends',          1600, 3),
  ('Mac & Cheese',         600, 4)
) x(name, price, pos);

with t as (select id from public.trucks where slug = 'seoulmate')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('KFC Box',             1500, 1),
  ('Bibimbap Bowl',       1400, 2),
  ('Spicy Wings',         1100, 3),
  ('Kimchi Fries',         900, 4)
) x(name, price, pos);

with t as (select id from public.trucks where slug = 'sugar-shack')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('Mini Donuts (12)',     800, 1),
  ('Soft Serve Cone',      600, 2),
  ('Funnel Cake',          900, 3),
  ('Hot Chocolate',        500, 4)
) x(name, price, pos);

with t as (select id from public.trucks where slug = 'green-leaf')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('Buddha Bowl',         1400, 1),
  ('Crispy Tofu Wrap',    1200, 2),
  ('Beet Hummus Plate',   1100, 3),
  ('Smoothie',             700, 4)
) x(name, price, pos);

with t as (select id from public.trucks where slug = 'phomance')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('Pho Tai',             1400, 1),
  ('Banh Mi',             1100, 2),
  ('Fresh Rolls (2)',      800, 3),
  ('Vietnamese Coffee',    500, 4)
) x(name, price, pos);

with t as (select id from public.trucks where slug = 'holy-cow')
insert into public.menu_items (truck_id, name, price_cents, position)
select t.id, x.name, x.price, x.pos from t, (values
  ('Beef Rib (1)',        2200, 1),
  ('Brisket Sandwich',    1400, 2),
  ('Baked Beans',          500, 3),
  ('Cornbread',            400, 4)
) x(name, price, pos);

----------------------------------------------------------------------
-- Weekly schedule template (published)
-- Day-of-week: 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
----------------------------------------------------------------------
with t as (select id from public.trucks where slug = 'big-cheese')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (2, '11:00', '14:00', 'Stephen Ave',     '8th Ave SW, Calgary'),
  (3, '11:00', '14:00', 'Stephen Ave',     '8th Ave SW, Calgary'),
  (4, '11:00', '14:00', 'Stephen Ave',     '8th Ave SW, Calgary'),
  (5, '17:00', '21:00', 'East Village',    '600 Riverfront Ave SE, Calgary')
) x(dow, s, e, loc, addr);

with t as (select id from public.trucks where slug = 'two-tacos')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (1, '11:30', '14:00', 'Bridgeland',      '1st Ave NE, Calgary'),
  (3, '11:30', '14:00', 'Bridgeland',      '1st Ave NE, Calgary'),
  (5, '17:00', '21:30', 'Kensington',      'Kensington Rd NW, Calgary'),
  (6, '12:00', '21:00', 'Stampede Park',   '14 Ave SE, Calgary')
) x(dow, s, e, loc, addr);

with t as (select id from public.trucks where slug = 'smokebox')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (4, '16:00', '20:00', 'Inglewood',       '9 Ave SE, Calgary'),
  (5, '16:00', '21:00', 'Inglewood',       '9 Ave SE, Calgary'),
  (6, '12:00', '20:00', 'Marda Loop',      '33 Ave SW, Calgary')
) x(dow, s, e, loc, addr);

with t as (select id from public.trucks where slug = 'seoulmate')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (2, '11:30', '14:30', 'Olympic Plaza',   '228 8 Ave SE, Calgary'),
  (4, '11:30', '14:30', 'Olympic Plaza',   '228 8 Ave SE, Calgary'),
  (5, '17:00', '21:00', '17th Ave',        '17 Ave SW, Calgary')
) x(dow, s, e, loc, addr);

with t as (select id from public.trucks where slug = 'sugar-shack')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (5, '14:00', '21:00', 'Eau Claire',      'Riverfront Ave SW, Calgary'),
  (6, '11:00', '21:00', 'Eau Claire',      'Riverfront Ave SW, Calgary'),
  (0, '11:00', '18:00', 'Eau Claire',      'Riverfront Ave SW, Calgary')
) x(dow, s, e, loc, addr);

with t as (select id from public.trucks where slug = 'green-leaf')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (1, '11:30', '14:00', 'Beltline',        '11 Ave SW, Calgary'),
  (2, '11:30', '14:00', 'Beltline',        '11 Ave SW, Calgary'),
  (4, '11:30', '14:00', 'University',      'University Ave NW, Calgary')
) x(dow, s, e, loc, addr);

with t as (select id from public.trucks where slug = 'phomance')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (1, '11:00', '14:30', 'Chinatown',       'Centre St NE, Calgary'),
  (3, '11:00', '14:30', 'Chinatown',       'Centre St NE, Calgary'),
  (5, '17:00', '21:00', 'East Village',    '600 Riverfront Ave SE, Calgary')
) x(dow, s, e, loc, addr);

with t as (select id from public.trucks where slug = 'holy-cow')
insert into public.schedule_template_slots
  (truck_id, day_of_week, start_time, end_time, location_label, address, published)
select t.id, x.dow, x.s::time, x.e::time, x.loc, x.addr, true from t, (values
  (5, '16:00', '21:00', 'Inglewood',       '9 Ave SE, Calgary'),
  (6, '12:00', '21:00', 'Stampede Park',   '14 Ave SE, Calgary')
) x(dow, s, e, loc, addr);

----------------------------------------------------------------------
-- One dated exception per a couple of trucks so the "Upcoming exceptions"
-- section actually renders.
----------------------------------------------------------------------
with t as (select id from public.trucks where slug = 'big-cheese')
insert into public.schedule_dated_slots
  (truck_id, slot_date, start_time, end_time, location_label, address, kind, published)
select t.id, (current_date + 3), '11:00'::time, '14:00'::time,
       'Stephen Ave', '8th Ave SW, Calgary', 'closure', true
from t;

with t as (select id from public.trucks where slug = 'two-tacos')
insert into public.schedule_dated_slots
  (truck_id, slot_date, start_time, end_time, location_label, address, kind, published)
select t.id, (current_date + 5), '17:00'::time, '22:00'::time,
       'Festival on 4th', '4 St SW, Calgary', 'addition', true
from t;

----------------------------------------------------------------------
-- Guarantee at least one truck shows "Open" right now (so the
-- open-now filter has visible results regardless of when you test).
----------------------------------------------------------------------
update public.trucks
set manual_override_status = 'open',
    manual_override_expires_at = now() + interval '7 days'
where slug = 'big-cheese';

update public.trucks
set manual_override_status = 'closed',
    manual_override_expires_at = now() + interval '7 days'
where slug = 'smokebox';
