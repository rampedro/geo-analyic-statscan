# API Documentation

## Data Ingestion API

### POST /ingest
Ingests a geo-statistics event into the system.

**Request Body:**
```json
{
  "event_id": "string",
  "region_code": "string",
  "event_type": "string",
  "payload": "object",
  "timestamp": "string"
}
```

**Response:**
```json
{
  "status": "accepted",
  "event_id": "string"
}
```

### GET /metadata/{event_id}
Retrieves metadata for a specific event.

**Response:**
```json
{
  "event_id": "string",
  "region_code": "string",
  "event_type": "string",
  "status": "string",
  "timestamp": "string"
}
```

## Streaming APIs

- Kafka Topic: `geo-events`
- Producer: Publishes events to topic
- Consumer: Processes events for downstream analytics

## ML APIs

- SageMaker: Model training and deployment
- Bedrock: Generative AI inference for summaries