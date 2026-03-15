#!/bin/bash

#SBATCH --account=
#SBATCH --partition=
#SBATCH --ntasks=1
#SBATCH --time=
#SBATCH --mem=
#SBATCH -o logs/describe-landscape%j

## start timestamp
date
# Sourcd and activate your env

# HF Cache
export TRANSFORMERS_CACHE=""
export HF_DATASETS_CACHE=""

# List of models to analyze
MODEL="gpt-4o-2024-05-13"
METHOD="direct"
OUT_DIR="generated_failure_patterns"

echo "Running analysis for model: $MODEL, method: $METHOD"
# Run with number of hypotheses to generate given in prompt and CoT
python stage2_can_we_generate_them/describe-landscapes.py --dataset 'mathcamps' --method "$METHOD" --model_to_analyze "$MODEL" --num_gold_specified --path_dir "$OUT_DIR"
# Same but without CoT
python stage2_can_we_generate_them/describe-landscapes.py --dataset 'mathcamps' --method "$method" --model_to_analyze "$model" --num_gold_specified --path_dir "$OUT_DIR" --include_cot

date