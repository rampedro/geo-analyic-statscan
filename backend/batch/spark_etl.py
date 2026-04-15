from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, to_timestamp

SOURCE_PATH = "s3://geo-analytics-raw/ingest/"
CURATED_PATH = "s3://geo-analytics-curated/analytics/"

spark = SparkSession.builder \
    .appName("geo-analytics-spark-etl") \
    .config("spark.sql.shuffle.partitions", "200") \
    .getOrCreate()

schema = "event_id STRING, region_code STRING, event_type STRING, payload MAP<STRING,STRING>, timestamp STRING"


def run_etl():
    raw_df = spark.read.json(SOURCE_PATH)
    enriched_df = raw_df.withColumn("event_ts", to_timestamp(col("timestamp"))) \
        .withColumn("source_layer", col("event_type"))

    curated_df = enriched_df.select(
        col("event_id"),
        col("region_code"),
        col("event_type"),
        col("payload"),
        col("event_ts"),
        col("source_layer"),
    )

    curated_df.write.mode("append").parquet(CURATED_PATH)


if __name__ == "__main__":
    run_etl()
