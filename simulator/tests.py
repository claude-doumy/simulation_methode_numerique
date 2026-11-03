import json
import math
from django.test import TestCase, Client
from django.urls import reverse
from .models import SimulationRecord
from . import numerical_engine as engine

class NumericalEngineTestCase(TestCase):
    def test_finite_difference_centered(self):
        # f(x) = sin(x), f'(1) = cos(1)
        f = math.sin
        exact = math.cos(1.0)
        h = 0.01
        res = engine.finite_difference_centered(f, 1.0, h)
        self.assertAlmostEqual(res, exact, places=4)

    def test_richardson_extrapolation(self):
        # Richardson should give higher order precision
        f = math.sin
        exact = math.cos(1.0)
        h = 0.1
        res_cen = engine.finite_difference_centered(f, 1.0, h)
        res_rich = engine.richardson_extrapolation(f, 1.0, h)
        self.assertLess(abs(res_rich - exact), abs(res_cen - exact))

    def test_simpson_and_trapezoid_integration(self):
        # int_0^1 x^2 dx = 1/3
        f = lambda x: x**2
        exact = 1.0 / 3.0
        trap = engine.trapezoidal_rule(f, 0.0, 1.0, 100)
        simp = engine.simpson_rule(f, 0.0, 1.0, 10)
        self.assertAlmostEqual(trap, exact, places=4)
        self.assertAlmostEqual(simp, exact, places=8)

    def test_romberg_integration(self):
        f = math.exp
        exact = math.e - 1.0
        res = engine.romberg_integration(f, 0.0, 1.0, max_k=4)
        self.assertAlmostEqual(res["result"], exact, places=8)
        self.assertGreater(res["evaluations"], 0)

    def test_gauss_legendre_quadrature(self):
        # Exact for polynomials up to degree 2n-1
        # n = 3 integrates degree 5 exactly: int_0^1 x^5 dx = 1/6
        f = lambda x: x**5
        exact = 1.0 / 6.0
        res = engine.gauss_legendre_quadrature(f, 0.0, 1.0, n=3)
        self.assertAlmostEqual(res["result"], exact, places=10)

    def test_adaptive_simpson(self):
        # Function with local peak
        f = lambda x: 1.0 / (1.0 + 100.0 * (x - 0.5)**2)
        res = engine.adaptive_simpson(f, 0.0, 1.0, tol=1e-5)
        self.assertGreater(res["evaluations"], 10)
        self.assertTrue(len(res["points"]) > 0)

    def test_monte_carlo_3d_sampling(self):
        res = engine.monte_carlo_3d_sampling(shape_type="dome", n_samples=1000, seed=42)
        self.assertAlmostEqual(res["estimated_volume"], res["exact_volume"], delta=25.0)
        self.assertIn("points", res)
        self.assertGreater(len(res["points"]), 0)

    def test_drone_flight_simulation(self):
        data = engine.drone_flight_trajectory_simulation(dt_input=0.1)
        self.assertIn("ref_path", data)
        self.assertIn("flight_keyframes", data)
        self.assertIn("current_state", data)
        self.assertIn("v_curve", data)
        self.assertGreater(len(data["ref_path"]), 50)
        self.assertGreater(data["current_state"]["speed_centered"], 0)

    def test_hydraulic_dam_simulation(self):
        data = engine.hydraulic_dam_volume_simulation(method="simpson", n_slices=10)
        self.assertAlmostEqual(data["calculated_volume"], data["exact_volume"], delta=200.0)
        self.assertIn("terrain_mesh", data)
        self.assertIn("slices", data)


class DjangoViewsAndApiTestCase(TestCase):
    def setUp(self):
        self.client = Client()

    def test_index_page(self):
        response = self.client.get(reverse("simulator:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Simulateur d'Analyse Numérique 3D")
        self.assertContains(response, "canvas3d-container")

    def test_api_drone(self):
        response = self.client.get(reverse("simulator:api_drone"), {"dt": 0.05, "noise": 0.0})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["dt"], 0.05)
        self.assertIn("current_state", data)

    def test_api_dam(self):
        response = self.client.get(reverse("simulator:api_dam"), {"method": "gauss", "slices": 8})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["method"], "gauss")
        self.assertIn("calculated_volume", data)

    def test_api_monte_carlo(self):
        response = self.client.get(reverse("simulator:api_monte_carlo"), {"shape": "torus", "samples": 500})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["shape_type"], "torus")

    def test_api_benchmark(self):
        response = self.client.get(reverse("simulator:api_benchmark"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("series", data)

    def test_api_save_and_history(self):
        payload = {
            "title": "Test Run",
            "scenario": "dam_volume",
            "method": "simpson",
            "parameters": {"slices": 10},
            "results": {"volume": 185118},
            "evaluations": 11,
            "relative_error_percent": 0.012
        }
        res_save = self.client.post(
            reverse("simulator:api_save"),
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(res_save.status_code, 200)
        save_data = res_save.json()
        self.assertEqual(save_data["status"], "success")

        # Verify DB
        record = SimulationRecord.objects.get(id=save_data["id"])
        self.assertEqual(record.title, "Test Run")
        self.assertEqual(record.evaluations, 11)

        # Check history API
        res_hist = self.client.get(reverse("simulator:api_history"))
        self.assertEqual(res_hist.status_code, 200)
        hist_data = res_hist.json()
        self.assertTrue(len(hist_data["history"]) >= 1)

    def test_exports(self):
        # Create a record
        SimulationRecord.objects.create(
            title="Export Test",
            scenario="dam_volume",
            method="trapezoid",
            evaluations=15,
            relative_error_percent=0.2
        )
        # CSV Export
        csv_res = self.client.get(reverse("simulator:export_csv"))
        self.assertEqual(csv_res.status_code, 200)
        self.assertEqual(csv_res["Content-Type"], "text/csv")
        self.assertIn("Export Test", csv_res.content.decode("utf-8"))

        # JSON Export
        json_res = self.client.get(reverse("simulator:export_json"))
        self.assertEqual(json_res.status_code, 200)
        self.assertIn("Export Test", json_res.content.decode("utf-8"))
