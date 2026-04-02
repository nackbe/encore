-- seed_test_data.sql
-- Encore: Comprehensive test data for local development
-- Run with: psql -f seed_test_data.sql  OR  via Supabase dashboard SQL editor
--
-- Uses fixed UUIDs so artists/venues can be referenced in events and event_artists.
-- Pattern:
--   Artists: a0000000-0000-0000-0000-000000000001 .. 025
--   Venues:  v0000000-0000-0000-0000-000000000001 .. 015
--   Events:  e0000000-0000-0000-0000-000000000001 .. 030

BEGIN;

------------------------------------------------------------------------
-- ARTISTS (25)
------------------------------------------------------------------------
INSERT INTO artists (id, name, name_normalized, spotify_id, musicbrainz_id, image_url, genres, country, spotify_popularity, spotify_monthly_listeners, spotify_followers, is_active)
VALUES
  -- Rock
  ('a0000000-0000-0000-0000-000000000001', 'Radiohead',               'radiohead',               NULL, NULL, NULL, ARRAY['alternative rock','art rock','experimental'],          'GB', 82, 28000000, 12000000, true),
  ('a0000000-0000-0000-0000-000000000002', 'Arctic Monkeys',          'arctic monkeys',          NULL, NULL, NULL, ARRAY['indie rock','alternative rock','garage rock'],         'GB', 88, 42000000, 18000000, true),
  ('a0000000-0000-0000-0000-000000000003', 'Foo Fighters',            'foo fighters',            NULL, NULL, NULL, ARRAY['alternative rock','post-grunge','hard rock'],          'US', 83, 31000000, 14000000, true),
  ('a0000000-0000-0000-0000-000000000004', 'The Strokes',             'the strokes',             NULL, NULL, NULL, ARRAY['indie rock','garage rock revival','post-punk revival'], 'US', 79, 19000000,  8500000, true),
  ('a0000000-0000-0000-0000-000000000005', 'Tame Impala',             'tame impala',             NULL, NULL, NULL, ARRAY['psychedelic rock','synth-pop','neo-psychedelia'],       'AU', 84, 33000000, 11000000, true),

  -- Pop / Global
  ('a0000000-0000-0000-0000-000000000006', 'Billie Eilish',           'billie eilish',           NULL, NULL, NULL, ARRAY['pop','electropop','dark pop'],                         'US', 93, 72000000, 48000000, true),
  ('a0000000-0000-0000-0000-000000000007', 'Dua Lipa',                'dua lipa',                NULL, NULL, NULL, ARRAY['pop','dance-pop','disco'],                             'GB', 91, 65000000, 38000000, true),
  ('a0000000-0000-0000-0000-000000000008', 'Bad Bunny',               'bad bunny',               NULL, NULL, NULL, ARRAY['reggaeton','latin trap','urbano latino'],               'PR', 95, 80000000, 52000000, true),
  ('a0000000-0000-0000-0000-000000000009', 'Rosalía',                 'rosalia',                 NULL, NULL, NULL, ARRAY['flamenco pop','experimental pop','reggaeton'],          'ES', 85, 28000000, 14000000, true),

  -- Latin Rock / Alt-Latin
  ('a0000000-0000-0000-0000-000000000010', 'Caifanes',                'caifanes',                NULL, NULL, NULL, ARRAY['rock en español','gothic rock','post-punk'],            'MX', 68, 5500000,  2400000, true),
  ('a0000000-0000-0000-0000-000000000011', 'Café Tacvba',             'cafe tacvba',             NULL, NULL, NULL, ARRAY['rock en español','alternative latin','experimental'],   'MX', 71, 7200000,  3100000, true),
  ('a0000000-0000-0000-0000-000000000012', 'Molotov',                 'molotov',                 NULL, NULL, NULL, ARRAY['rap rock','rock en español','nu metal'],                'MX', 67, 6800000,  2800000, true),
  ('a0000000-0000-0000-0000-000000000013', 'Mon Laferte',             'mon laferte',             NULL, NULL, NULL, ARRAY['latin pop','indie pop','singer-songwriter'],            'CL', 74, 9500000,  4200000, true),
  ('a0000000-0000-0000-0000-000000000014', 'Zoé',                     'zoe',                     NULL, NULL, NULL, ARRAY['rock en español','dream pop','shoegaze'],               'MX', 72, 7800000,  3400000, true),

  -- Electronic
  ('a0000000-0000-0000-0000-000000000015', 'Daft Punk',               'daft punk',               NULL, NULL, NULL, ARRAY['electronic','french house','synthpop'],                 'FR', 81, 35000000, 16000000, false),
  ('a0000000-0000-0000-0000-000000000016', 'Disclosure',              'disclosure',              NULL, NULL, NULL, ARRAY['uk garage','deep house','electronic'],                  'GB', 73, 12000000,  4500000, true),
  ('a0000000-0000-0000-0000-000000000017', 'Caribou',                 'caribou',                 NULL, NULL, NULL, ARRAY['electronic','psychedelic','indietronica'],              'CA', 65, 5000000,  1800000, true),

  -- Metal
  ('a0000000-0000-0000-0000-000000000018', 'Tool',                    'tool',                    NULL, NULL, NULL, ARRAY['progressive metal','alternative metal','art metal'],    'US', 78, 18000000,  7200000, true),
  ('a0000000-0000-0000-0000-000000000019', 'Gojira',                  'gojira',                  NULL, NULL, NULL, ARRAY['progressive metal','death metal','groove metal'],       'FR', 72, 6000000,  2900000, true),

  -- Hip-hop
  ('a0000000-0000-0000-0000-000000000020', 'Kendrick Lamar',          'kendrick lamar',          NULL, NULL, NULL, ARRAY['hip-hop','west coast hip-hop','conscious hip-hop'],    'US', 92, 58000000, 30000000, true),
  ('a0000000-0000-0000-0000-000000000021', 'Tyler, the Creator',      'tyler, the creator',      NULL, NULL, NULL, ARRAY['hip-hop','alternative hip-hop','neo-soul'],            'US', 89, 40000000, 20000000, true),

  -- Indie
  ('a0000000-0000-0000-0000-000000000022', 'Phoebe Bridgers',         'phoebe bridgers',         NULL, NULL, NULL, ARRAY['indie rock','indie folk','sad indie'],                  'US', 76, 11000000,  5000000, true),
  ('a0000000-0000-0000-0000-000000000023', 'Cigarettes After Sex',    'cigarettes after sex',    NULL, NULL, NULL, ARRAY['dream pop','shoegaze','slowcore'],                      'US', 83, 30000000, 12000000, true),
  ('a0000000-0000-0000-0000-000000000024', 'Mac DeMarco',             'mac demarco',             NULL, NULL, NULL, ARRAY['indie rock','jangle pop','slacker rock'],               'CA', 77, 15000000,  6500000, true),

  -- Bonus
  ('a0000000-0000-0000-0000-000000000025', 'Interpol',                'interpol',                NULL, NULL, NULL, ARRAY['post-punk revival','indie rock','alternative rock'],    'US', 73, 9000000,  3800000, true)
ON CONFLICT DO NOTHING;


------------------------------------------------------------------------
-- VENUES (15)
------------------------------------------------------------------------
INSERT INTO venues (id, name, name_normalized, city, country, lat, lng, capacity, venue_type, website, is_verified)
VALUES
  -- Mexico
  ('b0000000-0000-0000-0000-000000000001', 'Foro Sol',                  'foro sol',                  'Ciudad de México', 'MX', 19.3910, -99.0960, 65000, 'stadium',    'https://www.forosol.com.mx',         true),
  ('b0000000-0000-0000-0000-000000000002', 'Palacio de los Deportes',   'palacio de los deportes',   'Ciudad de México', 'MX', 19.4020, -99.0880, 22000, 'arena',      NULL,                                  true),
  ('b0000000-0000-0000-0000-000000000003', 'El Plaza Condesa',          'el plaza condesa',          'Ciudad de México', 'MX', 19.4115, -99.1730, 1400,  'club',       'https://www.elplazacondesa.com',     true),
  ('b0000000-0000-0000-0000-000000000004', 'Teatro Metropólitan',       'teatro metropolitan',       'Ciudad de México', 'MX', 19.4350, -99.1520, 3200,  'theater',    NULL,                                  true),
  ('b0000000-0000-0000-0000-000000000005', 'Auditorio Nacional',        'auditorio nacional',        'Ciudad de México', 'MX', 19.4230, -99.1880, 10000, 'arena',      'https://www.auditorio.com.mx',       true),

  -- Colombia
  ('b0000000-0000-0000-0000-000000000006', 'Movistar Arena',            'movistar arena',            'Bogotá',           'CO', 4.6250,  -74.0840, 14000, 'arena',      'https://www.movistararena.co',       true),

  -- Chile
  ('b0000000-0000-0000-0000-000000000007', 'Parque O''Higgins',         'parque ohiggins',           'Santiago',         'CL', -33.4620,-70.6590, 80000, 'open_air',   NULL,                                  true),
  ('b0000000-0000-0000-0000-000000000008', 'Movistar Arena Santiago',   'movistar arena santiago',   'Santiago',         'CL', -33.4640,-70.6120, 15000, 'arena',      NULL,                                  true),

  -- Argentina
  ('b0000000-0000-0000-0000-000000000009', 'Estadio River Plate',       'estadio river plate',       'Buenos Aires',     'AR', -34.5453,-58.4498, 72054, 'stadium',    NULL,                                  true),

  -- USA
  ('b0000000-0000-0000-0000-000000000010', 'Madison Square Garden',     'madison square garden',     'New York',         'US', 40.7505, -73.9934, 20789, 'arena',      'https://www.msg.com',                true),
  ('b0000000-0000-0000-0000-000000000011', 'The Forum',                 'the forum',                 'Los Angeles',      'US', 33.9583, -118.3420,17505, 'arena',      'https://www.theforum.com',           true),
  ('b0000000-0000-0000-0000-000000000012', 'Red Rocks Amphitheatre',    'red rocks amphitheatre',    'Morrison',         'US', 39.6654, -105.2057, 9525, 'amphitheater','https://www.redrocksonline.com',   true),

  -- Europe
  ('b0000000-0000-0000-0000-000000000013', 'Parc del Fòrum',            'parc del forum',            'Barcelona',        'ES', 41.4100,  2.2280,  60000, 'open_air',   'https://www.primaverasound.com',     true),
  ('b0000000-0000-0000-0000-000000000014', 'Worthy Farm',               'worthy farm',               'Pilton',           'GB', 51.1533, -2.5847, 135000, 'open_air',   'https://www.glastonburyfestivals.co.uk', true),
  ('b0000000-0000-0000-0000-000000000015', 'Ziggo Dome',                'ziggo dome',                'Amsterdam',        'NL', 52.3140,  4.9370,  17000, 'arena',      'https://www.ziggodome.nl',           true)
ON CONFLICT DO NOTHING;


------------------------------------------------------------------------
-- GLOBAL EVENTS (30)
-- 15 past (2018-2025), 15 future (2026)
------------------------------------------------------------------------
INSERT INTO global_events (id, name, event_type, date, date_end, venue_id, city, country, lat, lng, ticket_url, ticket_price_min, ticket_price_max, currency, source, source_id, confidence_score, is_past, historic_badge_type, historic_badge_title, historic_badge_desc)
VALUES
  -- ===================== PAST EVENTS =====================

  -- 1. Radiohead at Foro Sol 2018
  ('c0000000-0000-0000-0000-000000000001', 'Radiohead en Foro Sol', 'concert', '2018-10-03', NULL,
   'b0000000-0000-0000-0000-000000000001', 'Ciudad de México', 'MX', 19.3910, -99.0960,
   NULL, 1200, 3500, 'MXN', 'seed', 'seed_1', 1.0, true,
   'legendary_show', 'Noche Legendaria', 'Radiohead tocó por primera vez "True Love Waits" en México'),

  -- 2. Caifanes reunion at Palacio de los Deportes 2019
  ('c0000000-0000-0000-0000-000000000002', 'Caifanes - El Nervio del Volcán Tour', 'concert', '2019-03-15', NULL,
   'b0000000-0000-0000-0000-000000000002', 'Ciudad de México', 'MX', 19.4020, -99.0880,
   NULL, 600, 2200, 'MXN', 'seed', 'seed_2', 1.0, true,
   'reunion', 'Reunión Histórica', 'Caifanes reunidos después de 20 años de silencio'),

  -- 3. Tool at The Forum 2019
  ('c0000000-0000-0000-0000-000000000003', 'Tool - Fear Inoculum Tour', 'concert', '2019-10-21', NULL,
   'b0000000-0000-0000-0000-000000000011', 'Los Angeles', 'US', 33.9583, -118.3420,
   NULL, 85, 250, 'USD', 'seed', 'seed_3', 1.0, true,
   NULL, NULL, NULL),

  -- 4. Primavera Sound Barcelona 2019
  ('c0000000-0000-0000-0000-000000000004', 'Primavera Sound 2019', 'festival', '2019-05-30', '2019-06-01',
   'b0000000-0000-0000-0000-000000000013', 'Barcelona', 'ES', 41.4100, 2.2280,
   NULL, 195, 325, 'EUR', 'seed', 'seed_4', 1.0, true,
   'festival_edition', 'Edición Épica', 'Lineup con Tame Impala, Interpol y Disclosure'),

  -- 5. Bad Bunny at Estadio River Plate 2022
  ('c0000000-0000-0000-0000-000000000005', 'Bad Bunny - World''s Hottest Tour', 'concert', '2022-11-04', NULL,
   'b0000000-0000-0000-0000-000000000009', 'Buenos Aires', 'AR', -34.5453, -58.4498,
   NULL, 8000, 25000, 'ARS', 'seed', 'seed_5', 1.0, true,
   NULL, NULL, NULL),

  -- 6. Glastonbury 2022
  ('c0000000-0000-0000-0000-000000000006', 'Glastonbury Festival 2022', 'festival', '2022-06-22', '2022-06-26',
   'b0000000-0000-0000-0000-000000000014', 'Pilton', 'GB', 51.1533, -2.5847,
   NULL, 280, 280, 'GBP', 'seed', 'seed_6', 1.0, true,
   'festival_edition', 'Glastonbury 2022', 'Billie Eilish se convirtió en la headliner más joven'),

  -- 7. Kendrick Lamar at MSG 2022
  ('c0000000-0000-0000-0000-000000000007', 'Kendrick Lamar - The Big Steppers Tour', 'concert', '2022-08-05', NULL,
   'b0000000-0000-0000-0000-000000000010', 'New York', 'US', 40.7505, -73.9934,
   NULL, 75, 350, 'USD', 'seed', 'seed_7', 1.0, true,
   NULL, NULL, NULL),

  -- 8. Café Tacvba at El Plaza Condesa 2020
  ('c0000000-0000-0000-0000-000000000008', 'Café Tacvba - Íntimo', 'concert', '2020-02-14', NULL,
   'b0000000-0000-0000-0000-000000000003', 'Ciudad de México', 'MX', 19.4115, -99.1730,
   NULL, 800, 1500, 'MXN', 'seed', 'seed_8', 1.0, true,
   NULL, NULL, NULL),

  -- 9. Lollapalooza Chile 2023
  ('c0000000-0000-0000-0000-000000000009', 'Lollapalooza Chile 2023', 'festival', '2023-03-17', '2023-03-19',
   'b0000000-0000-0000-0000-000000000007', 'Santiago', 'CL', -33.4620, -70.6590,
   NULL, 85000, 195000, 'CLP', 'seed', 'seed_9', 1.0, true,
   NULL, NULL, NULL),

  -- 10. Tame Impala at Red Rocks 2021
  ('c0000000-0000-0000-0000-000000000010', 'Tame Impala - Slow Rush Tour', 'concert', '2021-09-07', NULL,
   'b0000000-0000-0000-0000-000000000012', 'Morrison', 'US', 39.6654, -105.2057,
   NULL, 60, 150, 'USD', 'seed', 'seed_10', 1.0, true,
   'iconic_venue', 'Red Rocks Magic', 'Show en el anfiteatro más icónico del mundo'),

  -- 11. Mon Laferte at Movistar Arena Bogotá 2023
  ('c0000000-0000-0000-0000-000000000011', 'Mon Laferte - Autopoiética Tour', 'concert', '2023-05-20', NULL,
   'b0000000-0000-0000-0000-000000000006', 'Bogotá', 'CO', 4.6250, -74.0840,
   NULL, 120000, 350000, 'COP', 'seed', 'seed_11', 1.0, true,
   NULL, NULL, NULL),

  -- 12. Foo Fighters at Ziggo Dome 2024
  ('c0000000-0000-0000-0000-000000000012', 'Foo Fighters - Everything or Nothing at All Tour', 'concert', '2024-06-13', NULL,
   'b0000000-0000-0000-0000-000000000015', 'Amsterdam', 'NL', 52.3140, 4.9370,
   NULL, 70, 120, 'EUR', 'seed', 'seed_12', 1.0, true,
   NULL, NULL, NULL),

  -- 13. Zoé at Auditorio Nacional 2024
  ('c0000000-0000-0000-0000-000000000013', 'Zoé - Panoramas Tour', 'concert', '2024-09-28', NULL,
   'b0000000-0000-0000-0000-000000000005', 'Ciudad de México', 'MX', 19.4230, -99.1880,
   NULL, 800, 2800, 'MXN', 'seed', 'seed_13', 1.0, true,
   NULL, NULL, NULL),

  -- 14. Tyler, the Creator at Movistar Arena Santiago 2024
  ('c0000000-0000-0000-0000-000000000014', 'Tyler, the Creator - Chromakopia Tour', 'concert', '2024-11-02', NULL,
   'b0000000-0000-0000-0000-000000000008', 'Santiago', 'CL', -33.4640, -70.6120,
   NULL, 55000, 120000, 'CLP', 'seed', 'seed_14', 1.0, true,
   NULL, NULL, NULL),

  -- 15. Dua Lipa at Foro Sol 2025
  ('c0000000-0000-0000-0000-000000000015', 'Dua Lipa - Radical Optimism Tour', 'concert', '2025-02-22', NULL,
   'b0000000-0000-0000-0000-000000000001', 'Ciudad de México', 'MX', 19.3910, -99.0960,
   NULL, 1400, 4500, 'MXN', 'seed', 'seed_15', 1.0, true,
   NULL, NULL, NULL),


  -- ===================== FUTURE EVENTS =====================

  -- 16. Arctic Monkeys at Foro Sol
  ('c0000000-0000-0000-0000-000000000016', 'Arctic Monkeys - The Car Tour', 'concert', '2026-05-10', NULL,
   'b0000000-0000-0000-0000-000000000001', 'Ciudad de México', 'MX', 19.3910, -99.0960,
   'https://www.ticketmaster.com.mx', 1500, 4200, 'MXN', 'seed', 'seed_16', 0.95, false,
   NULL, NULL, NULL),

  -- 17. Primavera Sound 2026
  ('c0000000-0000-0000-0000-000000000017', 'Primavera Sound 2026', 'festival', '2026-06-04', '2026-06-06',
   'b0000000-0000-0000-0000-000000000013', 'Barcelona', 'ES', 41.4100, 2.2280,
   'https://www.primaverasound.com/tickets', 210, 350, 'EUR', 'seed', 'seed_17', 0.90, false,
   NULL, NULL, NULL),

  -- 18. Billie Eilish at Madison Square Garden
  ('c0000000-0000-0000-0000-000000000018', 'Billie Eilish - HIT ME HARD AND SOFT Tour', 'concert', '2026-07-15', NULL,
   'b0000000-0000-0000-0000-000000000010', 'New York', 'US', 40.7505, -73.9934,
   'https://www.ticketmaster.com', 95, 400, 'USD', 'seed', 'seed_18', 0.95, false,
   NULL, NULL, NULL),

  -- 19. Caifanes + Café Tacvba at Palacio de los Deportes
  ('c0000000-0000-0000-0000-000000000019', 'Noche de Leyendas: Caifanes + Café Tacvba', 'concert', '2026-08-22', NULL,
   'b0000000-0000-0000-0000-000000000002', 'Ciudad de México', 'MX', 19.4020, -99.0880,
   'https://www.ticketmaster.com.mx', 900, 3200, 'MXN', 'seed', 'seed_19', 0.85, false,
   NULL, NULL, NULL),

  -- 20. Kendrick Lamar at The Forum
  ('c0000000-0000-0000-0000-000000000020', 'Kendrick Lamar - GNX Tour', 'concert', '2026-06-20', NULL,
   'b0000000-0000-0000-0000-000000000011', 'Los Angeles', 'US', 33.9583, -118.3420,
   'https://www.ticketmaster.com', 80, 375, 'USD', 'seed', 'seed_20', 0.95, false,
   NULL, NULL, NULL),

  -- 21. Lollapalooza Chile 2026
  ('c0000000-0000-0000-0000-000000000021', 'Lollapalooza Chile 2026', 'festival', '2026-11-14', '2026-11-16',
   'b0000000-0000-0000-0000-000000000007', 'Santiago', 'CL', -33.4620, -70.6590,
   'https://www.lollapaloozacl.com', 90000, 210000, 'CLP', 'seed', 'seed_21', 0.80, false,
   NULL, NULL, NULL),

  -- 22. Cigarettes After Sex at El Plaza Condesa
  ('c0000000-0000-0000-0000-000000000022', 'Cigarettes After Sex - X''s Tour', 'concert', '2026-04-25', NULL,
   'b0000000-0000-0000-0000-000000000003', 'Ciudad de México', 'MX', 19.4115, -99.1730,
   'https://www.elplazacondesa.com', 900, 1800, 'MXN', 'seed', 'seed_22', 0.90, false,
   NULL, NULL, NULL),

  -- 23. Rosalía at Movistar Arena Bogotá
  ('c0000000-0000-0000-0000-000000000023', 'Rosalía - MOTOMAMI World Tour', 'concert', '2026-09-05', NULL,
   'b0000000-0000-0000-0000-000000000006', 'Bogotá', 'CO', 4.6250, -74.0840,
   'https://www.tuboleta.com', 180000, 480000, 'COP', 'seed', 'seed_23', 0.85, false,
   NULL, NULL, NULL),

  -- 24. Bad Bunny at Foro Sol
  ('c0000000-0000-0000-0000-000000000024', 'Bad Bunny - Nadie Sabe Lo Que Va a Pasar Tour', 'concert', '2026-10-18', NULL,
   'b0000000-0000-0000-0000-000000000001', 'Ciudad de México', 'MX', 19.3910, -99.0960,
   'https://www.ticketmaster.com.mx', 1800, 5500, 'MXN', 'seed', 'seed_24', 0.90, false,
   NULL, NULL, NULL),

  -- 25. Disclosure at Red Rocks
  ('c0000000-0000-0000-0000-000000000025', 'Disclosure DJ Set at Red Rocks', 'concert', '2026-07-04', NULL,
   'b0000000-0000-0000-0000-000000000012', 'Morrison', 'US', 39.6654, -105.2057,
   'https://www.axs.com', 55, 110, 'USD', 'seed', 'seed_25', 0.90, false,
   NULL, NULL, NULL),

  -- 26. Glastonbury 2026
  ('c0000000-0000-0000-0000-000000000026', 'Glastonbury Festival 2026', 'festival', '2026-06-24', '2026-06-28',
   'b0000000-0000-0000-0000-000000000014', 'Pilton', 'GB', 51.1533, -2.5847,
   'https://www.glastonburyfestivals.co.uk', 340, 340, 'GBP', 'seed', 'seed_26', 0.85, false,
   NULL, NULL, NULL),

  -- 27. Molotov + Zoé at Teatro Metropólitan
  ('c0000000-0000-0000-0000-000000000027', 'Molotov + Zoé: Rock Mexicano Vive', 'concert', '2026-05-30', NULL,
   'b0000000-0000-0000-0000-000000000004', 'Ciudad de México', 'MX', 19.4350, -99.1520,
   'https://www.ticketmaster.com.mx', 700, 2200, 'MXN', 'seed', 'seed_27', 0.85, false,
   NULL, NULL, NULL),

  -- 28. Phoebe Bridgers at Ziggo Dome
  ('c0000000-0000-0000-0000-000000000028', 'Phoebe Bridgers - European Tour', 'concert', '2026-09-18', NULL,
   'b0000000-0000-0000-0000-000000000015', 'Amsterdam', 'NL', 52.3140, 4.9370,
   'https://www.ziggodome.nl', 50, 90, 'EUR', 'seed', 'seed_28', 0.90, false,
   NULL, NULL, NULL),

  -- 29. Mac DeMarco at Auditorio Nacional
  ('c0000000-0000-0000-0000-000000000029', 'Mac DeMarco - One Wayne G Tour', 'concert', '2026-08-08', NULL,
   'b0000000-0000-0000-0000-000000000005', 'Ciudad de México', 'MX', 19.4230, -99.1880,
   'https://www.ticketmaster.com.mx', 600, 2000, 'MXN', 'seed', 'seed_29', 0.90, false,
   NULL, NULL, NULL),

  -- 30. Gojira + Tool at Estadio River Plate
  ('c0000000-0000-0000-0000-000000000030', 'Tool - South American Tour', 'concert', '2026-12-05', NULL,
   'b0000000-0000-0000-0000-000000000009', 'Buenos Aires', 'AR', -34.5453, -58.4498,
   'https://www.allaccess.com.ar', 15000, 45000, 'ARS', 'seed', 'seed_30', 0.80, false,
   NULL, NULL, NULL)
ON CONFLICT (source, source_id) DO NOTHING;


------------------------------------------------------------------------
-- GLOBAL EVENT ARTISTS
-- Links artists to events with roles and billing order
------------------------------------------------------------------------
INSERT INTO global_event_artists (global_event_id, artist_id, role, stage, billing_order)
VALUES
  -- Event 1: Radiohead at Foro Sol
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'headliner', NULL, 1),

  -- Event 2: Caifanes at Palacio
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000010', 'headliner', NULL, 1),

  -- Event 3: Tool at The Forum
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000018', 'headliner', NULL, 1),

  -- Event 4: Primavera Sound 2019 (festival - 6 artists)
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', 'headliner', 'Escenario Estrella', 1),  -- Tame Impala
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000025', 'performer', 'Escenario Estrella', 2),  -- Interpol
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000016', 'performer', 'Escenario Bits',     3),  -- Disclosure
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000022', 'performer', 'Escenario Rayban',   4),  -- Phoebe Bridgers
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000017', 'performer', 'Escenario Bits',     5),  -- Caribou
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000009', 'performer', 'Escenario Estrella', 6),  -- Rosalía

  -- Event 5: Bad Bunny at River Plate
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000008', 'headliner', NULL, 1),

  -- Event 6: Glastonbury 2022 (festival - 7 artists)
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'headliner', 'Pyramid Stage',  1),  -- Billie Eilish
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000020', 'headliner', 'Pyramid Stage',  2),  -- Kendrick Lamar
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', 'performer', 'Other Stage',    3),  -- Dua Lipa
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000022', 'performer', 'Other Stage',    4),  -- Phoebe Bridgers
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000016', 'performer', 'West Holts',     5),  -- Disclosure
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000024', 'performer', 'Park Stage',     6),  -- Mac DeMarco
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000017', 'performer', 'West Holts',     7),  -- Caribou

  -- Event 7: Kendrick at MSG
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000020', 'headliner', NULL, 1),

  -- Event 8: Café Tacvba at El Plaza
  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000011', 'headliner', NULL, 1),

  -- Event 9: Lollapalooza Chile 2023 (festival - 8 artists)
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000021', 'headliner', 'Etapa Principal',  1),  -- Tyler
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005', 'headliner', 'Etapa Principal',  2),  -- Tame Impala
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000008', 'headliner', 'Etapa Principal',  3),  -- Bad Bunny
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000013', 'performer', 'Etapa Alternativa',4),  -- Mon Laferte
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000023', 'performer', 'Etapa Alternativa',5),  -- Cigarettes After Sex
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000016', 'performer', 'Etapa Perry''s',   6),  -- Disclosure
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'performer', 'Etapa Principal',  7),  -- Foo Fighters
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000012', 'performer', 'Etapa Alternativa',8),  -- Molotov

  -- Event 10: Tame Impala at Red Rocks
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005', 'headliner', NULL, 1),
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000017', 'support',   NULL, 2),  -- Caribou

  -- Event 11: Mon Laferte at Movistar Arena Bogotá
  ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000013', 'headliner', NULL, 1),

  -- Event 12: Foo Fighters at Ziggo Dome
  ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'headliner', NULL, 1),

  -- Event 13: Zoé at Auditorio Nacional
  ('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000014', 'headliner', NULL, 1),
  ('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000025', 'support',   NULL, 2),  -- Interpol

  -- Event 14: Tyler at Movistar Arena Santiago
  ('c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000021', 'headliner', NULL, 1),

  -- Event 15: Dua Lipa at Foro Sol
  ('c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000007', 'headliner', NULL, 1),

  -- ===================== FUTURE EVENTS =====================

  -- Event 16: Arctic Monkeys at Foro Sol
  ('c0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000002', 'headliner', NULL, 1),
  ('c0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000004', 'support',   NULL, 2),  -- The Strokes

  -- Event 17: Primavera Sound 2026 (festival - 7 artists)
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001', 'headliner', 'Escenario Estrella', 1),  -- Radiohead
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000009', 'headliner', 'Escenario Estrella', 2),  -- Rosalía
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000021', 'performer', 'Escenario Pull&Bear',3),  -- Tyler
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000022', 'performer', 'Escenario Rayban',   4),  -- Phoebe Bridgers
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000017', 'performer', 'Escenario Bits',     5),  -- Caribou
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000023', 'performer', 'Escenario Rayban',   6),  -- Cigarettes After Sex
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000019', 'performer', 'Escenario Estrella', 7),  -- Gojira

  -- Event 18: Billie Eilish at MSG
  ('c0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000006', 'headliner', NULL, 1),

  -- Event 19: Caifanes + Café Tacvba
  ('c0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000010', 'headliner', NULL, 1),  -- Caifanes
  ('c0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000011', 'headliner', NULL, 2),  -- Café Tacvba

  -- Event 20: Kendrick at The Forum
  ('c0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000020', 'headliner', NULL, 1),

  -- Event 21: Lollapalooza Chile 2026 (festival - 8 artists)
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000002', 'headliner', 'Etapa Principal',  1),  -- Arctic Monkeys
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000006', 'headliner', 'Etapa Principal',  2),  -- Billie Eilish
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000009', 'headliner', 'Etapa Principal',  3),  -- Rosalía
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000024', 'performer', 'Etapa Alternativa',4),  -- Mac DeMarco
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000013', 'performer', 'Etapa Alternativa',5),  -- Mon Laferte
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000014', 'performer', 'Etapa Alternativa',6),  -- Zoé
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000016', 'performer', 'Etapa Perry''s',   7),  -- Disclosure
  ('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000025', 'performer', 'Etapa Principal',  8),  -- Interpol

  -- Event 22: Cigarettes After Sex at El Plaza
  ('c0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000023', 'headliner', NULL, 1),

  -- Event 23: Rosalía at Movistar Arena Bogotá
  ('c0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000009', 'headliner', NULL, 1),

  -- Event 24: Bad Bunny at Foro Sol
  ('c0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000008', 'headliner', NULL, 1),

  -- Event 25: Disclosure at Red Rocks
  ('c0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000016', 'headliner', NULL, 1),
  ('c0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000017', 'support',   NULL, 2),  -- Caribou

  -- Event 26: Glastonbury 2026 (festival - 6 artists)
  ('c0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000020', 'headliner', 'Pyramid Stage', 1),  -- Kendrick Lamar
  ('c0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000005', 'headliner', 'Pyramid Stage', 2),  -- Tame Impala
  ('c0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000003', 'performer', 'Other Stage',   3),  -- Foo Fighters
  ('c0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000015', 'performer', 'West Holts',    4),  -- Daft Punk
  ('c0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000022', 'performer', 'Park Stage',    5),  -- Phoebe Bridgers
  ('c0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000024', 'performer', 'Park Stage',    6),  -- Mac DeMarco

  -- Event 27: Molotov + Zoé at Teatro Metropólitan
  ('c0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000012', 'headliner', NULL, 1),  -- Molotov
  ('c0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000014', 'headliner', NULL, 2),  -- Zoé

  -- Event 28: Phoebe Bridgers at Ziggo Dome
  ('c0000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000022', 'headliner', NULL, 1),
  ('c0000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000024', 'support',   NULL, 2),  -- Mac DeMarco

  -- Event 29: Mac DeMarco at Auditorio Nacional
  ('c0000000-0000-0000-0000-000000000029', 'a0000000-0000-0000-0000-000000000024', 'headliner', NULL, 1),

  -- Event 30: Tool + Gojira at River Plate
  ('c0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000018', 'headliner', NULL, 1),  -- Tool
  ('c0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000019', 'support',   NULL, 2)   -- Gojira
ON CONFLICT DO NOTHING;

COMMIT;
