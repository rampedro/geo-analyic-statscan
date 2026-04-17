import tensorflow as tf
from tensorflow import keras
import pandas as pd
import awswrangler as wr

def create_model(input_shape):
    model = keras.Sequential([
        keras.layers.Dense(64, activation='relu', input_shape=input_shape),
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dense(1)
    ])
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model

def load_training_data():
    df = wr.s3.read_parquet(path="s3://geo-analytics-curated/training_data/")
    features = df[['population', 'area', 'density']].values
    targets = df['growth_rate'].values
    return features, targets

def train_tensorflow_model():
    features, targets = load_training_data()

    model = create_model((features.shape[1],))
    model.fit(features, targets, epochs=100, batch_size=32, validation_split=0.2)

    model.save('geo_tensorflow_model.h5')
    return model

if __name__ == "__main__":
    trained_model = train_tensorflow_model()
    print("TensorFlow model trained and saved.")