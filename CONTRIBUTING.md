# Contributing to GeoAnalytics Enterprise Platform

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   pip install -r backend/requirements.txt
   ```
3. Start local services:
   ```bash
   docker-compose up -d
   ```
4. Run the application:
   ```bash
   npm run dev
   uvicorn backend.microservices.data_api:app --reload
   ```

## Code Standards

- Follow TypeScript/React best practices
- Use Python type hints
- Write tests for new features
- Update documentation for API changes

## Architecture Guidelines

- Microservices should be stateless and API-first
- Use event-driven patterns for data flow
- Ensure cloud-native design with AWS/Azure integration
- Follow TOGAF principles for enterprise architecture

## Testing

- Run frontend tests: `npm test`
- Run backend tests: `pytest backend/`
- Ensure CI passes before merging

## Deployment

- Use Terraform for infrastructure
- Containerize services with Docker
- Follow MLOps practices for ML components