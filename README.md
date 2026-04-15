# GeoAnalytics Enterprise Platform

## Repository Overview
This repo demonstrates a distributed heterogeneous analytics platform with full architecture, documentation, and sample backend services. It is designed to showcase a cloud-native enterprise-grade system using:
- AWS EMR / Spark
- Kafka / MSK streaming
- AWS Glue and AWS Data Wrangler
- S3 data lakehouses
- DynamoDB NoSQL metadata stores
- SageMaker and Bedrock AI/ML
- Azure Power BI / Microsoft Fabric integration
- Microservices, APIs, and event-driven data workflows

## What is included
- Frontend analytics dashboard built with React and Deck.gl for geospatial insights
- Backend sample microservices in FastAPI for ingestion, Kafka publishing, and metadata lookup
- Kafka producer/consumer examples for event-driven streaming
- Spark ETL sample for batch processing and S3 lakehouse writes
- SageMaker training example and Bedrock inference sample
- Infrastructure template for AWS resources in `infra/aws-infra.tf`
- Architecture and deployment docs in `docs/`
- Documentation panel within the app to surface architecture and platform guidance

## Repository Structure
- `App.tsx`, `components/`: Frontend dashboard and UI panels
- `backend/`: Python backend service and data pipeline examples
- `infra/`: AWS infrastructure design template and resource declarations
- `docs/`: Architecture, deployment, and cloud integration documentation
- `services/`: Data connectors and AI integration services

## Architecture Highlights
- Event-driven ingestion through Kafka topics and MSK
- Spark batch and streaming processing for geospatial analytics
- Data lake architecture with raw and curated S3 zones
- Glue Data Catalog for metadata, ETL jobs, and schema discovery
- DynamoDB for high-throughput metadata and session lookup
- SageMaker for supervised ML training and model registration
- Bedrock for generative inference and textual analytics summaries
- Power BI / Microsoft Fabric for enterprise reporting and KPI visualization

## Getting Started
### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.microservices.data_api:app --reload --host 0.0.0.0 --port 8000
```

### Documentation
Open the dashboard and click the documentation icon in the top-left header to view the architecture summary.
Also review:
- `docs/architecture.md`
- `docs/deployment.md`
- `backend/README.md`

## Cloud & Data Platform Coverage
This project is intentionally broad and representative of hiring expectations for enterprise data architecture:
- AWS: EC2, EMR, S3, Glue, DynamoDB, SageMaker, Bedrock
- Azure: Power BI, Microsoft Fabric, enterprise analytics
- Data Platforms: Spark, Hadoop-compatible EMR, Kafka streaming, NoSQL, lakehouse
- AI/ML: Python, TensorFlow/PyTorch-compatible SageMaker, MLOps-ready training and inference

## Review Notes for Hiring Managers
This repo is structured for review by cloud and data engineering hiring teams:
- Clear architecture documentation
- Strong separation of concerns between frontend, backend, streaming, batch, and ML
- Proof-of-concept code for AWS and Kafka integration
- Documentation of deployment and governance considerations
- Modular, extensible design suitable for enterprise adoption

## License
This repository is provided for demonstration purposes.
