import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname, { extensions: ['html'] }));

// ===================================================================
// FIREBASE FIRESTORE INITIALIZATION
// ===================================================================
let db = null;
try {
  const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const fbConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: fbConfig.projectId
      });
    }
    db = admin.firestore();
    if (fbConfig.firestoreDatabaseId) {
      db.settings({ databaseId: fbConfig.firestoreDatabaseId });
    }
    console.log('Firebase Firestore initialized successfully for project:', fbConfig.projectId);
  }
} catch (err) {
  console.error('Firebase Admin init notice:', err.message);
}

// ===================================================================
// DATA STORAGE & PERSISTENCE (Firestore & Local Fallback)
// ===================================================================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Password security helpers
function hashPassword(password, salt) {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, userSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: userSalt };
}

function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

// Persistent sessions token map: token -> { userId, expiresAt }
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const arr = JSON.parse(raw);
      const map = new Map();
      const now = Date.now();
      arr.forEach(([token, sess]) => {
        if (sess && sess.expiresAt > now) {
          map.set(token, sess);
        }
      });
      return map;
    }
  } catch (e) {
    console.error('Error loading sessions:', e);
  }
  return new Map();
}

function saveSessions(sessionsMap) {
  try {
    const arr = Array.from(sessionsMap.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving sessions:', e);
  }
}

const sessions = loadSessions();

function generateToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessions.set(token, { userId, expiresAt });
  saveSessions(sessions);
  return token;
}

// Initial default seed users with monthly subscription lifecycle
function getInitialUsers() {
  const adminCreds = hashPassword('admin123');
  const userCreds = hashPassword('user123');
  const user2Creds = hashPassword('user123');

  const now = Date.now();
  const DAY_MS = 24 * 3600 * 1000;

  return [
    {
      id: 'usr_admin_01',
      name: 'Gonzalo Rosendo (Admin)',
      email: 'admin@centrodemando.ia',
      role: 'admin',
      company: 'Centro de Mando Corporativo',
      department: 'Dirección General & IT',
      status: 'activo',
      phone: '+34 910 882 100',
      passwordHash: adminCreds.hash,
      salt: adminCreds.salt,
      createdAt: new Date(now - 30 * DAY_MS).toISOString(),
      lastLogin: new Date().toISOString(),
      subscription: {
        plan: 'enterprise',
        planName: 'Plan Enterprise Mensual',
        status: 'active',
        billingCycle: 'mensual',
        price: 299,
        currency: 'EUR',
        startDate: new Date(now - 6 * DAY_MS).toISOString(),
        currentPeriodEnd: new Date(now + 24 * DAY_MS).toISOString(), // 24 days left
        autoRenew: true,
        paymentMethod: {
          brand: 'visa',
          last4: '4242',
          expMonth: '12',
          expYear: '2028',
          holderName: 'Gonzalo Rosendo'
        },
        invoices: [
          {
            id: 'FAC-2026-0089',
            date: new Date(now - 6 * DAY_MS).toISOString(),
            plan: 'Plan Enterprise Mensual',
            billingCycle: 'mensual',
            subtotal: 299.00,
            vatRate: 21,
            vatAmount: 62.79,
            total: 361.79,
            currency: 'EUR',
            status: 'pagada',
            paymentMethod: 'Visa •••• 4242'
          }
        ]
      }
    },
    {
      id: 'usr_demo_02',
      name: 'Laura Morales',
      email: 'demo@empresa.com',
      role: 'user',
      company: 'Distribuciones Ibéricas S.L.',
      department: 'Ventas & Operaciones',
      status: 'activo',
      phone: '+34 934 112 334',
      passwordHash: userCreds.hash,
      salt: userCreds.salt,
      createdAt: new Date(now - 14 * DAY_MS).toISOString(),
      lastLogin: new Date(now - 2 * 3600 * 1000).toISOString(),
      subscription: {
        plan: 'pro',
        planName: 'Plan Business / Pro Mensual',
        status: 'active',
        billingCycle: 'mensual',
        price: 129,
        currency: 'EUR',
        startDate: new Date(now - 12 * DAY_MS).toISOString(),
        currentPeriodEnd: new Date(now + 18 * DAY_MS).toISOString(), // 18 days left
        autoRenew: true,
        paymentMethod: {
          brand: 'mastercard',
          last4: '8831',
          expMonth: '08',
          expYear: '2027',
          holderName: 'Laura Morales'
        },
        invoices: [
          {
            id: 'FAC-2026-0042',
            date: new Date(now - 12 * DAY_MS).toISOString(),
            plan: 'Plan Business / Pro Mensual',
            billingCycle: 'mensual',
            subtotal: 129.00,
            vatRate: 21,
            vatAmount: 27.09,
            total: 156.09,
            currency: 'EUR',
            status: 'pagada',
            paymentMethod: 'Mastercard •••• 8831'
          }
        ]
      }
    },
    {
      id: 'usr_demo_03',
      name: 'Carlos Vega',
      email: 'carlos@empresa.com',
      role: 'user',
      company: 'Distribuciones Ibéricas S.L.',
      department: 'Finanzas & Sostenibilidad',
      status: 'activo',
      phone: '+34 963 445 667',
      passwordHash: user2Creds.hash,
      salt: user2Creds.salt,
      createdAt: new Date(now - 7 * DAY_MS).toISOString(),
      lastLogin: new Date(now - 24 * 3600 * 1000).toISOString(),
      subscription: {
        plan: 'starter',
        planName: 'Plan Starter Mensual (Periodo de Prueba)',
        status: 'trial',
        billingCycle: 'mensual',
        price: 49,
        currency: 'EUR',
        startDate: new Date(now - 13 * DAY_MS).toISOString(),
        currentPeriodEnd: new Date(now + 1 * DAY_MS).toISOString(), // 1 day left
        autoRenew: false,
        paymentMethod: {
          brand: 'visa',
          last4: '1192',
          expMonth: '11',
          expYear: '2026',
          holderName: 'Carlos Vega'
        },
        invoices: [
          {
            id: 'FAC-2026-0015',
            date: new Date(now - 13 * DAY_MS).toISOString(),
            plan: 'Prueba Inicial 14 Días',
            billingCycle: 'mensual',
            subtotal: 0.00,
            vatRate: 21,
            vatAmount: 0.00,
            total: 0.00,
            currency: 'EUR',
            status: 'pagada',
            paymentMethod: 'Activación de Prueba'
          }
        ]
      }
    }
  ];
}

function ensureUserSubscription(user) {
  if (!user.subscription) {
    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;
    const isAdm = user.role === 'admin';
    user.subscription = {
      plan: isAdm ? 'enterprise' : 'pro',
      planName: isAdm ? 'Plan Enterprise Mensual' : 'Plan Business / Pro Mensual',
      status: 'active',
      billingCycle: 'mensual',
      price: isAdm ? 299 : 129,
      currency: 'EUR',
      startDate: new Date(now - 5 * DAY_MS).toISOString(),
      currentPeriodEnd: new Date(now + 25 * DAY_MS).toISOString(),
      autoRenew: true,
      paymentMethod: {
        brand: 'visa',
        last4: '4242',
        expMonth: '12',
        expYear: '2028',
        holderName: user.name || 'Titular Corporativo'
      },
      invoices: [
        {
          id: 'FAC-2026-00' + Math.floor(10 + Math.random() * 89),
          date: new Date(now - 5 * DAY_MS).toISOString(),
          plan: isAdm ? 'Plan Enterprise Mensual' : 'Plan Business / Pro Mensual',
          billingCycle: 'mensual',
          subtotal: isAdm ? 299.00 : 129.00,
          vatRate: 21,
          vatAmount: +( (isAdm ? 299 : 129) * 0.21 ).toFixed(2),
          total: +( (isAdm ? 299 : 129) * 1.21 ).toFixed(2),
          currency: 'EUR',
          status: 'pagada',
          paymentMethod: 'Tarjeta Corporativa Visa'
        }
      ]
    };
  }
  return user.subscription;
}

function computeSubscriptionDetails(user) {
  const sub = ensureUserSubscription(user);
  const now = Date.now();
  const periodEnd = new Date(sub.currentPeriodEnd).getTime();
  const periodStart = new Date(sub.startDate || (now - 30 * 24 * 3600 * 1000)).getTime();

  const totalCycleMs = Math.max(1, periodEnd - periodStart);
  const elapsedMs = Math.max(0, now - periodStart);
  const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsedMs / totalCycleMs) * 100)));

  // Remaining days calculated with floor/ceil
  const msRemaining = periodEnd - now;
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining <= 0 || sub.status === 'expired' || sub.status === 'canceled';

  // Has active access: Admins always have access, users have access if daysRemaining > 0 and status != 'expired'
  const hasAccess = user.role === 'admin' || (!isExpired && (sub.status === 'active' || sub.status === 'trial'));

  return {
    plan: sub.plan,
    planName: sub.planName,
    status: isExpired ? 'expired' : sub.status,
    billingCycle: 'mensual',
    price: sub.price,
    currency: sub.currency || 'EUR',
    startDate: sub.startDate,
    currentPeriodEnd: sub.currentPeriodEnd,
    daysRemaining: Math.max(0, daysRemaining),
    daysRemainingRaw: daysRemaining,
    percentElapsed,
    isExpired,
    hasAccess,
    autoRenew: sub.autoRenew,
    paymentMethod: sub.paymentMethod || { brand: 'visa', last4: '4242' },
    formattedEndDate: new Date(sub.currentPeriodEnd).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    formattedStartDate: new Date(sub.startDate).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  };
}

let cachedUsers = null;
let cachedLogs = null;

function loadUsersLocal() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      let updated = false;
      parsed.forEach(u => {
        if (!u.subscription) {
          ensureUserSubscription(u);
          updated = true;
        }
      });
      if (updated) saveUsersLocal(parsed);
      return parsed;
    }
  } catch (e) {
    console.error('Error loading users local:', e);
  }
  const defaults = getInitialUsers();
  saveUsersLocal(defaults);
  return defaults;
}

function saveUsersLocal(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving users local:', e);
  }
}

function loadUsers() {
  if (cachedUsers) return cachedUsers;
  cachedUsers = loadUsersLocal();
  if (db) {
    db.collection('users').get().then(snapshot => {
      if (!snapshot.empty) {
        const firestoreUsers = [];
        snapshot.forEach(doc => firestoreUsers.push(doc.data()));
        if (firestoreUsers.length > 0) {
          cachedUsers = firestoreUsers;
          saveUsersLocal(cachedUsers);
        }
      } else {
        const batch = db.batch();
        cachedUsers.forEach(u => {
          batch.set(db.collection('users').doc(u.id), u);
        });
        batch.commit().catch(err => console.error('Error seeding users to Firestore:', err));
      }
    }).catch(err => console.error('Error loading users from Firestore:', err));
  }
  return cachedUsers;
}

function saveUsers(users) {
  cachedUsers = users;
  saveUsersLocal(users);
  if (db) {
    const batch = db.batch();
    users.forEach(u => {
      batch.set(db.collection('users').doc(u.id), u, { merge: true });
    });
    batch.commit().catch(err => console.error('Error saving users batch to Firestore:', err));
  }
}

function loadLogsLocal() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading logs local:', e);
  }
  const initialLogs = [
    { id: 'log_01', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), user: 'admin@centrodemando.ia', action: 'INICIO_SESION', detail: 'Acceso correcto al panel de administración' },
    { id: 'log_02', timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), user: 'demo@empresa.com', action: 'CARGA_EXCEL', detail: 'Actualización de KPIs de ventas y operaciones desde Excel' },
    { id: 'log_03', timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), user: 'admin@centrodemando.ia', action: 'ACTIVAR_MODULO', detail: 'Módulo de Sostenibilidad (ESG) activado para la organización' }
  ];
  saveLogsLocal(initialLogs);
  return initialLogs;
}

function saveLogsLocal(logs) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving logs local:', e);
  }
}

function loadLogs() {
  if (cachedLogs) return cachedLogs;
  cachedLogs = loadLogsLocal();
  if (db) {
    db.collection('auditLogs').orderBy('timestamp', 'desc').limit(100).get().then(snapshot => {
      if (!snapshot.empty) {
        const firestoreLogs = [];
        snapshot.forEach(doc => firestoreLogs.push(doc.data()));
        if (firestoreLogs.length > 0) {
          cachedLogs = firestoreLogs;
          saveLogsLocal(cachedLogs);
        }
      } else {
        const batch = db.batch();
        cachedLogs.forEach(l => {
          batch.set(db.collection('auditLogs').doc(l.id), l);
        });
        batch.commit().catch(err => console.error('Error seeding logs to Firestore:', err));
      }
    }).catch(err => console.error('Error loading logs from Firestore:', err));
  }
  return cachedLogs;
}

function saveLogs(logs) {
  cachedLogs = logs.slice(0, 100);
  saveLogsLocal(cachedLogs);
  if (db) {
    const batch = db.batch();
    cachedLogs.forEach(l => {
      batch.set(db.collection('auditLogs').doc(l.id), l, { merge: true });
    });
    batch.commit().catch(err => console.error('Error saving logs to Firestore:', err));
  }
}

function addAuditLog(userEmail, action, detail) {
  const logs = loadLogs();
  logs.unshift({
    id: 'log_' + Date.now(),
    timestamp: new Date().toISOString(),
    user: userEmail || 'sistema@centrodemando.ia',
    action,
    detail
  });
  saveLogs(logs);
}

let cachedTickets = null;

function loadTicketsLocal() {
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading tickets local:', e);
  }
  const initialTickets = [
    {
      id: 'TCK-1092',
      userId: 'usr_demo_02',
      userEmail: 'laura@empresa.com',
      userName: 'Laura Morales',
      subject: 'Consulta sobre exportación de datos de sostenibilidad',
      message: 'Necesitamos verificar si la plantilla de sostenibilidad puede incluir emisiones de alcance 3.',
      status: 'Resuelto',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
    }
  ];
  saveTicketsLocal(initialTickets);
  return initialTickets;
}

function saveTicketsLocal(tickets) {
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving tickets local:', e);
  }
}

function loadTickets() {
  if (cachedTickets) return cachedTickets;
  cachedTickets = loadTicketsLocal();
  if (db) {
    db.collection('tickets').orderBy('createdAt', 'desc').get().then(snapshot => {
      if (!snapshot.empty) {
        const firestoreTickets = [];
        snapshot.forEach(doc => firestoreTickets.push(doc.data()));
        if (firestoreTickets.length > 0) {
          cachedTickets = firestoreTickets;
          saveTicketsLocal(cachedTickets);
        }
      } else {
        const batch = db.batch();
        cachedTickets.forEach(t => {
          batch.set(db.collection('tickets').doc(t.id), t);
        });
        batch.commit().catch(err => console.error('Error seeding tickets to Firestore:', err));
      }
    }).catch(err => console.error('Error loading tickets from Firestore:', err));
  }
  return cachedTickets;
}

function saveTickets(tickets) {
  cachedTickets = tickets;
  saveTicketsLocal(tickets);
  if (db) {
    const batch = db.batch();
    tickets.forEach(t => {
      batch.set(db.collection('tickets').doc(t.id), t, { merge: true });
    });
    batch.commit().catch(err => console.error('Error saving tickets to Firestore:', err));
  }
}

function generate30DaysSalesHistory() {
  const data = [];
  const now = new Date('2026-08-07T12:00:00Z');
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const dayOfWeek = d.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Upward organic trend
    const progress = (30 - i) / 30;
    const baseTarget = 86000 + Math.round(progress * 12000);
    
    const dayMultiplier = isWeekend ? 0.82 : (dayOfWeek === 3 || dayOfWeek === 4 ? 1.15 : 1.04);
    const wave = Math.sin(i * 0.42) * 8500;
    const noise = (Math.sin(i * 11.3) * 4200) + (Math.cos(i * 5.7) * 3100);

    const sales = Math.round(baseTarget * dayMultiplier + wave + noise);
    const target = baseTarget;
    const orders = Math.round(sales / (148 + (Math.sin(i * 0.7) * 16)));
    const margin = +(33.4 + Math.sin(i * 0.5) * 2.6 + (progress * 1.4)).toFixed(1);
    const serviceLevel = +(97.8 + Math.cos(i * 0.3) * 1.4).toFixed(1);

    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayLabel = `${day} ${monthNames[d.getUTCMonth()]}`;
    const weekday = dayNames[dayOfWeek];

    data.push({
      date: dateStr,
      dayLabel: dayLabel,
      weekday: weekday,
      dayIndex: 30 - i,
      sales: Math.max(55000, sales),
      target: target,
      orders: orders,
      margin: Math.min(42, Math.max(28, margin)),
      serviceLevel: Math.min(100, Math.max(94, serviceLevel))
    });
  }
  return data;
}

function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      if (!parsed.salesLast30Days || parsed.salesLast30Days.length < 30) {
        parsed.salesLast30Days = generate30DaysSalesHistory();
        saveMetrics(parsed);
      }
      return parsed;
    }
  } catch (e) {
    console.error('Error loading metrics:', e);
  }
  const defaultMetrics = {
    updatedAt: new Date().toISOString(),
    kpis: {
      ventasTotales: 2847654,
      ventasDelta: 15.3,
      beneficioNeto: 312456,
      beneficioDelta: 14.2,
      pedidosTotales: 18245,
      pedidosDelta: 12.5,
      ticketMedio: 156.08,
      ticketDelta: 2.5,
      satisfaccionNps: 94.6,
      satisfaccionDelta: 3.1,
      nivelServicio: 98.4,
      nivelServicioDelta: 1.2,
      retrasosLogistica: 1.8,
      retrasosDelta: -0.4,
      huellaCarbono: 24.8,
      huellaCarbonoDelta: -8.5,
      rotacionTalento: 3.2,
      rotacionDelta: -1.1
    },
    modules: {
      ventas: { name: 'Ventas & Facturación', active: true, desc: 'Cifras de facturación, pedidos y márgenes en tiempo real.' },
      clientes: { name: 'Clientes & Retención', active: true, desc: 'Satisfacción NPS, fidelización y churn.' },
      operaciones: { name: 'Operaciones & Logística', active: true, desc: 'Nivel de servicio y retrasos por delegación.' },
      cadena_suministro: { name: 'Cadena de Suministro', active: true, desc: 'Control de rotura de stock y rotación de almacén.' },
      sostenibilidad_esg: { name: 'Sostenibilidad (ESG)', active: true, desc: 'Consumo energético y reducción de emisiones CO2.' },
      talento_rrhh: { name: 'Talento & RRHH', active: true, desc: 'Rotación, productividad y clima laboral.' },
      power_bi: { name: 'Conector Power BI', active: true, desc: 'Informes embebidos y datasets sincronizados.' },
      excel_live: { name: 'Sincronizador Excel', active: true, desc: 'Carga masiva directa de hojas de cálculo.' }
    },
    regionalDelays: [
      { region: 'Norte', delay: 1.8, serviceLevel: 98.6 },
      { region: 'Centro', delay: 2.3, serviceLevel: 97.8 },
      { region: 'Este', delay: 1.1, serviceLevel: 99.2 },
      { region: 'Sur', delay: 2.9, serviceLevel: 96.9 }
    ],
    salesHistory: [
      { month: 'Ene', sales: 210000, target: 195000 },
      { month: 'Feb', sales: 228000, target: 205000 },
      { month: 'Mar', sales: 245000, target: 220000 },
      { month: 'Abr', sales: 239000, target: 230000 },
      { month: 'May', sales: 265000, target: 240000 },
      { month: 'Jun', sales: 284000, target: 250000 }
    ],
    salesLast30Days: generate30DaysSalesHistory()
  };
  saveMetrics(defaultMetrics);
  return defaultMetrics;
}

function saveMetrics(metrics) {
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving metrics:', e);
  }
}

// ===================================================================
// AUTHENTICATION MIDDLEWARES
// ===================================================================
function getAuthUser(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    saveSessions(sessions);
    return null;
  }

  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user || user.status === 'suspendido') return null;

  return { user, token };
}

function requireAuth(req, res, next) {
  const auth = getAuthUser(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
  }
  req.user = auth.user;
  req.token = auth.token;
  next();
}

function requireAdmin(req, res, next) {
  const auth = getAuthUser(req);
  if (!auth) {
    return res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
  }
  if (auth.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de Administrador.' });
  }
  req.user = auth.user;
  req.token = auth.token;
  next();
}

// ===================================================================
// AUTH ENDPOINTS (Registro, Login, Me, Logout, Perfil)
// ===================================================================

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, company, department, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const users = loadUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
    }

    // Role assignment: default 'user', allowed 'admin' if requested during registration
    const userRole = (role === 'admin') ? 'admin' : 'user';
    const { hash, salt } = hashPassword(password);

    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;
    const chosenPlan = (req.body.plan && ['starter', 'pro', 'enterprise', 'trial'].includes(req.body.plan))
      ? req.body.plan
      : (userRole === 'admin' ? 'enterprise' : 'pro');

    const planPrices = { starter: 49, pro: 129, enterprise: 299, trial: 0 };
    const planNames = {
      starter: 'Plan Starter Mensual',
      pro: 'Plan Business / Pro Mensual',
      enterprise: 'Plan Enterprise Mensual',
      trial: 'Prueba Inicial 14 Días'
    };

    const subPrice = planPrices[chosenPlan] ?? 129;
    const subDays = chosenPlan === 'trial' ? 14 : 30;

    const initialInvoiceId = 'FAC-2026-0' + Math.floor(100 + Math.random() * 899);
    const subtotal = subPrice;
    const vatRate = 21;
    const vatAmount = +(subtotal * 0.21).toFixed(2);
    const total = +(subtotal + vatAmount).toFixed(2);

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      email: cleanEmail,
      role: userRole,
      company: (company || 'Empresa Independiente').trim(),
      department: (department || (userRole === 'admin' ? 'Dirección General' : 'Operaciones & Ventas')).trim(),
      status: 'activo',
      phone: '',
      passwordHash: hash,
      salt: salt,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      subscription: {
        plan: chosenPlan,
        planName: planNames[chosenPlan],
        status: chosenPlan === 'trial' ? 'trial' : 'active',
        billingCycle: 'mensual',
        price: subPrice,
        currency: 'EUR',
        startDate: new Date().toISOString(),
        currentPeriodEnd: new Date(now + subDays * DAY_MS).toISOString(),
        autoRenew: true,
        paymentMethod: {
          brand: 'visa',
          last4: '4242',
          expMonth: '12',
          expYear: '2028',
          holderName: name.trim()
        },
        invoices: [
          {
            id: initialInvoiceId,
            date: new Date().toISOString(),
            plan: planNames[chosenPlan],
            billingCycle: 'mensual',
            subtotal,
            vatRate,
            vatAmount,
            total,
            currency: 'EUR',
            status: 'pagada',
            paymentMethod: chosenPlan === 'trial' ? 'Periodo de Prueba' : 'Tarjeta Visa •••• 4242'
          }
        ]
      }
    };

    users.push(newUser);
    saveUsers(users);

    const token = generateToken(newUser.id);
    addAuditLog(cleanEmail, 'REGISTRO_USUARIO', `Nuevo usuario registrado con rol [${userRole.toUpperCase()}] y ${planNames[chosenPlan]} (+${subDays} días de acceso)`);

    const safeUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      company: newUser.company,
      department: newUser.department,
      status: newUser.status,
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin,
      subscription: computeSubscriptionDetails(newUser)
    };

    return res.status(201).json({
      success: true,
      message: 'Cuenta creada con éxito con 30 días de suscripción mensual activa.',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    return res.status(500).json({ error: 'Error interno al procesar el registro.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Introduce tu correo y contraseña.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: 'Credenciales incorrectas. Comprueba el email o contraseña.' });
    }

    if (user.status === 'suspendido') {
      return res.status(403).json({ error: 'Esta cuenta ha sido suspendida. Contacta con el Administrador.' });
    }

    user.lastLogin = new Date().toISOString();
    saveUsers(users);

    const token = generateToken(user.id);
    addAuditLog(user.email, 'INICIO_SESION', `Acceso exitoso con rol [${user.role.toUpperCase()}]`);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      department: user.department,
      status: user.status,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Error in /api/auth/login:', error);
    return res.status(500).json({ error: 'Error interno en el inicio de sesión.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  const u = req.user;
  const subDetails = computeSubscriptionDetails(u);
  res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      company: u.company,
      department: u.department,
      status: u.status,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      subscription: subDetails,
      invoices: (u.subscription && u.subscription.invoices) || []
    }
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  if (req.token) {
    sessions.delete(req.token);
    saveSessions(sessions);
  }
  addAuditLog(req.user.email, 'CIERRE_SESION', 'Sesión cerrada por el usuario');
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// PUT /api/auth/profile
app.put('/api/auth/profile', requireAuth, (req, res) => {
  try {
    const { name, company, department, currentPassword, newPassword } = req.body;
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = users[userIndex];

    if (name) user.name = name.trim();
    if (company) user.company = company.trim();
    if (department) user.department = department.trim();

    if (newPassword) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
        return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      }
      const creds = hashPassword(newPassword);
      user.passwordHash = creds.hash;
      user.salt = creds.salt;
      addAuditLog(user.email, 'CAMBIO_PASSWORD', 'Contraseña actualizada por el usuario');
    }

    users[userIndex] = user;
    saveUsers(users);

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        department: user.department,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error in /api/auth/profile:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

// ===================================================================
// ADMIN MANAGEMENT ENDPOINTS (Usuarios, Roles, Logs)
// ===================================================================

// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = loadUsers();
  const safeUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    company: u.company,
    department: u.department,
    status: u.status,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin
  }));
  res.json({ users: safeUsers });
});

// POST /api/admin/users (Create user by admin)
app.post('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const { name, email, password, role, company, department, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = loadUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'Ya existe un usuario con este correo electrónico.' });
    }

    const userRole = role === 'admin' ? 'admin' : 'user';
    const userStatus = status === 'suspendido' ? 'suspendido' : 'activo';
    const { hash, salt } = hashPassword(password);

    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      email: cleanEmail,
      role: userRole,
      company: (company || req.user.company || 'Empresa').trim(),
      department: (department || 'General').trim(),
      status: userStatus,
      phone: '',
      passwordHash: hash,
      salt: salt,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    users.push(newUser);
    saveUsers(users);

    addAuditLog(req.user.email, 'CREAR_USUARIO', `Admin creó a ${cleanEmail} con rol [${userRole.toUpperCase()}]`);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente por el administrador',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        company: newUser.company,
        department: newUser.department,
        status: newUser.status,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error in POST /api/admin/users:', error);
    res.status(500).json({ error: 'Error al crear usuario.' });
  }
});

// PUT /api/admin/users/:id (Update role, status, department)
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    const { role, status, department, company, name } = req.body;

    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const targetUser = users[userIndex];

    // Prevent removing the last active admin
    if (targetUser.role === 'admin' && role === 'user') {
      const adminCount = users.filter(u => u.role === 'admin' && u.status === 'activo').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'No puedes cambiar el rol del único Administrador activo del sistema.' });
      }
    }

    const oldRole = targetUser.role;
    const oldStatus = targetUser.status;

    if (role && (role === 'admin' || role === 'user')) targetUser.role = role;
    if (status && (status === 'activo' || status === 'suspendido')) targetUser.status = status;
    if (department) targetUser.department = department.trim();
    if (company) targetUser.company = company.trim();
    if (name) targetUser.name = name.trim();

    users[userIndex] = targetUser;
    saveUsers(users);

    addAuditLog(req.user.email, 'MODIFICAR_USUARIO', `Usuario ${targetUser.email} actualizado: Rol ${oldRole}->${targetUser.role}, Estado ${oldStatus}->${targetUser.status}`);

    res.json({
      success: true,
      message: 'Usuario actualizado correctamente',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        company: targetUser.company,
        department: targetUser.department,
        status: targetUser.status
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/:id:', error);
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    const users = loadUsers();
    const targetUser = users.find(u => u.id === userId);

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de Administrador mientras tienes la sesión activa.' });
    }

    const remainingUsers = users.filter(u => u.id !== userId);
    saveUsers(remainingUsers);

    addAuditLog(req.user.email, 'ELIMINAR_USUARIO', `Usuario ${targetUser.email} [${targetUser.role}] eliminado por el Administrador`);

    res.json({ success: true, message: `Usuario ${targetUser.name} eliminado correctamente` });
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/:id:', error);
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
});

// GET /api/admin/logs
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const logs = loadLogs();
  res.json({ logs });
});

// GET /api/tickets (Get tickets for authenticated user, or all if admin)
app.get('/api/tickets', requireAuth, (req, res) => {
  try {
    const tickets = loadTickets();
    if (req.user.role === 'admin') {
      return res.json({ success: true, tickets });
    }
    const userTickets = tickets.filter(t => t.userId === req.user.id);
    res.json({ success: true, tickets: userTickets });
  } catch (error) {
    console.error('Error in GET /api/tickets:', error);
    res.status(500).json({ error: 'Error al obtener los tickets de soporte.' });
  }
});

// POST /api/tickets (Create a new support ticket associated with user UID)
app.post('/api/tickets', requireAuth, (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'El asunto y el mensaje son obligatorios.' });
    }

    const tickets = loadTickets();
    const newTicketId = 'TCK-' + Math.floor(1000 + Math.random() * 9000);
    const newTicket = {
      id: newTicketId,
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name,
      subject: subject.trim(),
      message: message.trim(),
      status: 'Abierto / En curso',
      createdAt: new Date().toISOString()
    };

    tickets.unshift(newTicket);
    saveTickets(tickets);

    addAuditLog(req.user.email, 'CREAR_TICKET', `Ticket ${newTicketId} creado: "${newTicket.subject}"`);

    res.status(201).json({
      success: true,
      message: 'Ticket creado exitosamente y guardado en Firestore asociado a tu cuenta.',
      ticket: newTicket
    });
  } catch (error) {
    console.error('Error in POST /api/tickets:', error);
    res.status(500).json({ error: 'Error al crear el ticket de soporte.' });
  }
});

// ===================================================================
// USER DASHBOARD & ADMIN DATABASE ENDPOINTS (Usuarios y sus Dashboards)
// ===================================================================

// GET /api/dashboard/me
app.get('/api/dashboard/me', requireAuth, (req, res) => {
  const user = req.user;
  if (!user.dashboardConfig) {
    user.dashboardConfig = {
      modules: ['resumen', 'clientes', 'operaciones', 'suministro', 'proyectos', 'talento', 'sostenibilidad', 'ventas-geo', 'noticias', 'powerbi', 'asistente-ia'],
      kpis: ['ventasTotales', 'beneficioNeto', 'ticketMedio', 'clientesActivos'],
      theme: 'default',
      notes: ''
    };
  }
  res.json({ success: true, dashboardConfig: user.dashboardConfig });
});

// PUT /api/dashboard/me
app.put('/api/dashboard/me', requireAuth, (req, res) => {
  try {
    const { modules, kpis, theme, notes } = req.body;
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) return res.status(404).json({ error: 'Usuario no encontrado.' });

    users[userIndex].dashboardConfig = {
      modules: modules || users[userIndex].dashboardConfig?.modules || [],
      kpis: kpis || users[userIndex].dashboardConfig?.kpis || [],
      theme: theme || 'default',
      notes: notes || '',
      updatedAt: new Date().toISOString()
    };

    saveUsers(users);
    res.json({ success: true, message: 'Dashboard guardado correctamente en la base de datos', dashboardConfig: users[userIndex].dashboardConfig });
  } catch (error) {
    console.error('Error in PUT /api/dashboard/me:', error);
    res.status(500).json({ error: 'Error al guardar el dashboard.' });
  }
});

// GET /api/admin/dashboards (Admin only: database of all users and their dashboards)
app.get('/api/admin/dashboards', requireAdmin, (req, res) => {
  const users = loadUsers();
  const records = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    company: u.company,
    department: u.department,
    status: u.status,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
    dashboardConfig: u.dashboardConfig || {
      modules: ['resumen', 'clientes', 'operaciones', 'suministro', 'proyectos', 'talento', 'sostenibilidad', 'ventas-geo', 'noticias', 'powerbi', 'asistente-ia'],
      kpis: ['ventasTotales', 'beneficioNeto', 'ticketMedio', 'clientesActivos'],
      theme: 'default',
      notes: ''
    },
    subscription: {
      plan: u.subscription?.plan,
      planName: u.subscription?.planName,
      status: u.subscription?.status
    }
  }));
  res.json({ success: true, totalUsers: records.length, records });
});

// PUT /api/admin/users/:id/dashboard (Admin only: update any user's dashboard configuration)
app.put('/api/admin/users/:id/dashboard', requireAdmin, (req, res) => {
  try {
    const targetId = req.params.id;
    const { modules, kpis, theme, notes } = req.body;
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === targetId);
    if (userIndex === -1) return res.status(404).json({ error: 'Usuario no encontrado.' });

    users[userIndex].dashboardConfig = {
      modules: modules || users[userIndex].dashboardConfig?.modules || [],
      kpis: kpis || users[userIndex].dashboardConfig?.kpis || [],
      theme: theme || 'default',
      notes: notes || '',
      updatedByAdmin: req.user.email,
      updatedAt: new Date().toISOString()
    };

    saveUsers(users);
    addAuditLog(req.user.email, 'ADMIN_ACTUALIZAR_DASHBOARD', `Admin actualizó el dashboard del usuario ${users[userIndex].email}`);

    res.json({ success: true, message: `Dashboard de ${users[userIndex].name} actualizado por el administrador.`, dashboardConfig: users[userIndex].dashboardConfig });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/:id/dashboard:', error);
    res.status(500).json({ error: 'Error al actualizar el dashboard del usuario.' });
  }
});

// ===================================================================
// SUBSCRIPTION & BILLING ENDPOINTS (Cobro Mensual, Renovación, Facturas)
// ===================================================================

// GET /api/subscription/me
app.get('/api/subscription/me', requireAuth, (req, res) => {
  const user = req.user;
  const subDetails = computeSubscriptionDetails(user);
  res.json({
    subscription: subDetails,
    invoices: (user.subscription && user.subscription.invoices) || []
  });
});

// POST /api/subscription/checkout (Procesar cobro mensual o cambio de plan)
app.post('/api/subscription/checkout', requireAuth, (req, res) => {
  try {
    const { plan, cardNumber, cardHolder, expMonth, expYear, cvv, autoRenew = true } = req.body;
    const validPlans = ['starter', 'pro', 'enterprise'];

    const chosenPlan = validPlans.includes(plan) ? plan : 'pro';
    const planPrices = { starter: 49, pro: 129, enterprise: 299 };
    const planNames = {
      starter: 'Plan Starter Mensual',
      pro: 'Plan Business / Pro Mensual',
      enterprise: 'Plan Enterprise Mensual'
    };

    const price = planPrices[chosenPlan];
    const name = planNames[chosenPlan];

    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = users[userIndex];
    ensureUserSubscription(user);

    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;
    const currentEnd = new Date(user.subscription.currentPeriodEnd).getTime();

    // Extend 30 days: if current period is in the future, add 30 days to it; otherwise start from now + 30 days
    const baseTime = (currentEnd > now && user.subscription.status === 'active') ? currentEnd : now;
    const newPeriodEnd = new Date(baseTime + 30 * DAY_MS).toISOString();

    const last4 = (cardNumber && cardNumber.replace(/\s+/g, '').slice(-4)) || (user.subscription.paymentMethod && user.subscription.paymentMethod.last4) || '4242';
    const brand = (cardNumber && cardNumber.startsWith('5')) ? 'mastercard' : 'visa';

    user.subscription.plan = chosenPlan;
    user.subscription.planName = name;
    user.subscription.status = 'active';
    user.subscription.price = price;
    user.subscription.billingCycle = 'mensual';
    user.subscription.startDate = new Date().toISOString();
    user.subscription.currentPeriodEnd = newPeriodEnd;
    user.subscription.autoRenew = Boolean(autoRenew);
    user.subscription.paymentMethod = {
      brand,
      last4,
      expMonth: expMonth || '12',
      expYear: expYear || '2028',
      holderName: (cardHolder && cardHolder.trim()) || user.name
    };

    // Generate official invoice
    const invoiceId = 'FAC-2026-0' + Math.floor(100 + Math.random() * 899);
    const subtotal = price;
    const vatRate = 21;
    const vatAmount = +(subtotal * 0.21).toFixed(2);
    const total = +(subtotal + vatAmount).toFixed(2);

    const newInvoice = {
      id: invoiceId,
      date: new Date().toISOString(),
      plan: name,
      billingCycle: 'mensual',
      subtotal,
      vatRate,
      vatAmount,
      total,
      currency: 'EUR',
      status: 'pagada',
      paymentMethod: `${brand.toUpperCase()} •••• ${last4}`
    };

    if (!Array.isArray(user.subscription.invoices)) {
      user.subscription.invoices = [];
    }
    user.subscription.invoices.unshift(newInvoice);

    users[userIndex] = user;
    saveUsers(users);

    addAuditLog(
      user.email,
      'SUSCRIPCION_COBRO_MENSUAL',
      `Cobro mensual procesado: ${total} € por ${name}. Acceso extendido 30 días hasta ${new Date(newPeriodEnd).toLocaleDateString('es-ES')}`
    );

    const updatedSub = computeSubscriptionDetails(user);

    res.json({
      success: true,
      message: `¡Pago de ${total} € completado con éxito! Tu acceso al panel ha sido ampliado 30 días.`,
      subscription: updatedSub,
      invoice: newInvoice,
      invoices: user.subscription.invoices
    });
  } catch (error) {
    console.error('Error in /api/subscription/checkout:', error);
    res.status(500).json({ error: 'Error al procesar el cobro mensual.' });
  }
});

// POST /api/subscription/renew (Renovación rápida con tarjeta guardada)
app.post('/api/subscription/renew', requireAuth, (req, res) => {
  try {
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = users[userIndex];
    ensureUserSubscription(user);

    const now = Date.now();
    const DAY_MS = 24 * 3600 * 1000;
    const currentEnd = new Date(user.subscription.currentPeriodEnd).getTime();
    const baseTime = (currentEnd > now && user.subscription.status === 'active') ? currentEnd : now;
    const newPeriodEnd = new Date(baseTime + 30 * DAY_MS).toISOString();

    const price = user.subscription.price || 129;
    const name = user.subscription.planName || 'Plan Business / Pro Mensual';
    const last4 = (user.subscription.paymentMethod && user.subscription.paymentMethod.last4) || '4242';
    const brand = (user.subscription.paymentMethod && user.subscription.paymentMethod.brand) || 'visa';

    user.subscription.status = 'active';
    user.subscription.currentPeriodEnd = newPeriodEnd;

    const invoiceId = 'FAC-2026-0' + Math.floor(100 + Math.random() * 899);
    const subtotal = price;
    const vatRate = 21;
    const vatAmount = +(subtotal * 0.21).toFixed(2);
    const total = +(subtotal + vatAmount).toFixed(2);

    const newInvoice = {
      id: invoiceId,
      date: new Date().toISOString(),
      plan: name,
      billingCycle: 'mensual',
      subtotal,
      vatRate,
      vatAmount,
      total,
      currency: 'EUR',
      status: 'pagada',
      paymentMethod: `${brand.toUpperCase()} •••• ${last4}`
    };

    if (!Array.isArray(user.subscription.invoices)) {
      user.subscription.invoices = [];
    }
    user.subscription.invoices.unshift(newInvoice);

    users[userIndex] = user;
    saveUsers(users);

    addAuditLog(
      user.email,
      'RENOVACION_SUSCRIPCION',
      `Renovación mensual automática: ${total} € por ${name}. Vence el ${new Date(newPeriodEnd).toLocaleDateString('es-ES')}`
    );

    res.json({
      success: true,
      message: `Suscripción renovada con éxito por 30 días (+1 mes).`,
      subscription: computeSubscriptionDetails(user),
      invoice: newInvoice,
      invoices: user.subscription.invoices
    });
  } catch (error) {
    console.error('Error in /api/subscription/renew:', error);
    res.status(500).json({ error: 'Error al renovar la suscripción.' });
  }
});

// POST /api/subscription/simulate-expiration (Probar bloqueo y paywall)
app.post('/api/subscription/simulate-expiration', requireAuth, (req, res) => {
  try {
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = users[userIndex];
    ensureUserSubscription(user);

    // Set expiration to yesterday
    user.subscription.currentPeriodEnd = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    user.subscription.status = 'expired';

    users[userIndex] = user;
    saveUsers(users);

    addAuditLog(user.email, 'SIMULACION_EXPIRACION', 'El usuario simuló la expiración de su suscripción mensual para probar el flujo de renovación.');

    res.json({
      success: true,
      message: 'Suscripción marcada como expirada para prueba. El panel mostrará el aviso de pago.',
      subscription: computeSubscriptionDetails(user)
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al simular expiración.' });
  }
});

// POST /api/subscription/toggle-autorenew
app.post('/api/subscription/toggle-autorenew', requireAuth, (req, res) => {
  try {
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = users[userIndex];
    ensureUserSubscription(user);
    user.subscription.autoRenew = !user.subscription.autoRenew;

    users[userIndex] = user;
    saveUsers(users);

    addAuditLog(
      user.email,
      'AUTO_RENOVACION',
      `Renovación automática ${user.subscription.autoRenew ? 'activada' : 'desactivada'}`
    );

    res.json({
      success: true,
      autoRenew: user.subscription.autoRenew,
      subscription: computeSubscriptionDetails(user)
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al cambiar renovación.' });
  }
});

// GET /api/subscription/invoice/:id
app.get('/api/subscription/invoice/:id', requireAuth, (req, res) => {
  const invoiceId = req.params.id;
  const user = req.user;
  ensureUserSubscription(user);

  let targetInvoice = (user.subscription.invoices || []).find(inv => inv.id === invoiceId);

  // If user is admin, search all users
  if (!targetInvoice && user.role === 'admin') {
    const allUsers = loadUsers();
    for (const u of allUsers) {
      if (u.subscription && u.subscription.invoices) {
        const found = u.subscription.invoices.find(inv => inv.id === invoiceId);
        if (found) {
          targetInvoice = { ...found, customerName: u.name, customerEmail: u.email, customerCompany: u.company };
          break;
        }
      }
    }
  }

  if (!targetInvoice) {
    return res.status(404).json({ error: 'Factura no encontrada.' });
  }

  res.json({
    invoice: {
      ...targetInvoice,
      customerName: targetInvoice.customerName || user.name,
      customerEmail: targetInvoice.customerEmail || user.email,
      customerCompany: targetInvoice.customerCompany || user.company || 'Empresa Cliente',
      issuer: {
        company: 'Centro de Mando IA · Data & Formation S.L.',
        cif: 'ES-B88349210',
        address: 'Paseo de la Castellana 216, 28046 Madrid, España',
        email: 'facturacion@centrodemando.ia',
        vatNumber: 'ESB88349210'
      }
    }
  });
});

// PUT /api/admin/users/:id/subscription (Admin puede extender o modificar suscripción de cualquier usuario)
app.put('/api/admin/users/:id/subscription', requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    const { plan, status, addDays } = req.body;

    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const targetUser = users[userIndex];
    ensureUserSubscription(targetUser);

    if (plan) {
      targetUser.subscription.plan = plan;
      const names = {
        starter: 'Plan Starter Mensual',
        pro: 'Plan Business / Pro Mensual',
        enterprise: 'Plan Enterprise Mensual',
        trial: 'Prueba Inicial 14 Días'
      };
      targetUser.subscription.planName = names[plan] || 'Plan Personalizado';
    }

    if (status) {
      targetUser.subscription.status = status;
    }

    if (addDays && Number(addDays)) {
      const now = Date.now();
      const DAY_MS = 24 * 3600 * 1000;
      const currentEnd = new Date(targetUser.subscription.currentPeriodEnd).getTime();
      const baseTime = currentEnd > now ? currentEnd : now;
      targetUser.subscription.currentPeriodEnd = new Date(baseTime + Number(addDays) * DAY_MS).toISOString();
      targetUser.subscription.status = 'active';
    }

    users[userIndex] = targetUser;
    saveUsers(users);

    addAuditLog(
      req.user.email,
      'ADMIN_MODIFICAR_SUSCRIPCION',
      `Admin modificó suscripción de ${targetUser.email} (Plan: ${targetUser.subscription.plan}, Estado: ${targetUser.subscription.status})`
    );

    res.json({
      success: true,
      message: 'Suscripción de usuario actualizada correctamente',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        subscription: computeSubscriptionDetails(targetUser)
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/:id/subscription:', error);
    res.status(500).json({ error: 'Error al actualizar suscripción de usuario.' });
  }
});

// ===================================================================
// CONTROL PANEL / DASHBOARD ENDPOINTS (Live KPIs, Excel, Modules)
// ===================================================================

// GET /api/dashboard/data
app.get('/api/dashboard/data', requireAuth, (req, res) => {
  const metrics = loadMetrics();
  const users = loadUsers();
  const logs = loadLogs();
  const subDetails = computeSubscriptionDetails(req.user);

  const userStats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'activo').length,
    adminUsers: users.filter(u => u.role === 'admin').length,
    standardUsers: users.filter(u => u.role === 'user').length
  };

  // If user is standard user and subscription is expired, notify frontend
  const isBlocked = req.user.role !== 'admin' && subDetails.isExpired;

  res.json({
    accessRestricted: isBlocked,
    subscription: subDetails,
    invoices: (req.user.subscription && req.user.subscription.invoices) || [],
    metrics: isBlocked ? null : metrics,
    userStats: isBlocked ? null : userStats,
    recentActivity: isBlocked ? [] : logs.slice(0, 6),
    currentUser: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      company: req.user.company,
      department: req.user.department
    }
  });
});

// GET /api/dashboard/sales-30days (Dedicated D3.js data feed)
app.get('/api/dashboard/sales-30days', requireAuth, (req, res) => {
  const metrics = loadMetrics();
  const daysParam = parseInt(req.query.days, 10) || 30;
  const rawList = metrics.salesLast30Days || generate30DaysSalesHistory();
  const sliced = rawList.slice(-daysParam);

  const totalSales = sliced.reduce((acc, d) => acc + d.sales, 0);
  const totalTarget = sliced.reduce((acc, d) => acc + d.target, 0);
  const totalOrders = sliced.reduce((acc, d) => acc + d.orders, 0);
  const avgSales = Math.round(totalSales / sliced.length);
  const peak = sliced.reduce((max, d) => d.sales > max.sales ? d : max, sliced[0]);
  const minDay = sliced.reduce((min, d) => d.sales < min.sales ? d : min, sliced[0]);
  const daysAboveTarget = sliced.filter(d => d.sales >= d.target).length;

  res.json({
    daysCount: sliced.length,
    data: sliced,
    summary: {
      totalSales,
      totalTarget,
      totalOrders,
      avgSales,
      daysAboveTarget,
      targetHitRate: +(daysAboveTarget / sliced.length * 100).toFixed(1),
      peakDay: peak,
      minDay: minDay
    }
  });
});

// POST /api/dashboard/simulate-sales-day (Interactive D3 refresh button)
app.post('/api/dashboard/simulate-sales-day', requireAuth, (req, res) => {
  try {
    const metrics = loadMetrics();
    const history = metrics.salesLast30Days || generate30DaysSalesHistory();
    
    // Add jitter / new realistic day
    const lastDay = history[history.length - 1];
    const newSales = Math.round(lastDay.sales * (1 + (Math.random() * 0.12 - 0.04)));
    const newOrders = Math.round(newSales / 152);
    const newMargin = +(34.0 + (Math.random() * 3.5)).toFixed(1);

    // Update last day with live tick
    history[history.length - 1].sales = newSales;
    history[history.length - 1].orders = newOrders;
    history[history.length - 1].margin = newMargin;
    metrics.salesLast30Days = history;
    metrics.kpis.ventasTotales = history.reduce((sum, item) => sum + item.sales, 0);
    saveMetrics(metrics);

    res.json({
      success: true,
      message: 'Métricas de la última jornada recalculadas en tiempo real.',
      data: history
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al recalcular datos D3' });
  }
});

// POST /api/dashboard/upload-excel (Simulated & live parsed Excel data processor)
app.post('/api/dashboard/upload-excel', requireAuth, (req, res) => {
  try {
    const { fileName, multiplier = 1, department = 'Todas' } = req.body;
    const metrics = loadMetrics();

    // Dynamically calculate new realistic metrics based on the upload
    const growthFactor = 1 + (Math.random() * 0.08 - 0.02); // -2% to +6%
    const currentSales = metrics.kpis.ventasTotales;
    const newSales = Math.round(currentSales * growthFactor);
    const newProfit = Math.round(newSales * 0.115);
    const newOrders = Math.round(metrics.kpis.pedidosTotales * (1 + (Math.random() * 0.06 - 0.01)));

    metrics.kpis.ventasTotales = newSales;
    metrics.kpis.ventasDelta = +(growthFactor * 10 - 10 + metrics.kpis.ventasDelta * 0.5).toFixed(1);
    metrics.kpis.beneficioNeto = newProfit;
    metrics.kpis.pedidosTotales = newOrders;
    metrics.kpis.satisfaccionNps = +(Math.min(99.5, metrics.kpis.satisfaccionNps + (Math.random() * 0.8 - 0.3))).toFixed(1);
    metrics.kpis.nivelServicio = +(Math.min(99.9, metrics.kpis.nivelServicio + (Math.random() * 0.6 - 0.2))).toFixed(1);
    metrics.kpis.retrasosLogistica = +(Math.max(0.5, metrics.kpis.retrasosLogistica + (Math.random() * 0.4 - 0.3))).toFixed(1);
    metrics.kpis.huellaCarbono = +(Math.max(10, metrics.kpis.huellaCarbono - (Math.random() * 0.5))).toFixed(1);
    metrics.updatedAt = new Date().toISOString();

    saveMetrics(metrics);

    addAuditLog(
      req.user.email,
      'IMPORTAR_EXCEL',
      `Hoja [${fileName || 'datos-empresa.xlsx'}] procesada para delegación ${department}. Nuevas ventas: ${newSales.toLocaleString()} €`
    );

    res.json({
      success: true,
      message: `Archivo "${fileName || 'datos.xlsx'}" procesado con éxito. Métricas sincronizadas al 100%.`,
      updatedMetrics: metrics
    });
  } catch (error) {
    console.error('Error in /api/dashboard/upload-excel:', error);
    res.status(500).json({ error: 'Error al procesar el archivo Excel.' });
  }
});

// POST /api/dashboard/toggle-module
app.post('/api/dashboard/toggle-module', requireAuth, (req, res) => {
  try {
    const { moduleKey, active } = req.body;
    const metrics = loadMetrics();

    if (!metrics.modules[moduleKey]) {
      return res.status(404).json({ error: 'Módulo no encontrado.' });
    }

    metrics.modules[moduleKey].active = Boolean(active);
    metrics.updatedAt = new Date().toISOString();
    saveMetrics(metrics);

    addAuditLog(
      req.user.email,
      active ? 'ACTIVAR_MODULO' : 'DESACTIVAR_MODULO',
      `Módulo [${metrics.modules[moduleKey].name}] ${active ? 'activado' : 'desactivado'}`
    );

    res.json({
      success: true,
      moduleKey,
      active: metrics.modules[moduleKey].active,
      message: `Módulo ${metrics.modules[moduleKey].name} ${active ? 'activado' : 'desactivado'} correctamente.`
    });
  } catch (error) {
    console.error('Error in /api/dashboard/toggle-module:', error);
    res.status(500).json({ error: 'Error al actualizar el módulo.' });
  }
});

// POST /api/dashboard/ai-analysis (Generates role-tailored Executive / Operational Analysis)
app.post('/api/dashboard/ai-analysis', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    const metrics = loadMetrics();
    const user = req.user;

    const contextSummary = `
Datos en tiempo real de la empresa (${user.company}, departamento: ${user.department}, rol de usuario: ${user.role}):
- Ventas Totales: ${metrics.kpis.ventasTotales.toLocaleString()} € (${metrics.kpis.ventasDelta > 0 ? '+' : ''}${metrics.kpis.ventasDelta}%)
- Beneficio Neto: ${metrics.kpis.beneficioNeto.toLocaleString()} € (+${metrics.kpis.beneficioDelta}%)
- Pedidos: ${metrics.kpis.pedidosTotales.toLocaleString()}
- Ticket Medio: ${metrics.kpis.ticketMedio} €
- Satisfacción Clientes NPS: ${metrics.kpis.satisfaccionNps}%
- Nivel de Servicio: ${metrics.kpis.nivelServicio}%
- Retrasos Logísticos: ${metrics.kpis.retrasosLogistica}%
- Huella de Carbono (ESG): ${metrics.kpis.huellaCarbono} tCO2 (${metrics.kpis.huellaCarbonoDelta}%)
- Rotación de Talento: ${metrics.kpis.rotacionTalento}%
- Módulos Activos: ${Object.entries(metrics.modules).filter(([k,v]) => v.active).map(([k,v]) => v.name).join(', ')}
`;

    const ai = getGenAIClient();

    if (ai) {
      try {
        const userPrompt = prompt
          ? `Pregunta específica del ${user.role === 'admin' ? 'Administrador' : 'Responsable de Área'}: "${prompt}".\n\nContexto empresarial:\n${contextSummary}`
          : `Genera un Resumen Ejecutivo inteligente y recomendaciones de acción prioritarias para el perfil [${user.role.toUpperCase()}] de la empresa.\n\nContexto empresarial:\n${contextSummary}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: `Eres el Asistente Ejecutivo de Inteligencia de Negocio del Centro de Mando IA. Analiza las métricas y entrega 3 puntos clave: 1. Estado de salud del negocio, 2. Alertas o focos de atención, 3. Recomendaciones prácticas inmediatas para ${user.name} (${user.role === 'admin' ? 'Alta Dirección / Admin' : 'Área Operativa / Usuario'}). Usa viñetas claras y lenguaje directo sin rodeos.`,
            temperature: 0.7,
            maxOutputTokens: 600
          }
        });

        const replyText = response?.text?.trim();
        if (replyText) {
          return res.json({ analysis: replyText, source: 'gemini-3.6-flash' });
        }
      } catch (err) {
        console.warn('Gemini analysis failed, using executive rule engine:', err.message);
      }
    }

    // High quality rule-based intelligent analysis fallback
    let fallbackAnalysis = '';
    if (user.role === 'admin') {
      fallbackAnalysis = `**Resumen Ejecutivo de Dirección (Centro de Mando IA)**

• **Salud Global**: Facturación consolidada en **${metrics.kpis.ventasTotales.toLocaleString()} €** con crecimiento intermensual del **+${metrics.kpis.ventasDelta}%**. El margen neto se sitúa en un sólido **11%**.
• **Operaciones y Calidad**: El nivel de servicio global alcanza el **${metrics.kpis.nivelServicio}%**, con satisfacción de clientes en un excelente **${metrics.kpis.satisfaccionNps}%**.
• **Foco Estratégico**: La delegación Sur presenta un **${metrics.regionalDelays.find(r => r.region === 'Sur')?.delay}%** de retrasos logísticos. Se aconseja redistribuir stock hacia el hub central.
• **Sostenibilidad ESG**: Reducción de huella de carbono de **${metrics.kpis.huellaCarbonoDelta}%** frente al periodo anterior, cumpliendo con los objetivos de reporte no financiero.`;
    } else {
      fallbackAnalysis = `**Informe Operativo de Área (${user.department})**

• **Rendimiento de Ventas & Pedidos**: Se han registrado **${metrics.kpis.pedidosTotales.toLocaleString()} pedidos** con un ticket medio de **${metrics.kpis.ticketMedio} €**.
• **Nivel de Servicio**: **${metrics.kpis.nivelServicio}%** de entregas a tiempo. La delegación Este lidera con un **99.2%**.
• **Acción Prioritaria**: Monitorear las rutas de la zona Sur durante los picos de pedidos para evitar cuellos de botella en entrega.
• **Integración**: Tus módulos de Excel y Power BI se encuentran sincronizados y listos para consulta.`;
    }

    return res.json({ analysis: fallbackAnalysis, source: 'rule-engine' });
  } catch (error) {
    console.error('Error in /api/dashboard/ai-analysis:', error);
    res.status(500).json({ error: 'Error al generar el análisis.' });
  }
});

// ===================================================================
// PUBLIC CHAT ASSISTANT & CONTACT
// ===================================================================
const SYSTEM_INSTRUCTION = `Eres el Asistente Inteligente de "Centro de Mando IA" (creado por Gonzalo Rosendo · Data & Formation).
Tu objetivo es resolver con precisión, profesionalidad, cercanía y claridad todas las dudas de clientes potenciales y usuarios sobre los servicios, características, integraciones, precios, seguridad, registro y funcionamiento del Centro de Mando IA.

Información clave sobre el producto:
- **Concepto**: Un único panel de control empresarial en tiempo real que reúne ventas, clientes, operaciones, cadena de suministro, talento y sostenibilidad, acompañado de un asistente de IA proactivo.
- **Acceso & Registro**: Registro rápido para administradores y usuarios con roles diferenciados, panel de control en vivo y cuentas demo instantáneas.
- **Integraciones**:
  * Excel: Permite subir hojas de cálculo con plantilla para actualizar métricas al instante sin esperas técnicas.
  * Power BI: Inserta informes ya publicados para combinarlos en un solo lugar con el resto de datos.
  * ERPs y CRMs (Plan Enterprise): Conexión directa con SAP, Navision, Holded, Salesforce, HubSpot y bases de datos SQL mediante API.
- **Módulos**: Ventas y facturación, Clientes y retención, Operaciones y nivel de servicio, Cadena de suministro y stock, Sostenibilidad (ESG y huella de carbono), Talento y rotación.
- **Planes y Precios**:
  * Starter (49 €/mes): Hasta 4 módulos activos, importación Excel, 1 usuario, actualización diaria, soporte por email.
  * Pro (129 €/mes - Más popular): Los 10 módulos, conexión Excel y Power BI, hasta 5 usuarios, alertas del Asistente IA, soporte prioritario.
  * Enterprise (299 €/mes): Multiempresa con delegaciones, conectores ERP/CRM/API a medida, usuarios ilimitados, actualización en tiempo real, SLA garantizado y soporte dedicado.
- **Seguridad**: Servidores seguros en la Unión Europea (UE), cifrado SSL/TLS de extremo a extremo, cumplimiento estricto del RGPD (GDPR).`;

let aiClient = null;
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function generateFallbackResponse(userMessage, history = []) {
  const msg = (userMessage || '').toLowerCase();

  if (msg.includes('registro') || msg.includes('crear cuenta') || msg.includes('rol') || msg.includes('admin') || msg.includes('usuario') || msg.includes('panel')) {
    return `Puedes registrarte directamente en nuestra plataforma para probar el **Centro de Mando**:

• **Roles disponibles**:
  - **Administrador**: Control total de usuarios, roles, módulos y analítica ejecutiva.
  - **Usuario / Operativo**: Gestión de KPIs de departamento, subida de Excel y consulta de Power BI.
• **Acceso Inmediato**: Dispones de registro libre en [Registrarse](registro.html) o acceso inmediato con 1 clic en [Iniciar Sesión](login.html) usando las cuentas de prueba (Admin y Usuario).`;
  }

  if (msg.includes('precio') || msg.includes('plan') || msg.includes('cuanto cuesta') || msg.includes('tarifa')) {
    return `Disponemos de tres planes adaptados al tamaño de cada empresa:

• **Starter (49 €/mes)**: Hasta 4 módulos activos, importación desde Excel y 1 usuario.
• **Pro (129 €/mes)**: 10 módulos, conexión con Excel y Power BI, hasta 5 usuarios y alertas proactivas de IA.
• **Enterprise (299 €/mes)**: Multiempresa, conectores API/ERP (SAP, Salesforce, etc.), usuarios ilimitados y tiempo real.

Puedes consultar todos los detalles en nuestra sección de [Precios](precios.html).`;
  }

  if (msg.includes('excel') || msg.includes('power bi') || msg.includes('conectar') || msg.includes('integrar')) {
    return `La integración en el **Centro de Mando IA** es rápida y sin fricción:

1. **Hojas de cálculo Excel**: Subes tu plantilla estructurada y el panel se recalcula al instante.
2. **Informes de Power BI**: Pega el enlace de tu informe publicado para incrustarlo en el centro de mando.
3. **ERPs y Bases de Datos**: Conexión vía API REST o conectores nativos en Plan Enterprise.`;
  }

  if (msg.includes('seguridad') || msg.includes('privacidad') || msg.includes('rgpd')) {
    return `La seguridad de tus datos empresariales es nuestra máxima prioridad:

• **Cifrado Total**: SSL/TLS de extremo a extremo y contraseñas salteadas criptográficamente.
• **Alojamiento en la UE**: Cumplimiento riguroso del RGPD / GDPR.
• **Control de Roles**: Permisos granulares de acceso por usuario y departamento.`;
  }

  return `¡Hola! Soy el asistente virtual de **Centro de Mando IA**. 

Puedo ayudarte con:
• **Registro y Panel**: Cómo crear tu cuenta, roles de administrador y panel en vivo.
• **Integración**: Conexión con Excel, Power BI y ERPs.
• **Precios y Módulos**: Planes Starter (49 €), Pro (129 €) y Enterprise (299 €).
• **Seguridad**: Cifrado, RGPD y servidores en la Unión Europea.

¿Qué te gustaría consultar o probar?`;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const ai = getGenAIClient();

    if (ai) {
      try {
        const contents = [];
        for (const item of history.slice(-8)) {
          if (item.role === 'user' || item.role === 'model' || item.role === 'assistant') {
            contents.push({
              role: item.role === 'assistant' ? 'model' : item.role,
              parts: [{ text: item.content || item.text || '' }]
            });
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        });

        const replyText = response?.text?.trim() || generateFallbackResponse(message, history);
        return res.json({ reply: replyText, model: 'gemini-3.6-flash' });
      } catch (geminiError) {
        console.warn('Gemini API call failed, using fallback:', geminiError.message);
        const fallbackReply = generateFallbackResponse(message, history);
        return res.json({ reply: fallbackReply, model: 'knowledge-engine' });
      }
    } else {
      const fallbackReply = generateFallbackResponse(message, history);
      return res.json({ reply: fallbackReply, model: 'knowledge-engine' });
    }
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: 'Error al procesar la consulta',
      reply: 'Ha ocurrido un problema al procesar tu consulta. Por favor, inténtalo de nuevo o contáctanos en hola@centrodemando.ia.'
    });
  }
});

// POST /api/contacto
app.post('/api/contacto', (req, res) => {
  try {
    const { nombre, email, empresa, empleados, mensaje, plan } = req.body;
    addAuditLog(email || 'anonimo@empresa.com', 'SOLICITUD_DEMO', `Demo solicitada por ${nombre || 'Contacto'} (${empresa || 'Empresa'}, ${empleados || '1-10'} empleados)`);
    res.json({ success: true, message: 'Solicitud recibida correctamente. Nos pondremos en contacto en menos de 24h.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar contacto.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    registeredUsersCount: loadUsers().length
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
