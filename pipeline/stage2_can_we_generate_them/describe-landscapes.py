# Query OpenAI models to generate descriptions of error groups
import json
import openai
from openai import OpenAI
from typing import List, Dict, Callable
import pandas as pd
import yaml
import argparse
import numpy as np
import os
import sys
sys.path.append('')
from utils import calculate_error_metrics, load_mathcamps_data, generate_prompt, query_openai, fit_in_context, df_to_dict
from stage1_do_errors_exist.Dataset import MMLUDataset
from collections import Counter


from D5.D5 import D5
from D5.validator import DummyValidator, Validator, OpenAIValidator
from D5.lm_proposer import GPT3_Proposer
import pickle as pkl


# IntegrAI imports
from integrai.integrai import IntegrAI
from integrai.embedding_funcs import get_text_embeddings_text
from integrai.utils import *


def describe_errors(input_obj, model="gpt-4o-2024-08-06"):
    '''Given an input object, query openai model to generate candidate error descriptions and add to input obj'''
    prompt = input_obj['prompt']
    response = query_openai(prompt, model=model, t=0.7)
    # add the response to the input
    response_item = json.loads(response.choices[0].message.content)
    input_obj['response'] = response_item

    return input_obj


def create_problem(df, cot=False, subset=None) -> None:
    '''
    Format dataframe based as a problem for D5 based on whether an instance has a specific property of interest
    direction - whether groupA is instances where AI was "wrong" or "correct"
    p - name of the property column in the dataframe if filtering by a specific property
    include_answer_choices - whether to include answer choices or not
    '''
    # Load example problem which we'll modify  
    problem = pkl.load(open('stage2_can_we_generate_them/D5/example_problem.pkl', 'rb'))

    if subset:
        # where AI is wrong
        d0 = df[~df['ai_correct']]
        # where AI is correct
        d1 = df[df['ai_correct']]     

        problem['dataset_description'] = f'multiple choice questions covering the topic of {subset}.'
        q_col = 'questions'
        cot_col = 'ai_expl'
    else:
        # where AI is wrong
        d0 = df[~df['correct']]
        # where AI is correct
        d1 = df[df['correct']]     

        problem['dataset_description'] = f'elementary level math problems for grades K-8 testing different educational standards.'
        q_col = 'question'
        cot_col = 'model_generation'


    # modifying the problem to fit MMLU
    problem['generation'] = 'whether the AI answered correctly or not'
    problem['example_hypotheses'] = ["uses double negation, i.e., using two negations in a sentence.", "contain equations with integrals", "are written in the style of a case-study"]
    
    problem['target'] = 'what specific features distinguish the questions where AI is correct from the questions where the AI is wrong.'
    problem['user'] = 'user of this AI system'
    
    # set the appropriate direction
    problem['A_desc'] = 'are questions where the AI system was wrong' 
    problem['B_desc'] = 'are questions where the AI system was correct'
    research_A = d0
    research_B = d1 


    # research samples
    if cot:
        A_samples = [f'{q} {cot}' for q, cot in zip(research_A[q_col].to_list(), research_A[cot_col].to_list())]
        B_samples = [f'{q} {cot}' for q, cot in zip(research_B[q_col].to_list(), research_B[cot_col].to_list())]
    else:
        A_samples = research_A[q_col].to_list()
        B_samples = research_B[q_col].to_list()

    problem['split']['research']['A_samples'] = A_samples
    problem['split']['research']['B_samples'] = B_samples

    # # Validation split - TODO none for now
    problem['split']['validation']['A_samples'] = ""
    problem['split']['validation']['B_samples'] = ""

    return problem


def get_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', choices=['mathcamps', 'mmlu-math', 'mmlu-health'], required=True, 
                        help='which dataset you want to describe errors for')
    parser.add_argument('--method', choices=['direct', 'd5', 'integrai'], required=True, 
                        help='The description method you want to use')
    # parser.add_argument('--num_descriptions', type=int, required=True, 
    #                     help='Total number of descriptions to generate')
    parser.add_argument('--proposer', type=str, 
                        help='which model to use to generate candidate descriptions')
    parser.add_argument('--num_gold_specified', action='store_true',
                        help='Whether proposer model is explicitly given number of ground truth error types to generate')
    parser.add_argument('--model_to_analyze', type=str,
                        help="which model you are characterizing the errors of \
                        e.g. gpt-3.5-turbo-0125, gpt-4o-2024-05-13,\
                        claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307")
    parser.add_argument('--gold_threshold', type=float, default=0.5,
                    help="threshold value on the error ratio to determine which standards are considered gold")
    
    parser.add_argument('--include_cot', action='store_true',
                    help="provide the CoT of the model with the problem instance")
    parser.add_argument('--path_dir', type=str, help="base directory to store results in", default='res')
    return parser.parse_args()

def main():
    args = get_args()
    # Load the dataset
    model_to_analyze = args.model_to_analyze
    num_gold_specified = args.num_gold_specified
    descr_method = args.method
    # threshold to decide the gold label standards to recover. picks standards with error ratio above gold_thresh
    gold_thresh = args.gold_threshold

    print(f'Using args.gold_threshold: {gold_thresh}')
    print(f'Using error landscape: {model_to_analyze}')
    print(f'Using description method: {descr_method}')
    print(f'Number of gold standards specified in prompt: {args.num_gold_specified}') 

    if args.dataset == 'mathcamps':
        q_col = 'question'
        label_col = 'correct'
        cot_col = 'model_generation'
        group_col = 'standard'
        subset = None
        if model_to_analyze in ['gpt-4o-2024-05-13', 'gpt-3.5-turbo-0125']:
            dataset = load_mathcamps_data('stage1_do_errors_exist/datasets/mathcamps/model-responses/v1/openai.json', model_to_analyze)
        elif model_to_analyze in ['claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']:
            dataset = load_mathcamps_data('stage1_do_errors_exist/datasets/mathcamps/model-responses/v1/anthropic.json', model_to_analyze )
        # open models
        elif model_to_analyze in ['gemma', 'llama', 'qwen']:
            if model_to_analyze == 'gemma':
                dataset = load_mathcamps_data('stage1_do_errors_exist/datasets/mathcamps/open_model_responses/gemma-3-1b-it-results.json', None)
            if model_to_analyze == 'llama':
                dataset = load_mathcamps_data('stage1_do_errors_exist/datasets/mathcamps/open_model_responses/llama3.1-8b-instruct-results.json', None)
            if model_to_analyze == 'qwen':
                dataset = load_mathcamps_data('stage1_do_errors_exist/datasets/mathcamps/open_model_responses/qwen-3-8b-results.json', None)
        else:
            raise NotImplementedError('responses for requested model_to_analyze not found. Please specify a different model')

    elif args.dataset.split('-')[0] == 'mmlu':
        # with MMLU we only have 
        model_to_analyze = 'gpt-3.5-turbo'
        # map cols for dataset
        q_col = 'questions'
        label_col = 'ai_correct'
        cot_col = 'ai_expl'
        group_col = 'subject'
        subset = args.dataset.split('-')[-1]

        dataset = MMLUDataset(f'mmlu-{subset}-reg').data
        df = calculate_error_metrics(dataset, 'subject', 'ai_correct', mmlu=True)
        qm = df_to_dict(df, "subject")
        # qm = QualityMetricsGold(dataset, 'subject')
        # qm.pretty_print()
        # plot_metrics(qm.metrics)
    
    #### Common code across methods - selecting dataset and identifying gold standards ####

    # filter for standards with 0% accuracy. Removing 8.EE.C.8 because it has too high of an error ratio (models got all or all but 1 questions of this type wrong)
    if args.dataset == 'mathcamps':
        metrics_df = calculate_error_metrics(dataset, group_col, label_col)
        zero_accuracy_stds = (metrics_df['accuracy'] == 0) | (metrics_df[group_col] == '8.EE.C.8')
    elif args.dataset.startswith('mmlu'):
        metrics_df = calculate_error_metrics(dataset, group_col, label_col, mmlu=True)
        zero_accuracy_stds = (metrics_df['accuracy'] == 0)

    zero_accuracy_names = metrics_df[zero_accuracy_stds][group_col]
    # print('zero_accuracy_names', zero_accuracy_names)

    # filter to identify which standards should be used as gold label
    metrics_df = metrics_df[~zero_accuracy_stds].sort_values('wrongVScorrect', ascending=False)
    # print(metrics_df)

    # identify the gold standard descriptions thaat we need to recover.
    if args.dataset == 'mathcamps':
        gold_standards = metrics_df[metrics_df['wrongVScorrect'] > gold_thresh][['standard', 'verification_criteria', 'description', 'short_description']].to_dict(orient='records')
    elif args.dataset.startswith('mmlu'):
        gold_standards = metrics_df[metrics_df['wrongVScorrect'] > gold_thresh][[group_col, 'subcat', 'cat']].to_dict(orient='records')
    
    # print('gold_standards=', gold_standards)
    num_gold_standards = len(gold_standards)

    # make zero-accuracy standards from the seed_df into 100% accurate.
    if zero_accuracy_names is not None:
        dataset.loc[dataset[group_col].isin(zero_accuracy_names), label_col] = True

    errors = dataset[dataset[label_col] == 0].sample(frac=1)
    sample = errors

    # SANITY check - error counts by standard
    counts = Counter(sample[group_col].to_list())
    # print('error_counts_by_group', counts)

    # FIXME Add integrai. Currently it is run from a separate script :(
    # mozannar et al. Neurips
    if descr_method == 'integrai':
        # Run integrai
        # get model loss on each point - here we use the 0-1 loss
        print(f'Running Integrai for {model_to_analyze}')
        model_losses = (1 - dataset['correct']).to_numpy()
        # print('model_losses', model_losses)

        # We're interested in discovering regions where the model tends to make errors
        integrai = IntegrAI(np.array(dataset['question_embedding'].to_list()), dataset['short_description'].to_list(), get_text_embeddings_text, model_losses)
        # we use the all_0 prior which means we assume that AI has loss lower than the threshold for all points. This is a simulation of complete over-reliance.
        # our loss is binary so we set threshold at 0.5
        # we specify that the discovered groups should be between 1% and 50% of the data
        _ = integrai.discover_regions(prior = "all_0", loss_threshold=0.5, number_regions = num_gold_standards, max_size = 0.5, min_size = 0.01)
        region_labels = integrai.region_finder.get_region_labels(np.array(dataset['question_embedding'].to_list()))
        defer_preds = integrai.region_finder.get_defer_preds(np.array(dataset['question_embedding'].to_list()))
        print(f' accuracy of AI in region 1 found is {np.mean(dataset["model_answer"][region_labels==1] == dataset["answer"][region_labels==1]) }')
        # print(f' accuracy of AI in region 2 found is {np.mean(df_data["preds"][region_labels==2] == df_data["labels"][region_labels==2]) }')
        # Regions: 0 is always the "background" region
        # print(f' size of regions is {Counter(region_labels)}')

        hypotheses = {}
        prompts = []
        for i in range(1, len(set(region_labels))):
            description, _, _, _, prompt = integrai.describe_region(i)
            hypotheses[f"hypothesis{i-1}"] = description
            prompts.append(prompt)

        # for each region we produce a description.
        # description, _, _, _ = integrai.describe_region(1)
        # print(f'IntegrAI has described region 1 as: {description}')
        # description, _, _, _ = integrai.describe_region(2)
        # print(f'IntegrAI has described region 2 as: {description}')

        # put this in a loop so that we describe the entire region

        # debug = dataset[dataset['standard'] == '8.EE.C.8']['correct'].mean()
        # print('debug=', debug)

        # raise NotImplementedError
        obj_to_write = {"prompt": prompts,
                "error_landscape": model_to_analyze,
                "num_gold_standards": num_gold_standards,
                "num_gold_specified": num_gold_specified,
                "gold_labels": gold_standards,
                "total_errors": len(errors),
                "response": hypotheses,
                }
    
        # path_input = f"can_we_generate_them/{args.dataset}/error_landscapes_erthresh={gold_thresh}/"
        path_input = f"{args.path_dir}/{args.dataset}/error_landscapes_erthresh={gold_thresh}/"
        path_input = f"{path_input}/landscape={obj_to_write['error_landscape']}_specified={obj_to_write['num_gold_specified']}"
        # save response
        os.makedirs(path_input, exist_ok=True) 
        if args.include_cot:
            with open(f"{path_input}/{descr_method}-response_cot.json", "w") as file:
                json.dump(obj_to_write, file)
        else:
            with open(f"{path_input}/{descr_method}-response.json", "w") as file:
                json.dump(obj_to_write, file)    


    # describing differences between text corpora
    if descr_method == 'd5':
        verifier_name = 'openai'
        verifier_batch_size = 12

        # For D5, k is a hyperparameter that must be set
        assert num_gold_specified == True

        # dataset was modified in-place above so 8.EE.C.8 is removed.
        if args.include_cot:
            problem = create_problem(dataset, cot=True, subset=subset)

            # error_instances = '\n***\n'.join([f'{q} {cot}' for q, cot in zip(sample[q_col].to_list(), sample[cot_col].to_list())])
            # error_instances = fit_in_context(error_instances)
        else:
            problem = create_problem(dataset, subset=subset)

        # logging the problem for debugging.
        # with open("mathcamps-problem.json", "w") as f:
        #     json.dump(problem, f, indent=2)

        # creating the proposer and verifier
        proposer = GPT3_Proposer(problem)

        # for actual use, the verifier is a validator with 11B parameters
        # for debugging, the verifier is a dummy validator returns a random value
        if verifier_name == 'dummy':
            verifier = DummyValidator()
        else:
            print(f'using {verifier_name} as verifier')
            # verifier = Validator(verifier_name, batch_size=verifier_batch_size)
            verifier = OpenAIValidator()

        # goal-driven discovery and description of corpus-level differences
        d5 = D5(
            problem['split']['research']['A_samples'], 
            problem['split']['research']['B_samples'], 
            verifier,
            proposer,
            total_hypotheses_count=20, # number of hypotheses we allow the model to generate
            early_stop=True,
            top_K_hypotheses=num_gold_standards # the size of H_final
        )
        h2h_dicts = d5.run()

        h_sorted = sorted(h2h_dicts, key=lambda h: h2h_dicts[h]['diff_w_significance']['mu'], reverse=True)[:num_gold_standards]
        for h in h_sorted:
            h_dict = h2h_dicts[h]
            # print out the example hypothesis along with their V' score
            # print(h_dict['hypothesis'], 'V\'', h_dict['diff_w_significance']['mu'])

        # with open()
        # pkl.dump(h2h_dicts, open('d5-mathcamps-out.pkl', 'wb'))
        # logging the problem for debugging.
            
        hypotheses = {f"hypothesis{i}": hyp for i, hyp in enumerate(h_sorted)}
            
        obj_to_write = {"prompt": h2h_dicts[h_sorted[0]]["provenance"]["messages"],
                    "error_landscape": model_to_analyze,
                    "num_gold_standards": num_gold_standards,
                    "num_gold_specified": num_gold_specified,
                    "gold_labels": gold_standards,
                    "total_errors": len(errors),
                    "response": hypotheses,
                    }
        
        # path_input = f"can_we_generate_them/{args.dataset}/error_landscapes_erthresh={gold_thresh}/"
        path_input = f"{args.path_dir}/{args.dataset}/error_landscapes_erthresh={gold_thresh}/"
        path_input = f"{path_input}/landscape={obj_to_write['error_landscape']}_specified={obj_to_write['num_gold_specified']}"
        # save response
        os.makedirs(path_input, exist_ok=True) 
        if args.include_cot:
            with open(f"{path_input}/{descr_method}-response_cot.json", "w") as file:
                json.dump(obj_to_write, file)
        else:
            with open(f"{path_input}/{descr_method}-response.json", "w") as file:
                json.dump(obj_to_write, file)    
              
    
    if descr_method == 'direct':
        print('Using args.gold_threshold=', gold_thresh)
        print(f'Using error landscape: {model_to_analyze}')
        print(f'Using description method: {args.method}')
        print(f'Number of gold standards specified in prompt: {args.num_gold_specified}') 

        if args.dataset == 'mathcamps':
            metrics_df = calculate_error_metrics(dataset, 'standard', 'correct')
            # filter for standards with 0% accuracy. Removing 8.EE.C.8 because it has too high of an error ratio (models got all or all but 1 questions of this type wrong)
            zero_accuracy_stds = (metrics_df['accuracy'] == 0) | (metrics_df['standard'] == '8.EE.C.8')
            zero_accuracy_names = metrics_df[zero_accuracy_stds]['standard']
            # print('zero_accuracy_names', zero_accuracy_names)

            # filter to identify which standards should be used as gold label
            metrics_df = metrics_df[~zero_accuracy_stds].sort_values('wrongVScorrect', ascending=False)
            # print(metrics_df)

            # identify the gold standard descriptions thaat we need to recover.
            gold_standards = metrics_df[metrics_df['wrongVScorrect'] > gold_thresh][['standard', 'verification_criteria', 'description', 'short_description']].to_dict(orient='records')
            # print('gold_standards=', gold_standards)
            num_gold_standards = len(gold_standards)

            # make zero-accuracy standards from the seed_df into 100% accurate.
            if zero_accuracy_names is not None:
                dataset.loc[dataset["standard"].isin(zero_accuracy_names), "correct"] = True

            errors = dataset[dataset['correct'] == 0].sample(frac=1)

            sample = errors
        elif args.dataset.startswith('mmlu'):
            # print('dataset.columns', dataset.columns)
            # print(dataset.groupby(['subject']).head())
            metrics_df = calculate_error_metrics(dataset, group_col, label_col, mmlu=True)
            # filter for standards with 0% accuracy. Removing 8.EE.C.8 because it has too high of an error ratio (models got all or all but 1 questions of this type wrong)
            zero_accuracy_stds = (metrics_df['accuracy'] == 0)
            zero_accuracy_names = metrics_df[zero_accuracy_stds]['subject']
            # print('zero_accuracy_names', zero_accuracy_names)

            # filter to identify which standards should be used as gold label
            metrics_df = metrics_df[~zero_accuracy_stds].sort_values('wrongVScorrect', ascending=False)
            # print(metrics_df)

            # identify the gold standard descriptions that we need to recover.
            # print('metrics_df=', metrics_df)
            gold_standards = metrics_df[metrics_df['wrongVScorrect'] > gold_thresh][[group_col, 'subcat', 'cat']].to_dict(orient='records')
            # print('gold_standards=', gold_standards)
            num_gold_standards = len(gold_standards)

            # make zero-accuracy standards from the seed_df into 100% accurate.
            if zero_accuracy_names is not None:
                dataset.loc[dataset[group_col].isin(zero_accuracy_names), label_col] = True

            errors = dataset[dataset[label_col] == 0].sample(frac=1)

            sample = errors

        # SANITY check - error counts by standard
        counts = Counter(sample[group_col].to_list())
        # print('error_counts_by_group', counts)


        if args.include_cot:
            error_instances = '\n***\n'.join([f'{q} {cot}' for q, cot in zip(sample[q_col].to_list(), sample[cot_col].to_list())])
            error_instances = fit_in_context(error_instances)

        else:
            error_instances = '\n***\n'.join(sample[q_col].to_list())
            
        # Condition 1 = we specify the number of standards that we're trying to match.
        if num_gold_specified:
            template = open('stage2_can_we_generate_them/prompt_templates/direct_describe.txt', 'r').read()
            prompt_fields = {'error_instances': error_instances,
                            'num_hyps': num_gold_standards}

        # Condition 2 = we don't specify how many. We instruct to find all of the most salient ones.
        else:
            template = open('stage2_can_we_generate_them/prompt_templates/direct_describe_unspecified.txt', 'r').read()
            prompt_fields = {'error_instances': error_instances}

        p = generate_prompt(prompt_fields, template)

        # print('len_prompt', p) 
        # print(len(gold_standards))

        input_obj = {"prompt": p,
                    "error_landscape": model_to_analyze,
                    "num_gold_standards": num_gold_standards,
                    "num_gold_specified": num_gold_specified,
                    "gold_labels": gold_standards,
                    "total_errors": len(errors)
                    }

        
        # print(input_obj)
        for k, v in input_obj.items():
            # print(k)
            if k != 'prompt':
                print(k, v)
        
        # query openai api to get candidate error descriptions
        print('Proposer Model:', args.proposer)
        if args.proposer:
            obj_to_write = describe_errors(input_obj, args.proposer)
        else:
            obj_to_write = describe_errors(input_obj)

        

        # Saving Responses
        # path_input = f"can_we_generate_them/{args.dataset}/error_landscapes_erthresh={gold_thresh}/"
        path_input = f"{args.path_dir}/{args.dataset}/error_landscapes_erthresh={gold_thresh}/"
        path_input = f"{path_input}/landscape={input_obj['error_landscape']}_specified={input_obj['num_gold_specified']}"
        # save response
        os.makedirs(path_input, exist_ok=True)
        if args.include_cot:
            with open(f"{path_input}/{descr_method}-response_cot.json", "w") as file:
                json.dump(obj_to_write, file)
        else:
            with open(f"{path_input}/{descr_method}-response.json", "w") as file:
                json.dump(obj_to_write, file)            
    

if __name__ == "__main__":
    main()