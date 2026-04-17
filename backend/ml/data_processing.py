import pandas as pd
import awswrangler as wr
from sklearn.preprocessing import StandardScaler

def main():
    # Load raw data
    df = wr.s3.read_parquet(path="s3://geo-analytics-raw/data/")

    # Data preprocessing
    scaler = StandardScaler()
    numerical_cols = ['population', 'area', 'density']
    df[numerical_cols] = scaler.fit_transform(df[numerical_cols])

    # Save processed data
    wr.s3.to_parquet(
        df=df,
        path="s3://geo-analytics-curated/training_data/",
        index=False
    )

if __name__ == "__main__":
    main()