# Connector

a chat app we built and works surprisingly well.

live at → [connector-b0ku.onrender.com](https://connector-b0ku.onrender.com)

---

built with Node.js, Express, and WebSockets. no database, no framework, no overthinking. messages live in memory so if the server restarts they're gone. that's fine.

**to run it yourself**

```bash
git clone https://github.com/sizmosloth/Connector.git
cd Connector
npm install
node server.js
```

---

**what it does**

- real-time messaging (websockets)
- user profiles — name, age, location, avatar
- typing indicators, online list, join/leave alerts
- emoji picker, copy button, message history
- dark/light mode, accent colors
- works on mobile too somehow

**what it doesn't do**

- save messages permanently
- have private rooms
- have auth of any kind (anyone can be anyone)

---

**stack**

```
Node.js + Express    server
ws                   websockets
HTML/CSS/JS          frontend, no frameworks
Render               hosting
UptimeRobot          keeps it from sleeping
```

---

hosted free on Render. UptimeRobot pings it every 5 min so it stays awake.

*his code doesn't work — but this one does*
