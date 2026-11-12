const express = require("express");
const router = express.Router();
const etlDao = require("../dao/etl.dao");

router.get("/fill-firebase", etlDao.fillFirebase);
router.get("/etl-process", etlDao.EtlProcess);
router.get("/ventas", etlDao.getVentas);
router.get("/ventas/resumen", etlDao.getResumen);

router.post("/ventas/firebase", etlDao.addVentaFirebase);
router.post("/ventas/mysql", etlDao.addVentaMysql);
router.post("/ventas", etlDao.addVentaAmbos);

router.get("/firebase/ventas", etlDao.getVentasFirebase);

module.exports = router;