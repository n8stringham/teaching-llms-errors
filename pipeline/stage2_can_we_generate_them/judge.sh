#!/bin/bash

#SBATCH --account=
#SBATCH --partition=
#SBATCH --ntasks=1
#SBATCH --time=
#SBATCH --mem=20G
#SBATCH --mail-type=FAIL,END
#SBATCH -o logs/judge%j

## start time
date


# HF Cache
export TRANSFORMERS_CACHE=""
export HF_DATASETS_CACHE=""
export HF_HOME=""
pwd
# mathcamps
python judge.py --seed 1 --path "generated_failure_patterns/mathcamps/error_landscapes_erthresh=0.5/landscape=claude-3-haiku-20240307_specified=True/direct-response_cot.json"
# mmlu
python judge-mmlu.py --seed 1 --path "generated_failure_patterns/mathcamps/error_landscapes_erthresh=0.5/landscape=claude-3-haiku-20240307_specified=True/direct-response_cot.json"
date