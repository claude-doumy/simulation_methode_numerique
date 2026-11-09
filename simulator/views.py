import json
import csv
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from .models import SimulationRecord
from . import numerical_engine as engine

def index(request):
    """Page d'accueil du simulateur 3D interactif"""
    history = SimulationRecord.objects.all()[:15]
    return render(request, "simulator/index.html", {"history": history})

def api_drone_simulation(request):
    """Calcul de la trajectoire et cinématique 3D du drone avec personnalisation"""
    dt = float(request.GET.get("dt", 0.1))
    noise = float(request.GET.get("noise", 0.0))
    traj_type = request.GET.get("trajectory", "helix")
    radius = float(request.GET.get("radius", 15.0))
    altitude = float(request.GET.get("altitude", 10.0))
    speed_factor = float(request.GET.get("speed_factor", 1.0))
    data = engine.drone_flight_trajectory_simulation(
        dt_input=dt,
        noise_amplitude=noise,
        trajectory_type=traj_type,
        radius=radius,
        altitude=altitude,
        speed_factor=speed_factor
    )
    return JsonResponse(data)

def api_dam_simulation(request):
    """Calcul du volume du barrage / réservoir hydraulique"""
    method = request.GET.get("method", "simpson")
    n_slices = int(request.GET.get("slices", 10))
    tol = float(request.GET.get("tolerance", 1e-5))
    data = engine.hydraulic_dam_volume_simulation(method=method, n_slices=n_slices, tolerance=tol)
    return JsonResponse(data)

def api_turbine_simulation(request):
    """Calcul aérodynamique de la puissance d'une éolienne"""
    method = request.GET.get("method", "simpson")
    n_elements = int(request.GET.get("elements", 16))
    blade_radius = float(request.GET.get("radius", 50.0))
    wind_speed = float(request.GET.get("wind_speed", 12.0))
    data = engine.wind_turbine_power_simulation(
        method=method,
        n_elements=n_elements,
        blade_radius=blade_radius,
        wind_speed=wind_speed
    )
    return JsonResponse(data)

def api_rocket_simulation(request):
    """Calcul cinématique et facteur de charge G lors d'une rentrée spatiale"""
    dt = float(request.GET.get("dt", 0.05))
    noise = float(request.GET.get("noise", 0.0))
    data = engine.rocket_reentry_trajectory_simulation(dt_input=dt, noise_amplitude=noise)
    return JsonResponse(data)

def api_monte_carlo(request):
    """Simulation Monte-Carlo 3D pour géométries complexes"""
    shape = request.GET.get("shape", "dome")
    n_samples = int(request.GET.get("samples", 2000))
    seed = int(request.GET.get("seed", 42))
    data = engine.monte_carlo_3d_sampling(shape_type=shape, n_samples=n_samples, seed=seed)
    return JsonResponse(data)

def api_benchmark(request):
    """Banc d'essai à coût égal"""
    shape = request.GET.get("shape", "dam")
    data = engine.multi_method_cost_benchmark(shape=shape)
    return JsonResponse(data)

@csrf_exempt
def api_save_simulation(request):
    """Sauvegarde d'un run de simulation en base de données"""
    if request.method == "POST":
        try:
            payload = json.loads(request.body)
            record = SimulationRecord.objects.create(
                title=payload.get("title", "Run de simulation"),
                scenario=payload.get("scenario", "dam_volume"),
                method=payload.get("method", ""),
                parameters=payload.get("parameters", {}),
                results=payload.get("results", {}),
                evaluations=int(payload.get("evaluations", 0)),
                relative_error_percent=payload.get("relative_error_percent")
            )
            return JsonResponse({"status": "success", "id": record.id, "created_at": record.created_at.strftime("%H:%M:%S")})
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
    return JsonResponse({"status": "error", "message": "POST required"}, status=405)

def api_get_history(request):
    """Récupère l'historique récent des simulations"""
    records = SimulationRecord.objects.all()[:20]
    data = []
    for r in records:
        data.append({
            "id": r.id,
            "title": r.title,
            "scenario": r.get_scenario_display(),
            "method": r.method,
            "evaluations": r.evaluations,
            "error_pct": r.relative_error_percent,
            "created_at": r.created_at.strftime("%d/%m/%Y %H:%M:%S")
        })
    return JsonResponse({"history": data})

def export_history_csv(request):
    """Exportation CSV de l'historique des calculs"""
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="historique_simulations_numeriques.csv"'

    writer = csv.writer(response)
    writer.writerow(["ID", "Scénario", "Titre", "Méthode", "Évaluations (N_eval)", "Erreur Relative (%)", "Date/Heure"])

    for r in SimulationRecord.objects.all():
        writer.writerow([
            r.id,
            r.get_scenario_display(),
            r.title,
            r.method,
            r.evaluations,
            f"{r.relative_error_percent:.6f}%" if r.relative_error_percent is not None else "N/A",
            r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])

    return response

def export_history_json(request):
    """Exportation JSON de l'historique complet des simulations"""
    records = list(SimulationRecord.objects.all().values())
    response = JsonResponse(records, safe=False)
    response["Content-Disposition"] = 'attachment; filename="historique_simulations_numeriques.json"'
    return response
