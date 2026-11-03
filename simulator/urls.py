from django.urls import path
from . import views

app_name = "simulator"

urlpatterns = [
    path("", views.index, name="index"),
    path("api/drone/", views.api_drone_simulation, name="api_drone"),
    path("api/dam/", views.api_dam_simulation, name="api_dam"),
    path("api/monte-carlo/", views.api_monte_carlo, name="api_monte_carlo"),
    path("api/benchmark/", views.api_benchmark, name="api_benchmark"),
    path("api/save/", views.api_save_simulation, name="api_save"),
    path("api/history/", views.api_get_history, name="api_history"),
    path("export/csv/", views.export_history_csv, name="export_csv"),
    path("export/json/", views.export_history_json, name="export_json"),
]
