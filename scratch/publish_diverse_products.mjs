import Database from 'better-sqlite3';

const db = new Database('data/meli_bot.db');
const tenant = db.prepare('SELECT access_token FROM tenants WHERE seller_id = ?').get('3680586616');

if (!tenant || !tenant.access_token) {
  console.error('No se encontró el access token para el seller 3680586616');
  process.exit(1);
}

const productsToPublish = [
  {
    name: 'Cafetera Oster Prima Latte Roja',
    catalog_product_id: 'MLA21726650',
    category_id: 'MLA4340',
    price: 185000,
    quantity: 12,
    picture: 'https://http2.mlstatic.com/D_NQ_NP_666063-MLC48036390275_102021-F.jpg'
  },
  {
    name: 'Teclado Mecánico Redragon Kumara K552',
    catalog_product_id: 'MLA24066301',
    category_id: 'MLA418448',
    price: 52000,
    quantity: 20,
    picture: 'https://http2.mlstatic.com/D_NQ_NP_679404-MLU70095103493_062023-F.jpg'
  },
  {
    name: 'Termo Stanley Classic 1L Negro',
    catalog_product_id: 'MLA35222639',
    category_id: 'MLA47769',
    price: 79000,
    quantity: 15,
    picture: 'https://http2.mlstatic.com/D_NQ_NP_891618-MLA80207590953_102024-F.jpg'
  },
  {
    name: 'Parlante Portátil Bluetooth JBL Go 4',
    catalog_product_id: 'MLA44742234',
    category_id: 'MLA8618',
    price: 64000,
    quantity: 18,
    picture: 'https://http2.mlstatic.com/D_NQ_NP_887120-MLA99378598880_112025-F.jpg'
  },
  {
    name: 'Mouse Gamer Logitech G203 Lightsync Blanco',
    catalog_product_id: 'MLA7871164',
    category_id: 'MLA1714',
    price: 32000,
    quantity: 25,
    picture: 'https://http2.mlstatic.com/D_NQ_NP_921085-MLA95833211703_102025-F.jpg'
  }
];

async function publishAll() {
  const results = [];
  for (const prod of productsToPublish) {
    try {
      console.log(`Publicando: ${prod.name}...`);
      const payload = {
        catalog_product_id: prod.catalog_product_id,
        catalog_listing: true,
        category_id: prod.category_id,
        price: prod.price,
        currency_id: 'ARS',
        available_quantity: prod.quantity,
        buying_mode: 'buy_it_now',
        listing_type_id: 'gold_special',
        condition: 'new',
        pictures: [{ source: prod.picture }]
      };

      const res = await fetch('https://api.mercadolibre.com/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tenant.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.status === 201) {
        console.log(`✅ [OK] ${data.id} - ${data.title} (${data.status})`);
        results.push({
          id: data.id,
          title: data.title,
          status: data.status,
          price: data.price,
          quantity: data.available_quantity,
          permalink: data.permalink
        });
      } else {
        console.error(`❌ [Error ${res.status}] en ${prod.name}:`, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`❌ Excepción al publicar ${prod.name}:`, err.message);
    }
  }

  console.log('\n--- Resumen de Productos Creados ---');
  console.log(JSON.stringify(results, null, 2));
}

publishAll();
