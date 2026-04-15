import os
import json
from confluent_kafka import Producer

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC_NAME = os.getenv("KAFKA_TOPIC", "geo-events")

producer = Producer({
    "bootstrap.servers": KAFKA_BOOTSTRAP,
    "client.id": "geo-analytics-producer",
})


def delivery_report(err, msg):
    if err is not None:
        print(f"Delivery failed for record {msg.key()}: {err}")
    else:
        print(f"Message delivered to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}")


def publish_geo_event(event_id: str, region_code: str, event_type: str, payload: dict, timestamp: str):
    record = {
        "event_id": event_id,
        "region_code": region_code,
        "event_type": event_type,
        "payload": payload,
        "timestamp": timestamp,
    }
    producer.produce(TOPIC_NAME, key=event_id, value=json.dumps(record), callback=delivery_report)
    producer.flush(timeout=5)


if __name__ == "__main__":
    publish_geo_event(
        event_id="evt-0001",
        region_code="QC-24",
        event_type="census_snapshot",
        payload={"population": 1250000, "indicator": "growth"},
        timestamp="2026-04-15T12:00:00Z",
    )
