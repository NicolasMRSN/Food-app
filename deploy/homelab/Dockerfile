# Front Food-app : build Vite puis service statique nginx (+ proxy des API Supabase).
# Construit depuis la racine du dépôt (voir make-compose.py).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Clé publique (anon) de l'instance Supabase. L'URL est la même origine que le front.
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/homelab/nginx.conf /etc/nginx/conf.d/default.conf
