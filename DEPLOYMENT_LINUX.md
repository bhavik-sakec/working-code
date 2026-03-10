# Linux Deployment Guide: Magellan Response

This guide outlines the steps to deploy the **Magellan Response** (Frontend) and **File Parser Engine** (Backend) on a Linux server (Ubuntu/Debian recommended).

## 📋 Prerequisites

Ensure the following are installed on your Linux server:
- **Java 21** (JDK or JRE)
- **Node.js 18+** & **npm**
- **Nginx** (for reverse proxy)
- **PM2** (Node.js process manager - optional but recommended)

---

## 🚀 1. Backend Deployment (Spring Boot)

The backend is a Spring Boot application managed by Gradle.

### Build and Package
On your local machine or build server:
```bash
cd backend
./gradlew clean build -x test
```
The executable JAR will be located at: `backend/build/libs/file-parser-engine-0.0.1-SNAPSHOT.jar`.

### Production Configuration
The backend uses `application.properties`. For production, you can create an external configuration file `application-prod.properties` on the server:

```properties
# server.port=8080 (Default)
server.address=127.0.0.1

# High-Performance Settings for Large Files
spring.servlet.multipart.max-file-size=2GB
spring.servlet.multipart.max-request-size=2GB
server.tomcat.connection-timeout=1800s
spring.mvc.async.request-timeout=1800000
```

### Running as a Systemd Service
Create `/etc/systemd/system/magellan-backend.service`:
```ini
[Unit]
Description=Magellan Backend Engine
After=syslog.target

[Service]
User=your-user
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/java -jar file-parser-engine-0.0.1-SNAPSHOT.jar --spring.config.location=file:/path/to/application-prod.properties
SuccessExitStatus=143
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
Run: 
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now magellan-backend
```

---

## 💻 2. Frontend Deployment (Next.js)

The frontend is a Next.js application.

### Build Configuration
Before building, update the `.env` file (or create `.env.production`) to point to your server's **Public API URL**:

```env
# CRITICAL: This must be the public IP or Domain where the Backend is accessible
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Build and Start
```bash
cd frontend
npm install
npm run build
```

### Process Management with PM2
```bash
pm2 start npm --name "magellan-frontend" -- start
pm2 save
```

---

## 🛡️ 3. Nginx Reverse Proxy Configuration

To expose both services on standard ports (80/443), use Nginx as a reverse proxy.

```nginx
server {
    listen 80;
    server_name yourdomain.com; # Replace with your Domain or IP

    # Frontend (Next.js on port 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API (Spring Boot on port 8080)
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # INCREASE TIMEOUTS FOR LARGE FILES (1800s = 30 minutes)
        proxy_read_timeout 1800s;
        proxy_connect_timeout 1800s;
        proxy_send_timeout 1800s;
        
        # INCREASE MAX UPLOAD SIZE (Match Backend Multipart Limit)
        client_max_body_size 2G;
    }
}
```

## ⚠️ Summary of Necessary Changes

1.  **Frontend (`/frontend/.env`)**: Change `NEXT_PUBLIC_API_URL` from `http://localhost:8080` to your **Public IP/Domain**.
2.  **Backend (`/backend/src/main/resources/application.properties`)**: Ensure `multipart.max-file-size` is large enough (default is set to 2GB in this project).
3.  **CORS**: The current backend is configured with `@CrossOrigin(origins = "*")`. For strict security, you may want to limit this to your frontend domain in `UnifiedParserController.java`.
4.  **Java Version**: Ensure **Java 21** is installed on the server.
5.  **Node Version**: Ensure **Node.js 18 or 20** is installed on the server.
