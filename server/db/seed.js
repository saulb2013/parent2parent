const pool = require('./database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function seed() {
  // Drop existing tables and recreate
  await pool.query('DROP TABLE IF EXISTS saved_listings, listing_images, listings, categories, users CASCADE');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  // Seed users
  const passwordHash = bcrypt.hashSync('password123', 10);

  const users = [
    ['Naledi Mokoena', 'naledi@example.com', passwordHash, 'https://api.dicebear.com/7.x/avataaars/svg?seed=naledi', 'Gauteng', 'Johannesburg', '+27821234567', 'Mom of two, decluttering our playroom. Everything well cared for!'],
    ['Johan van der Merwe', 'johan@example.com', passwordHash, 'https://api.dicebear.com/7.x/avataaars/svg?seed=johan', 'Western Cape', 'Cape Town', '+27839876543', 'First-time dad selling items our little one has outgrown.'],
    ['Priya Naidoo', 'priya@example.com', passwordHash, 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', 'KwaZulu-Natal', 'Durban', '+27845551234', 'Twin mom! Double of everything means double the items to share.'],
    ['Thabo Dlamini', 'thabo@example.com', passwordHash, 'https://api.dicebear.com/7.x/avataaars/svg?seed=thabo', 'Gauteng', 'Pretoria', '+27861112233', 'Our kids grow so fast! Quality items looking for loving new homes.'],
    ['Sarah Botha', 'sarah@example.com', passwordHash, 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah', 'Eastern Cape', 'Port Elizabeth', '+27872223344', 'Passionate about sustainable parenting. Buy pre-loved, save the planet!']
  ];

  for (const u of users) {
    await pool.query(
      'INSERT INTO users (name, email, password_hash, avatar_url, province, city, phone, bio) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      u
    );
  }

  // Seed categories
  const categories = [
    ['Prams & Strollers', 'prams-strollers', '\u{1F6D2}', 'Prams, strollers, and travel systems'],
    ['Car Seats', 'car-seats', '\u{1FA91}', 'Infant, toddler, and booster car seats'],
    ['Cots & Beds', 'cots-beds', '\u{1F6CF}\uFE0F', 'Cots, bassinets, camp cots, and toddler beds'],
    ['Feeding', 'feeding', '\u{1F37C}', 'Bottles, breast pumps, high chairs, and sterilisers'],
    ['Toys & Play', 'toys-play', '\u{1F9F8}', 'Educational toys, playsets, and games'],
    ['Clothing', 'clothing', '\u{1F476}', 'Baby and kids clothing bundles'],
    ['Carriers & Slings', 'carriers-slings', '\u{1F931}', 'Baby carriers, wraps, and slings'],
    ['Outdoor & Garden', 'outdoor-garden', '\u{1F33F}', 'Swings, trampolines, and outdoor play equipment']
  ];

  for (const c of categories) {
    await pool.query(
      'INSERT INTO categories (name, slug, emoji, description) VALUES ($1,$2,$3,$4)',
      c
    );
  }

  // Seed listings
  const listings = [
    { title: 'Bugaboo Fox 3 Complete Pram', description: 'Bugaboo Fox 3 in graphite/grey melange. Includes bassinet, seat, rain cover, and cup holder. Used for 8 months, in excellent condition. Recently serviced. Smoke-free home.', price: 1200000, negotiable: true, condition: 'like_new', category_id: 1, seller_id: 1, province: 'Gauteng', city: 'Johannesburg', views: 234, seed: 'bugaboo' },
    { title: 'Maxi-Cosi Pebble 360 Car Seat', description: 'Maxi-Cosi Pebble 360 i-Size car seat in essential black. Birth to approx. 15 months. No accidents, all labels intact. Includes newborn inlay.', price: 450000, negotiable: false, condition: 'like_new', category_id: 2, seller_id: 2, province: 'Western Cape', city: 'Cape Town', views: 156, seed: 'carseat' },
    { title: 'Snoo Smart Bassinet', description: 'The famous Snoo Smart Sleeper Bassinet by Happiest Baby. Works perfectly, includes all original accessories, organic sheets, and leg lifters. Our baby slept through the night from 6 weeks!', price: 850000, negotiable: true, condition: 'good', category_id: 3, seller_id: 3, province: 'KwaZulu-Natal', city: 'Durban', views: 312, seed: 'snoo' },
    { title: 'Medela Swing Maxi Double Breast Pump', description: 'Medela Swing Maxi double electric breast pump. Barely used (expressed for 3 months). Includes extra membranes and bottles. Sanitised and ready to go.', price: 280000, negotiable: true, condition: 'like_new', category_id: 4, seller_id: 3, province: 'KwaZulu-Natal', city: 'Durban', views: 89, seed: 'medela' },
    { title: 'LEGO Duplo Mega Collection', description: 'Massive LEGO Duplo collection - over 500 pieces including train set, fire station, farm, and zoo sets. Hours of creative play. All clean and in great condition.', price: 350000, negotiable: true, condition: 'good', category_id: 5, seller_id: 4, province: 'Gauteng', city: 'Pretoria', views: 201, seed: 'lego' },
    { title: 'Baby Clothing Bundle 0-6 Months (Girls)', description: '40+ items of baby girl clothing, 0-6 months. Mix of Cotton On Kids, Woolworths, and imported brands. Includes sleepsuits, vests, dresses, and hats. All stain-free.', price: 85000, negotiable: false, condition: 'good', category_id: 6, seller_id: 1, province: 'Gauteng', city: 'Johannesburg', views: 167, seed: 'babyclothes' },
    { title: 'Ergobaby Omni 360 Carrier', description: 'Ergobaby Omni 360 Cool Air Mesh carrier in oxford blue. All positions including forward-facing. From newborn to toddler (3.2-20kg). Machine washable.', price: 195000, negotiable: true, condition: 'like_new', category_id: 7, seller_id: 5, province: 'Eastern Cape', city: 'Port Elizabeth', views: 134, seed: 'ergobaby' },
    { title: 'Little Tikes Climb & Slide Playground', description: 'Little Tikes Hide & Seek Climber with slide. Perfect for garden play, ages 1-4. Has been outside under shade for one summer. Still vibrant colours, sturdy structure.', price: 250000, negotiable: true, condition: 'good', category_id: 8, seller_id: 4, province: 'Gauteng', city: 'Pretoria', views: 98, seed: 'playground' },
    { title: 'Chicco Bravo Travel System', description: 'Chicco Bravo Trio Travel System - includes stroller frame, bassinet attachment, and KeyFit 30 car seat. One-hand fold. Used for one child only.', price: 650000, negotiable: true, condition: 'good', category_id: 1, seller_id: 2, province: 'Western Cape', city: 'Stellenbosch', views: 178, seed: 'chicco' },
    { title: 'Britax Safe-n-Sound Platinum Pro Car Seat', description: 'Britax Safe-n-Sound b-first iFix convertible car seat. Rear and forward facing. SABS approved. Expires 2028. No accidents.', price: 380000, negotiable: false, condition: 'like_new', category_id: 2, seller_id: 4, province: 'Gauteng', city: 'Sandton', views: 245, seed: 'britax' },
    { title: 'Wooden Co-Sleeper Cot with Mattress', description: 'Beautiful solid pine co-sleeper cot, converts to standalone cot. Includes brand new organic cotton mattress. Hand-crafted by a local SA woodworker.', price: 420000, negotiable: true, condition: 'like_new', category_id: 3, seller_id: 5, province: 'Eastern Cape', city: 'East London', views: 156, seed: 'cosleeper' },
    { title: 'Stokke Tripp Trapp High Chair', description: 'Stokke Tripp Trapp in natural beech wood with baby set (red) and tray. Grows with your child from 6 months. Some minor scratches on legs, otherwise perfect.', price: 320000, negotiable: true, condition: 'good', category_id: 4, seller_id: 1, province: 'Gauteng', city: 'Randburg', views: 189, seed: 'stokke' },
    { title: 'Melissa & Doug Wooden Toy Bundle', description: 'Collection of Melissa & Doug wooden toys - includes puzzle set (5 puzzles), play kitchen food, and lacing beads. Perfect for ages 2-5. Educational and screen-free.', price: 150000, negotiable: false, condition: 'good', category_id: 5, seller_id: 3, province: 'KwaZulu-Natal', city: 'Umhlanga', views: 112, seed: 'melissadoug' },
    { title: 'Woolworths Boys Bundle 2-3 Years', description: '25 items from Woolworths boys range, sizes 2-3 years. Includes jeans, shorts, t-shirts, jerseys, and one puffer jacket. All in excellent nick.', price: 120000, negotiable: true, condition: 'like_new', category_id: 6, seller_id: 4, province: 'Gauteng', city: 'Centurion', views: 203, seed: 'woolworths' },
    { title: 'Baby Bjorn Carrier Mini', description: 'Baby Bjorn Mini carrier in dusty pink cotton. Perfect for newborns, super soft and easy to use. Birth to 12 months. Washed and ready.', price: 95000, negotiable: false, condition: 'like_new', category_id: 7, seller_id: 2, province: 'Western Cape', city: 'Cape Town', views: 76, seed: 'babybjorn' },
    { title: 'Jungle Gym with Swings and Fort', description: 'Custom-built wooden jungle gym with two swings, fort with roof, climbing wall, and sandpit area. Buyer must disassemble and collect. Built 2 years ago.', price: 850000, negotiable: true, condition: 'good', category_id: 8, seller_id: 1, province: 'Gauteng', city: 'Fourways', views: 289, seed: 'junglegym' },
    { title: 'UPPAbaby Vista V2 Double Pram', description: 'UPPAbaby Vista V2 with rumble seat for second child. In Lucy (rosemary) colour. Includes all adapters, rain covers, and mosquito nets. SA warranty until 2025.', price: 1500000, negotiable: true, condition: 'like_new', category_id: 1, seller_id: 3, province: 'KwaZulu-Natal', city: 'Ballito', views: 345, seed: 'uppababy' },
    { title: 'Joie i-Spin 360 Car Seat', description: 'Joie i-Spin 360 car seat in coal. Birth to 4 years. 360 rotation for easy loading. ISOFIX base. No accidents, non-smoking household.', price: 480000, negotiable: true, condition: 'like_new', category_id: 2, seller_id: 5, province: 'Eastern Cape', city: 'Port Elizabeth', views: 167, seed: 'joie' },
    { title: 'Fisher-Price Rainforest Jumperoo', description: 'Fisher-Price Rainforest Jumperoo - lights, sounds, and bouncing fun! Clean, all electronics working. Ages 4 months to walking. Folds flat for storage.', price: 95000, negotiable: false, condition: 'good', category_id: 5, seller_id: 2, province: 'Western Cape', city: 'Paarl', views: 134, seed: 'jumperoo' },
    { title: 'Camp Cot with Mattress and Carry Bag', description: 'Camping/travel cot in navy blue. Folds compact with carry bag. Includes fitted sheet and thin mattress. Used on 3 holidays only. Clean, no tears.', price: 75000, negotiable: false, condition: 'like_new', category_id: 3, seller_id: 4, province: 'Gauteng', city: 'Midrand', views: 88, seed: 'campcot' }
  ];

  for (const l of listings) {
    const { rows } = await pool.query(
      `INSERT INTO listings (title, description, price, negotiable, condition, category_id, seller_id, province, city, status, views)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10) RETURNING id`,
      [l.title, l.description, l.price, l.negotiable, l.condition, l.category_id, l.seller_id, l.province, l.city, l.views]
    );
    const listingId = rows[0].id;

    await pool.query(
      'INSERT INTO listing_images (listing_id, url, is_primary, display_order) VALUES ($1,$2,TRUE,0), ($1,$3,FALSE,1), ($1,$4,FALSE,2)',
      [listingId, `https://picsum.photos/seed/${l.seed}/800/600`, `https://picsum.photos/seed/${l.seed}2/800/600`, `https://picsum.photos/seed/${l.seed}3/800/600`]
    );
  }

  console.log('Database seeded successfully!');
  console.log(`  - ${users.length} users`);
  console.log(`  - ${categories.length} categories`);
  console.log(`  - ${listings.length} listings`);

  await pool.end();
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
