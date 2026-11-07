const { Router } = require('express');
const authService = require('../services/auth.service');

const router = Router();

// POST /login (público). Avalia somente o corpo; ignora Authorization e campos extras.
router.post('/', (req, res, next) => {
  try {
    const email = req.body ? req.body.email : undefined;
    res.status(200).json(authService.login(email));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
