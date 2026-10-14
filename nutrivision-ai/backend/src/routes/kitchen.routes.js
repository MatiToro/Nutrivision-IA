const { Router } = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { handleValidation } = require('../utils/validators');
const controller = require('../controllers/kitchen.controller');

const router = Router();

// Mi cocina. Solo cuentas de usuario (pacientes): el nutricionista
// y el administrador no tienen cocina.
router.use(requireAuth, requireRole('USER'));

const NAME_MSG = 'Escribí el nombre (hasta 60 caracteres).';
const QTY_MSG = 'La cantidad puede tener hasta 30 caracteres.';

const idParam = param('id').isUUID().withMessage('Ítem inválido.');
const clientId = body('id').optional().isUUID().withMessage('Identificador inválido.');
const name = (field = 'name') => body(field).isString().trim().isLength({ min: 1, max: 60 }).withMessage(NAME_MSG);
const quantity = (field = 'quantity') =>
  body(field).optional({ values: 'null' }).isString().trim().isLength({ max: 30 }).withMessage(QTY_MSG);

router.get('/', controller.getKitchen);

// Heladera
router.post('/fridge', [clientId, name(), quantity()], handleValidation, controller.addFridgeItem);
router.patch('/fridge/:id', [idParam, name().optional(), quantity()], handleValidation, controller.updateFridgeItem);
router.delete('/fridge/:id', [idParam], handleValidation, controller.deleteFridgeItem);

// Lista de compras
router.post('/shopping', [clientId, name(), quantity()], handleValidation, controller.addShoppingItem);
router.patch(
  '/shopping/:id',
  [idParam, name().optional(), quantity(), body('done').optional().isBoolean().withMessage('Valor inválido.')],
  handleValidation,
  controller.updateShoppingItem,
);
router.delete('/shopping/:id', [idParam], handleValidation, controller.deleteShoppingItem);
router.delete('/shopping-bought', controller.clearBought);
// Pasar los comprados elegidos a la heladera (suma cantidades si ya estaba)
router.post(
  '/shopping-bought/to-fridge',
  [body('ids').isArray({ min: 1, max: 200 }).withMessage('Elegí al menos un producto.'), body('ids.*').isUUID().withMessage('Producto inválido.')],
  handleValidation,
  controller.boughtToFridge,
);
// Varios productos de una vez (faltantes de una receta)
router.post(
  '/shopping/bulk',
  [body('items').isArray({ min: 1, max: 40 }).withMessage('No hay productos para agregar.'), name('items.*.name'), quantity('items.*.quantity')],
  handleValidation,
  controller.addShoppingBulk,
);

// Pasar a la cuenta lo que estaba guardado solo en el teléfono (una vez)
router.post(
  '/import',
  [
    body('fridge').optional().isArray({ max: 200 }),
    body('shopping').optional().isArray({ max: 200 }),
    name('fridge.*.name'),
    quantity('fridge.*.quantity'),
    name('shopping.*.name'),
    quantity('shopping.*.quantity'),
    body('shopping.*.done').optional().isBoolean(),
  ],
  handleValidation,
  controller.importLocal,
);

module.exports = router;
