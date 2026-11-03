# Guide de Déploiement en Ligne (Accès Public Gratuit)

Comme ce projet est une application **Django avec backend Python (calculs numériques NumPy et base de données SQLite)**, il nécessite un hébergeur Python (et non un simple hébergeur de fichiers statiques comme GitHub Pages brut).

Grâce aux fichiers configurés dans le dépôt (`Procfile`, `requirements.txt`, `render.yaml`, `Dockerfile`, `whitenoise`), vous pouvez le déployer gratuitement en ligne en 2 minutes depuis votre dépôt GitHub.

---

## Option 1 : Déploiement Gratuit en 1 Clic sur Render.com (Recommandé)

1. Rendez-vous sur [Render.com](https://render.com) et connectez-vous avec votre compte **GitHub**.
2. Cliquez sur **New +** > **Web Service**.
3. Choisissez votre dépôt GitHub : `claude-doumy/simulation_methode_numerique`.
4. Remplissez les paramètres suivants (Render détecte automatiquement le fichier `render.yaml` ou vous pouvez entrer) :
   - **Environment** : `Python 3`
   - **Build Command** :
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - **Start Command** :
     ```bash
     gunicorn numerical_project.wsgi:application
     ```
   - **Instance Type** : `Free`
5. Cliquez sur **Deploy Web Service**.
6. En moins de 2 minutes, votre application sera accessible publiquement via une URL en `https://simulation-methode-numerique.onrender.com` !

---

## Option 2 : Déploiement sur Railway.app

1. Rendez-vous sur [Railway.app](https://railway.app) et connectez-vous avec **GitHub**.
2. Cliquez sur **New Project** > **Deploy from GitHub repo**.
3. Sélectionnez votre dépôt `simulation_methode_numerique`.
4. Railway détectera automatiquement le `Procfile` et `requirements.txt`.
5. Allez dans l'onglet **Settings** > **Networking** > **Generate Domain**.
6. Votre application est immédiatement en ligne et accessible publiquement.

---

## Option 3 : Déploiement avec Docker

Si vous avez un serveur VPS ou utilisez Docker :
```bash
docker build -t simulateur-3d .
docker run -p 8000:8000 simulateur-3d
```
L'application sera accessible sur `http://localhost:8000`.

---

## Option 4 : Lancement en local

```bash
git clone https://github.com/claude-doumy/simulation_methode_numerique.git
cd simulation_methode_numerique
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
Ouvrez votre navigateur sur `http://127.0.0.1:8000`.
