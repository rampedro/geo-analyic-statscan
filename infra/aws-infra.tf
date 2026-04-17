terraform {
  required_version = ">= 1.4.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_prefix" {
  type    = string
  default = "geo-analytics"
}

resource "aws_s3_bucket" "raw_data" {
  bucket = "${var.project_prefix}-raw-data-${random_id.bucket_suffix.hex}"
  acl    = "private"

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket" "curated_data" {
  bucket = "${var.project_prefix}-curated-data-${random_id.bucket_suffix.hex}"
  acl    = "private"

  lifecycle_rule {
    enabled = true
    transitions {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    noncurrent_version_expiration {
      days = 90
    }
  }
}

resource "aws_dynamodb_table" "metadata" {
  name         = "${var.project_prefix}-metadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}

resource "aws_msk_cluster" "kafka" {
  cluster_name = "${var.project_prefix}-msk"
  kafka_version = "3.4.0"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type = var.msk_instance_type
    client_subnets = var.subnet_ids
    security_groups = var.security_group_ids
  }
}

resource "aws_emr_cluster" "spark_job" {
  name          = "${var.project_prefix}-emr"
  release_label = "emr-6.14.0"
  applications  = ["Hadoop", "Spark", "Hive"]
  service_role  = "EMR_DefaultRole"
  ec2_attributes {
    instance_profile = "EMR_EC2_DefaultRole"
    subnet_id        = var.subnet_ids[0]
  }

  master_instance_group {
    instance_type = var.emr_instance_type
    instance_count = 1
  }

  core_instance_group {
    instance_type = var.emr_instance_type
    instance_count = 2
  }
}

resource "aws_glue_catalog_database" "data_lake" {
  name = "geo_analytics_db"
}

resource "aws_glue_crawler" "raw_crawler" {
  name = "${var.project_prefix}-raw-crawler"
  database_name = aws_glue_catalog_database.data_lake.name
  role          = "AWSGlueServiceRole"
  s3_target {
    path = aws_s3_bucket.raw_data.bucket_regional_domain_name
  }
}

resource "aws_sagemaker_model" "analytics_model" {
  name = "${var.project_prefix}-model"
  execution_role_arn = "arn:aws:iam::123456789012:role/SageMakerExecutionRole"
  primary_container {
    image = "382416733822.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:2.0.2-gpu-py310"
    model_data_url = "s3://my-model-bucket/artifacts/model.tar.gz"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}
