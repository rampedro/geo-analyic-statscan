import boto3
import sagemaker
from sagemaker.workflow.pipeline import Pipeline
from sagemaker.workflow.steps import TrainingStep, ProcessingStep
from sagemaker.processing import ScriptProcessor
from sagemaker.estimator import Estimator

def create_ml_pipeline():
    sagemaker_session = sagemaker.Session()
    role = "arn:aws:iam::123456789012:role/SageMakerExecutionRole"

    # Data processing step
    processor = ScriptProcessor(
        image_uri="382416733822.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.0-1-cpu-py3",
        command=["python3"],
        instance_type="ml.m5.xlarge",
        instance_count=1,
        role=role,
        sagemaker_session=sagemaker_session,
    )

    processing_step = ProcessingStep(
        name="DataProcessing",
        processor=processor,
        inputs=[],
        outputs=[],
        code="data_processing.py",
    )

    # Training step
    estimator = Estimator(
        image_uri="382416733822.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:2.0.2-gpu-py310",
        role=role,
        instance_count=1,
        instance_type="ml.m5.xlarge",
        output_path="s3://geo-analytics-models/output/",
        sagemaker_session=sagemaker_session,
    )

    training_step = TrainingStep(
        name="ModelTraining",
        estimator=estimator,
        inputs={
            "training": "s3://geo-analytics-curated/training_data/",
        },
    )

    # Create pipeline
    pipeline = Pipeline(
        name="geo-analytics-ml-pipeline",
        steps=[processing_step, training_step],
        sagemaker_session=sagemaker_session,
    )

    return pipeline

if __name__ == "__main__":
    pipeline = create_ml_pipeline()
    pipeline.upsert(role_arn="arn:aws:iam::123456789012:role/SageMakerExecutionRole")
    execution = pipeline.start()
    print(f"Pipeline execution started: {execution.arn}")