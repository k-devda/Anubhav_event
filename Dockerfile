# Anubhav volunteer system - no npm dependencies, only Node's built-in modules (needs Node >= 22.13)
FROM node:24-slim

WORKDIR /app

# Production defaults. Platforms terminate HTTPS in front of the container, so cookies are Secure
# and the client IP comes from X-Forwarded-For. Override COOKIE_SECURE=0 only for plain-http local tests.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    TRUST_PROXY=1 \
    COOKIE_SECURE=1 \
    DB_FILE=/data/anubhav.sqlite

COPY package.json ./
COPY server ./server
COPY public ./public

# The SQLite database lives here. Attach a PERSISTENT VOLUME at /data or data is lost on redeploy.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--no-warnings", "server/index.js"]
