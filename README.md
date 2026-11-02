# Simulateur de Méthodes Numériques

Ce projet propose une application interactive autonome et accessible pour simuler, analyser et comparer des méthodes fondamentales d'intégration et de dérivation numériques.

## 🎯 Méthodes implémentées (sans bibliothèque externe)

1. **Dérivation Numérique** : Différences finies avant \(O(h)\), centrées \(O(h^2)\) et accélération de Richardson \(O(h^4)\) avec mise en évidence du compromis troncature / arrondi.
2. **Méthode de Romberg** : Extrapolation itérative de Richardson sur la méthode des trapèzes, tableau triangulaire de Romberg.
3. **Quadrature de Gauss–Legendre** : Détermination des nœuds et des poids via les racines des polynômes de Legendre par l'algorithme de Newton-Raphson.
4. **Simpson Adaptatif** : Raffinement récursif de maillage selon le critère d'erreur locale \(|S_g + S_d - S| \le 15\varepsilon\).
5. **Intégration de Monte-Carlo** : Évaluation stochastique multidimensionnelle (\(\mathbb{R}^d\)), intervalles de confiance à 95% et comparaison de vitesse face aux grilles régulières.
6. **Comparaison à Coût Égal** : Benchmarking rigoureux des méthodes selon le nombre réel d'évaluations de la fonction \(f\) pour atteindre une tolérance donnée.

## 🚀 Utilisation

Ouvrez simplement le fichier `simulateur_methodes_numeriques.html` ou `index.html` dans n'importe quel navigateur web moderne.
Aucun serveur ni installation préalable n'est nécessaire.

## ♿ Accessibilité & Confort Visuel
- Conforme aux contrastes WCAG AA
- Support du mode clair et du mode sombre (avec mémorisation dans `localStorage`)
- Navigation intégrale au clavier (rôles ARIA `tablist`, flèches directionnelles, outline visible)
- Adaptation responsive complète pour smartphones, tablettes et ordinateurs (points de rupture sous 820 px).
