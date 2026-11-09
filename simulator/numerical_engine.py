import math
import numpy as np

EPSILON_MACHINE = np.finfo(float).eps

# -----------------------------------------------------------------------------
# 1. CORE NUMERICAL METHODS
# -----------------------------------------------------------------------------

def finite_difference_forward(f, x, h):
    """Ordre 1: O(h)"""
    return (f(x + h) - f(x)) / h

def finite_difference_centered(f, x, h):
    """Ordre 2: O(h^2)"""
    return (f(x + h) - f(x - h)) / (2.0 * h)

def richardson_extrapolation(f, x, h):
    """Ordre 4: O(h^4)"""
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
    """Méthode de Simpson composite"""
    if n % 2 != 0:
        n += 1
    h = (b - a) / float(n)
    s = f(a) + f(b)
    for i in range(1, n):
        weight = 4.0 if (i % 2 != 0) else 2.0
        s += weight * f(a + i * h)
    return s * h / 3.0

def romberg_integration(f, a, b, max_k=6):
    R = []
    eval_count = 2
    h = b - a
    R.append([0.5 * h * (f(a) + f(b))])
    n = 1
    for k in range(1, max_k + 1):
        row = [0.0] * (k + 1)
        h = (b - a) / float(n)
        mid_sum = 0.0
        for i in range(n):
            mid_sum += f(a + (i + 0.5) * h)
            eval_count += 1
        row[0] = 0.5 * R[k - 1][0] + 0.5 * h * mid_sum
        n *= 2
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
    x, w = np.polynomial.legendre.leggauss(n)
    return x.tolist(), w.tolist()

def gauss_legendre_quadrature(f, a, b, n):
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

# -----------------------------------------------------------------------------
# 2. 3D MONTE-CARLO STOCHASTIC SAMPLING
# -----------------------------------------------------------------------------

def monte_carlo_3d_sampling(shape_type="dome", n_samples=3000, seed=42):
    rng = np.random.default_rng(seed)

    if shape_type == "dome":
        R = 5.0
        bbox = {"xmin": -R, "xmax": R, "ymin": -R, "ymax": R, "zmin": 0.0, "zmax": R}
        box_vol = (bbox["xmax"] - bbox["xmin"]) * (bbox["ymax"] - bbox["ymin"]) * (bbox["zmax"] - bbox["zmin"])
        exact_vol = (2.0 / 3.0) * math.pi * (R ** 3)
        xs = rng.uniform(bbox["xmin"], bbox["xmax"], n_samples)
        ys = rng.uniform(bbox["ymin"], bbox["ymax"], n_samples)
        zs = rng.uniform(bbox["zmin"], bbox["zmax"], n_samples)
        inside_mask = (xs**2 + ys**2 + zs**2 <= R**2) & (zs >= 0)

    elif shape_type == "torus":
        R_major = 4.0
        r_minor = 1.5
        bbox = {
            "xmin": -(R_major + r_minor), "xmax": (R_major + r_minor),
            "ymin": -(R_major + r_minor), "ymax": (R_major + r_minor),
            "zmin": -r_minor, "zmax": r_minor
        }
        box_vol = (bbox["xmax"] - bbox["xmin"]) * (bbox["ymax"] - bbox["ymin"]) * (bbox["zmax"] - bbox["zmin"])
        exact_vol = 2.0 * (math.pi ** 2) * R_major * (r_minor ** 2)
        xs = rng.uniform(bbox["xmin"], bbox["xmax"], n_samples)
        ys = rng.uniform(bbox["ymin"], bbox["ymax"], n_samples)
        zs = rng.uniform(bbox["zmin"], bbox["zmax"], n_samples)
        r_xy = np.sqrt(xs**2 + ys**2)
        inside_mask = ((r_xy - R_major)**2 + zs**2) <= (r_minor**2)

    elif shape_type == "dam_vault":
        bbox = {"xmin": -10.0, "xmax": 10.0, "ymin": 0.0, "ymax": 15.0, "zmin": 0.0, "zmax": 20.0}
        box_vol = 20.0 * 15.0 * 20.0
        xs = rng.uniform(bbox["xmin"], bbox["xmax"], n_samples)
        ys = rng.uniform(bbox["ymin"], bbox["ymax"], n_samples)
        zs = rng.uniform(bbox["zmin"], bbox["zmax"], n_samples)
        surf = 20.0 * np.maximum(0.0, 1.0 - (xs / 10.0)**2) * (1.0 - ys / 15.0)
        inside_mask = (zs <= surf) & (zs >= 0)
        exact_vol = 2000.0
    else:
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
    var_p = (proportion * (1.0 - proportion)) / float(n_samples)
    se = box_vol * math.sqrt(var_p)
    ci95 = 1.96 * se

    sample_vis_limit = min(n_samples, 1800)
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
# 3. DRONE FLIGHT KINEMATICS WITH CUSTOMIZABLE TRAJECTORIES
# -----------------------------------------------------------------------------

def get_drone_trajectory_functions(trajectory_type="helix", radius=15.0, altitude=10.0, speed_factor=1.0):
    """
    Retourne la fonction de position exacte pos(t), vitesse exacte vel(t), accélération acc(t),
    et durée t_end selon le type de trajectoire choisi.
    """
    R = float(radius)
    H = float(altitude)
    w = 0.5 * float(speed_factor)

    if trajectory_type == "figure8":  # Lemniscate de Bernoulli / Figure en 8
        t_end = 16.0
        def true_pos(t):
            wt = w * t
            x = R * np.sin(wt)
            y = R * np.sin(wt) * np.cos(wt)
            z = 2.0 + (H / 2.0) * (1.0 - np.cos(0.5 * wt))
            return np.array([x, y, z])

        def true_vel(t):
            wt = w * t
            vx = R * w * np.cos(wt)
            vy = R * w * (np.cos(wt)**2 - np.sin(wt)**2)
            vz = (H / 4.0) * w * np.sin(0.5 * wt)
            return np.array([vx, vy, vz])

        def true_acc(t):
            wt = w * t
            ax = -R * (w**2) * np.sin(wt)
            ay = -4.0 * R * (w**2) * np.sin(wt) * np.cos(wt)
            az = (H / 8.0) * (w**2) * np.cos(0.5 * wt)
            return np.array([ax, ay, az])

    elif trajectory_type == "spiral":  # Spirale conique d'atterrissage / décollage
        t_end = 14.0
        def true_pos(t):
            r_t = max(1.0, R * (1.0 - 0.06 * t))
            wt = 0.8 * w * t
            x = r_t * np.cos(wt)
            y = r_t * np.sin(wt)
            z = 1.0 + (H / 14.0) * t
            return np.array([x, y, z])

        def true_vel(t):
            r_t = max(1.0, R * (1.0 - 0.06 * t))
            dr = -0.06 * R
            wt = 0.8 * w * t
            W = 0.8 * w
            vx = dr * np.cos(wt) - r_t * W * np.sin(wt)
            vy = dr * np.sin(wt) + r_t * W * np.cos(wt)
            vz = H / 14.0
            return np.array([vx, vy, vz])

        def true_acc(t):
            r_t = max(1.0, R * (1.0 - 0.06 * t))
            dr = -0.06 * R
            wt = 0.8 * w * t
            W = 0.8 * w
            ax = -2.0 * dr * W * np.sin(wt) - r_t * (W**2) * np.cos(wt)
            ay = 2.0 * dr * W * np.cos(wt) - r_t * (W**2) * np.sin(wt)
            az = 0.0
            return np.array([ax, ay, az])

    elif trajectory_type == "slalom":  # Slalom acrobatique à travers obstacles
        t_end = 12.0
        def true_pos(t):
            x = 3.5 * t - 20.0
            y = R * np.sin(0.8 * w * t)
            z = 3.0 + (H * 0.4) * np.sin(1.2 * w * t) + 0.3 * t
            return np.array([x, y, z])

        def true_vel(t):
            W1 = 0.8 * w
            W2 = 1.2 * w
            vx = 3.5
            vy = R * W1 * np.cos(W1 * t)
            vz = (H * 0.4) * W2 * np.cos(W2 * t) + 0.3
            return np.array([vx, vy, vz])

        def true_acc(t):
            W1 = 0.8 * w
            W2 = 1.2 * w
            ax = 0.0
            ay = -R * (W1**2) * np.sin(W1 * t)
            az = -(H * 0.4) * (W2**2) * np.sin(W2 * t)
            return np.array([ax, ay, az])

    else:  # "helix" - Hélice ascensionnelle standard
        t_end = 12.0
        def true_pos(t):
            wt = w * t
            return np.array([
                R * np.cos(wt),
                R * np.sin(wt),
                2.0 + (H / 12.0) * t + 1.5 * np.sin(1.5 * wt)
            ])

        def true_vel(t):
            wt = w * t
            return np.array([
                -R * w * np.sin(wt),
                R * w * np.cos(wt),
                (H / 12.0) + 1.5 * 1.5 * w * np.cos(1.5 * wt)
            ])

        def true_acc(t):
            wt = w * t
            return np.array([
                -R * (w**2) * np.cos(wt),
                -R * (w**2) * np.sin(wt),
                -1.5 * (1.5 * w)**2 * np.sin(1.5 * wt)
            ])

    return true_pos, true_vel, true_acc, t_end


def drone_flight_trajectory_simulation(dt_input=0.1, noise_amplitude=0.0, trajectory_type="helix", radius=15.0, altitude=10.0, speed_factor=1.0):
    true_pos, true_vel, true_acc, t_end = get_drone_trajectory_functions(trajectory_type, radius, altitude, speed_factor)
    t_start = 0.0

    # Chemin de référence pour le tracé 3D
    t_ref = np.linspace(t_start, t_end, 200)
    ref_path = [true_pos(t).tolist() for t in t_ref]

    # Analyse d'erreur à t_target au milieu du vol
    t_eval = round(t_end / 2.0, 1)
    v_exact = true_vel(t_eval)
    v_exact_norm = float(np.linalg.norm(v_exact))

    # Génération de la courbe d'erreur en V (log-log)
    h_values = np.logspace(-12, 0, 50)
    errors_forward, errors_centered, errors_richardson = [], [], []

    for h in h_values:
        p_p = true_pos(t_eval + h)
        p_0 = true_pos(t_eval)
        p_m = true_pos(t_eval - h)
        p_p2 = true_pos(t_eval + h / 2.0)
        p_m2 = true_pos(t_eval - h / 2.0)

        v_fwd = (p_p - p_0) / h
        v_cen = (p_p - p_m) / (2.0 * h)
        v_cen2 = (p_p2 - p_m2) / h
        v_rich = (4.0 * v_cen2 - v_cen) / 3.0

        errors_forward.append(float(np.linalg.norm(v_fwd - v_exact)))
        errors_centered.append(float(np.linalg.norm(v_cen - v_exact)))
        errors_richardson.append(float(np.linalg.norm(v_rich - v_exact)))

    # Calcul pour le pas h choisi par l'utilisateur
    h_user = float(dt_input)
    # Bruit GPS / accéléromètre éventuel
    noise = np.random.normal(0, float(noise_amplitude) * 0.05, 3) if float(noise_amplitude) > 0 else np.zeros(3)

    p_p_u = true_pos(t_eval + h_user) + noise
    p_0_u = true_pos(t_eval)
    p_m_u = true_pos(t_eval - h_user) + noise
    p_p2_u = true_pos(t_eval + h_user / 2.0)
    p_m2_u = true_pos(t_eval - h_user / 2.0)

    v_fwd_u = (p_p_u - p_0_u) / h_user
    v_cen_u = (p_p_u - p_m_u) / (2.0 * h_user)
    v_cen2_u = (p_p2_u - p_m2_u) / h_user
    v_rich_u = (4.0 * v_cen2_u - v_cen_u) / 3.0

    a_cen_u = (p_p_u - 2.0 * p_0_u + p_m_u) / (h_user ** 2)
    a_exact = true_acc(t_eval)

    # Discrétisation de l'animation de vol
    dt_anim = max(h_user, 0.05)
    t_flight = np.arange(t_start, t_end + 0.001, dt_anim)
    flight_keyframes = []
    for tf in t_flight:
        pos = true_pos(tf)
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
        "trajectory_type": trajectory_type,
        "radius": radius,
        "altitude": altitude,
        "speed_factor": speed_factor,
        "t_eval": t_eval,
        "t_end": t_end,
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

# -----------------------------------------------------------------------------
# 4. HYDRAULIC DAM RESERVOIR VOLUME SIMULATION
# -----------------------------------------------------------------------------

def hydraulic_dam_volume_simulation(method="simpson", n_slices=10, tolerance=1e-5):
    L = 200.0
    B_max = 80.0
    H_max = 45.0
    k_const = (2.0 / 3.0) * B_max * H_max

    def cross_section_area(x):
        u = max(0.0, min(1.0, x / L))
        return k_const * (1.0 - u ** 1.5) * (1.0 - u)

    exact_volume = k_const * L * (27.0 / 70.0)  # ~ 185142.857 m^3
    result = {}
    slices_data = []

    if method == "trapezoid":
        val = trapezoidal_rule(cross_section_area, 0.0, L, n_slices)
        evals = n_slices + 1
        x_pts = np.linspace(0.0, L, n_slices + 1)
        for x in x_pts:
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
        for x in x_pts:
            u = x / L
            bx = B_max * max(0.0, 1.0 - u ** 1.5)
            hx = H_max * max(0.0, 1.0 - u)
            slices_data.append({"x": float(x), "width": float(bx), "height": float(hx), "area": float(cross_section_area(x))})
        result = {"result": val, "evaluations": evals, "slices": slices_data}

    elif method == "romberg":
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
        for x in asimp_res["points"][:120]:
            u = x / L
            bx = B_max * max(0.0, 1.0 - u ** 1.5)
            hx = H_max * max(0.0, 1.0 - u)
            slices_data.append({"x": float(x), "width": float(bx), "height": float(hx), "area": float(cross_section_area(x))})
        result = {"result": val, "evaluations": evals, "slices": slices_data}

    calculated_volume = result["result"]
    abs_err = abs(calculated_volume - exact_volume)
    rel_err_pct = (abs_err / exact_volume) * 100.0

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
            norm_y = (2.0 * yj / bx) if bx > 0.001 else 0.0
            z_terrain = -hx * (1.0 - norm_y ** 2) if abs(norm_y) <= 1.0 else 0.0
            surface_vertices.append([float(xi), float(yj), float(z_terrain)])
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

# -----------------------------------------------------------------------------
# 5. NEW REAL-WORLD SCENARIO: WIND TURBINE BLADE AERODYNAMIC POWER INTEGRATION
# -----------------------------------------------------------------------------

def wind_turbine_power_simulation(method="simpson", n_elements=16, blade_radius=50.0, wind_speed=12.0):
    """
    Scénario Réel d'Ingénierie Éolienne (Aérodynamique & Énergie Renouvelable):
    Calcul de la puissance mécanique totale extraite par une pale d'éolienne via la théorie
    de l'élément de pale (BEM - Blade Element Momentum).
    Puissance différentielle sur un anneau de rayon r in [R_hub, R_tip]:
       dP(r) = 0.5 * rho * v_rel(r)^3 * C_p(r) * chord(r) * dr
    R_hub = 2.0 m, R_tip = blade_radius (ex: 50 m), rho = 1.225 kg/m3.
    """
    R_hub = 2.5
    R_tip = float(blade_radius)
    V_wind = float(wind_speed)
    rho = 1.225  # kg/m3 masse volumique de l'air
    omega = 2.2  # rad/s vitesse angulaire du rotor (environ 21 RPM)

    def power_density(r):
        """Puissance par unité de longueur dP/dr (W/m)"""
        if r < R_hub or r > R_tip:
            return 0.0
        # Vitesse tangentielle et vitesse relative locale
        v_tan = omega * r
        v_rel = math.sqrt(V_wind**2 + v_tan**2)
        # Profil de corde aérodynamique décroissante c(r)
        chord = 3.5 * (1.0 - 0.65 * (r - R_hub) / (R_tip - R_hub))
        # Coefficient de puissance local avec pertes en bout de pale (Prandtl tip loss)
        mu = (R_tip - r) / (r * math.sin(math.atan2(V_wind, v_tan) + 1e-6))
        f_tip = (2.0 / math.pi) * math.acos(max(0.0, min(1.0, math.exp(-max(0.0, mu)))))
        cp_local = 0.44 * f_tip * math.sin(math.atan2(v_tan, V_wind))
        return 0.5 * rho * (v_rel ** 2) * cp_local * chord * v_tan

    # Référence numérique haute précision (Gauss 60 pts)
    ref_high = gauss_legendre_quadrature(power_density, R_hub, R_tip, 60)
    exact_power_blade = ref_high["result"]

    elements_data = []
    if method == "trapezoid":
        val = trapezoidal_rule(power_density, R_hub, R_tip, n_elements)
        evals = n_elements + 1
        r_pts = np.linspace(R_hub, R_tip, n_elements + 1)
        for r in r_pts:
            elements_data.append({"r": float(r), "dP_dr": float(power_density(r))})
    elif method == "gauss":
        n_g = max(2, min(30, n_elements))
        g_res = gauss_legendre_quadrature(power_density, R_hub, R_tip, n_g)
        val = g_res["result"]
        evals = g_res["evaluations"]
        for r in sorted(g_res["nodes"]):
            elements_data.append({"r": float(r), "dP_dr": float(power_density(r))})
    elif method == "romberg":
        k_level = max(1, min(6, int(math.log2(max(1, n_elements)))))
        r_res = romberg_integration(power_density, R_hub, R_tip, max_k=k_level)
        val = r_res["result"]
        evals = r_res["evaluations"]
        for r in np.linspace(R_hub, R_tip, 2**k_level + 1):
            elements_data.append({"r": float(r), "dP_dr": float(power_density(r))})
    else:  # simpson
        n_ev = n_elements if n_elements % 2 == 0 else n_elements + 1
        val = simpson_rule(power_density, R_hub, R_tip, n_ev)
        evals = n_ev + 1
        r_pts = np.linspace(R_hub, R_tip, n_ev + 1)
        for r in r_pts:
            elements_data.append({"r": float(r), "dP_dr": float(power_density(r))})

    total_power_kw = (val * 3.0) / 1000.0  # 3 pales d'éolienne en kW
    exact_total_kw = (exact_power_blade * 3.0) / 1000.0
    abs_err_kw = abs(total_power_kw - exact_total_kw)
    rel_err_pct = (abs_err_kw / exact_total_kw) * 100.0 if exact_total_kw > 0 else 0.0

    return {
        "method": method,
        "n_elements": n_elements,
        "blade_radius": R_tip,
        "wind_speed": V_wind,
        "power_kw": total_power_kw,
        "exact_power_kw": exact_total_kw,
        "absolute_error_kw": abs_err_kw,
        "relative_error_percent": rel_err_pct,
        "evaluations": evals,
        "blade_elements": elements_data
    }

# -----------------------------------------------------------------------------
# 6. NEW REAL-WORLD SCENARIO: ROCKET / SATELLITE ATMOSPHERIC REENTRY DERIVATION
# -----------------------------------------------------------------------------

def rocket_reentry_trajectory_simulation(dt_input=0.05, noise_amplitude=0.0):
    """
    Scénario Réel d'Aérospatial : Rentrée atmosphérique guidée d'une capsule spatiale.
    Calcul des accélérations et des charges de décélération (Facteur de charge G = |a| / 9.81)
    à partir des positions altimétriques et spatiales échantillonnées.
    Trajectoire 3D hyperbolique amortie par frottement atmosphérique:
       x(t) = 80 - 6.0 * t
       y(t) = 15 * sin(0.4 * t) * exp(-0.08 * t)
       z(t) = 100 * exp(-0.15 * t) + 2.0
    """
    t_start, t_end = 0.0, 18.0

    def true_pos(t):
        return np.array([
            80.0 - 5.0 * t,
            18.0 * np.sin(0.4 * t) * np.exp(-0.06 * t),
            100.0 * np.exp(-0.18 * t) + 1.0
        ])

    def true_vel(t):
        vx = -5.0
        vy = 18.0 * np.exp(-0.06 * t) * (0.4 * np.cos(0.4 * t) - 0.06 * np.sin(0.4 * t))
        vz = -18.0 * np.exp(-0.18 * t)
        return np.array([vx, vy, vz])

    def true_acc(t):
        ax = 0.0
        ay = 18.0 * np.exp(-0.06 * t) * ((0.06**2 - 0.4**2) * np.sin(0.4 * t) - 2 * 0.4 * 0.06 * np.cos(0.4 * t))
        az = 3.24 * np.exp(-0.18 * t)
        return np.array([ax, ay, az])

    t_ref = np.linspace(t_start, t_end, 200)
    ref_path = [true_pos(t).tolist() for t in t_ref]

    t_eval = 6.0  # Pic de décélération maximale (Max-Q)
    v_exact = true_vel(t_eval)
    a_exact = true_acc(t_eval)

    h_user = float(dt_input)
    noise = np.random.normal(0, float(noise_amplitude) * 0.08, 3) if float(noise_amplitude) > 0 else np.zeros(3)

    p_p = true_pos(t_eval + h_user) + noise
    p_0 = true_pos(t_eval)
    p_m = true_pos(t_eval - h_user) + noise
    p_p2 = true_pos(t_eval + h_user / 2.0)
    p_m2 = true_pos(t_eval - h_user / 2.0)

    v_fwd = (p_p - p_0) / h_user
    v_cen = (p_p - p_m) / (2.0 * h_user)
    v_cen2 = (p_p2 - p_m2) / h_user
    v_rich = (4.0 * v_cen2 - v_cen) / 3.0

    a_cen = (p_p - 2.0 * p_0 + p_m) / (h_user ** 2)
    g_load = float(np.linalg.norm(a_cen)) / 9.81
    g_exact = float(np.linalg.norm(a_exact)) / 9.81

    # Animation keyframes
    dt_anim = max(h_user, 0.1)
    t_flight = np.arange(t_start, t_end + 0.001, dt_anim)
    keyframes = []
    for tf in t_flight:
        pos = true_pos(tf)
        p_next = true_pos(tf + dt_anim)
        p_prev = true_pos(tf - dt_anim)
        vel = (p_next - p_prev) / (2.0 * dt_anim)
        acc = (p_next - 2.0 * pos + p_prev) / (dt_anim ** 2)
        keyframes.append({
            "t": round(float(tf), 2),
            "pos": [round(float(pos[0]), 3), round(float(pos[1]), 3), round(float(pos[2]), 3)],
            "vel": [round(float(vel[0]), 3), round(float(vel[1]), 3), round(float(vel[2]), 3)],
            "speed": round(float(np.linalg.norm(vel)), 3),
            "g_force": round(float(np.linalg.norm(acc)) / 9.81, 2)
        })

    return {
        "dt": h_user,
        "t_eval": t_eval,
        "ref_path": ref_path,
        "keyframes": keyframes,
        "current_state": {
            "pos": true_pos(t_eval).tolist(),
            "exact_speed": float(np.linalg.norm(v_exact)),
            "v_forward": v_fwd.tolist(),
            "v_centered": v_cen.tolist(),
            "v_richardson": v_rich.tolist(),
            "error_fwd": float(np.linalg.norm(v_fwd - v_exact)),
            "error_cen": float(np.linalg.norm(v_cen - v_exact)),
            "error_rich": float(np.linalg.norm(v_rich - v_exact)),
            "g_force_numerical": g_load,
            "g_force_exact": g_exact,
            "error_g_force": abs(g_load - g_exact)
        }
    }

# -----------------------------------------------------------------------------
# 7. MULTI-METHOD COST BENCHMARK
# -----------------------------------------------------------------------------

def multi_method_cost_benchmark(shape="dam"):
    if shape == "dam":
        L = 200.0
        B_max = 80.0
        H_max = 45.0
        k_const = (2.0 / 3.0) * B_max * H_max
        f = lambda x: k_const * (1.0 - (x / L) ** 1.5) * (1.0 - x / L)
        a, b = 0.0, L
        exact = k_const * L * (27.0 / 70.0)
    else:
        R = 10.0
        f = lambda z: math.pi * (R**2 - z**2)
        a, b = 0.0, R
        exact = (2.0 / 3.0) * math.pi * (R**3)

    trap_evals, trap_errors = [], []
    for n in [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]:
        res = trapezoidal_rule(f, a, b, n)
        trap_evals.append(n + 1)
        trap_errors.append(max(abs(res - exact), 1e-16))

    simp_evals, simp_errors = [], []
    for n in [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]:
        res = simpson_rule(f, a, b, n)
        simp_evals.append(n + 1)
        simp_errors.append(max(abs(res - exact), 1e-16))

    romb_evals, romb_errors = [], []
    for k in range(1, 9):
        r = romberg_integration(f, a, b, max_k=k)
        romb_evals.append(2**k + 1)
        romb_errors.append(max(abs(r["result"] - exact), 1e-16))

    gauss_evals, gauss_errors = [], []
    for n in [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30]:
        res = gauss_legendre_quadrature(f, a, b, n)
        gauss_evals.append(n)
        gauss_errors.append(max(abs(res["result"] - exact), 1e-16))

    asimp_evals, asimp_errors = [], []
    for tol_exp in [2, 3, 4, 5, 6, 7, 8, 9, 10]:
        tol = 10.0 ** (-tol_exp)
        res = adaptive_simpson(f, a, b, tol=tol)
        asimp_evals.append(res["evaluations"])
        asimp_errors.append(max(abs(res["result"] - exact), 1e-16))

    mc_evals = [50, 100, 250, 500, 1000, 2500, 5000, 10000]
    mc_errors = []
    rng = np.random.default_rng(123)
    for n in mc_evals:
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
