from django.test import TestCase, Client
from django.urls import reverse
import json
import math
from .models import SimulationRecord
from . import numerical_engine as engine

class NumericalEngineTests(TestCase):
    def test_finite_difference_forward(self):
        f = lambda x: x**2
        df = engine.finite_difference_forward(f, 2.0, 1e-5)
        self.assertAlmostEqual(df, 4.0, places=4)

    def test_finite_difference_centered(self):
        f = lambda x: math.sin(x)
        df = engine.finite_difference_centered(f, 0.0, 1e-4)
        self.assertAlmostEqual(df, 1.0, places=6)

    def test_richardson_extrapolation(self):
        f = lambda x: math.exp(x)
        df = engine.richardson_extrapolation(f, 1.0, 1e-2)
        self.assertAlmostEqual(df, math.e, places=7)

    def test_trapezoidal_rule(self):
        f = lambda x: x**3
        integ = engine.trapezoidal_rule(f, 0.0, 2.0, 100)
        self.assertAlmostEqual(integ, 4.0, places=2)

    def test_simpson_rule(self):
        f = lambda x: x**3
        integ = engine.simpson_rule(f, 0.0, 2.0, 20)
        self.assertAlmostEqual(integ, 4.0, places=6)

    def test_gauss_legendre_quadrature(self):
        f = lambda x: 3 * x**2
        res = engine.gauss_legendre_quadrature(f, 0.0, 2.0, 3)
        self.assertAlmostEqual(res["result"], 8.0, places=8)

    def test_adaptive_simpson(self):
        f = lambda x: math.sin(x)
        res = engine.adaptive_simpson(f, 0.0, math.pi, tol=1e-6)
        self.assertAlmostEqual(res["result"], 2.0, places=5)

    def test_drone_simulation_trajectories(self):
        for traj in ["helix", "figure8", "spiral", "slalom"]:
            data = engine.drone_flight_trajectory_simulation(trajectory_type=traj)
            self.assertIn("ref_path", data)
            self.assertIn("flight_keyframes", data)
            self.assertIn("v_curve", data)
            self.assertGreater(len(data["flight_keyframes"]), 10)

    def test_dam_simulation(self):
        data = engine.hydraulic_dam_volume_simulation(method="simpson", n_slices=10)
        self.assertIn("calculated_volume", data)
        self.assertGreater(data["calculated_volume"], 100000)
        self.assertIn("terrain_mesh", data)

    def test_wind_turbine_simulation(self):
        data = engine.wind_turbine_power_simulation(method="simpson", n_elements=16)
        self.assertIn("power_kw", data)
        self.assertGreater(data["power_kw"], 100.0)

    def test_rocket_reentry_simulation(self):
        data = engine.rocket_reentry_trajectory_simulation(dt_input=0.05)
        self.assertIn("keyframes", data)
        self.assertIn("current_state", data)
        self.assertGreater(data["current_state"]["g_force_numerical"], 0.0)

    def test_monte_carlo_sampling(self):
        data = engine.monte_carlo_3d_sampling(shape_type="dome", n_samples=1000, seed=123)
        self.assertIn("estimated_volume", data)
        self.assertIn("ci95", data)
        self.assertGreater(data["estimated_volume"], 200.0)
        self.assertLess(data["estimated_volume"], 320.0)


class ViewsAndApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_index_view(self):
        response = self.client.get(reverse("simulator:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Simulateur d'Analyse Numérique 3D")

    def test_api_drone(self):
        response = self.client.get(reverse("simulator:api_drone"), {"trajectory": "figure8", "dt": "0.1"})
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertIn("current_state", json_data)

    def test_api_dam(self):
        response = self.client.get(reverse("simulator:api_dam"), {"method": "gauss", "slices": "8"})
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertIn("calculated_volume", json_data)

    def test_api_turbine(self):
        response = self.client.get(reverse("simulator:api_turbine"), {"elements": "12"})
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertIn("power_kw", json_data)

    def test_api_rocket(self):
        response = self.client.get(reverse("simulator:api_rocket"), {"dt": "0.05"})
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertIn("keyframes", json_data)

    def test_api_save_and_history(self):
        payload = {
            "title": "Test Run Turbine",
            "scenario": "drone_differentiation",
            "method": "simpson",
            "evaluations": 25,
            "relative_error_percent": 0.012
        }
        post_resp = self.client.post(
            reverse("simulator:api_save"),
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(post_resp.status_code, 200)

        hist_resp = self.client.get(reverse("simulator:api_history"))
        self.assertEqual(hist_resp.status_code, 200)
        hist_data = hist_resp.json()
        self.assertEqual(len(hist_data["history"]), 1)

    def test_csv_and_json_exports(self):
        SimulationRecord.objects.create(
            title="Export Test",
            scenario="dam_volume",
            method="romberg",
            evaluations=17,
            relative_error_percent=0.005
        )
        csv_resp = self.client.get(reverse("simulator:export_csv"))
        self.assertEqual(csv_resp.status_code, 200)
        self.assertIn(b"Export Test", csv_resp.content)

        json_resp = self.client.get(reverse("simulator:export_json"))
        self.assertEqual(json_resp.status_code, 200)
        self.assertIn(b"Export Test", json_resp.content)
