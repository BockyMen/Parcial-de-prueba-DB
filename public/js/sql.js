const log = document.getElementById("log");

function escapar(texto) {
  return String(texto ?? "-").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function registrar(metodo, ruta, destino, resultado) {
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} | ${metodo} ${ruta} → ${destino}: ${resultado}`;
  log.prepend(li);
}

async function llamar(metodo, ruta, destino, body) {
  try {
    const opciones = { method: metodo };
    if (body) {
      opciones.headers = { "Content-Type": "application/json" };
      opciones.body = JSON.stringify(body);
    }
    const response = await fetch(ruta, opciones);
    const data = await response.json();

    if (!response.ok) {
      registrar(metodo, ruta, destino, "ERROR: " + data.error);
      return null;
    }
    registrar(metodo, ruta, destino, "OK");
    return data;
  } catch (error) {
    registrar(metodo, ruta, destino, "ERROR: " + error.message);
    return null;
  }
}

function pintarTabla(idTbody, filas) {
  document.getElementById(idTbody).innerHTML = filas
    .map(
      (v) => `<tr>
        <td>${escapar(v.id)}</td>
        <td>${escapar(v.cliente)}</td>
        <td>${escapar(v.juego)}</td>
        <td>${escapar(v.ciudad)}</td>
        <td>${escapar(v.cantidad)}</td>
        <td>${escapar(v.precio)}</td>
        <td>${escapar(v.total)}</td>
      </tr>`
    )
    .join("");
}

async function actualizarTablas() {
  const firebase = await llamar("GET", "/etl/firebase/ventas", "Firebase");
  if (firebase) pintarTabla("tablaFirebase", firebase);

  const mysql = await llamar("GET", "/etl/ventas", "MySQL");
  if (mysql) pintarTabla("tablaMysql", mysql);
}

document.getElementById("uploadBtn").addEventListener("click", async () => {
  await llamar("GET", "/etl/fill-firebase", "Firebase");
  actualizarTablas();
});

document.getElementById("processBtn").addEventListener("click", async () => {
  await llamar("GET", "/etl/etl-process", "Firebase → MySQL");
  actualizarTablas();
});

document.getElementById("refreshBtn").addEventListener("click", actualizarTablas);

function leerFormulario() {
  return {
    id: document.getElementById("id").value,
    cliente: document.getElementById("cliente").value,
    juego: document.getElementById("juego").value,
    ciudad: document.getElementById("ciudad").value,
    cantidad: document.getElementById("cantidad").value,
    precio: document.getElementById("precio").value,
  };
}

async function guardar(ruta, destino) {
  const data = await llamar("POST", ruta, destino, leerFormulario());
  if (data) actualizarTablas();
}

document.getElementById("addFirebaseBtn")
  .addEventListener("click", () => guardar("/etl/ventas/firebase", "Firebase"));

document.getElementById("addMysqlBtn")
  .addEventListener("click", () => guardar("/etl/ventas/mysql", "MySQL"));

document.getElementById("addBothBtn")
  .addEventListener("click", () => guardar("/etl/ventas", "Firebase y MySQL"));

actualizarTablas();