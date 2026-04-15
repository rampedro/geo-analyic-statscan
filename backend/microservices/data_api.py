import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from confluent_kafka import Producer
import boto3

app = FastAPI(title="GeoAnalytics Data API")

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "GeoAnalyticsMetadata")
TOPIC_NAME = os.getenv("KAFKA_TOPIC", "geo-events")

producer_config = {
    "bootstrap.servers": KAFKA_BOOTSTRAP,
    "client.id": "geo-analytics-api",
}
producer = Producer(producer_config)

dynamodb = boto3.resource("dynamodb")
metadata_table = dynamodb.Table(DYNAMODB_TABLE)

class GeoEvent(BaseModel):
    event_id: str
    region_code: str
    event_type: str
    payload: dict
    timestamp: str

@app.post("/ingest")
def ingest_event(event: GeoEvent):
    """Ingest a geo-statistics event and publish into Kafka for downstream processing."""
    try:
        producer.produce(TOPIC_NAME, key=event.event_id, value=event.json())
        producer.flush(timeout=10)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Kafka publish failed: {exc}")

    metadata_table.put_item(Item={
        "event_id": event.event_id,
        "region_code": event.region_code,
        "event_type": event.event_type,
        "status": "ingested",
        "timestamp": event.timestamp,
    })

    return {"status": "accepted", "event_id": event.event_id}

@app.get("/metadata/{event_id}")
def get_metadata(event_id: str):
    response = metadata_table.get_item(Key={"event_id": event_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Event metadata not found")
    return item

@app.get("/health")
def health_check():
    return {"status": "ok", "kafka_bootstrap": KAFKA_BOOTSTRAP, "dynamodb_table": DYNAMODB_TABLE}
