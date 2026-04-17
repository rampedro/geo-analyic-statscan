import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
import awswrangler as wr

class GeoPredictor(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super(GeoPredictor, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        return out

def load_training_data():
    df = wr.s3.read_parquet(path="s3://geo-analytics-curated/training_data/")
    features = df[['population', 'area', 'density']].values
    targets = df['growth_rate'].values
    return torch.tensor(features, dtype=torch.float32), torch.tensor(targets, dtype=torch.float32)

def train_model():
    features, targets = load_training_data()
    dataset = TensorDataset(features, targets)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

    model = GeoPredictor(input_size=3, hidden_size=64, output_size=1)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(100):
        for batch_features, batch_targets in dataloader:
            optimizer.zero_grad()
            outputs = model(batch_features)
            loss = criterion(outputs.squeeze(), batch_targets)
            loss.backward()
            optimizer.step()

    torch.save(model.state_dict(), 'geo_predictor.pth')
    return model

if __name__ == "__main__":
    trained_model = train_model()
    print("Model trained and saved.")