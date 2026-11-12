const db = require("../services/firebase.service");
const pool = require("../services/mysql.service");

/* ─────────────────────────────────────────────
   1) FILL: llenar Firestore con datos sucios
   ───────────────────────────────────────────── */
exports.fillFirebase = async (req, res) => {
  try {
    const ventas = [
      { id: 1, cliente: "  Ana Pérez ", juego: "Zelda", ciudad: "bogotá", cantidad: 2, precio: "59900" },
      { id: 2, cliente: "LUIS GÓMEZ", juego: "FIFA 26", ciudad: "Cali ", cantidad: 1, precio: "$ 89900" },
      { id: 3, cliente: "marta ruiz", juego: "Mario Kart", ciudad: "MEDELLÍN", cantidad: 3, precio: "49900" },
      { id: 4, cliente: "Pedro Díaz", juego: "Hollow Knight", ciudad: "Bogotá", cantidad: 1, precio: "" },   // sucio: sin precio
      { id: 5, cliente: "Sofía León", juego: "Celeste", ciudad: "Cali", cantidad: -2, precio: "35000" },     // sucio: cantidad negativa
      { id: 6, cliente: "Juan Mora", juego: "Zelda", ciudad: "bogotá ", cantidad: 1, precio: "59900" },
    ];

    const batch = db.batch(); // escribe todo en una sola operación
    ventas.forEach((v) => {
      batch.set(db.collection("ventas").doc(String(v.id)), v);
    });
    await batch.commit();

    res.json({ ok: true, insertados: ventas.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

function capitalizar(texto) {
  return texto
    .trim()
    .toLowerCase()
    .split(/\s+/)                                          // separa por espacios
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))    // primera letra en mayúscula
    .join(" ");
}

exports.EtlProcess = async (req, res) => {
  try {
    // EXTRACT: leer todos los documentos de Firestore
    const snapshot = await db.collection("ventas").get();
    const crudos = snapshot.docs.map((doc) => doc.data());

    // TRANSFORM: limpiar, validar y calcular
    const limpios = [];
    const descartados = [];

    for (const v of crudos) {
      const precio = Number(String(v.precio).replace(/[^0-9.]/g, ""));
      const cantidad = Number(v.cantidad);

      if (!precio || precio <= 0 || !cantidad || cantidad <= 0) {
        descartados.push({ id: v.id, motivo: "precio o cantidad inválidos" });
        continue;
      }

      limpios.push({
        id: v.id,
        cliente: capitalizar(v.cliente),
        juego: v.juego.trim(),
        ciudad: capitalizar(v.ciudad),
        cantidad,
        precio,
        total: cantidad * precio,
      });
    }

    // LOAD: insertar en MySQL (sin duplicar si se corre dos veces)
    for (const v of limpios) {
      await pool.query(
        `INSERT INTO ventas (id, cliente, juego, ciudad, cantidad, precio, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           cliente = VALUES(cliente),
           juego = VALUES(juego),
           ciudad = VALUES(ciudad),
           cantidad = VALUES(cantidad),
           precio = VALUES(precio),
           total = VALUES(total)`,
        [v.id, v.cliente, v.juego, v.ciudad, v.cantidad, v.precio, v.total]
      );
    }

    res.json({
      ok: true,
      extraidos: crudos.length,
      cargados: limpios.length,
      descartados,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/* ─────────────────────────────────────────────
   3) CONSULTAS sobre MySQL
   ───────────────────────────────────────────── */
exports.getVentas = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM ventas ORDER BY id");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.getResumen = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ciudad,
              COUNT(*) AS num_ventas,
              SUM(cantidad) AS unidades,
              SUM(total) AS total_vendido
       FROM ventas
       GROUP BY ciudad
       ORDER BY total_vendido DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
/* ─────────────────────────────────────────────
   Utilidades
   ───────────────────────────────────────────── */
function validarVenta(body) {
  const { id, cliente, juego, ciudad, cantidad, precio } = body;

  if (!id || !cliente || !juego || !ciudad) {
    return "Faltan campos: id, cliente, juego y ciudad son obligatorios";
  }
  if (!(Number(cantidad) > 0) || !(Number(precio) > 0)) {
    return "cantidad y precio deben ser números mayores a 0";
  }
  return null; // null = todo bien
}

function limpiarVenta(body) {
  const cantidad = Number(body.cantidad);
  const precio = Number(body.precio);
  return {
    id: Number(body.id),
    cliente: capitalizar(body.cliente),
    juego: body.juego.trim(),
    ciudad: capitalizar(body.ciudad),
    cantidad,
    precio,
    total: cantidad * precio,
  };
}

/* ─────────────────────────────────────────────
   A) POST solo a Firestore (dato crudo)
   ───────────────────────────────────────────── */
exports.addVentaFirebase = async (req, res) => {
  try {
    const error = validarVenta(req.body);
    if (error) return res.status(400).json({ error });

    const { id, cliente, juego, ciudad, cantidad, precio } = req.body;
    await db.collection("ventas").doc(String(id)).set({
      id: Number(id), cliente, juego, ciudad, cantidad, precio,
    });

    res.status(201).json({ ok: true, destino: "firebase", id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/* ─────────────────────────────────────────────
   B) POST solo a MySQL (dato limpio)
   ───────────────────────────────────────────── */
exports.addVentaMysql = async (req, res) => {
  try {
    const error = validarVenta(req.body);
    if (error) return res.status(400).json({ error });

    const v = limpiarVenta(req.body);
    await pool.query(
      `INSERT INTO ventas (id, cliente, juego, ciudad, cantidad, precio, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cliente = VALUES(cliente), juego = VALUES(juego),
         ciudad = VALUES(ciudad), cantidad = VALUES(cantidad),
         precio = VALUES(precio), total = VALUES(total)`,
      [v.id, v.cliente, v.juego, v.ciudad, v.cantidad, v.precio, v.total]
    );

    res.status(201).json({ ok: true, destino: "mysql", venta: v });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/* ─────────────────────────────────────────────
   C) POST a Firestore Y MySQL
   ───────────────────────────────────────────── */
exports.addVentaAmbos = async (req, res) => {
  try {
    const error = validarVenta(req.body);
    if (error) return res.status(400).json({ error });

    const v = limpiarVenta(req.body);

    // 1) MySQL
    await pool.query(
      `INSERT INTO ventas (id, cliente, juego, ciudad, cantidad, precio, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cliente = VALUES(cliente), juego = VALUES(juego),
         ciudad = VALUES(ciudad), cantidad = VALUES(cantidad),
         precio = VALUES(precio), total = VALUES(total)`,
      [v.id, v.cliente, v.juego, v.ciudad, v.cantidad, v.precio, v.total]
    );

    // 2) Firestore
    await db.collection("ventas").doc(String(v.id)).set(v);

    res.status(201).json({ ok: true, destino: "mysql y firebase", venta: v });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
exports.getVentasFirebase = async (req, res) => {
  try {
    const snapshot = await db.collection("ventas").get();
    const ventas = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => a.id - b.id);
    res.json(ventas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};