# Assane Kart 3D

Jeu de kart racing 3D jouable dans le navigateur (style arcade/cartoon), développé avec **Three.js**.

## Fonctionnalités

- 8 pilotes (joueur + 7 IA)
- 3 tours par course
- 3 circuits : ville, désert, jungle
- Bonus sur la piste : boost, turbo, missile, piège
- Drift + mini-boost
- Boost de départ (timing pendant le décompte)
- HUD en course : position, tour, vitesse, chrono, bonus
- Sons procéduraux : moteur, boost, impact

## Structure du projet

```text
.
├── assets/
│   └── images/
│       └── README.md
├── src/
│   ├── js/
│   │   └── game.js
│   └── styles/
│       └── main.css
├── index.html
└── README.md
```

## Image du personnage principal (Assane)

1. Place la photo fournie dans :
   - `assets/images/assane-head.jpg`
2. Le jeu applique automatiquement cette image sur la tête 3D du personnage principal **Assane Thiongane**.

## Lancer le jeu

> Le jeu doit être servi via un petit serveur HTTP local (pas en ouvrant directement le fichier `index.html` en `file://`).

### Option 1 — Python

```bash
python3 -m http.server 8080
```

Puis ouvre :
- `http://localhost:8080`

### Option 2 — Node.js

```bash
npx serve .
```

Puis ouvre l'URL affichée dans le terminal.

## Contrôles

- `↑` accélérer
- `↓` freiner
- `←` / `→` diriger
- `Espace` utiliser le bonus

