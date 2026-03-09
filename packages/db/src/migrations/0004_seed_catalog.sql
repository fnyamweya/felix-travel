-- Migration 0004: Seed tours, safaris & beach catalog data
--
-- Populates: destinations, listing_categories, service_providers, listings,
--            amenities, listing_amenities, pricing_rules, seasonal_rates,
--            inventory (next 90 days), media_assets

-- ── 1. Destinations ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO destinations (id, name, slug, country_code, description, image_url, is_active, sort_order, created_at) VALUES
  ('dst_001', 'Maasai Mara',     'maasai-mara',     'KE', 'Kenya''s premier safari destination, home to the Great Migration and the Big Five.',                    'https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=800', 1, 1, datetime('now')),
  ('dst_002', 'Diani Beach',     'diani-beach',      'KE', 'Award-winning white-sand beach on Kenya''s south coast, perfect for tropical getaways.',               'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800', 1, 2, datetime('now')),
  ('dst_003', 'Amboseli',        'amboseli',         'KE', 'Iconic views of Mount Kilimanjaro with vast herds of elephants roaming the plains.',                   'https://images.unsplash.com/photo-1612196808214-b7e239e46f40?w=800', 1, 3, datetime('now')),
  ('dst_004', 'Tsavo',           'tsavo',            'KE', 'Kenya''s largest national park, split into East and West, famous for red elephants and lava flows.',     'https://images.unsplash.com/photo-1535338454528-1b22a28ed4f5?w=800', 1, 4, datetime('now')),
  ('dst_005', 'Lake Nakuru',     'lake-nakuru',      'KE', 'A flamingo-lined soda lake in the Great Rift Valley surrounded by acacia woodland.',                    'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800', 1, 5, datetime('now')),
  ('dst_006', 'Lamu Island',     'lamu-island',      'KE', 'A UNESCO World Heritage Swahili town with centuries-old architecture and dhow sailing.',                'https://images.unsplash.com/photo-1590846083693-f23fdede1222?w=800', 1, 6, datetime('now')),
  ('dst_007', 'Mount Kenya',     'mount-kenya',      'KE', 'Africa''s second-highest peak offers challenging treks through diverse ecological zones.',              'https://images.unsplash.com/photo-1631646109206-4c986a684abc?w=800', 1, 7, datetime('now')),
  ('dst_008', 'Samburu',         'samburu',          'KE', 'Remote northern reserve home to rare species like Grevy''s zebra, reticulated giraffe, and gerenuk.',   'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800', 1, 8, datetime('now')),
  ('dst_009', 'Watamu',          'watamu',           'KE', 'Pristine marine park and beach town on Kenya''s north coast, perfect for snorkelling.',                 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', 1, 9, datetime('now')),
  ('dst_010', 'Nairobi',         'nairobi',          'KE', 'The only capital city in the world with a national park — great for day trips and city tours.',          'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=800', 1, 10, datetime('now'));

-- ── 2. Listing Categories ─────────────────────────────────────────────────────

INSERT OR IGNORE INTO listing_categories (id, name, slug, parent_id, sort_order, is_active, created_at) VALUES
  ('cat_001', 'Safari Tours',       'safari-tours',      NULL, 1, 1, datetime('now')),
  ('cat_002', 'Beach Resorts',      'beach-resorts',     NULL, 2, 1, datetime('now')),
  ('cat_003', 'Mountain Treks',     'mountain-treks',    NULL, 3, 1, datetime('now')),
  ('cat_004', 'Cultural Tours',     'cultural-tours',    NULL, 4, 1, datetime('now')),
  ('cat_005', 'Day Trips',          'day-trips',         NULL, 5, 1, datetime('now')),
  ('cat_006', 'Holiday Packages',   'holiday-packages',  NULL, 6, 1, datetime('now'));

-- ── 3. Service Providers ──────────────────────────────────────────────────────

INSERT OR IGNORE INTO service_providers (id, name, slug, description, email, phone, country_code, currency_code, is_active, is_verified, created_at, updated_at) VALUES
  ('prv_001', 'Savanna Safari Co.',   'savanna-safari-co',  'Award-winning safari operator since 2010.',       'info@safarico.com',      '+254700000001', 'KE', 'KES', 1, 1, datetime('now'), datetime('now')),
  ('prv_002', 'Coastal Escapes Ltd',  'coastal-escapes',    'Premium beach and island experiences on the Kenyan coast.', 'hello@coastalescapes.co.ke', '+254711000002', 'KE', 'KES', 1, 1, datetime('now'), datetime('now')),
  ('prv_003', 'Summit Trails Kenya',  'summit-trails',      'Mountain trekking and hiking adventures across East Africa.', 'info@summittrails.co.ke', '+254722000003', 'KE', 'KES', 1, 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO provider_settings (provider_id, settlement_delay_days, commission_bps, updated_at) VALUES
  ('prv_002', 3, 1200, datetime('now')),
  ('prv_003', 3, 1000, datetime('now'));

INSERT OR IGNORE INTO provider_payout_accounts (id, provider_id, account_type, account_number, account_name, network_code, country_code, currency_code, is_default, is_verified, created_at, updated_at) VALUES
  ('poa_002', 'prv_002', 'mobile_money', '254711000002', 'Coastal Escapes Mpesa', 'MPESA', 'KE', 'KES', 1, 1, datetime('now'), datetime('now')),
  ('poa_003', 'prv_003', 'mobile_money', '254722000003', 'Summit Trails Mpesa',   'MPESA', 'KE', 'KES', 1, 1, datetime('now'), datetime('now'));

-- ── 4. Amenities ──────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO amenities (id, name, icon, category, created_at) VALUES
  ('amen_001', 'Game Drives',           '🚙', 'safari',      datetime('now')),
  ('amen_002', 'Full Board Meals',      '🍽️', 'dining',      datetime('now')),
  ('amen_003', 'Airport Transfer',      '✈️', 'transport',    datetime('now')),
  ('amen_004', 'Professional Guide',    '🧑‍🏫', 'service',     datetime('now')),
  ('amen_005', 'Wi-Fi',                 '📶', 'comfort',      datetime('now')),
  ('amen_006', 'Swimming Pool',         '🏊', 'leisure',      datetime('now')),
  ('amen_007', 'Campfire',              '🔥', 'experience',   datetime('now')),
  ('amen_008', 'Binoculars',            '🔭', 'equipment',    datetime('now')),
  ('amen_009', 'Bush Breakfast',        '🌅', 'experience',   datetime('now')),
  ('amen_010', 'Spa & Wellness',        '💆', 'leisure',      datetime('now')),
  ('amen_011', 'Snorkelling Gear',      '🤿', 'equipment',    datetime('now')),
  ('amen_012', 'Boat Excursion',        '⛵', 'experience',   datetime('now')),
  ('amen_013', 'Sundowner Drinks',      '🍹', 'experience',   datetime('now')),
  ('amen_014', 'Photography Guide',     '📷', 'service',      datetime('now')),
  ('amen_015', 'Cultural Visit',        '🏛️', 'experience',   datetime('now')),
  ('amen_016', 'Tented Camp',           '⛺', 'accommodation', datetime('now')),
  ('amen_017', 'Lodge Accommodation',   '🏨', 'accommodation', datetime('now')),
  ('amen_018', 'Balloon Safari',        '🎈', 'experience',   datetime('now')),
  ('amen_019', 'Night Game Drive',      '🌙', 'safari',       datetime('now')),
  ('amen_020', 'Walking Safari',        '🥾', 'safari',       datetime('now'));

-- ── 5. Listings ───────────────────────────────────────────────────────────────

-- Safari Tours
INSERT OR IGNORE INTO listings (id, provider_id, category_id, destination_id, type, status, title, slug, short_description, description, cover_image_url, base_price_amount, currency_code, duration_minutes, max_capacity, min_guests, is_instant_booking, tags, created_at, updated_at) VALUES
(
  'lst_001', 'prv_001', 'cat_001', 'dst_001', 'tour', 'active',
  '3-Day Maasai Mara Safari',
  '3-day-maasai-mara-safari',
  'Experience the Big Five on our award-winning Maasai Mara safari.',
  'Immerse yourself in the breathtaking Maasai Mara National Reserve on this 3-day, 2-night safari adventure. Your journey begins with an early morning departure from Nairobi along the Great Rift Valley escarpment, descending into the Mara ecosystem by midday.

Day 1: Scenic drive from Nairobi with a stop at the Rift Valley viewpoint. Afternoon game drive through the open savannah spotting lions, elephants, and buffalo. Sundowner drinks overlooking the Mara River.

Day 2: Full-day game drive with a packed bush breakfast. Witness hippo pools, leopard territory, and the famous Mara River crossing point used during the Great Migration (July–October). Optional hot-air balloon ride at dawn.

Day 3: Early morning game drive for golden-hour photography. Depart after brunch and return to Nairobi by evening.

All meals, park fees, and an English-speaking naturalist guide are included.',
  'https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=800',
  4500000, 'KES', 4320, 8, 2, 0,
  '["safari","kenya","wildlife","big-five","maasai-mara"]',
  datetime('now'), datetime('now')
),
(
  'lst_002', 'prv_001', 'cat_001', 'dst_003', 'tour', 'active',
  '2-Day Amboseli Elephant Safari',
  '2-day-amboseli-elephant-safari',
  'Get up close with Africa''s gentle giants against the backdrop of Mount Kilimanjaro.',
  'Explore Amboseli National Park — one of the best places in Africa to observe large herds of elephants in their natural habitat with the snow-capped peak of Kilimanjaro towering in the background.

Day 1: Morning departure from Nairobi (4-hour drive). Arrive for lunch at the lodge followed by an afternoon game drive through the park''s marshlands. Spot elephants, zebras, wildebeest, and over 400 bird species.

Day 2: Sunrise game drive for the best Kilimanjaro photo opportunities. Visit an Observation Hill for panoramic views of the park. Brunch at the lodge before returning to Nairobi.

Includes all meals, park fees, and transport in a pop-top safari vehicle.',
  'https://images.unsplash.com/photo-1612196808214-b7e239e46f40?w=800',
  3200000, 'KES', 2880, 6, 2, 0,
  '["safari","elephants","kilimanjaro","amboseli","wildlife"]',
  datetime('now'), datetime('now')
),
(
  'lst_003', 'prv_001', 'cat_001', 'dst_004', 'tour', 'active',
  '4-Day Tsavo East & West Safari',
  '4-day-tsavo-east-west-safari',
  'Explore Kenya''s largest national park — from red elephants to volcanic landscapes.',
  'Discover the raw wilderness of Tsavo on this 4-day expedition through both Tsavo East and Tsavo West national parks — together forming one of the world''s largest wildlife sanctuaries.

Day 1: Depart Nairobi to Tsavo West. Visit the Mzima Springs, where hippos and crocodiles inhabit crystal-clear pools fed by underground volcanic springs.

Day 2: Cross the Shetani Lava Flows and explore the Chaimu Crater. Afternoon transfer to Tsavo East.

Day 3: Full-day game drive in Tsavo East — famous for its red-dusted elephants, Galana River, Lugard Falls, and wide-open plains. Night game drive with spotlight.

Day 4: Sunrise drive along the Athi River. Depart after breakfast for return to Nairobi or Mombasa.

All meals, park fees, night game drive permit, and 4×4 safari vehicle included.',
  'https://images.unsplash.com/photo-1535338454528-1b22a28ed4f5?w=800',
  5800000, 'KES', 5760, 6, 2, 0,
  '["safari","tsavo","red-elephants","kenya","wilderness"]',
  datetime('now'), datetime('now')
),
(
  'lst_004', 'prv_001', 'cat_001', 'dst_005', 'tour', 'active',
  'Lake Nakuru Flamingo Day Safari',
  'lake-nakuru-flamingo-day-safari',
  'A day trip to the pink shores of Lake Nakuru — flamingos, rhinos, and Rift Valley scenery.',
  'Experience one of Kenya''s most scenic parks on a full-day safari to Lake Nakuru National Park, nestled in the Great Rift Valley.

Depart Nairobi at 6:30 AM and arrive by 10 AM. The park is renowned for its massive flocks of pink flamingos lining the alkaline lake, along with endangered black and white rhinos, Rothschild giraffes, and tree-climbing lions.

Enjoy a game drive around the lakeshore, stop at Baboon Cliff for panoramic views, and have a packed lunch at the Makalia Falls picnic site.

Depart by 4 PM, arriving in Nairobi by 7:30 PM. Park fees, lunch, and transport included.',
  'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800',
  1500000, 'KES', 780, 8, 1, 1,
  '["safari","flamingos","nakuru","day-trip","birds","rhino"]',
  datetime('now'), datetime('now')
),
(
  'lst_005', 'prv_001', 'cat_001', 'dst_008', 'tour', 'active',
  '3-Day Samburu Wildlife Safari',
  '3-day-samburu-wildlife-safari',
  'Track Africa''s rarest wildlife in the rugged landscapes of northern Kenya.',
  'Venture into the remote Samburu National Reserve, a hidden gem in Kenya''s arid north. The unique ecosystem here supports species found nowhere else — the "Samburu Special Five": Grevy''s zebra, reticulated giraffe, Beisa oryx, Somali ostrich, and gerenuk.

Day 1: Fly from Nairobi''s Wilson Airport to Samburu airstrip (1 hour). Afternoon game drive along the Ewaso Ng''iro River spotting crocodiles, elephants, and leopards.

Day 2: Full-day game drive. Visit a Samburu village to learn about the semi-nomadic culture. Evening sundowner with views of the Mathews Range.

Day 3: Walking safari with an armed ranger at dawn. Breakfast at camp, then fly back to Nairobi.

Includes domestic flights, lodge accommodation, all meals, park fees, and cultural visit.',
  'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800',
  7500000, 'KES', 4320, 6, 2, 0,
  '["safari","samburu","rare-wildlife","kenya","culture","remote"]',
  datetime('now'), datetime('now')
),
(
  'lst_006', 'prv_001', 'cat_001', 'dst_010', 'tour', 'active',
  'Nairobi National Park Half-Day Safari',
  'nairobi-national-park-half-day-safari',
  'The only urban safari in the world — lions and giraffes with the Nairobi skyline behind.',
  'Experience the surreal sight of lions, rhinos, and giraffes roaming free with Nairobi''s skyscrapers forming the backdrop on this half-day safari in Nairobi National Park.

Pick-up from your hotel at 6 AM for the best wildlife sighting hours. The park is home to 80+ mammal species and 500+ bird species, including endangered black rhinos and cheetahs.

After a 3-hour game drive, visit the Ivory Burning Memorial and the park''s hippo pools. Return to the city by noon — perfect for travellers with a short layover or a free morning.

Includes park fees, hotel pick-up/drop-off, and bottled water.',
  'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=800',
  800000, 'KES', 360, 8, 1, 1,
  '["safari","nairobi","urban","half-day","rhino","budget"]',
  datetime('now'), datetime('now')
);

-- Beach & Coastal
INSERT OR IGNORE INTO listings (id, provider_id, category_id, destination_id, type, status, title, slug, short_description, description, cover_image_url, base_price_amount, currency_code, duration_minutes, max_capacity, min_guests, is_instant_booking, tags, created_at, updated_at) VALUES
(
  'lst_007', 'prv_002', 'cat_002', 'dst_002', 'hotel', 'active',
  '5-Night Diani Beach Resort Stay',
  '5-night-diani-beach-resort-stay',
  'Relax on award-winning white sands with turquoise waters and all-inclusive dining.',
  'Escape to Diani Beach — voted Africa''s Leading Beach Destination — for five nights of pure tropical bliss at a 4-star beachfront resort.

Your stay includes a spacious ocean-view room, daily breakfast and dinner buffet, access to two swimming pools, a spa credit, and a complimentary sunset dhow cruise.

Activities: Snorkelling in the Kisite-Mpunguti Marine Park, kite surfing lessons, deep-sea fishing trips, and visits to the Colobus Conservation centre are all available (some at extra cost).

The resort is 30 minutes from Ukunda Airstrip (domestic flights from Nairobi) or reachable by road via the Likoni Ferry.

Perfect for couples, honeymooners, and families seeking relaxation and adventure on Kenya''s south coast.',
  'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800',
  12500000, 'KES', 7200, 2, 1, 0,
  '["beach","diani","resort","all-inclusive","honeymoon","coast"]',
  datetime('now'), datetime('now')
),
(
  'lst_008', 'prv_002', 'cat_002', 'dst_006', 'hotel', 'active',
  '3-Night Lamu Old Town Heritage Stay',
  '3-night-lamu-old-town-heritage-stay',
  'Step back in time in a UNESCO-listed Swahili town with donkey-lined alleys and dhow sunsets.',
  'Stay in a beautifully restored Swahili townhouse in the heart of Lamu Old Town — a UNESCO World Heritage Site and one of East Africa''s oldest living towns.

Day 1: Arrive by flight to Manda Airport. Cross by boat to Lamu Island (no cars allowed!). Settle into your rooftop suite overlooking the harbour. Evening walking tour through the coral-stone alleyways.

Day 2: Full-day dhow sailing excursion to Manda Bay and Shela Beach. Snorkel over coral reefs, feast on freshly grilled seafood on a sandbank, and swim in the Indian Ocean.

Day 3: Morning visit to the Lamu Museum and Donkey Sanctuary. Free afternoon for shopping in the craft markets. Farewell rooftop dinner with Swahili cuisine and live taarab music.

Day 4: Breakfast and transfer to Manda Airport.

Includes accommodation, breakfast & dinner, dhow excursion, walking tour, and airport transfers.',
  'https://images.unsplash.com/photo-1590846083693-f23fdede1222?w=800',
  8500000, 'KES', 4320, 4, 1, 0,
  '["beach","lamu","culture","heritage","UNESCO","dhow"]',
  datetime('now'), datetime('now')
),
(
  'lst_009', 'prv_002', 'cat_002', 'dst_009', 'tour', 'active',
  'Watamu Marine Park Snorkelling Trip',
  'watamu-marine-park-snorkelling-trip',
  'Explore coral gardens and swim with sea turtles in Kenya''s top marine park.',
  'Join a glass-bottom boat excursion to the Watamu Marine National Park — one of East Africa''s premier marine reserves protecting coral reefs, sea grass beds, and over 600 fish species.

The 4-hour trip includes:
• Glass-bottom boat ride over the coral gardens
• 90-minute guided snorkelling session (gear provided)
• Visit to the turtle nesting beach at Mida Creek
• Fresh tropical fruit and soft drinks on board

Suitable for all ages and swimming abilities. Wetsuits and life jackets available.

Based in Watamu, 120 km north of Mombasa and a 20-minute flight from Nairobi (via Malindi Airport).',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
  450000, 'KES', 240, 12, 1, 1,
  '["beach","snorkelling","marine","watamu","turtles","family"]',
  datetime('now'), datetime('now')
);

-- Mountain Treks
INSERT OR IGNORE INTO listings (id, provider_id, category_id, destination_id, type, status, title, slug, short_description, description, cover_image_url, base_price_amount, currency_code, duration_minutes, max_capacity, min_guests, is_instant_booking, tags, created_at, updated_at) VALUES
(
  'lst_010', 'prv_003', 'cat_003', 'dst_007', 'tour', 'active',
  '5-Day Mount Kenya Sirimon Route Trek',
  '5-day-mount-kenya-sirimon-route-trek',
  'Summit Point Lenana (4,985m) on Africa''s second-highest peak via the scenic Sirimon Route.',
  'Challenge yourself with a 5-day trek to Point Lenana — the trekking summit of Mount Kenya at 4,985 metres. The Sirimon Route is the driest and most gradual approach, offering the best acclimatisation profile.

Day 1: Drive from Nairobi to Sirimon Gate (2,660m). Trek through montane forest to Old Moses Camp (3,300m).

Day 2: Ascend through the moorland zone with giant groundsel and lobelia plants to Shipton''s Camp (4,200m).

Day 3: Acclimatisation day. Short hike to Kami Hut and Hausberg Col for altitude training. Rest in camp.

Day 4: Summit night — depart at 3 AM for the final push to Point Lenana for sunrise. Descend to Mackinder''s Camp (4,200m).

Day 5: Trek down through the Chogoria bamboo forest. Transfer to Nairobi.

Includes: certified mountain guide, porters, all meals on the mountain, camping equipment, park fees, and Nairobi transfers.',
  'https://images.unsplash.com/photo-1631646109206-4c986a684abc?w=800',
  6500000, 'KES', 7200, 8, 2, 0,
  '["hiking","mountain","mount-kenya","trek","summit","adventure"]',
  datetime('now'), datetime('now')
);

-- Cultural Tours
INSERT OR IGNORE INTO listings (id, provider_id, category_id, destination_id, type, status, title, slug, short_description, description, cover_image_url, base_price_amount, currency_code, duration_minutes, max_capacity, min_guests, is_instant_booking, tags, created_at, updated_at) VALUES
(
  'lst_011', 'prv_001', 'cat_004', 'dst_001', 'tour', 'active',
  'Maasai Village Cultural Experience',
  'maasai-village-cultural-experience',
  'Visit an authentic Maasai homestead — traditional dances, beadwork, and warrior stories.',
  'Step into the world of the Maasai — one of Africa''s most iconic pastoral communities — on this immersive half-day cultural visit near the Maasai Mara.

Your Maasai host will welcome you with a traditional jumping dance (adumu) and guide you through the boma (homestead). Learn about:
• Traditional cattle-herding lifestyle and its evolution
• The art of Maasai beadwork — with a hands-on workshop
• Medicinal plant knowledge passed down through generations
• Fire-making without matches using the hand-drill method
• Warrior stories and rites of passage

A portion of every booking is donated to the village''s education fund, supporting the local primary school.

The experience can be added to any Maasai Mara safari or booked as a standalone half-day trip from Narok town.',
  'https://images.unsplash.com/photo-1504432842672-1a79f78e4084?w=800',
  350000, 'KES', 180, 15, 1, 1,
  '["culture","maasai","village","experience","community","beadwork"]',
  datetime('now'), datetime('now')
);

-- Holiday Packages
INSERT OR IGNORE INTO listings (id, provider_id, category_id, destination_id, type, status, title, slug, short_description, description, cover_image_url, base_price_amount, currency_code, duration_minutes, max_capacity, min_guests, is_instant_booking, tags, created_at, updated_at) VALUES
(
  'lst_012', 'prv_001', 'cat_006', 'dst_001', 'package', 'active',
  '7-Day Kenya Safari & Beach Combo',
  '7-day-kenya-safari-beach-combo',
  'The ultimate Kenya experience — Big Five safari in the Mara plus tropical beach days in Diani.',
  'Combine the best of Kenya in one unforgettable week: world-class wildlife in the Maasai Mara followed by tropical relaxation on Diani Beach.

SAFARI PHASE (Days 1–4):
Day 1: Nairobi → Maasai Mara. Scenic drive via the Great Rift Valley. Afternoon game drive.
Day 2: Full-day Mara game drive with bush breakfast. Visit the Mara River for hippo and crocodile sightings.
Day 3: Optional hot-air balloon safari at dawn (extra cost). Afternoon game drive and Maasai village visit.
Day 4: Morning game drive. After lunch, drive to Nairobi and catch an evening flight to Ukunda.

BEACH PHASE (Days 5–7):
Day 5: Free day at the Diani Beach resort. Spa, pool, or beach.
Day 6: Full-day snorkelling trip to Kisite-Mpunguti Marine Park. Swim with dolphins and explore coral reefs.
Day 7: Breakfast and airport transfer for flight back to Nairobi.

Includes: safari vehicle + driver, lodge + resort accommodation, all meals, domestic flight (Nairobi–Ukunda), park fees, marine park excursion.',
  'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800',
  15000000, 'KES', 10080, 6, 2, 0,
  '["package","safari","beach","combo","kenya","big-five","diani","mara"]',
  datetime('now'), datetime('now')
);

-- ── 6. Listing Amenities ──────────────────────────────────────────────────────

-- lst_001: 3-Day Mara Safari
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_001', 'amen_001'), ('lst_001', 'amen_002'), ('lst_001', 'amen_003'),
  ('lst_001', 'amen_004'), ('lst_001', 'amen_007'), ('lst_001', 'amen_008'),
  ('lst_001', 'amen_009'), ('lst_001', 'amen_013'), ('lst_001', 'amen_016');

-- lst_002: Amboseli
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_002', 'amen_001'), ('lst_002', 'amen_002'), ('lst_002', 'amen_003'),
  ('lst_002', 'amen_004'), ('lst_002', 'amen_008'), ('lst_002', 'amen_017');

-- lst_003: Tsavo
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_003', 'amen_001'), ('lst_003', 'amen_002'), ('lst_003', 'amen_003'),
  ('lst_003', 'amen_004'), ('lst_003', 'amen_007'), ('lst_003', 'amen_019'),
  ('lst_003', 'amen_016'), ('lst_003', 'amen_017');

-- lst_004: Lake Nakuru day trip
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_004', 'amen_001'), ('lst_004', 'amen_004'), ('lst_004', 'amen_008');

-- lst_005: Samburu
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_005', 'amen_001'), ('lst_005', 'amen_002'), ('lst_005', 'amen_004'),
  ('lst_005', 'amen_015'), ('lst_005', 'amen_017'), ('lst_005', 'amen_020');

-- lst_006: Nairobi NP half-day
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_006', 'amen_001'), ('lst_006', 'amen_004');

-- lst_007: Diani Beach Resort
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_007', 'amen_002'), ('lst_007', 'amen_003'), ('lst_007', 'amen_005'),
  ('lst_007', 'amen_006'), ('lst_007', 'amen_010'), ('lst_007', 'amen_011'),
  ('lst_007', 'amen_012'), ('lst_007', 'amen_013');

-- lst_008: Lamu Heritage Stay
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_008', 'amen_002'), ('lst_008', 'amen_003'), ('lst_008', 'amen_012'),
  ('lst_008', 'amen_015');

-- lst_009: Watamu Snorkelling
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_009', 'amen_011'), ('lst_009', 'amen_012');

-- lst_010: Mount Kenya Trek
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_010', 'amen_002'), ('lst_010', 'amen_003'), ('lst_010', 'amen_004'),
  ('lst_010', 'amen_016');

-- lst_011: Maasai Village
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_011', 'amen_004'), ('lst_011', 'amen_015');

-- lst_012: Safari & Beach Combo
INSERT OR IGNORE INTO listing_amenities (listing_id, amenity_id) VALUES
  ('lst_012', 'amen_001'), ('lst_012', 'amen_002'), ('lst_012', 'amen_003'),
  ('lst_012', 'amen_004'), ('lst_012', 'amen_006'), ('lst_012', 'amen_007'),
  ('lst_012', 'amen_009'), ('lst_012', 'amen_011'), ('lst_012', 'amen_013');

-- ── 7. Pricing Rules ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO pricing_rules (id, listing_id, name, price_amount, currency_code, unit_type, min_units, max_units, is_active, created_at, updated_at) VALUES
  -- Mara Safari
  ('pr_001', 'lst_001', 'Adult',            4500000,  'KES', 'per_person', 1, 8,  1, datetime('now'), datetime('now')),
  ('pr_002', 'lst_001', 'Child (3-11)',     2250000,  'KES', 'per_person', 1, 8,  1, datetime('now'), datetime('now')),
  -- Amboseli
  ('pr_003', 'lst_002', 'Adult',            3200000,  'KES', 'per_person', 1, 6,  1, datetime('now'), datetime('now')),
  ('pr_004', 'lst_002', 'Child (3-11)',     1600000,  'KES', 'per_person', 1, 6,  1, datetime('now'), datetime('now')),
  -- Tsavo
  ('pr_005', 'lst_003', 'Adult',            5800000,  'KES', 'per_person', 1, 6,  1, datetime('now'), datetime('now')),
  ('pr_006', 'lst_003', 'Child (3-11)',     2900000,  'KES', 'per_person', 1, 6,  1, datetime('now'), datetime('now')),
  -- Lake Nakuru Day
  ('pr_007', 'lst_004', 'Adult',            1500000,  'KES', 'per_person', 1, 8,  1, datetime('now'), datetime('now')),
  ('pr_008', 'lst_004', 'Child (3-11)',      750000,  'KES', 'per_person', 1, 8,  1, datetime('now'), datetime('now')),
  -- Samburu
  ('pr_009', 'lst_005', 'Adult (inc. flights)', 7500000, 'KES', 'per_person', 1, 6, 1, datetime('now'), datetime('now')),
  ('pr_010', 'lst_005', 'Child (3-11)',      3750000,  'KES', 'per_person', 1, 6,  1, datetime('now'), datetime('now')),
  -- Nairobi NP Half-Day
  ('pr_011', 'lst_006', 'Adult',             800000,  'KES', 'per_person', 1, 8,  1, datetime('now'), datetime('now')),
  ('pr_012', 'lst_006', 'Child (3-11)',      400000,  'KES', 'per_person', 1, 8,  1, datetime('now'), datetime('now')),
  -- Diani Beach Resort
  ('pr_013', 'lst_007', 'Double Room (per night)', 2500000, 'KES', 'per_night', 1, NULL, 1, datetime('now'), datetime('now')),
  ('pr_014', 'lst_007', 'Family Suite (per night)', 4000000, 'KES', 'per_night', 1, NULL, 1, datetime('now'), datetime('now')),
  -- Lamu Heritage
  ('pr_015', 'lst_008', 'Standard Room',    2833000,  'KES', 'per_night', 1, NULL, 1, datetime('now'), datetime('now')),
  ('pr_016', 'lst_008', 'Rooftop Suite',    3500000,  'KES', 'per_night', 1, NULL, 1, datetime('now'), datetime('now')),
  -- Watamu Snorkelling
  ('pr_017', 'lst_009', 'Adult',             450000,  'KES', 'per_person', 1, 12, 1, datetime('now'), datetime('now')),
  ('pr_018', 'lst_009', 'Child (5-11)',      225000,  'KES', 'per_person', 1, 12, 1, datetime('now'), datetime('now')),
  -- Mount Kenya Trek
  ('pr_019', 'lst_010', 'Per Trekker',      6500000,  'KES', 'per_person', 1, 8,  1, datetime('now'), datetime('now')),
  -- Maasai Village
  ('pr_020', 'lst_011', 'Per Person',        350000,  'KES', 'per_person', 1, 15, 1, datetime('now'), datetime('now')),
  -- Safari & Beach Combo
  ('pr_021', 'lst_012', 'Adult',           15000000,  'KES', 'per_person', 1, 6,  1, datetime('now'), datetime('now')),
  ('pr_022', 'lst_012', 'Child (3-11)',     7500000,  'KES', 'per_person', 1, 6,  1, datetime('now'), datetime('now'));

-- ── 8. Seasonal Rates ─────────────────────────────────────────────────────────

-- Peak season: Jul–Oct (Great Migration), Dec–Jan (holidays)
INSERT OR IGNORE INTO seasonal_rates (id, listing_id, name, start_date, end_date, price_amount, currency_code, is_multiplier, multiplier, is_active, created_at) VALUES
  ('sr_001', 'lst_001', 'Migration Peak',   '2026-07-01', '2026-10-31', 0, 'KES', 1, 1.3, 1, datetime('now')),
  ('sr_002', 'lst_001', 'Holiday Peak',     '2026-12-15', '2027-01-10', 0, 'KES', 1, 1.2, 1, datetime('now')),
  ('sr_003', 'lst_005', 'Dry Season Peak',  '2026-06-01', '2026-09-30', 0, 'KES', 1, 1.2, 1, datetime('now')),
  ('sr_004', 'lst_007', 'Holiday Peak',     '2026-12-15', '2027-01-10', 0, 'KES', 1, 1.4, 1, datetime('now')),
  ('sr_005', 'lst_007', 'Low Season',       '2026-04-01', '2026-06-30', 0, 'KES', 1, 0.8, 1, datetime('now')),
  ('sr_006', 'lst_012', 'Migration Peak',   '2026-07-01', '2026-10-31', 0, 'KES', 1, 1.25, 1, datetime('now'));

-- ── 9. Inventory (next 90 days from mid-March 2026) ───────────────────────────
-- Generate inventory for key listings — tours with limited capacity

-- Helper: recursive CTE to generate date series, one INSERT per listing

-- lst_001: 3-Day Mara Safari — capacity 8, available every day
INSERT OR IGNORE INTO inventory (id, listing_id, date, total_capacity, booked_count, remaining_capacity, is_available, updated_at)
SELECT 'inv_001_' || d.val, 'lst_001', d.val, 8, 0, 8, 1, datetime('now')
FROM (
  WITH RECURSIVE dates(val) AS (
    VALUES('2026-03-15')
    UNION ALL
    SELECT date(val, '+1 day') FROM dates WHERE val < '2026-06-12'
  ) SELECT val FROM dates
) d;

-- lst_004: Lake Nakuru Day — capacity 8, daily
INSERT OR IGNORE INTO inventory (id, listing_id, date, total_capacity, booked_count, remaining_capacity, is_available, updated_at)
SELECT 'inv_004_' || d.val, 'lst_004', d.val, 8, 0, 8, 1, datetime('now')
FROM (
  WITH RECURSIVE dates(val) AS (
    VALUES('2026-03-15')
    UNION ALL
    SELECT date(val, '+1 day') FROM dates WHERE val < '2026-06-12'
  ) SELECT val FROM dates
) d;

-- lst_006: Nairobi NP Half-Day — capacity 8, daily
INSERT OR IGNORE INTO inventory (id, listing_id, date, total_capacity, booked_count, remaining_capacity, is_available, updated_at)
SELECT 'inv_006_' || d.val, 'lst_006', d.val, 8, 0, 8, 1, datetime('now')
FROM (
  WITH RECURSIVE dates(val) AS (
    VALUES('2026-03-15')
    UNION ALL
    SELECT date(val, '+1 day') FROM dates WHERE val < '2026-06-12'
  ) SELECT val FROM dates
) d;

-- lst_009: Watamu Snorkelling — capacity 12, daily
INSERT OR IGNORE INTO inventory (id, listing_id, date, total_capacity, booked_count, remaining_capacity, is_available, updated_at)
SELECT 'inv_009_' || d.val, 'lst_009', d.val, 12, 0, 12, 1, datetime('now')
FROM (
  WITH RECURSIVE dates(val) AS (
    VALUES('2026-03-15')
    UNION ALL
    SELECT date(val, '+1 day') FROM dates WHERE val < '2026-06-12'
  ) SELECT val FROM dates
) d;

-- lst_011: Maasai Village — capacity 15, daily
INSERT OR IGNORE INTO inventory (id, listing_id, date, total_capacity, booked_count, remaining_capacity, is_available, updated_at)
SELECT 'inv_011_' || d.val, 'lst_011', d.val, 15, 0, 15, 1, datetime('now')
FROM (
  WITH RECURSIVE dates(val) AS (
    VALUES('2026-03-15')
    UNION ALL
    SELECT date(val, '+1 day') FROM dates WHERE val < '2026-06-12'
  ) SELECT val FROM dates
) d;

-- ── 10. Media Assets (gallery images) ─────────────────────────────────────────

INSERT OR IGNORE INTO media_assets (id, entity_type, entity_id, purpose, r2_key, url, mime_type, size_bytes, sort_order, uploaded_by, created_at) VALUES
  -- Mara Safari gallery
  ('ma_001', 'listing', 'lst_001', 'cover',   'listings/lst_001/cover.jpg',   'https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=800', 'image/jpeg', 120000, 0, 'system', datetime('now')),
  ('ma_002', 'listing', 'lst_001', 'gallery', 'listings/lst_001/gallery1.jpg', 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800', 'image/jpeg', 95000,  1, 'system', datetime('now')),
  ('ma_003', 'listing', 'lst_001', 'gallery', 'listings/lst_001/gallery2.jpg', 'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800', 'image/jpeg', 88000,  2, 'system', datetime('now')),
  -- Amboseli
  ('ma_004', 'listing', 'lst_002', 'cover',   'listings/lst_002/cover.jpg',   'https://images.unsplash.com/photo-1612196808214-b7e239e46f40?w=800', 'image/jpeg', 110000, 0, 'system', datetime('now')),
  -- Tsavo
  ('ma_005', 'listing', 'lst_003', 'cover',   'listings/lst_003/cover.jpg',   'https://images.unsplash.com/photo-1535338454528-1b22a28ed4f5?w=800',  'image/jpeg', 105000, 0, 'system', datetime('now')),
  -- Lake Nakuru
  ('ma_006', 'listing', 'lst_004', 'cover',   'listings/lst_004/cover.jpg',   'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800', 'image/jpeg', 92000,  0, 'system', datetime('now')),
  -- Samburu
  ('ma_007', 'listing', 'lst_005', 'cover',   'listings/lst_005/cover.jpg',   'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800', 'image/jpeg', 98000,  0, 'system', datetime('now')),
  -- Nairobi NP
  ('ma_008', 'listing', 'lst_006', 'cover',   'listings/lst_006/cover.jpg',   'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=800', 'image/jpeg', 85000,  0, 'system', datetime('now')),
  -- Diani Beach
  ('ma_009', 'listing', 'lst_007', 'cover',   'listings/lst_007/cover.jpg',   'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800', 'image/jpeg', 115000, 0, 'system', datetime('now')),
  ('ma_010', 'listing', 'lst_007', 'gallery', 'listings/lst_007/gallery1.jpg', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', 'image/jpeg', 90000,  1, 'system', datetime('now')),
  -- Lamu
  ('ma_011', 'listing', 'lst_008', 'cover',   'listings/lst_008/cover.jpg',   'https://images.unsplash.com/photo-1590846083693-f23fdede1222?w=800', 'image/jpeg', 100000, 0, 'system', datetime('now')),
  -- Watamu
  ('ma_012', 'listing', 'lst_009', 'cover',   'listings/lst_009/cover.jpg',   'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', 'image/jpeg', 87000,  0, 'system', datetime('now')),
  -- Mount Kenya
  ('ma_013', 'listing', 'lst_010', 'cover',   'listings/lst_010/cover.jpg',   'https://images.unsplash.com/photo-1631646109206-4c986a684abc?w=800', 'image/jpeg', 95000,  0, 'system', datetime('now')),
  -- Maasai Village
  ('ma_014', 'listing', 'lst_011', 'cover',   'listings/lst_011/cover.jpg',   'https://images.unsplash.com/photo-1504432842672-1a79f78e4084?w=800', 'image/jpeg', 82000,  0, 'system', datetime('now')),
  -- Safari+Beach Combo
  ('ma_015', 'listing', 'lst_012', 'cover',   'listings/lst_012/cover.jpg',   'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800', 'image/jpeg', 110000, 0, 'system', datetime('now')),

  -- Destination cover images
  ('ma_dst_001', 'destination', 'dst_001', 'cover', 'destinations/dst_001/cover.jpg', 'https://images.unsplash.com/photo-1547970810-dc1eac37d174?w=800', 'image/jpeg', 120000, 0, 'system', datetime('now')),
  ('ma_dst_002', 'destination', 'dst_002', 'cover', 'destinations/dst_002/cover.jpg', 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800', 'image/jpeg', 115000, 0, 'system', datetime('now')),
  ('ma_dst_003', 'destination', 'dst_003', 'cover', 'destinations/dst_003/cover.jpg', 'https://images.unsplash.com/photo-1612196808214-b7e239e46f40?w=800', 'image/jpeg', 110000, 0, 'system', datetime('now')),
  ('ma_dst_004', 'destination', 'dst_004', 'cover', 'destinations/dst_004/cover.jpg', 'https://images.unsplash.com/photo-1535338454528-1b22a28ed4f5?w=800', 'image/jpeg', 105000, 0, 'system', datetime('now')),
  ('ma_dst_005', 'destination', 'dst_005', 'cover', 'destinations/dst_005/cover.jpg', 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800', 'image/jpeg', 92000,  0, 'system', datetime('now'));
