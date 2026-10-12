# syntax=docker/dockerfile:1
# Firebase Auth + Firestore emulators (and the Emulator UI) for local development.
# Build from the repository root:  docker build -f infra/firebase/Dockerfile .

FROM eclipse-temurin:21-jre AS jre

FROM node:22-bookworm-slim
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH
COPY --from=jre /opt/java/openjdk /opt/java/openjdk

ARG FIREBASE_TOOLS_VERSION=15.33.0
# Optional extra CA for TLS-inspecting proxies: --secret id=npm_ca,src=ca.pem
# Emulator binaries are downloaded at build time so the container starts offline.
RUN --mount=type=secret,id=npm_ca \
  if [ -s /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
  npm install --global firebase-tools@${FIREBASE_TOOLS_VERSION} \
  && firebase setup:emulators:firestore \
  && firebase setup:emulators:ui \
  && npm cache clean --force

WORKDIR /firebase
COPY firebase.json .firebaserc firestore.rules firestore.indexes.json ./

# UI, hub, Firestore, Auth, Firestore UI websocket
EXPOSE 4000 4400 8080 9099 9150
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=30 \
  CMD node -e "Promise.all([fetch('http://127.0.0.1:8080'),fetch('http://127.0.0.1:9099')]).then(()=>process.exit(0),()=>process.exit(1))"
CMD ["firebase", "emulators:start", "--only", "auth,firestore", "--project", "demo-budgetwise"]
