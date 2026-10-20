#!/usr/bin/env python3
"""Génère compose.yaml depuis le docker-compose.yml officiel de Supabase self-hosted.

- retire les services inutiles à Food-app (storage, imgproxy, supavisor) ;
- ajoute le service food-web (front + reverse-proxy des API).

À lancer depuis le dossier de déploiement (ex. /srv/docker/food-app).
"""
import yaml

src = yaml.safe_load(open("docker-compose.yml"))
src["name"] = "food-app"
for s in ("storage", "imgproxy", "supavisor"):
    src["services"].pop(s, None)

src["services"]["food-web"] = {
    "container_name": "food-web",
    "build": {
        "context": "./app-src",
        "dockerfile": "deploy/homelab/Dockerfile",
        "args": {"VITE_SUPABASE_ANON_KEY": "${ANON_KEY}"},
    },
    "image": "food-web:local",
    "restart": "unless-stopped",
    "depends_on": {"api-gw": {"condition": "service_healthy"}},
    # Réseau local uniquement : LAN_IP (dans .env) est tenu à jour par homelab-reseau.sh
    "ports": ["${LAN_IP}:8081:80"],
}

with open("compose.yaml", "w") as f:
    f.write("# Généré par app-src/deploy/homelab/make-compose.py — ne pas modifier à la main\n")
    yaml.safe_dump(src, f, sort_keys=False, allow_unicode=True, width=1000)
print("compose.yaml généré :", " ".join(src["services"]))
