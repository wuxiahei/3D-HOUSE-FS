from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

SAMPLE_LAYOUT = {
    "schemaVersion": 2,
    "id": "layout-test",
    "templateId": "compact-two-room",
    "metadata": {
        "projectName": "Test layout",
        "address": "Shanghai test road 18",
        "latitude": 31.23,
        "longitude": 121.47,
        "timezone": "Asia/Shanghai",
        "buildYear": 2019,
        "renovationYear": 2024,
    },
    "bounds": {"width": 8.8, "depth": 6.8, "height": 2.9},
    "orientation": {
        "facingDegrees": 135,
        "facingLabel": "SE",
        "frontDoorDegrees": 90,
        "frontDoorLabel": "E",
    },
    "rooms": [
        {
            "id": "living",
            "name": "Living",
            "purpose": "living",
            "origin": {"x": 0.5, "y": 0.5},
            "width": 4.6,
            "depth": 3.5,
            "level": 1,
        }
    ],
    "walls": [],
    "openings": [
        {
            "id": "entry-door",
            "type": "door",
            "wallId": "living-east",
            "width": 1.0,
            "height": 2.1,
            "offset": 0.4,
        }
    ],
    "sensors": [
        {"id": "sensor-a", "label": "A", "x": 1.6, "y": 1.2, "temperature": 26.0},
        {"id": "sensor-b", "label": "B", "x": 3.2, "y": 2.4, "temperature": 25.2},
    ],
    "devices": [
        {
            "id": "ac-1",
            "type": "ac",
            "roomId": "living",
            "label": "AC",
            "x": 2.4,
            "y": 1.1,
            "directionDegrees": 180,
            "strength": 0.7,
            "temperatureDelta": -4.0,
        }
    ],
    "weather": {
        "windDirection": 120,
        "windSpeed": 3.2,
        "outdoorTemperature": 31,
    },
}


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["simulation"] == "browser-authoritative"


def test_fengshui_analysis() -> None:
    response = client.post("/analyze/fengshui", json=SAMPLE_LAYOUT)
    payload = response.json()
    assert response.status_code == 200
    assert "fengshui" in payload
    assert payload["simulation"] == "browser-authoritative"


def test_removed_duplicate_simulation_endpoints() -> None:
    assert client.post("/analyze/complete", json=SAMPLE_LAYOUT).status_code == 404
    assert client.post("/analyze/heatmap", json=SAMPLE_LAYOUT).status_code == 404
    assert client.post("/analyze/airflow", json=SAMPLE_LAYOUT).status_code == 404
