import os
import json
from confluent_kafka import Consumer

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC_NAME = os.getenv("KAFKA_TOPIC", "geo-events")
GROUP_ID = os.getenv("KAFKA_GROUP", "geo-analytics-consumer")

consumer = Consumer({
    "bootstrap.servers": KAFKA_BOOTSTRAP,
    "group.id": GROUP_ID,
    "auto.offset.reset": "earliest",
})


def process_record(record):
    event = json.loads(record.value().decode("utf-8"))
    print(f"Processing event {event['event_id']} for region {event['region_code']}")
    # Insert downstream logic: enrich, write to S3, update DynamoDB, or forward to Spark


def run_consumer():
    consumer.subscribe([TOPIC_NAME])
    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                print(f"Consumer error: {msg.error()}")
                continue
            process_record(msg)
    finally:
        consumer.close()


if __name__ == "__main__":
    run_consumer()
