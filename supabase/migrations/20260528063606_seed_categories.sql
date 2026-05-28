-- 0006: Seed the 6 categories. Idempotent so the migration is safe to re-run.

insert into public.categories (id, slug, name, position) values
  (1, 'burgers-sandwiches',  'Burgers & Sandwiches',       0),
  (2, 'tacos-latin',         'Tacos & Latin',              1),
  (3, 'bbq',                 'BBQ & Smoked Meats',         2),
  (4, 'asian',               'Asian',                      3),
  (5, 'sweets-desserts',     'Sweets, Desserts & Bakery',  4),
  (6, 'vegetarian-vegan',    'Vegetarian / Vegan',         5)
on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      position = excluded.position;
