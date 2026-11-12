const express = require("express");
const cors = require("cors");
const path = require("path");
const etlRoutes = require("./routes/etl.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use("/etl", etlRoutes);

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));