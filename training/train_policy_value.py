from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

ACTION_COUNT = 2736
PLANE_COUNT = 16
BOARD_SIZE = 6


@dataclass
class Sample:
    planes: np.ndarray
    policy_indices: np.ndarray
    policy_values: np.ndarray
    value: float


class SelfPlayDataset(Dataset[Sample]):
    def __init__(self, path: Path):
        self.samples: list[Sample] = []

        for line in path.read_text("utf8").splitlines():
            if not line.strip():
                continue

            payload = json.loads(line)
            self.samples.append(
                Sample(
                    planes=np.asarray(payload["planes"], dtype=np.float32).reshape(
                        PLANE_COUNT, BOARD_SIZE, BOARD_SIZE
                    ),
                    policy_indices=np.asarray(
                        [entry["index"] for entry in payload["policy"]], dtype=np.int64
                    ),
                    policy_values=np.asarray(
                        [entry["probability"] for entry in payload["policy"]], dtype=np.float32
                    ),
                    value=float(payload["value"]),
                )
            )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> Sample:
        return self.samples[index]


class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.relu(x + self.layers(x))


class PolicyValueNet(nn.Module):
    def __init__(self, channels: int = 32, blocks: int = 4):
        super().__init__()
        body = [
            nn.Conv2d(PLANE_COUNT, channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        ]
        body.extend(ResidualBlock(channels) for _ in range(blocks))
        self.body = nn.Sequential(*body)
        self.policy_head = nn.Sequential(
            nn.Conv2d(channels, 2, kernel_size=1, bias=False),
            nn.BatchNorm2d(2),
            nn.ReLU(inplace=True),
            nn.Flatten(),
            nn.Linear(2 * BOARD_SIZE * BOARD_SIZE, ACTION_COUNT),
        )
        self.value_head = nn.Sequential(
            nn.Conv2d(channels, 1, kernel_size=1, bias=False),
            nn.BatchNorm2d(1),
            nn.ReLU(inplace=True),
            nn.Flatten(),
            nn.Linear(BOARD_SIZE * BOARD_SIZE, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
            nn.Tanh(),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        hidden = self.body(x)
        return self.policy_head(hidden), self.value_head(hidden)


def collate(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    planes = torch.tensor(np.stack([sample.planes for sample in samples]), dtype=torch.float32)
    dense_policy = torch.zeros((len(samples), ACTION_COUNT), dtype=torch.float32)

    for row, sample in enumerate(samples):
        if sample.policy_indices.size:
            dense_policy[row, sample.policy_indices] = torch.tensor(
                sample.policy_values, dtype=torch.float32
            )

    values = torch.tensor([[sample.value] for sample in samples], dtype=torch.float32)
    return planes, dense_policy, values


def train(args: argparse.Namespace) -> None:
    dataset = SelfPlayDataset(Path(args.input))
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True, collate_fn=collate)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = PolicyValueNet().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=1e-4)
    mse_loss = nn.MSELoss()

    for epoch in range(args.epochs):
        model.train()
        epoch_loss = 0.0

        for planes, policy_targets, value_targets in loader:
            planes = planes.to(device)
            policy_targets = policy_targets.to(device)
            value_targets = value_targets.to(device)

            optimizer.zero_grad(set_to_none=True)
            policy_logits, value_pred = model(planes)
            log_probs = torch.log_softmax(policy_logits, dim=1)
            policy_loss = -(policy_targets * log_probs).sum(dim=1).mean()
            value_loss = mse_loss(value_pred, value_targets)
            loss = policy_loss + value_loss
            loss.backward()
            optimizer.step()
            epoch_loss += float(loss.item())

        print(f"epoch={epoch + 1} loss={epoch_loss / max(1, len(loader)):.4f}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sample_input = torch.zeros((1, PLANE_COUNT, BOARD_SIZE, BOARD_SIZE), dtype=torch.float32).to(device)
    model.eval()
    torch.onnx.export(
      model,
      sample_input,
      output,
      input_names=["input"],
      output_names=["policy", "value"],
      dynamic_axes={"input": {0: "batch"}, "policy": {0: "batch"}, "value": {0: "batch"}},
      opset_version=17,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    train(parser.parse_args())


if __name__ == "__main__":
    main()
