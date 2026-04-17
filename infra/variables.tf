variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "geo-analytics"
}

variable "vpc_id" {
  description = "VPC ID for resources"
  type        = string
  default     = "vpc-12345678"
}

variable "subnet_ids" {
  description = "Subnet IDs for EMR and MSK"
  type        = list(string)
  default     = ["subnet-abc123", "subnet-def456"]
}

variable "security_group_ids" {
  description = "Security groups for MSK"
  type        = list(string)
  default     = ["sg-xyz123"]
}

variable "emr_instance_type" {
  description = "Instance type for EMR"
  type        = string
  default     = "m5.xlarge"
}

variable "msk_instance_type" {
  description = "Instance type for MSK"
  type        = string
  default     = "kafka.m5.large"
}