import os
import boto3

region = os.getenv("AWS_REGION", "us-east-1")
model_id = os.getenv("BEDROCK_MODEL_ID", "amazon.titan-text-v1")

client = boto3.client("bedrock", region_name=region)


def generate_summary(prompt: str):
    response = client.invoke_model(
        modelId=model_id,
        body={
            "inputText": prompt,
        },
    )
    return response["body"].read().decode("utf-8")


if __name__ == "__main__":
    sample_prompt = (
        "Analyze the latest geo-statistical event stream and summarize the highest risk regions "
        "for infrastructure demand. Include key drivers and recommended actions."
    )
    print(generate_summary(sample_prompt))
