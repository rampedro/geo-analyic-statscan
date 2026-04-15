# Backend Services

This directory contains the backend and data pipeline examples for the GeoAnalytics platform.

## Components
- `microservices/data_api.py`: FastAPI service that ingests events, publishes them to Kafka, and stores event metadata in DynamoDB.
- `streaming/kafka_producer.py`: Kafka producer sample for geo-event publishing.
- `streaming/kafka_consumer.py`: Kafka consumer sample for downstream processing.
- `batch/spark_etl.py`: Spark ETL job that reads raw S3 data and writes curated parquet output.
- `ml/sagemaker_training.py`: SageMaker training and model registration example using AWS Data Wrangler.
- `ml/bedrock_inference.py`: AWS Bedrock inference sample for enterprise LLM-driven analytics.

## Getting started
1. Create a Python virtual environment.
2. Install dependencies:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```
3. Run the API server:
   ```bash
   uvicorn backend.microservices.data_api:app --reload --host 0.0.0.0 --port 8000
   ```
4. Run the Kafka producer or consumer examples after configuring `KAFKA_BOOTSTRAP_SERVERS`.

## Notes
- These examples are designed as architecture proofs-of-concept, not production deployment scripts.
- Use IAM roles, secure secrets, and environment variables when deploying to AWS.
