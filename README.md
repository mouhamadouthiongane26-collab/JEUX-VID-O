# Assane Kart 3D (Mario Kart style)

Jeu de kart 3D jouable dans le navigateur avec : drift, bonus, IA, tremplins et saut.

## Texture visage joueur

Le visage du personnage principal charge l'image :

- `assets/images/player.png`

> Mets ta photo dans ce fichier pour personnaliser le héros.

## Lancer le jeu

```bash
python3 -m http.server 8080
```
Puis ouvrir : `http://localhost:8080`

## Commandes MacBook

- `↑` : accélérer
- `↓` : freiner / reculer
- `←` : tourner à gauche
- `→` : tourner à droite
- `Espace` : utiliser un bonus
- `Shift` : drift
- `J` : sauter

## Gameplay

- 8 pilotes (joueur + 7 IA)
- 3 tours
- Bonus : boost, turbo, missile, piège
- Tremplins sur la piste
- Gravité et retombée après saut
- Boost après atterrissage réussi depuis un tremplin
- Tutoriel rapide affiché au début de la course

## Structure

```text
.
├── assets/
│   └── images/
│       ├── player.png
│       └── README.md
├── src/
│   ├── js/
│   │   └── game.js
│   └── styles/
│       └── main.css
├── index.html
└── README.md
```
