# teaching-llms-errors

## The AI-Integration Teaching Pipeline
The `pipeline/` folder contains code for running experiments for Stages 1&2 found in the paper: 

### Analyzing existence of failure patterns worth-teaching using meta-labels
Related code can be found in `stage1_do_errors_exist`
* `dataset-model-analysis.ipynb` contains code for analyzing the existence of sizable groups of failure patterns represented by meta-labels for MMLU and MathCAMPs.

### Generating Failure Patterns
`describe-landscape.py` is used to generate candidate failure patterns for a model and dataset pair. 

For example, from the `pipeline/` directory run:

`$ python stage2_can_we_generate_them/describe-landscapes.py --'mathcamps' --method "direct" --model_to_analyze "claude-3-haiku-20240307" --num_gold_specified --path_dir "generated_failue_patterns"`

You can then score them with the LLM judge for mathcamps failure patterns by running:
`$ python judge.py --seed 1 --path "generated_failure_patterns/mathcamps/error_landscapes_erthresh=0.5/landscape=claude-3-haiku-20240307_specified=True/direct-response_cot.json"`

and for mmlu failure patterns by running:

`$ python judge-mmlu.py --seed 1 --path "generated_failure_patterns/mathcamps/error_landscapes_erthresh=0.5/landscape=claude-3-haiku-20240307_specified=True/direct-response_cot.json"$"`


* template slurm scripts are provided: `describe-single.sh`, `describe-landscapes.sh`, `judge.sh`. These should be run from the `pipeline/` directory.

## Teaching Generated Failure Patterns to Users
Templates for teaching people can be found in the `user_study`directory

Firebase project templates for our user study measuring the effectiveness of the AI-Integration teaching pipeline can be found in the `user_study` directory. 
`study-S3` contains templates with teaching and `study-S5` contains templates without teaching.