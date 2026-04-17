import pytest
from fastapi.testclient import TestClient
from backend.microservices.data_api import app

client = TestClient(app)

def test_ingest_event():
    event = {
        "event_id": "test-123",
        "region_code": "QC-24",
        "event_type": "census",
        "payload": {"population": 1000000},
        "timestamp": "2023-01-01T00:00:00Z"
    }
    response = client.post("/ingest", json=event)
    assert response.status_code == 200
    assert response.json()["event_id"] == "test-123"