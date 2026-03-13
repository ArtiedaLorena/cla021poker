```markdown
---

## ✨ ¿Qué es CLA021POKER?

CLA021POKER es una aplicación de **Planning Poker** para equipos ágiles. Permite estimar historias de usuario en tiempo real usando la secuencia de Fibonacci, con una experiencia visual inmersiva y sin necesidad de registrarse.

> "Estimá más rápido, debatí menos, entregá más."

---

## 🎯 Features principales

| Feature | Descripción |
|---------|-------------|
| ⚡ **Tiempo real** | Sincronización instantánea entre todos los participantes via Supabase Realtime |
| 🃏 **Mesa visual** | Mesa de poker SVG animada con los avatares de cada jugador |
| 👑 **Rol de Facilitador** | Control total de la sesión: iniciar rondas, revelar votos, transferir rol |
| 🔐 **Sesión persistente** | Tu sesión se guarda aunque recargues o cierres el tab |
| ⏱️ **Timer sincronizado** | Contador regresivo visible para todos los participantes |
| 📊 **Estadísticas** | Promedio, consenso y distribución de votos post-revelación |
| 📋 **Historial** | Registro completo de todas las rondas estimadas |
| 🎭 **15 avatares únicos** | Íconos MUI con colores personalizados para cada jugador |
| 🔔 **Notificaciones** | Toast notifications para todas las acciones importantes |
| 🚪 **Gestión de sala** | El facilitador puede remover participantes y transferir su rol |

---

## 🖼️ Screenshots

### Lobby
![Lobby](docs\screenshots\lobby.png)

### Mesa de juego
![Room](docs\screenshots\room.png)

### Votos revelados
![Revealed](docs\screenshots\revealed.png)

---


## 🛠️ Stack tecnológico

```
Frontend
├── React 18          — UI
├── Vite 5            — Bundler
├── MUI Icons         — Avatares
└── CSS Variables     — Design system

Backend / Infra
├── Supabase          — Base de datos PostgreSQL
├── Supabase Realtime — WebSockets para sync en tiempo real
└── Supabase Auth     — (sin auth, userKey por tab)

Deploy
└── Netlify           
```

---

## 🗄️ Estructura del proyecto

```
cla021poker/
├── public/
│   ├── favicon.ico
│   └── favicon-512x512.png
├── src/
│   ├── components/
│   │   ├── Lobby.jsx          — Pantalla de ingreso
│   │   ├── Room.jsx           — Sala de juego principal
│   │   └── PokerTable.jsx     — Mesa SVG animada
│   ├── hooks/
│   │   └── useRoom.js         — Lógica de sala + Realtime
│   ├── lib/
│   │   ├── supabase.js        — Cliente Supabase
│   │   └── roomService.js     — Servicios de BD
│   ├── App.jsx                — Root + gestión de sesión
│   ├── main.jsx
│   └── index.css              — Design system completo
├── .env.example
├── .gitignore
└── README.md
```

---

## 🗃️ Esquema de base de datos

```sql
-- Tabla rooms
CREATE TABLE rooms (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code             text UNIQUE NOT NULL,
  facilitator_id   text,
  current_story    text DEFAULT '',
  revealed         boolean DEFAULT false,
  timer_running    boolean DEFAULT false,
  timer_started_at timestamptz,
  timer_duration   integer DEFAULT 60,
  updated_at       timestamptz DEFAULT now()
);

-- Tabla participants
CREATE TABLE participants (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id   uuid REFERENCES rooms ON DELETE CASCADE,
  user_key  text NOT NULL,
  name      text NOT NULL,
  avatar    text DEFAULT 'rocket',
  is_online boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_key)
);

-- Tabla votes
CREATE TABLE votes (
  id       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id  uuid REFERENCES rooms ON DELETE CASCADE,
  user_key text NOT NULL,
  value    text NOT NULL,
  UNIQUE(room_id, user_key)
);

-- Tabla rounds
CREATE TABLE rounds (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id               uuid REFERENCES rooms ON DELETE CASCADE,
  story                 text,
  average               text,
  votes_snapshot        jsonb,
  participants_snapshot jsonb,
  created_at            timestamptz DEFAULT now()
);

-- Habilitar Realtime en todas las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
```

---

## 🚀 Instalación local

### 1. Clonar el repo

```bash
git clone https://github.com/TU_USUARIO/cla021poker.git
cd cla021poker
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Editá `.env.local` con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Abrí http://localhost:5173 🎉

---

## 🌐 Deploy en Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

O importá directamente desde vercel.com:

1. **Import Git Repository** → seleccioná tu repo
2. **Environment Variables** → agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
3. Click en **Deploy** 🚀

---

## 🎮 Cómo usar

### Como Facilitador

```
1. Crear sala         → Ingresá tu nombre y hacé click en "Crear sala"
2. Compartir código   → Compartí el código de sala con tu equipo
3. Escribir historia  → Ingresá el nombre de la historia a estimar
4. Iniciar ronda      → Click en "Iniciar Ronda"
5. Esperar votos      → Todos los participantes eligen su carta
6. Revelar            → Click en "Revelar Votos" para ver resultados
7. Nueva ronda        → Click en "Nueva Ronda" para continuar
```

### Como Participante

```
1. Unirse a sala      → Ingresá tu nombre y el código de sala
2. Esperar historia   → El facilitador inicia la ronda
3. Votar              → Elegí una carta y confirmá tu voto
4. Ver resultados     → Cuando el facilitador revela, ves todos los votos
```

---

## 🔑 Conceptos clave

### Sesión por tab
Cada tab del navegador es un usuario diferente. Esto permite simular múltiples usuarios desde una misma computadora para testear.

### Facilitador
El primero en crear la sala. Puede:
- ✅ Iniciar y controlar rondas
- ✅ Revelar votos
- ✅ Manejar el timer
- ✅ Remover participantes
- ✅ Transferir su rol a otro participante

### Persistencia
La sesión se guarda en `localStorage`. Si recargás la página o cerrás el tab accidentalmente, al volver sos reconectado automáticamente a tu sala.

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para cambios grandes, abrí un issue primero para discutir qué querés cambiar.

```bash
# Fork del repo
# Crear branch
git checkout -b feature/mi-feature

# Commit
git commit -m "feat: agregar mi feature"

# Push
git push origin feature/mi-feature

# Abrir Pull Request
```

---

## ☕ Apoyar el proyecto

Si esta herramienta te es útil, podés invitarme un café:

[![Cafecito](https://img.shields.io/badge/Cafecito-Invitame%20un%20café-purple?style=for-the-badge)](https://cafecito.app/artiedalorena)


---

## 📄 Licencia

MIT © [CLA021](https://github.com/artiedalorena)

---

<div align="center">
  Hecho con ❤️ por <b>Lorena Artieda</b>
  <br/>
  <sub>Si te gustó, dejá una ⭐ en el repo</sub>
</div>
```
