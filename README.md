# Simulateur d'Analyse Numérique 3D (Django & Three.js)

Application Django pour l'apprentissage et l'expérimentation interactive de l'analyse numérique (dérivation et intégration) appliquée à des problèmes physiques concrets du monde réel en 3D.

## Fonctionnalités

1. **Scénario 1 : Dérivation Numérique 3D - Trajectoire de Drone Autonome**
   - Calcul des vecteurs vitesse et accélération à partir d'échantillons de position GPS/IMU 3D.
   - Comparaison des méthodes : Différences Finies Avant $O(h)$, Différences Finies Centrées $O(h^2)$, Extrapolation de Richardson $O(h^4)$.
   - Visualisation 3D avec Three.js : trajectoire spline 3D, modèle de quadricoptère animé avec hélices tournantes, vecteurs fléchés 3D de vitesse et accélération, repère au sol avec grille, timeline interactive et vitesse de lecture réglable.
   - Courbe dynamique du profil de vitesse $v(t)$.

2. **Scénario 2 : Intégration Numérique 3D - Retenue et Volume de Barrage Hydraulique**
   - Calcul de la bathymétrie, surface de coupe transversale et volume total d'eau retenue en $m^3$.
   - Méthodes d'intégration : Trapèzes, Simpson composite $O(h^4)$, Extrapolation de Romberg, Quadrature de Gauss-Legendre (ordre optimal), Simpson Adaptatif.
   - Rendu 3D : gorge rocheuse / vallée en relief, surface d'eau translucide, voûte du barrage en béton, tranches transversales discrétisées visualisées en volume, mode fil de fer (wireframe).
   - Graphique de bathymétrie et profil d'aire le long de la retenue.

3. **Scénario 3 : Intégration Numérique 3D - Monte-Carlo sur Formes Complexes**
   - Calcul stochastique du volume pour des géométries 3D complexes (dôme géodésique, tore de confinement Tokamak, voûte paraboloïde de barrage, sphère).
   - Nuage de points 3D stochastique : points intérieurs (verts) vs points extérieurs (rouges).
   - Intervalle de confiance statistique à 95% ($\pm 1.96 \times \sigma / \sqrt{N}$) selon la loi des grands nombres et le théorème central limite.

4. **Scénario 4 : Comparatif Rigoureux à Coût Égal ($N_{eval}$)**
   - Banc d'essai équitable comparant toutes les méthodes pour un même nombre total d'appels à la fonction.
   - Visualisation en diagramme à barres 3D interactif dans Three.js.
   - Graphique semi-logarithmique de la convergence de l'erreur absolue en fonction de $N_{eval}$.

5. **Plateforme & Outils Django**
   - Moteur de calcul numérique Python pur et optimisé NumPy (`simulator/numerical_engine.py`).
   - API REST JSON pour le calcul temps réel des simulations.
   - Historique des simulations stocké en base de données Django (`SimulationRecord`).
   - Export des données et résultats au format CSV et JSON.
   - Interface responsive avec bascule Thème Sombre / Thème Clair.

---

## Installation et Démarrage

### Prérequis
- Python 3.10+
- `pip`

### Dépendances
```bash
pip install -r requirements.txt
```

### Initialiser la base de données
```bash
python manage.py migrate
```

### Lancer le serveur Django
```bash
python manage.py runserver 0.0.0.0:8000
```
Ouvrez ensuite votre navigateur sur `http://localhost:8000/`.

---

## Tests Automatisés

Pour exécuter la suite de tests unitaires et d'intégration :
```bash
python manage.py test
```
