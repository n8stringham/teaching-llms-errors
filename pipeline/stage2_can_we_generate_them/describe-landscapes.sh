#!/bin/bash
#SBATCH --account=
#SBATCH --partition=
#SBATCH --ntasks=1
#SBATCH --time=
#SBATCH --mem=20G
#SBATCH --mail-type=FAIL,END
#SBATCH -o logs/describe-landscape%j

# HF Cache
export TRANSFORMERS_CACHE=""
export HF_DATASETS_CACHE=""

# List of models to analyze
MODELS=(
    "gpt-4o-2024-05-13"
    "gpt-3.5-turbo-0125"
    "claude-3-haiku-20240307"
    "claude-3-sonnet-20240229"
    "claude-3-opus-20240229"
)

METHODS=(
    "direct"
    "d5"
    "integrai"
)

DATASETS=(
    "mathcamps"
    "mmlu-math"
    "mmlu-health"
)

OUT_DIR="generated_failure_patterns"

# Loop over models and run the script for each
for model in "${MODELS[@]}"; do
    for method in "${METHODS[@]}"; do
        for dataset in "${DATASETS[@]}"; do
            echo "Running analysis for model: $model, method: $method, dataset $dataset"
            # where number of hypotheses to generate is given in prompt
            python stage2_can_we_generate_them/describe-landscapes.py --dataset "$dataset" --method "$method" --model_to_analyze "$model" --num_gold_specified --path_dir "$OUT_DIR"
            # Plus CoT
            python stage2_can_we_generate_them/describe-landscapes.py --dataset "$dataset" --method "$method" --model_to_analyze "$model" --num_gold_specified --include_cot --path_dir "$OUT_DIR"
        done
    done
done
date