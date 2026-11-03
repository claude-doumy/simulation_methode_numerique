from django.db import models
import json

class SimulationRecord(models.Model):
    SCENARIO_CHOICES = [
        ("drone_derivative", "Cinématique 3D Drone (Dérivation)"),
        ("dam_volume", "Volume 3D Barrage / Réservoir (Intégration)"),
        ("monte_carlo_3d", "Volume Stochastique 3D (Monte-Carlo)"),
        ("benchmark", "Banc d'Essai Comparatif à Coût Égal"),
    ]

    title = models.CharField(max_length=200, default="Simulation")
    scenario = models.CharField(max_length=50, choices=SCENARIO_CHOICES)
    method = models.CharField(max_length=50, blank=True, default="")
    parameters = models.JSONField(default=dict)
    results = models.JSONField(default=dict)
    evaluations = models.IntegerField(default=0)
    relative_error_percent = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.get_scenario_display()}] - {self.title} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
