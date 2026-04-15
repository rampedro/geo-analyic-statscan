# Deployment and Environment Setup

## Local Development
1. Install Node.js 18+ and Python 3.11+.
2. Install frontend dependencies:
   ```bash
   npm install
   npm run dev
   ```
3. Install backend dependencies:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```
4. Run the FastAPI microservice:
   ```bash
   uvicorn backend.microservices.data_api:app --reload --host 0.0.0.0 --port 8000
   ```

## AWS Deployment
This repository includes Terraform-style infrastructure in `infra/aws-infra.tf`.
It is intended as a design template for AWS resources:
- S3 data lake buckets
- MSK Kafka cluster
- EMR cluster for Spark jobs
- Glue data catalog and crawler
- DynamoDB metadata store
- SageMaker model assets

### Recommended deployment sequence
1. Create S3 buckets and base IAM roles
2. Deploy MSK and EMR with networking and security groups
3. Provision Glue catalog and crawler definitions
4. Create DynamoDB table and Glue jobs
5. Train SageMaker model and register the endpoint
6. Enable Bedrock inference integration

## Azure Reporting
For Azure / Microsoft Fabric:
- Provision a Fabric workspace or Power BI service
- Connect to S3 data lake via Snowflake connector, Redshift, or external dataflow
- Publish dashboards that surface geo-analytics, model predictions, and KPI reports

## Documentation Tab
The dashboard includes a documentation panel through the `DocumentationPanel` component.
It provides a quick entry point for reviewers to understand architecture, cloud services, and analytics strategy.

## Security and Best Practices
- Use least-privilege IAM policies for all AWS services
- Store secrets in AWS Secrets Manager or Azure Key Vault
- Use environment variables for local development and CI
- Keep production and staging infrastructure isolated
- Enable CloudWatch logs and metrics for monitoring and alerting
