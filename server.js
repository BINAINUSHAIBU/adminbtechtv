const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   DATABASE
========================= */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"));

/* =========================
   USER MODEL
========================= */
const User = mongoose.model("User", new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: "user" },

  plan: { type: String, default: "trial" },
  trialStart: Date,
  trialEnd: Date,
  subscriptionEnd: Date,

  isBanned: { type: Boolean, default: false }
}));

/* =========================
   AUTH MIDDLEWARE
========================= */
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.send("No token");

  try {
    req.user = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.send("Invalid token");
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.send("Admins only");
  next();
}

/* =========================
   ACCESS CONTROL (TRIAL + SUB)
========================= */
async function accessControl(req, res, next) {
  const user = await User.findById(req.user.id);
  const now = new Date();

  if (!user || user.isBanned) {
    return res.send("Account blocked");
  }

  if (user.plan === "trial" && now > user.trialEnd) {
    user.plan = "expired";
    await user.save();
    return res.send("Trial expired");
  }

  if (user.plan === "active" && user.subscriptionEnd && now > user.subscriptionEnd) {
    user.plan = "expired";
    await user.save();
    return res.send("Subscription expired");
  }

  req.u = user;
  next();
}

/* =========================
   REGISTER (AUTO 3 DAY TRIAL)
========================= */
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const now = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(now.getDate() + 3);

  await User.create({
    username,
    password: hashed,
    trialStart: now,
    trialEnd,
    plan: "trial"
  });

  res.send("User created with 3-day trial");
});

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.send("User not found");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.send("Wrong password");

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

/* =========================
   IPTV ACCESS ROUTE
========================= */
app.get("/stream", auth, accessControl, (req, res) => {
  res.send(`
    <h2>Welcome ${req.u.username}</h2>
    <p>Plan: ${req.u.plan}</p>
    <a href="/user">Go to User Panel</a>
  `);
});

/* =========================
   USER PANEL (ONE PAGE UI)
========================= */
app.get("/user", (req, res) => {
  res.send(`
  <h1>User Dashboard</h1>

  <button onclick="check()">Check Status</button>

  <pre id="out"></pre>

  <script>
  async function check(){
    const token = localStorage.getItem("token");

    const res = await fetch("/me", {
      headers: { Authorization: "Bearer " + token }
    });

    document.getElementById("out").innerText = await res.text();
  }
  </script>
  `);
});

/* =========================
   ADMIN PANEL (ONE PAGE)
========================= */
app.get("/admin", (req, res) => {
  res.send(`
  <h1>Admin Panel</h1>

  <button onclick="load()">Load Users</button>

  <pre id="out"></pre>

  <script>
  async function load(){
    const token = localStorage.getItem("token");

    const res = await fetch("/admin/users", {
      headers: { Authorization: "Bearer " + token }
    });

    document.getElementById("out").innerText = await res.text();
  }
  </script>
  `);
});

/* =========================
   ADMIN API
========================= */
app.get("/admin/users", auth, adminOnly, async (req, res) => {
  const users = await User.find();
  res.json(users);
});

/* =========================
   USER PROFILE
========================= */
app.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user);
});

/* =========================
   START SERVER
========================= */
app.listen(5000, () => console.log("Server running on 5000"));
