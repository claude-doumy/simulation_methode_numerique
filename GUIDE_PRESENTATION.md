# 🎓 Guide de Présentation & Soutenance
## Simulateur Interactif d'Analyse Numérique
**Auteur :** Kouakou Konan Claude Doumy  
**Profil :** Master 2 Mathématiques Appliquées & Ingénierie Logicielle

---

## 1. 📌 Introduction & Pitch du Projet (1 à 2 minutes)

### Accroche
> *"Bonjour à tous. Dans le cadre de mes travaux en analyse numérique et ingénierie logicielle, j'ai développé un simulateur interactif complet pour analyser, comparer et visualiser le comportement des algorithmes fondamentaux d'intégration et de dérivation numérique."*

### Pourquoi ce projet ? (Problématique)
En calcul scientifique, on apprend souvent les formules théoriques (ordres de convergence, résidus de Taylor, quadratures). Cependant :
1. On visualise rarement la réalité de l'**arithmétique flottante IEEE 754** (comme le compromis fondamental entre erreur de discrétisation et erreur d'arrondi machine).
2. On compare souvent les méthodes selon le pas $h$ ou le nombre d'intervalles $N$, alors que dans les applications réelles (physique numérique, finance, IA), le véritable critère est le **coût de calcul réel**, mesuré en nombre d'évaluations de la fonction $f$ ($N_{\text{eval}}$).
3. Ce simulateur a été conçu avec une contrainte technique exigeante : **0 dépendance externe (pur Vanilla JavaScript ES6+)**, moteur de tracé SVG vectoriel artisanal, échelles bi-logarithmiques dynamiques et régression linéaire en temps réel pour mesurer l'ordre de convergence effectif.

---

## 2. 🔬 Les Piliers Scientifiques & Algorithmiques

Le simulateur s'articule autour de 6 modules principaux :

### Module 1 : Dérivation Numérique & La "Courbe en V" (V-Curve)
- **Ce qu'on montre :**
  - **Différences finies avant** : $f'(x) \approx \frac{f(x+h) - f(x)}{h}$ (Ordre 1, $O(h)$).
  - **Différences centrées** : $f'(x) \approx \frac{f(x+h) - f(x-h)}{2h}$ (Ordre 2, $O(h^2)$).
  - **Extrapolation de Richardson** : Combinaison linéaire annulant le terme d'ordre 2 pour atteindre l'ordre 4 ($O(h^4)$) :
    $$D_{\text{Rich}}(h) = \frac{4 D_{\text{centré}}(h/2) - D_{\text{centré}}(h)}{3}$$
- **Le phénomène clé à expliquer :**
  - Lorsque $h$ diminue, l'erreur de troncature mathématique diminue.
  - Mais en dessous d'un pas critique $h^*$, l'erreur d'arrondi numérique (perte de précision due à la soustraction de deux nombres très proches en virgule flottante 64 bits) explose proportionnellement à $\frac{\varepsilon_{\text{machine}}}{h}$.
  - Le tracé log-log fait émerger la célèbre **courbe en V**, montrant visuellement le pas optimal théorique $h^* \approx \sqrt{\varepsilon} \approx 10^{-8}$ pour l'ordre 2, et $h^* \approx \varepsilon^{1/4} \approx 10^{-4}$ pour l'ordre 4.

---

### Module 2 : Intégration de Romberg (Extrapolation Triangulaire)
- **Principe :**
  - On part de la méthode des trapèzes composite. À chaque division par 2 du pas $h$, on élimine par extrapolation polynomiale de Richardson les puissances paires de l'erreur d'Euler-Maclaurin ($h^2, h^4, h^6, \dots$).
  - La récurrence est implémentée manuellement :
    $$R(i, j) = \frac{4^j R(i, j-1) - R(i-1, j-1)}{4^j - 1}$$
- **Point fort pédagogique :**
  - Le simulateur affiche en direct le **tableau triangulaire de Romberg**, illustrant le gain spectaculaire de précision à chaque colonne avec un coût très maîtrisé (réutilisation des points intermédiaires calculés).

---

### Module 3 : Quadrature de Gauss-Legendre
- **Principe :**
  - Contrairement à Newton-Cotes (trapèzes, Simpson) où les abscisses sont équidistantes, Gauss-Legendre optimise à la fois les **abscisses** $x_i$ et les **poids** $w_i$.
  - Les abscisses sont les racines des polynômes de Legendre $P_n(x)$ sur $[-1, 1]$.
  - Avec $n$ points, la méthode intègre **exactement** tous les polynômes de degré $\le 2n - 1$.
- **Prouesse technique de l'implémentation :**
  - Aucune table pré-calculée n'est injectée en dur : le code implémente l'évaluation des polynômes de Legendre par la relation de récurrence de Bonnet :
    $$(k+1) P_{k+1}(x) = (2k+1) x P_k(x) - k P_{k-1}(x)$$
  - Les racines sont trouvées numériquement par la méthode de **Newton-Raphson**, puis les poids sont calculés par quadrature exacte.

---

### Module 4 : Méthode de Simpson Adaptatif
- **Principe :**
  - Une grille uniforme est inefficace pour les fonctions à fortes variations localisées (ex. pics gaussiens, fonctions de Runge, singularités).
  - L'algorithme calcule l'approximation de Simpson globale $S_1$ sur $[a, b]$, puis divise en deux moitiés pour calculer $S_2 = S([a, m]) + S([m, b])$.
  - Le critère d'arrêt local compare l'écart $|S_1 - S_2| \le 15 \cdot \text{tol}$.
  - Si le critère est respecté, on applique la correction d'extrapolation locale $S_2 + \frac{S_2 - S_1}{15}$.
- **Ce qu'on montre visuellement :**
  - Le simulateur affiche la **densité de découpage de l'intervalle** : là où la courbure est forte, les sous-intervalles se resserrent ; là où la fonction est plate, le pas reste large.

---

### Module 5 : Intégration par Monte-Carlo
- **Principe :**
  - Évaluation probabiliste par la loi des grands nombres : $\mathbb{E}[f(X)] \approx \frac{1}{N} \sum_{i=1}^N f(X_i)$.
  - Taux de convergence théorique en $O(N^{-1/2})$, totalement indépendant de la dimension.
- **Ce qu'on montre dans le simulateur :**
  - La convergence lente et oscillante typique des méthodes stochastiques.
  - L'affichage de l'intervalle de confiance statistique à 95% ($2\sigma / \sqrt{N}$), permettant de confronter l'erreur réelle à la borne probabiliste.

---

### Module 6 : Comparaison à Coût Égal ($N_{\text{eval}}$)
- **L'apport majeur :**
  - Au lieu de comparer les méthodes sur un pas abstrait, on les soumet au même banc d'essai : l'erreur en fonction du **nombre total d'appels à la fonction $f$**.
  - On constate immédiatement la supériorité exponentielle de Gauss-Legendre et Romberg pour les fonctions régulières, versus Simpson pour les fonctions moyennement régulières et Monte-Carlo en grande variabilité.

---

## 3. 💻 Architecture Technique & Choix de Développement

1. **Pur Vanilla JavaScript (ES6+) :**
   - Aucune dépendance externe (pas de Chart.js, pas de Math.js, pas de D3.js).
   - Temps de chargement instantané (< 50 ms), zéro vulnérabilité npm, pérennité maximale du code.
2. **Moteur Graphique SVG Vectoriel Autonome :**
   - Système de projection dynamique (conversion coordonnées mathématiques $(\log_{10} x, \log_{10} y)$ en pixels écran).
   - Génération dynamique des axes gradués en décades ($10^{-2}, 10^{-4}, 10^{-6}, \dots$).
   - Courbes en dégradés, points de mesure interactifs avec infobulles (tooltips).
   - Régression linéaire par moindres carrés calculant automatiquement la pente observée et la comparant à l'ordre théorique.
3. **Qualité & Accessibilité (WCAG AA) :**
   - Navigation clavier intégrale conforme au motif WAI-ARIA (`role="tablist"`, touches fléchées `←` `→`, `Home`, `End`).
   - Mode clair / mode sombre avec bascule instantanée et persistance `localStorage`.
   - Palette de couleurs à haut contraste (> 4.5:1) testée pour les vidéoprojecteurs et les écrans à fort reflet.
4. **Évaluateur d'expressions mathématiques :**
   - Permet à l'utilisateur de saisir n'importe quelle fonction personnalisée (ex. `sin(x) * exp(-x^2)`).

---

## 4. 🎭 Scénario Idéal de Démonstration (5 à 7 minutes)

### Étape 1 : Vue globale & Accessibilité (30 secondes)
- Ouvrir le simulateur en plein écran.
- Basculer en mode sombre puis en mode clair via le bouton 🌙/☀️.
- Montrer la navigation au clavier (appuyer sur `Tab` puis flèches `Droite`/`Gauche` pour changer d'onglet).

### Étape 2 : La Courbe en V de la Dérivation (2 minutes)
- Sélectionner l'onglet **Dérivation**.
- Choisir $f(x) = \sin(x)$ au point $x_0 = 1.0$.
- Pointer le graphique SVG :
  - Montrer la droite descendante d'ordre 1 (différences avant, pente -1).
  - Montrer la droite descendante d'ordre 2 (différences centrées, pente -2).
  - Montrer la droite descendante d'ordre 4 (Richardson, pente -4).
  - Pointer le fond de la courbe en V : expliquer pourquoi vers $h \approx 10^{-8}$, l'erreur remonte brutalement (saturation de précision de l'arithmétique IEEE 754 float64).

### Étape 3 : La puissance de Gauss-Legendre vs Trapèzes (1 minute 30)
- Passer sur l'onglet **Gauss-Legendre**.
- Choisir un polynôme de degré 7 ou une fonction régulière.
- Montrer qu'avec seulement 4 points d'évaluation, Gauss-Legendre atteint directement la précision machine ($10^{-15}$), alors que la méthode des trapèzes nécessite des milliers d'itérations.

### Étape 4 : Simpson Adaptatif sur une fonction à gradient raide (1 minute 30)
- Ouvrir l'onglet **Simpson Adaptatif**.
- Choisir la fonction Lorentzienne ou la fonction de Runge avec pic prononcé.
- Montrer l'histogramme de découpage : expliquer comment l'algorithme "concentre" l'effort de calcul uniquement là où la dérivée seconde est élevée.

### Étape 5 : Synthèse sur le graphique à coût égal (1 minute)
- Ouvrir l'onglet **Comparaison à Coût Égal**.
- Montrer la superposition de toutes les courbes en fonction de $N_{\text{eval}}$.
- Conclure sur le choix de la méthode en fonction de la régularité de la fonction.

---

## 5. ❓ Questions Anticipées du Jury & Réponses Types

### Q1 : *"Pourquoi ne pas avoir utilisé Chart.js ou Plotly pour les graphiques ?"*
> **Réponse :**  
> *"L'objectif était d'avoir une maîtrise totale du pipeline graphique et algorithmique, sans dépendance tierce. L'implémentation directe en SVG permet un rendu vectoriel net, un affichage instantané hors-ligne, et le contrôle précis des échelles logarithmiques décimales nécessaires à l'analyse de convergence numérique."*

### Q2 : *"Comment avez-vous résolu le calcul des racines de Legendre pour des ordres élevés ?"*
> **Réponse :**  
> *"J'utilise la récurrence de Bonnet à 3 termes pour évaluer $P_n(x)$ et sa dérivée $P'_n(x)$ de manière stable. Les racines sont isolées grâce à des approximations trigonométriques initiales de Chebyshev, puis raffinées par la méthode de Newton-Raphson jusqu'à convergence à $10^{-15}$."*

### Q3 : *"Que se passe-t-il si l'utilisateur saisit une fonction avec une division par zéro ou non définie ?"*
> **Réponse :**  
> *"Le module d'évaluation entoure chaque calcul d'un bloc de sécurité (`try...catch` et tests `isNaN` / `isFinite`). En cas de valeur non finie ou d'erreur mathématique, l'interface affiche un message d'alerte explicite sans faire planter le script."*

### Q4 : *"Quelle est la différence entre ce projet et votre projet OptimDjango ?"*
> **Réponse :**  
> *"OptimDjango est une plateforme full-stack Django dédiée à la recherche opérationnelle (programmation linéaire, méthode du simplexe, transport, branch & bound). Ce simulateur-ci est un laboratoire d'analyse numérique en temps réel, ultra-léger et interactif, conçu pour le déploiement immédiat en web client."*
