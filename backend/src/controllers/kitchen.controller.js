const prisma = require('../config/prisma');
const { normalizeFood } = require('../utils/foodName');

/**
 * Mi cocina: heladera y lista de compras.
 * Cada usuario solo ve y modifica sus propios ítems.
 *
 * Al crear un ítem la app puede mandar su propio `id` (UUID). Así la pantalla
 * lo muestra al instante y, si el pedido se reintenta, no se duplica.
 */

// Tope por lista, para que nadie llene la base con miles de ítems.
const MAX_ITEMS = 200;

const FRIDGE_SELECT = { id: true, name: true, quantity: true, createdAt: true, updatedAt: true };
const SHOPPING_SELECT = { id: true, name: true, quantity: true, done: true, createdAt: true, updatedAt: true };

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v);
// "Huevos", "huevo" y "HUEVOS" son el mismo alimento (ver utils/foodName.js).
const foodKey = (name) => normalizeFood(name) || clean(name).toLowerCase();
// En la lista de compras, sin cantidad se asume 1.
const shoppingQty = (q) => clean(q) || '1';

const listFridge = (userId) =>
  prisma.fridgeItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: FRIDGE_SELECT });
const listShopping = (userId) =>
  prisma.shoppingItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: SHOPPING_SELECT });

function tooMany(res, what) {
  return res.status(409).json({ error: `Llegaste al máximo de ${MAX_ITEMS} ${what}. Borrá algunos para agregar más.` });
}

/**
 * Crea un ítem con el id que mandó la app. Si ese id ya existe y es del mismo
 * usuario (pedido repetido), devuelve el existente en vez de fallar.
 */
async function createWithClientId(model, select, userId, data) {
  try {
    return { item: await prisma[model].create({ data: { ...data, userId }, select }), created: true };
  } catch (err) {
    if (err.code !== 'P2002' || !data.id) throw err;
    const existing = await prisma[model].findFirst({ where: { id: data.id, userId }, select });
    if (!existing) {
      const conflict = new Error('Ese identificador ya está en uso.');
      conflict.status = 409;
      throw conflict;
    }
    return { item: existing, created: false };
  }
}

// GET /api/kitchen → { fridge, shopping }
async function getKitchen(req, res) {
  const [fridge, shopping] = await Promise.all([listFridge(req.user.id), listShopping(req.user.id)]);
  res.json({ fridge, shopping, maxItems: MAX_ITEMS });
}

// ---------- Heladera ----------

// POST /api/kitchen/fridge { id?, name, quantity? }
async function addFridgeItem(req, res) {
  const userId = req.user.id;

  // Si ya hay un alimento con el mismo nombre ("huevo" = "Huevos"), se suma la
  // cantidad en vez de crear otro. Se responde merged: true y el ítem existente.
  if (!req.body.id || !(await prisma.fridgeItem.findFirst({ where: { id: req.body.id, userId }, select: { id: true } }))) {
    const key = foodKey(req.body.name);
    const fridge = await prisma.fridgeItem.findMany({ where: { userId }, select: { id: true, name: true, quantity: true } });
    const existing = fridge.find((f) => foodKey(f.name) === key);
    if (existing) {
      const item = await prisma.fridgeItem.update({
        where: { id: existing.id },
        data: { quantity: mergeQty(existing.quantity, req.body.quantity) },
        select: FRIDGE_SELECT,
      });
      return res.json({ item, merged: true, replacedId: req.body.id || null });
    }
    if (fridge.length >= MAX_ITEMS) return tooMany(res, 'alimentos en la heladera');
  }

  const { item, created } = await createWithClientId('fridgeItem', FRIDGE_SELECT, userId, {
    ...(req.body.id ? { id: req.body.id } : {}),
    name: clean(req.body.name),
    quantity: clean(req.body.quantity) || null,
  });
  res.status(created ? 201 : 200).json({ item });
}

// PATCH /api/kitchen/fridge/:id { name?, quantity? }
async function updateFridgeItem(req, res) {
  const data = {};
  if (req.body.name !== undefined) data.name = clean(req.body.name);
  if (req.body.quantity !== undefined) data.quantity = clean(req.body.quantity) || null;

  const result = await prisma.fridgeItem.updateMany({ where: { id: req.params.id, userId: req.user.id }, data });
  if (result.count === 0) return res.status(404).json({ error: 'Ese alimento ya no está en tu heladera.' });
  const item = await prisma.fridgeItem.findUnique({ where: { id: req.params.id }, select: FRIDGE_SELECT });
  res.json({ item });
}

// DELETE /api/kitchen/fridge/:id  (si ya no existía, igual responde OK)
async function deleteFridgeItem(req, res) {
  await prisma.fridgeItem.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.status(204).end();
}

// ---------- Lista de compras ----------

// POST /api/kitchen/shopping { id?, name, quantity? }
async function addShoppingItem(req, res) {
  const userId = req.user.id;
  const count = await prisma.shoppingItem.count({ where: { userId } });
  if (count >= MAX_ITEMS) return tooMany(res, 'productos en la lista de compras');

  const { item, created } = await createWithClientId('shoppingItem', SHOPPING_SELECT, userId, {
    ...(req.body.id ? { id: req.body.id } : {}),
    name: clean(req.body.name),
    quantity: shoppingQty(req.body.quantity),
  });
  res.status(created ? 201 : 200).json({ item });
}

// PATCH /api/kitchen/shopping/:id { name?, quantity?, done? }
async function updateShoppingItem(req, res) {
  const data = {};
  if (req.body.name !== undefined) data.name = clean(req.body.name);
  if (req.body.quantity !== undefined) data.quantity = shoppingQty(req.body.quantity);
  if (req.body.done !== undefined) data.done = req.body.done;

  const result = await prisma.shoppingItem.updateMany({ where: { id: req.params.id, userId: req.user.id }, data });
  if (result.count === 0) return res.status(404).json({ error: 'Ese producto ya no está en tu lista.' });
  const item = await prisma.shoppingItem.findUnique({ where: { id: req.params.id }, select: SHOPPING_SELECT });
  res.json({ item });
}

// DELETE /api/kitchen/shopping/:id
async function deleteShoppingItem(req, res) {
  await prisma.shoppingItem.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.status(204).end();
}

// DELETE /api/kitchen/shopping-bought → borra los productos tachados ("Limpiar")
async function clearBought(req, res) {
  const { count } = await prisma.shoppingItem.deleteMany({ where: { userId: req.user.id, done: true } });
  res.json({ deleted: count });
}

// POST /api/kitchen/shopping/bulk { items: [{ name, quantity }] }
// "Agregar los que faltan a mi lista" desde una receta.
// No duplica: si el producto ya está en la lista (mismo nombre), se saltea.
async function addShoppingBulk(req, res) {
  const userId = req.user.id;
  const key = foodKey;

  const existing = await prisma.shoppingItem.findMany({ where: { userId }, select: { name: true } });
  const names = new Set(existing.map((i) => key(i.name)));
  const toAdd = [];
  const skipped = [];
  for (const it of req.body.items) {
    const name = clean(it.name);
    if (names.has(key(name))) {
      skipped.push(name);
      continue;
    }
    names.add(key(name));
    toAdd.push(name);
  }

  const room = MAX_ITEMS - existing.length;
  if (toAdd.length > room) {
    return res.status(409).json({ error: `Tu lista de compras tiene lugar para ${Math.max(room, 0)} producto(s) más (máximo ${MAX_ITEMS}).` });
  }

  const byName = new Map(req.body.items.map((it) => [clean(it.name), it]));
  const now = Date.now();
  if (toAdd.length) {
    await prisma.shoppingItem.createMany({
      data: toAdd.map((name, i) => ({ userId, name, quantity: shoppingQty(byName.get(name)?.quantity), createdAt: new Date(now - i) })),
    });
  }
  res.status(201).json({ added: toAdd, skipped, shopping: await listShopping(userId) });
}

// ---------- Comprados → heladera ----------

// Unidades que se pueden sumar, llevadas a una base común.
const UNITS = [
  { re: /^(kg|kgs|kilo|kilos)$/, base: 'g', factor: 1000 },
  { re: /^(g|gr|grs|gramo|gramos)$/, base: 'g', factor: 1 },
  { re: /^(l|lt|lts|litro|litros)$/, base: 'ml', factor: 1000 },
  { re: /^(ml|cc)$/, base: 'ml', factor: 1 },
  { re: /^(u|un|unid|unidad|unidades)?$/, base: 'u', factor: 1 },
  // Una docena son 12 unidades (se suma como número: "3" + "1 docena" = "15").
  { re: /^(docena|docenas|doc)$/, base: 'u', factor: 12, noLabel: true },
];

/** "500 g" → { value: 500, base: 'g', label: false }; "6 unidades" → { 6, 'u', label: true }; "1 docena" → null. */
function parseQty(text) {
  const t = String(text ?? '').trim().toLowerCase()
    .replace(/^(una|un)\s+/, '1 ')
    .replace(/^(media|1\/2)\s+/, '0.5 ')
    .replace(/^docenas?$/, '1 docena');
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*([a-zñ.]*)$/);
  if (!m) return null;
  const unitText = m[2].replace(/\.$/, '');
  const unit = UNITS.find((u) => u.re.test(unitText));
  if (!unit) return null;
  return { value: Number(m[1].replace(',', '.')) * unit.factor, base: unit.base, label: unitText !== '' && !unit.noLabel };
}

const fmtNum = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

function formatQty(value, base, label) {
  if (base === 'g') return value >= 1000 ? `${fmtNum(value / 1000)} kg` : `${fmtNum(value)} g`;
  if (base === 'ml') return value >= 1000 ? `${fmtNum(value / 1000)} L` : `${fmtNum(value)} ml`;
  return label ? `${fmtNum(value)} ${value === 1 ? 'unidad' : 'unidades'}` : fmtNum(value);
}

/**
 * Suma dos cantidades de texto libre cuando se puede ("6" + "12" = "18",
 * "500 g" + "1 kg" = "1,5 kg"). Si no, las junta: "6 unidades + 1 docena".
 */
function mergeQty(current, added) {
  const a = clean(current);
  const b = clean(added);
  if (!a) return b || null;
  if (!b) return a;
  const pa = parseQty(a);
  const pb = parseQty(b);
  if (pa && pb && pa.base === pb.base) return formatQty(pa.value + pb.value, pa.base, pa.label || pb.label);
  // Misma unidad que no conocemos ("3 latas" + "2 latas" = "5 latas").
  const ra = a.toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  const rb = b.toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (ra && rb && ra[2] === rb[2]) {
    return `${fmtNum(Number(ra[1].replace(',', '.')) + Number(rb[1].replace(',', '.')))} ${a.match(/^\S+\s+(.+)$/)[1]}`.slice(0, 30);
  }
  const joined = `${a} + ${b}`;
  return joined.length <= 30 ? joined : b; // si no entra (máx. 30), queda la cantidad recién comprada
}

const nameKey = (name) => foodKey(name);

// POST /api/kitchen/shopping-bought/to-fridge { ids: [...] }
// Pasa a la heladera los productos comprados (tachados) que eligió el usuario y los
// saca de la lista. Si el alimento ya estaba en la heladera, suma las cantidades.
// Todo en una transacción: o se pasa todo, o nada.
async function boughtToFridge(req, res) {
  const userId = req.user.id;
  const ids = [...new Set(req.body.ids)];

  const result = await prisma.$transaction(async (tx) => {
    const items = await tx.shoppingItem.findMany({
      where: { userId, id: { in: ids }, done: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!items.length) return { error: 'Esos productos ya no están en tus comprados.' };

    const fridge = await tx.fridgeItem.findMany({ where: { userId } });
    const byName = new Map(fridge.map((f) => [nameKey(f.name), f]));
    const toCreate = [];
    const merged = [];

    for (const it of items) {
      const k = nameKey(it.name);
      const existing = byName.get(k);
      if (existing) {
        const quantity = mergeQty(existing.quantity, it.quantity);
        existing.quantity = quantity;
        if (existing.id) merged.push(existing);
      } else {
        const created = { userId, name: clean(it.name), quantity: clean(it.quantity) || null };
        byName.set(k, created);
        toCreate.push(created);
      }
    }

    if (fridge.length + toCreate.length > MAX_ITEMS) {
      return { error: `Tu heladera tiene lugar para ${Math.max(MAX_ITEMS - fridge.length, 0)} alimento(s) más (máximo ${MAX_ITEMS}).`, status: 409 };
    }

    const now = Date.now();
    if (toCreate.length) {
      await tx.fridgeItem.createMany({ data: toCreate.map((d, i) => ({ ...d, createdAt: new Date(now - i) })) });
    }
    // Un mismo alimento puede haberse sumado más de una vez: se guarda el valor final una sola vez.
    for (const f of new Map(merged.map((m) => [m.id, m])).values()) {
      await tx.fridgeItem.update({ where: { id: f.id }, data: { quantity: f.quantity } });
    }
    await tx.shoppingItem.deleteMany({ where: { userId, id: { in: items.map((i) => i.id) } } });

    return { moved: items.length, created: toCreate.length, merged: new Set(merged.map((m) => m.id)).size };
  });

  if (result.error) return res.status(result.status || 404).json({ error: result.error });
  const [fridge, shopping] = await Promise.all([listFridge(userId), listShopping(userId)]);
  res.json({ ...result, fridge, shopping });
}

// ---------- Pasar a la cuenta lo que estaba guardado solo en el celular ----------

/**
 * POST /api/kitchen/import { fridge: [{ name, quantity }], shopping: [{ name, quantity, done }] }
 * La app lo usa una sola vez, con lo que el usuario tenía guardado en el teléfono
 * antes de esta versión. No duplica: si ya hay un ítem con el mismo nombre, lo saltea.
 */
async function importLocal(req, res) {
  const userId = req.user.id;
  const key = foodKey;

  const result = await prisma.$transaction(async (tx) => {
    const [fridge, shopping] = await Promise.all([
      tx.fridgeItem.findMany({ where: { userId }, select: { name: true } }),
      tx.shoppingItem.findMany({ where: { userId }, select: { name: true } }),
    ]);
    const fridgeNames = new Set(fridge.map((i) => key(i.name)));
    const shoppingNames = new Set(shopping.map((i) => key(i.name)));

    const newFridge = [];
    for (const it of req.body.fridge || []) {
      if (fridge.length + newFridge.length >= MAX_ITEMS) break;
      if (fridgeNames.has(key(it.name))) continue;
      fridgeNames.add(key(it.name));
      newFridge.push({ userId, name: clean(it.name), quantity: clean(it.quantity) || null });
    }
    const newShopping = [];
    for (const it of req.body.shopping || []) {
      if (shopping.length + newShopping.length >= MAX_ITEMS) break;
      if (shoppingNames.has(key(it.name))) continue;
      shoppingNames.add(key(it.name));
      newShopping.push({ userId, name: clean(it.name), quantity: shoppingQty(it.quantity), done: it.done === true });
    }

    // Fechas escalonadas (1 ms) para que, al listar por fecha, queden en el mismo orden que en el teléfono.
    const now = Date.now();
    const stamp = (list) => list.map((data, i) => ({ ...data, createdAt: new Date(now - i) }));
    if (newFridge.length) await tx.fridgeItem.createMany({ data: stamp(newFridge) });
    if (newShopping.length) await tx.shoppingItem.createMany({ data: stamp(newShopping) });
    return { fridge: newFridge.length, shopping: newShopping.length };
  });

  const [fridge, shopping] = await Promise.all([listFridge(userId), listShopping(userId)]);
  res.json({ imported: result, fridge, shopping, maxItems: MAX_ITEMS });
}

module.exports = {
  getKitchen,
  addFridgeItem,
  updateFridgeItem,
  deleteFridgeItem,
  addShoppingItem,
  updateShoppingItem,
  deleteShoppingItem,
  clearBought,
  addShoppingBulk,
  boughtToFridge,
  importLocal,
  mergeQty,
};
