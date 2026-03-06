# 💬 NexChat – Real-Time Chat Application

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Backend-green">
  <img src="https://img.shields.io/badge/Socket.io-RealTime-black">
  <img src="https://img.shields.io/badge/MySQL-Database-blue">
  <img src="https://img.shields.io/badge/Express.js-API-lightgrey">
</p>

NexChat คือระบบ **Real-Time Chat Application** ที่พัฒนาด้วย  
**Node.js + Socket.io + MySQL**

ผู้ใช้งานสามารถสร้างห้องแชท ส่งข้อความแบบทันที และดูประวัติข้อความย้อนหลังได้

โปรเจคนี้ถูกสร้างขึ้นเพื่อแสดงความสามารถด้าน

- Full-Stack Development
- REST API
- WebSocket / Real-Time Communication
- Database Design
- Authentication System

---

# 🚀 Features

✨ ฟีเจอร์หลักของระบบ

- 🔐 User Register / Login
- 🔑 JWT Authentication
- 💬 Real-Time Chat Messaging
- 🏠 Create / Join Chat Rooms
- 👥 Online Users
- ⌨️ Typing Indicator
- 📜 Message History
- 🔒 Password Encryption (bcrypt)
- 📡 REST API + WebSocket

---

# 🛠 Tech Stack

## Frontend
- HTML5
- CSS3
- JavaScript

## Backend
- Node.js
- Express.js
- Socket.io

## Database
- MySQL (XAMPP)

## Tools
- Git
- VS Code
- npm
- Postman

---

# 📂 Project Structure

```
realtime-chat/
│
├── backend/
│   ├── server.js
│   ├── db.js
│   └── package.json
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── chat.html
│   │
│   ├── css/
│   └── js/
│
└── README.md
```

---

# ⚙️ Installation Guide

## 1️⃣ Clone Repository

```bash
git clone https://github.com/thaweesakmos56-netizen/Real-Time-Chat-Application.git
```

---

## 2️⃣ เข้าไปในโฟลเดอร์ Backend

```bash
cd nexchat/backend
```

---

## 3️⃣ ติดตั้ง Dependencies

```bash
npm install
```

---

## 4️⃣ Setup Database

เปิด **XAMPP → phpMyAdmin**

สร้าง Database

```
chat_db
```

---

### สร้างตาราง

```sql
CREATE TABLE users (
id INT AUTO_INCREMENT PRIMARY KEY,
username VARCHAR(50) UNIQUE,
password VARCHAR(255),
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rooms (
id INT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(50) UNIQUE,
created_by INT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
id INT AUTO_INCREMENT PRIMARY KEY,
user_id INT,
room VARCHAR(50),
message TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5️⃣ Run Server

```bash
node server.js
```

Server จะทำงานที่

```
http://localhost:3000
```

---


# 🎯 Learning Goals

โปรเจคนี้ช่วยพัฒนาทักษะด้าน

- Full-Stack Web Development
- REST API Development
- Real-Time Web Applications
- Authentication System
- Database Design
- WebSocket Communication

---

# 👨‍💻 Author

Thaweesak Seeangrat Computer Science Student สนใจด้าน Software Development, Web Development และ Automation

GitHub https://github.com/thaweesakmos56-netizen

📄 License
MIT License — โปรเจคนี้สร้างขึ้นเพื่อความฝันวัยเด็กและการศึกษาพัฒนาเท่านั้น
