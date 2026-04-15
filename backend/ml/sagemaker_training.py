import os
import boto3
import sagemaker
from sagemaker import Session
from sagemaker.estimator import Estimator
import awswrangler as wr

s3_bucket = os.getenv("SAGEMAKER_BUCKET", "geo-analytics-models")
role_arn = os.getenv("SAGEMAKER_ROLE_ARN", "arn:aws:iam::123456789012:role/SageMakerExecutionRole")
region = os.getenv("AWS_REGION", "us-east-1")

sagemaker_session = Session(boto3.session.Session(region_name=region))


def create_training_job():
    train_input_s3 = f"s3://{s3_bucket}/training/data/"
    output_path = f"s3://{s3_bucket}/training/output/"

    estimator = Estimator(
        image_uri="382416733822.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:2.0.2-gpu-py310",
        role=role_arn,
        instance_count=1,
        instance_type="ml.m5.xlarge",
        volume_size=50,
        output_path=output_path,
        sagemaker_session=sagemaker_session,
    )

    estimator.fit({"training": train_input_s3})
    return estimator.model_data


def register_model(model_data: str):
    sm_client = boto3.client("sagemaker", region_name=region)
    response = sm_client.create_model(
        ModelName="geo-analytics-model",
        PrimaryContainer={
            "Image": "382416733822.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:2.0.2-gpu-py310",
            "ModelDataUrl": model_data,
        },
        ExecutionRoleArn=role_arn,
    )
    return response


def read_training_dataframe():
    df = wr.s3.read_parquet(path=f"s3://{s3_bucket}/training/data/")
    print(df.head())
    return df


if __name__ == "__main__":
    print("Loading training data...")
    read_training_dataframe()
    print("Starting SageMaker training job...")
    create_training_job()
