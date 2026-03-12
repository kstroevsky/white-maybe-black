# AI Training Pipeline

This directory contains the offline training path for the optional policy/value guidance model.

## Flow

1. Generate self-play data from the TypeScript engine:

```bash
npm run ai:selfplay -- --games=64 --difficulty=hard --out=output/training/self-play.jsonl
```

2. Create a virtual environment and install Python dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r training/requirements.txt
```

3. Train and export the ONNX model:

```bash
python3 training/train_policy_value.py \
  --input output/training/self-play.jsonl \
  --output public/models/ai-policy-value.onnx
```

The browser worker looks for `public/models/ai-policy-value.onnx`. If the file is missing, the AI falls back to the heuristic engine automatically.
