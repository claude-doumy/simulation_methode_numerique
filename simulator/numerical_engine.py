import math
import numpy as np

# Machine epsilon standard IEEE 754 64-bit
EPSILON_MACHINE = np.finfo(float).eps

# -----------------------------------------------------------------------------
# 1. CORE NUMERICAL METHODS (PURE & NUMPY ENHANCED)
# -----------------------------------------------------------------------------

def finite_difference_forward(f, x, h):
    """Ordre 1: O(h)"""
    return (f(x + h) - f(x)) / h

def finite_difference_centered(f, x, h):
    """Ordre 2: O(h^2)"""
    return (f(x + h) - f(x - h)) / (2.0 * h)

def richardson_extrapolation(f, x, h):
    """Ordre 4: O(h^4) via combinaison centrée"""
    d1 = finite_difference_centered(f, x, h)
    d2 = finite_difference_centered(f, x, h / 2.0)
    return (4.0 * d2 - d1) / 3.0

def trapezoidal_rule(f, a, b, n):
    """Méthode des trapèzes composite"""
    if n < 1:
        n = 1
    h = (b - a) / float(n)
    s = 0.5 * (f(a) + f(b))
    for i in range(1, n):
        s += f(a + i * h)
    return s * h

def simpson_rule(f, a, b, n):
    """Méthode de Simpson composite (n doit être pair)"""
    if n % 2 != 0:
        n += 1
    h = (b - a) / float(n)
    s = f(a) + f(b)
    for i in range(1, n):
        weight = 4.0 if (i % 2 != 0) else 2.0
        s += weight * f(a + i * h)
    return s * h / 3.0

def romberg_integration(f, a, b, max_k=6):
    """
    Extrapolation itérative de Richardson sur la méthode des trapèzes.
    Retourne la matrice triangulaire R et le nombre d'évaluations.
    """
    R = []
    eval_count = 2
    h = b - a
    R.append([0.5 * h * (f(a) + f(b))])

    n = 1
    for k in range(1, max_k + 1):
        row = [0.0] * (k + 1)
        h = (b - a) / float(n)
        # Évaluation aux points médians
        mid_sum = 0.0
        for i in range(n):
            mid_sum += f(a + (i + 0.5) * h)
            eval_count += 1
        row[0] = 0.5 * R[k - 1][0] + 0.5 * h * mid_sum
        n *= 2

        # Combinaisons de Richardson
        for j in range(1, k + 1):
            factor = 4.0 ** j
            row[j] = row[j - 1] + (row[j - 1] - R[k - 1][j - 1]) / (factor - 1.0)
        R.append(row)

    return {
        "result": R[max_k][max_k],
        "table": R,
        "evaluations": eval_count
    }

def gauss_legendre_nodes_weights(n):
    """Calcul des racines et poids de Gauss-Legendre sur [-1, 1]"""
    # Utilisation des polynômes de Legendre via numpy pour précision machine
    x, w = np.polynomial.legendre.leggauss(n)
    return x.tolist(), w.tolist()

def gauss_legendre_quadrature(f, a, b, n):
    """Quadrature de Gauss-Legendre sur [a, b]"""
    x_nodes, weights = gauss_legendre_nodes_weights(n)
    half_length = 0.5 * (b - a)
    mid_point = 0.5 * (a + b)
    s = 0.0
    for xi, wi in zip(x_nodes, weights):
        s += wi * f(mid_point + half_length * xi)
    return {
        "result": s * half_length,
        "nodes": [mid_point + half_length * xi for xi in x_nodes],
        "weights": weights,
        "evaluations": n
    }

def adaptive_simpson(f, a, b, tol=1e-6, max_depth=25):
    """
    Simpson adaptatif avec raffinement récursif de maillage
    et enregistrement des points d'évaluation pour visualisation 3D.
    """
    evaluated_points = []

    def F(x):
        evaluated_points.append(x)
        return f(x)

    def simpson_step(x1, fx1, x2, fx2, xm, fxm):
        return (x2 - x1) / 6.0 * (fx1 + 4.0 * fxm + fx2)

    def recursive_step(x1, fx1, x2, fx2, xm, fxm, s_whole, cur_tol, depth):
        left_m = 0.5 * (x1 + xm)
        right_m = 0.5 * (xm + x2)
        f_left_m = F(left_m)
        f_right_m = F(right_m)

        s_left = simpson_step(x1, fx1, xm, fxm, left_m, f_left_m)
        s_right = simpson_step(xm, fxm, x2, fx2, right_m, f_right_m)
        delta = s_left + s_right - s_whole

        if depth >= max_depth or abs(delta) <= 15.0 * cur_tol:
            return s_left + s_right + delta / 15.0

        return (recursive_step(x1, fx1, xm, fxm, left_m, f_left_m, s_left, cur_tol / 2.0, depth + 1) +
                recursive_step(xm, fxm, x2, fx2, right_m, f_right_m, s_right, cur_tol / 2.0, depth + 1))

    fa = F(a)
    fb = F(b)
    m = 0.5 * (a + b)
    fm = F(m)
    whole = simpson_step(a, fa, b, fb, m, fm)
    integral = recursive_step(a, fa, b, fb, m, fm, whole, tol, 0)

    evaluated_points.sort()
    return {
        "result": integral,
        "evaluations": len(evaluated_points),
        "points": evaluated_points
    }

def monte_carlo_3d_sampling(shape_type="dome", n_samples=3000, seed=42):
    """
    Simulation stochastique 3D d'estimation de volume physique.
    Retourne l'estimation, l'intervalle de confiance et le nuage de points (in/out).
    """
    rng = np.random.default_rng(seed)

    if shape_type == "dome":
        # Dôme géodésique / hémisphère de rayon R=5m : z = sqrt(max(0, R^2 - x^2 - y^2)) pour z >= 0
        R = 5.0
        # Boîte englobante [-R, R] x [-R, R] x [0, R] -> Volume = 2R * 2R * R = 4 R^3 = 500 m3
        bbox = {"xmin": -R, "xmax": R, "ymin": -R, "ymax": R, "zmin": 0.0, "zmax": R}
        box_vol = (bbox["xmax"] - bbox["xmin"]) * (bbox["ymax"] - bbox["ymin"]) * (bbox["zmax"] - bbox["zmin"])
        exact_vol = (2.0 / 3.0) * math.pi * (R ** 3)  # ~ 261.799 m3

        xs = rng.uniform(bbox["xmin"], bbox["xmax"], n_samples)
        ys = rng.uniform(bbox["ymin"], bbox["ymax"], n_samples)
        zs = rng.uniform(bbox["zmin"], bbox["zmax"], n_samples)

        inside_mask = (xs**2 + ys**2 + zs**2 <= R**2) & (zs >= 0)

    elif shape_type == "torus":
        # Réservoir toroïdal (ex: Tokamak ou réservoir circulaire) R=4m, r=1.5m
        R_major = 4.0
        r_minor = 1.5
        bbox = {
            "xmin": -(R_major + r_minor), "xmax": (R_major + r_minor),
            "ymin": -(R_major + r_minor), "ymax": (R_major + r_minor),
            "zmin": -r_minor, "zmax": r_minor
        }
        box_vol = (bbox["xmax"] - bbox["xmin"]) * (bbox["ymax"] - bbox["ymin"]) * (bbox["zmax"] - bbox["zmin"])
        exact_vol = 2.0 * (math.pi ** 2) * R_major * (r_minor ** 2)  # ~ 177.65 m3

        xs = rng.uniform(bbox["xmin"], bbox["xmax"], n_samples)
        ys = rng.uniform(bbox["ymin"], bbox["ymax"], n_samples)
        zs = rng.uniform(bbox["zmin"], bbox["zmax"], n_samples)

        r_xy = np.sqrt(xs**2 + ys**2)
        inside_mask = ((r_xy - R_major)**2 + zs**2) <= (r_minor**2)

    elif shape_type == "dam_vault":
        # Voûte parabolique asymétrique de barrage
        bbox = {"xmin": -10.0, "xmax": 10.0, "ymin": 0.0, "ymax": 15.0, "zmin": 0.0, "zmax": 20.0}
        box_vol = 20.0 * 15.0 * 20.0
        # Profil z(x, y) <= 20 * (1 - (x/10)^2) * (1 - y/15)
        xs = rng.uniform(bbox["xmin"], bbox["xmax"], n_samples)
        ys = rng.uniform(bbox["ymin"], bbox["ymax"], n_samples)
        zs = rng.uniform(bbox["zmin"], bbox["zmax"], n_samples)

        surf = 20.0 * np.maximum(0.0, 1.0 - (xs / 10.0)**2) * (1.0 - ys / 15.0)
        inside_mask = (zs <= surf) & (zs >= 0)
        # Intégrale exacte: int_{-10}^{10} (1 - x^2/100) dx * 20 * int_0^{15} (1 - y/15) dy
        # = (20 - 20/3) * 20 * (15/2) = (40/3) * 150 = 2000.0 m3
        exact_vol = 2000.0
    else:
        # Sphère unité
        bbox = {"xmin": -1.0, "xmax": 1.0, "ymin": -1.0, "ymax": 1.0, "zmin": -1.0, "zmax": 1.0}
        box_vol = 8.0
        exact_vol = (4.0 / 3.0) * math.pi
        xs = rng.uniform(-1.0, 1.0, n_samples)
        ys = rng.uniform(-1.0, 1.0, n_samples)
        zs = rng.uniform(-1.0, 1.0, n_samples)
        inside_mask = (xs**2 + ys**2 + zs**2 <= 1.0)

    n_inside = int(np.sum(inside_mask))
    proportion = n_inside / float(n_samples)
    estimated_volume = box_vol * proportion

    # Écart type & Intervalle de confiance à 95%
    var_p = (proportion * (1.0 - proportion)) / float(n_samples)
    se = box_vol * math.sqrt(var_p)
    ci95 = 1.96 * se

    # Limite des points renvoyés pour la visualisation WebGL pour garder une fluidité parfaite (max 1500 pts)
    sample_vis_limit = min(n_samples, 1500)
    indices = np.random.choice(n_samples, sample_vis_limit, replace=False)

    vis_points = []
    for idx in indices:
        vis_points.append({
            "x": float(xs[idx]),
            "y": float(ys[idx]),
            "z": float(zs[idx]),
            "inside": bool(inside_mask[idx])
        })

    return {
        "shape_type": shape_type,
        "n_samples": n_samples,
        "n_inside": n_inside,
        "box_volume": box_vol,
        "estimated_volume": estimated_volume,
        "exact_volume": exact_vol,
        "absolute_error": abs(estimated_volume - exact_vol),
        "relative_error_percent": abs(estimated_volume - exact_vol) / exact_vol * 100.0,
        "std_error": se,
        "ci95": ci95,
        "bbox": bbox,
        "points": vis_points
    }


# -----------------------------------------------------------------------------
# 2. REAL-WORLD 3D SIMULATION SCENARIOS
# -----------------------------------------------------------------------------

def drone_flight_trajectory_simulation(dt_input=0.1, noise_amplitude=0.0):
    """
    Simulation de cinématique 3D d'un drone autonome / hélicoptère de secours.
    Trajectoire 3D paramétrée:
       x(t) = 15 * cos(0.5 t)
       y(t) = 15 * sin(0.5 t)
       z(t) = 3 + 2 * sin(1.2 t) + 0.5 * t
    Dérivation numérique par différences finies (Avant, Centrée, Richardson)
    avec mise en évidence de l'effet du pas dt et du bruit de mesure.
    """
    t_start, t_end = 0.0, 12.0

    def true_pos(t):
        return np.array([
            15.0 * np.cos(0.5 * t),
            15.0 * np.sin(0.5 * t),
            3.0 + 2.0 * np.sin(1.2 * t) + 0.5 * t
        ])

    def true_vel(t):
        return np.array([
            -7.5 * np.sin(0.5 * t),
            7.5 * np.cos(0.5 * t),
            2.4 * np.cos(1.2 * t) + 0.5
        ])

    def true_acc(t):
        return np.array([
            -3.75 * np.cos(0.5 * t),
            -3.75 * np.sin(0.5 * t),
            -2.88 * np.sin(1.2 * t)
        ])

    # Trajectoire de référence continue (200 points) pour le tracé 3D
    t_ref = np.linspace(t_start, t_end, 200)
    ref_path = [true_pos(t).tolist() for t in t_ref]

    # Analyse de la vitesse au temps t_target = 5.0s selon le pas h (Courbe en V)
    t_eval = 5.0
    v_exact = true_vel(t_eval)
    v_exact_norm = float(np.linalg.norm(v_exact))

    # Génération de la courbe d'erreur de dérivation (log-log)
    h_values = np.logspace(-12, 0, 50)
    errors_forward = []
    errors_centered = []
    errors_richardson = []

    for h in h_values:
        # Vitesse par composante
        # Ajout éventuel de bruit machine/flottant simulé
        p_p = true_pos(t_eval + h) + (noise_amplitude * np.random.normal(0, 1e-6, 3) if noise_amplitude > 0 else 0)
        p_0 = true_pos(t_eval)
        p_m = true_pos(t_eval - h) + (noise_amplitude * np.random.normal(0, 1e-6, 3) if noise_amplitude > 0 else 0)
        p_p2 = true_pos(t_eval + h / 2.0)
        p_m2 = true_pos(t_eval - h / 2.0)

        v_fwd = (p_p - p_0) / h
        v_cen = (p_p - p_m) / (2.0 * h)
        v_cen2 = (p_p2 - p_m2) / h
        v_rich = (4.0 * v_cen2 - v_cen) / 3.0

        errors_forward.append(float(np.linalg.norm(v_fwd - v_exact)))
        errors_centered.append(float(np.linalg.norm(v_cen - v_exact)))
        errors_richardson.append(float(np.linalg.norm(v_rich - v_exact)))

    # Calcul spécifique pour le pas h choisi par l'utilisateur (dt_input)
    h_user = float(dt_input)
    p_p_u = true_pos(t_eval + h_user)
    p_0_u = true_pos(t_eval)
    p_m_u = true_pos(t_eval - h_user)
    p_p2_u = true_pos(t_eval + h_user / 2.0)
    p_m2_u = true_pos(t_eval - h_user / 2.0)

    v_fwd_u = (p_p_u - p_0_u) / h_user
    v_cen_u = (p_m_u if h_user == 0 else (p_p_u - p_m_u) / (2.0 * h_user))
    v_cen2_u = (p_p2_u - p_m2_u) / h_user
    v_rich_u = (4.0 * v_cen2_u - v_cen_u) / 3.0

    # Accélération par différences centrées
    a_cen_u = (p_p_u - 2.0 * p_0_u + p_m_u) / (h_user ** 2)
    a_exact = true_acc(t_eval)

    # Discrétisation sur toute la durée pour l'animation du vol
    dt_anim = max(h_user, 0.05)
    t_flight = np.arange(t_start, t_end + 0.001, dt_anim)
    flight_keyframes = []
    for tf in t_flight:
        pos = true_pos(tf)
        # vitesse centrée au temps tf
        p_next = true_pos(tf + dt_anim)
        p_prev = true_pos(tf - dt_anim)
        vel = (p_next - p_prev) / (2.0 * dt_anim)
        acc = (p_next - 2.0 * pos + p_prev) / (dt_anim ** 2)
        flight_keyframes.append({
            "t": round(float(tf), 2),
            "pos": [round(float(pos[0]), 3), round(float(pos[1]), 3), round(float(pos[2]), 3)],
            "vel": [round(float(vel[0]), 3), round(float(vel[1]), 3), round(float(vel[2]), 3)],
            "acc": [round(float(acc[0]), 3), round(float(acc[1]), 3), round(float(acc[2]), 3)],
            "speed": round(float(np.linalg.norm(vel)), 3)
        })

    return {
        "dt": h_user,
        "t_eval": t_eval,
        "ref_path": ref_path,
        "flight_keyframes": flight_keyframes,
        "current_state": {
            "pos": true_pos(t_eval).tolist(),
            "exact_speed": v_exact_norm,
            "v_forward": v_fwd_u.tolist(),
            "speed_forward": float(np.linalg.norm(v_fwd_u)),
            "error_forward": float(np.linalg.norm(v_fwd_u - v_exact)),
            "v_centered": v_cen_u.tolist(),
            "speed_centered": float(np.linalg.norm(v_cen_u)),
            "error_centered": float(np.linalg.norm(v_cen_u - v_exact)),
            "v_richardson": v_rich_u.tolist(),
            "speed_richardson": float(np.linalg.norm(v_rich_u)),
            "error_richardson": float(np.linalg.norm(v_rich_u - v_exact)),
            "a_centered": a_cen_u.tolist(),
            "acc_centered_norm": float(np.linalg.norm(a_cen_u)),
            "exact_acc_norm": float(np.linalg.norm(a_exact)),
            "error_acc": float(np.linalg.norm(a_cen_u - a_exact))
        },
        "v_curve": {
            "h": h_values.tolist(),
            "err_fwd": errors_forward,
            "err_cen": errors_centered,
            "err_rich": errors_richardson
        }
    }


def hydraulic_dam_volume_simulation(method="simpson", n_slices=10, tolerance=1e-5):
    """
    Simulation de génie civil / hydroélectrique :
    Calcul du volume de retenue d'eau d'un barrage hydraulique ou réservoir de vallée en 3D.
    Profil de section transversale le long de l'axe de la vallée x in [0, L]:
    La largeur de la vallée b(x) et la hauteur maximale h(x) varient selon:
       b(x) = B_max * (1 - (x/L)^1.5)
       h(x) = H_max * (1 - (x/L))
    L'aire de la section transversale parabolique à la position x est:
       A(x) = (2/3) * b(x) * h(x) = (2/3) * B_max * H_max * (1 - (x/L)^1.5) * (1 - x/L)
    L = 200 m (longueur de retenue), B_max = 80 m, H_max = 45 m.
    Intégrale exacte connue pour valider les erreurs.
    """
    L = 200.0
    B_max = 80.0
    H_max = 45.0
    k_const = (2.0 / 3.0) * B_max * H_max  # = 2400.0

    def cross_section_area(x):
        u = max(0.0, min(1.0, x / L))
        return k_const * (1.0 - u ** 1.5) * (1.0 - u)

    # Intégrale exacte analytique:
    # int_0^L (1 - u^1.5)(1 - u) dx = L * int_0^1 (1 - u - u^1.5 + u^2.5) du
    # = L * [1 - 1/2 - 1/2.5 + 1/3.5] = L * [0.5 - 0.4 + 2/7] = L * [0.1 + 2/7] = L * 27/70
    exact_volume = k_const * L * (27.0 / 70.0)  # ~ 185142.857 m^3

    result = {}
    slices_data = []

    if method == "trapezoid":
        val = trapezoidal_rule(cross_section_area, 0.0, L, n_slices)
        evals = n_slices + 1
        x_pts = np.linspace(0.0, L, n_slices + 1)
        for i, x in enumerate(x_pts):
            u = x / L
            bx = B_max * max(0.0, 1.0 - u ** 1.5)
            hx = H_max * max(0.0, 1.0 - u)
            slices_data.append({"x": float(x), "width": float(bx), "height": float(hx), "area": float(cross_section_area(x))})
        result = {"result": val, "evaluations": evals, "slices": slices_data}

    elif method == "simpson":
        n_even = n_slices if n_slices % 2 == 0 else n_slices + 1
        val = simpson_rule(cross_section_area, 0.0, L, n_even)
        evals = n_even + 1
        x_pts = np.linspace(0.0, L, n_even + 1)
        for i, x in enumerate(x_pts):
            u = x / L
            bx = B_max * max(0.0, 1.0 - u ** 1.5)
            hx = H_max * max(0.0, 1.0 - u)
            slices_data.append({"x": float(x), "width": float(bx), "height": float(hx), "area": float(cross_section_area(x))})
        result = {"result": val, "evaluations": evals, "slices": slices_data}

    elif method == "romberg":
        # K niveaux
        k_level = max(1, min(7, int(math.log2(max(1, n_slices)))))
        romb_res = romberg_integration(cross_section_area, 0.0, L, max_k=k_level)
        val = romb_res["result"]
        evals = romb_res["evaluations"]
        x_pts = np.linspace(0.0, L, 2 ** k_level + 1)
        for x in x_pts:
            u = x / L
            bx = B_max * max(0.0, 1.0 - u ** 1.5)
            hx = H_max * max(0.0, 1.0 - u)
            slices_data.append({"x": float(x), "width": float(bx), "height": float(hx), "area": float(cross_section_area(x))})
        result = {"result": val, "evaluations": evals, "slices": slices_data, "table": romb_res["table"]}

    elif method == "gauss":
        n_gauss = max(1, min(30, n_slices))
        gauss_res = gauss_legendre_quadrature(cross_section_area, 0.0, L, n_gauss)
        val = gauss_res["result"]
        evals = gauss_res["evaluations"]
        for x in sorted(gauss_res["nodes"]):
            u = x / L
            bx = B_max * max(0.0, 1.0 - u ** 1.5)
            hx = H_max * max(0.0, 1.0 - u)
            slices_data.append({"x": float(x), "width": float(bx), "height": float(hx), "area": float(cross_section_area(x))})
        result = {"result": val, "evaluations": evals, "slices": slices_data, "weights": gauss_res["weights"]}

    elif method == "adaptive":
        asimp_res = adaptive_simpson(cross_section_area, 0.0, L, tol=tolerance)
        val = asimp_res["result"]
        evals = asimp_res["evaluations"]
        for x in asimp_res["points"][:120]:  # échantillon représentatif pour la 3D
            u = x / L
            bx = B_max * max(0.0, 1.0 - u ** 1.5)
            hx = H_max * max(0.0, 1.0 - u)
            slices_data.append({"x": float(x), "width": float(bx), "height": float(hx), "area": float(cross_section_area(x))})
        result = {"result": val, "evaluations": evals, "slices": slices_data}

    calculated_volume = result["result"]
    abs_err = abs(calculated_volume - exact_volume)
    rel_err_pct = (abs_err / exact_volume) * 100.0

    # 3D surface mesh generation of the valley / reservoir for Three.js
    # Grid of coordinates (x, y, z)
    nx_mesh, ny_mesh = 30, 20
    mesh_x = np.linspace(0.0, L, nx_mesh)
    surface_vertices = []
    water_vertices = []

    for xi in mesh_x:
        u = xi / L
        bx = B_max * max(0.0, 1.0 - u ** 1.5)
        hx = H_max * max(0.0, 1.0 - u)
        ys = np.linspace(-bx / 2.0, bx / 2.0, ny_mesh) if bx > 0 else np.zeros(ny_mesh)
        for yj in ys:
            # Profil parabolique du fond de vallée z(x, y) = hx * (2y/bx)^2 - hx
            norm_y = (2.0 * yj / bx) if bx > 0.001 else 0.0
            z_terrain = -hx * (1.0 - norm_y ** 2) if abs(norm_y) <= 1.0 else 0.0
            surface_vertices.append([float(xi), float(yj), float(z_terrain)])
            # Surface de l'eau z = 0
            water_vertices.append([float(xi), float(yj), 0.0])

    return {
        "method": method,
        "n_slices": n_slices,
        "tolerance": tolerance,
        "exact_volume": exact_volume,
        "calculated_volume": calculated_volume,
        "absolute_error": abs_err,
        "relative_error_percent": rel_err_pct,
        "evaluations": result["evaluations"],
        "dam_dimensions": {"length": L, "max_width": B_max, "max_depth": H_max},
        "slices": slices_data,
        "terrain_mesh": {
            "nx": nx_mesh,
            "ny": ny_mesh,
            "vertices": surface_vertices,
            "water_surface": water_vertices
        }
    }


def multi_method_cost_benchmark(shape="dam"):
    """
    Comparaison rigoureuse à coût égal (N_eval) de toutes les méthodes d'intégration
    appliquées au calcul de volume réel.
    """
    if shape == "dam":
        L = 200.0
        B_max = 80.0
        H_max = 45.0
        k_const = (2.0 / 3.0) * B_max * H_max
        f = lambda x: k_const * (1.0 - (x / L) ** 1.5) * (1.0 - x / L)
        a, b = 0.0, L
        exact = k_const * L * (27.0 / 70.0)
    else:
        # Réservoir sphérique demi-volume
        R = 10.0
        f = lambda z: math.pi * (R**2 - z**2)
        a, b = 0.0, R
        exact = (2.0 / 3.0) * math.pi * (R**3)

    # 1. Trapèzes
    trap_evals, trap_errors = [], []
    for n in [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]:
        res = trapezoidal_rule(f, a, b, n)
        trap_evals.append(n + 1)
        trap_errors.append(max(abs(res - exact), 1e-16))

    # 2. Simpson
    simp_evals, simp_errors = [], []
    for n in [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]:
        res = simpson_rule(f, a, b, n)
        simp_evals.append(n + 1)
        simp_errors.append(max(abs(res - exact), 1e-16))

    # 3. Romberg
    romb_evals, romb_errors = [], []
    for k in range(1, 9):
        r = romberg_integration(f, a, b, max_k=k)
        romb_evals.append(2**k + 1)
        romb_errors.append(max(abs(r["result"] - exact), 1e-16))

    # 4. Gauss-Legendre
    gauss_evals, gauss_errors = [], []
    for n in [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30]:
        res = gauss_legendre_quadrature(f, a, b, n)
        gauss_evals.append(n)
        gauss_errors.append(max(abs(res["result"] - exact), 1e-16))

    # 5. Simpson adaptatif
    asimp_evals, asimp_errors = [], []
    for tol_exp in [2, 3, 4, 5, 6, 7, 8, 9, 10]:
        tol = 10.0 ** (-tol_exp)
        res = adaptive_simpson(f, a, b, tol=tol)
        asimp_evals.append(res["evaluations"])
        asimp_errors.append(max(abs(res["result"] - exact), 1e-16))

    # 6. Monte-Carlo (1D volume)
    mc_evals = [50, 100, 250, 500, 1000, 2500, 5000, 10000]
    mc_errors = []
    rng = np.random.default_rng(123)
    for n in mc_evals:
        # Moyenne sur 10 runs
        runs = []
        for _ in range(10):
            pts = rng.uniform(a, b, n)
            estim = (b - a) * np.mean([f(p) for p in pts])
            runs.append(abs(estim - exact))
        mc_errors.append(max(float(np.mean(runs)), 1e-16))

    return {
        "exact_reference": exact,
        "series": {
            "trapezoid": {"evals": trap_evals, "errors": trap_errors, "name": "Trapèzes O(h²)"},
            "simpson": {"evals": simp_evals, "errors": simp_errors, "name": "Simpson O(h⁴)"},
            "romberg": {"evals": romb_evals, "errors": romb_errors, "name": "Romberg Extrapolé"},
            "gauss": {"evals": gauss_evals, "errors": gauss_errors, "name": "Gauss–Legendre"},
            "adaptive_simpson": {"evals": asimp_evals, "errors": asimp_errors, "name": "Simpson Adaptatif"},
            "monte_carlo": {"evals": mc_evals, "errors": mc_errors, "name": "Monte-Carlo 1D O(N^-0.5)"}
        }
    }
