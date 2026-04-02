-- seed.sql
-- Encore: Historic badges seed data
-- Famous music history moments

INSERT INTO historic_badges (id, artist_name, badge_type, title, description, event_date, event_city, sources, verified) VALUES

-- Nirvana - last concert
(gen_random_uuid(), 'Nirvana', 'last_concert', 'El Ultimo Show de Nirvana',
 'El ultimo concierto de Nirvana tuvo lugar en el Terminal Einz de Munich, apenas un mes antes de la muerte de Kurt Cobain.',
 '1994-03-01', 'Munich',
 ARRAY['https://en.wikipedia.org/wiki/In_Utero_Tour'], true),

-- Queen - Live Aid
(gen_random_uuid(), 'Queen', 'legendary_performance', 'Queen en Live Aid',
 'La actuacion de Queen en Live Aid en Wembley es considerada una de las mejores presentaciones en vivo de la historia del rock.',
 '1985-07-13', 'London',
 ARRAY['https://en.wikipedia.org/wiki/Live_Aid'], true),

-- Oasis - Knebworth
(gen_random_uuid(), 'Oasis', 'legendary_performance', 'Oasis en Knebworth',
 'Oasis toco ante 250.000 personas en Knebworth Park, el evento de musica en vivo mas grande del Reino Unido en ese momento. 2.5 millones solicitaron entradas.',
 '1996-08-10', 'Knebworth',
 ARRAY['https://en.wikipedia.org/wiki/Oasis_at_Knebworth'], true),

-- Oasis - Reunion
(gen_random_uuid(), 'Oasis', 'reunion', 'La Reunion de Oasis',
 'Despues de 15 anos separados, los hermanos Gallagher anunciaron la reunion de Oasis para una gira mundial en 2025.',
 '2025-07-04', 'Manchester',
 ARRAY['https://www.oasisinet.com'], true),

-- Daft Punk - Alive 2007
(gen_random_uuid(), 'Daft Punk', 'legendary_performance', 'Daft Punk: Alive 2007',
 'La gira Alive 2007 de Daft Punk redefinio los conciertos de musica electronica con su iconica piramide LED.',
 '2007-06-14', 'Paris',
 ARRAY['https://en.wikipedia.org/wiki/Alive_2007'], true),

-- Daft Punk - Breakup
(gen_random_uuid(), 'Daft Punk', 'breakup', 'Daft Punk se Separa',
 'Daft Punk anuncio su separacion despues de 28 anos con el video "Epilogue".',
 '2021-02-22', 'Paris',
 ARRAY['https://en.wikipedia.org/wiki/Daft_Punk'], true),

-- The Beatles - Rooftop Concert
(gen_random_uuid(), 'The Beatles', 'last_concert', 'El Concierto en la Azotea',
 'El ultimo concierto publico de The Beatles fue una actuacion improvisada en la azotea del edificio de Apple Corps en Londres.',
 '1969-01-30', 'London',
 ARRAY['https://en.wikipedia.org/wiki/The_Beatles%27_rooftop_concert'], true),

-- Pink Floyd - The Wall Live
(gen_random_uuid(), 'Pink Floyd', 'legendary_performance', 'Pink Floyd: The Wall en Berlin',
 'Roger Waters interpreto The Wall frente al Muro de Berlin recien caido, ante 350.000 personas.',
 '1990-07-21', 'Berlin',
 ARRAY['https://en.wikipedia.org/wiki/The_Wall_%E2%80%93_Live_in_Berlin'], true),

-- Jimi Hendrix - Woodstock
(gen_random_uuid(), 'Jimi Hendrix', 'legendary_performance', 'Hendrix en Woodstock',
 'La interpretacion del himno nacional de EE.UU. por Jimi Hendrix en Woodstock se convirtio en uno de los momentos mas iconicos del rock.',
 '1969-08-18', 'Bethel',
 ARRAY['https://en.wikipedia.org/wiki/Woodstock'], true),

-- Bob Marley - One Love Peace Concert
(gen_random_uuid(), 'Bob Marley', 'legendary_performance', 'One Love Peace Concert',
 'Bob Marley unio las manos de los rivales politicos Michael Manley y Edward Seaga durante el One Love Peace Concert en Kingston.',
 '1978-04-22', 'Kingston',
 ARRAY['https://en.wikipedia.org/wiki/One_Love_Peace_Concert'], true),

-- Talking Heads - Stop Making Sense
(gen_random_uuid(), 'Talking Heads', 'legendary_performance', 'Stop Making Sense',
 'El concierto filmado de Talking Heads dirigido por Jonathan Demme es considerado uno de los mejores documentales de conciertos jamas realizados.',
 '1983-12-01', 'Los Angeles',
 ARRAY['https://en.wikipedia.org/wiki/Stop_Making_Sense'], true),

-- Led Zeppelin - Last Concert
(gen_random_uuid(), 'Led Zeppelin', 'last_concert', 'El Ultimo Show de Led Zeppelin',
 'El ultimo concierto de Led Zeppelin con John Bonham fue en el Eissporthalle de Berlin, antes de la muerte del baterista.',
 '1980-07-07', 'Berlin',
 ARRAY['https://en.wikipedia.org/wiki/Led_Zeppelin_discography'], true),

-- The Clash - Shea Stadium
(gen_random_uuid(), 'The Clash', 'legendary_performance', 'The Clash en Shea Stadium',
 'The Clash abrio para The Who en el Shea Stadium, presentando el punk rock a un publico masivo.',
 '1982-10-12', 'New York',
 ARRAY['https://en.wikipedia.org/wiki/The_Clash'], true),

-- Radiohead - Kid A Live Debut
(gen_random_uuid(), 'Radiohead', 'legendary_performance', 'Radiohead debuta Kid A en vivo',
 'Radiohead presento material de Kid A por primera vez en vivo, sorprendiendo al publico con su reinvencion sonora.',
 '2000-10-02', 'Barcelona',
 ARRAY['https://en.wikipedia.org/wiki/Kid_A'], true),

-- David Bowie - Ziggy Stardust Farewell
(gen_random_uuid(), 'David Bowie', 'last_concert', 'Adios a Ziggy Stardust',
 'David Bowie "retiro" al personaje de Ziggy Stardust en el Hammersmith Odeon, en uno de los momentos mas dramaticos del glam rock.',
 '1973-07-03', 'London',
 ARRAY['https://en.wikipedia.org/wiki/Ziggy_Stardust_(album)'], true),

-- The Rolling Stones - Altamont
(gen_random_uuid(), 'The Rolling Stones', 'historic_event', 'Altamont Free Concert',
 'El festival gratuito de Altamont marco el fin simbolico de la era hippie, con violencia durante la actuacion de los Stones.',
 '1969-12-06', 'Livermore',
 ARRAY['https://en.wikipedia.org/wiki/Altamont_Free_Concert'], true),

-- Joy Division - Last Concert
(gen_random_uuid(), 'Joy Division', 'last_concert', 'El Ultimo Show de Joy Division',
 'El ultimo concierto de Joy Division tuvo lugar en la Universidad de Birmingham, dos dias antes de la muerte de Ian Curtis.',
 '1980-05-02', 'Birmingham',
 ARRAY['https://en.wikipedia.org/wiki/Joy_Division'], true),

-- Beyonce - Coachella (Beychella)
(gen_random_uuid(), 'Beyonce', 'legendary_performance', 'Beychella',
 'Beyonce se convirtio en la primera mujer afroamericana en encabezar Coachella, con una actuacion historica que homenajeo la cultura HBCU.',
 '2018-04-14', 'Indio',
 ARRAY['https://en.wikipedia.org/wiki/Homecoming:_A_Film_by_Beyonc%C3%A9'], true),

-- Kraftwerk - First Electronic Live Show
(gen_random_uuid(), 'Kraftwerk', 'historic_event', 'Kraftwerk: Pioneros en Vivo',
 'Kraftwerk fue de los primeros actos en presentar musica completamente electronica en vivo, cambiando para siempre la musica en directo.',
 '1981-06-01', 'Dusseldorf',
 ARRAY['https://en.wikipedia.org/wiki/Kraftwerk'], true),

-- The Smiths - Last Concert
(gen_random_uuid(), 'The Smiths', 'last_concert', 'El Ultimo Show de The Smiths',
 'El ultimo concierto de The Smiths tuvo lugar en el Brixton Academy de Londres antes de su acrimonosa separacion.',
 '1986-12-12', 'London',
 ARRAY['https://en.wikipedia.org/wiki/The_Smiths'], true);
