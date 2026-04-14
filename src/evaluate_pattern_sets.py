import argparse
import json
import os
import pandas as pd
import numpy as np

def calculate_metrics(df):
    """
    Calculates Coverage and Concentration
    """
    total_instances = len(df)
    total_errors = df['is_error'].sum()
    overall_error_rate = total_errors / total_instances if total_instances > 0 else 0

    metrics = {
        "overall_error_rate": float(overall_error_rate),
        "total_errors": int(total_errors),
        "total_instances": int(total_instances)
    }

    if 'group' in df.columns:
        high_mask = df['group'].str.contains('High', case=False, na=False)
        high_instances = high_mask.sum()
        
        high_errors = ((df['is_error'] == 1) & high_mask).sum()

        coverage = high_errors / total_errors if total_errors > 0 else 0
        
        concentration = high_errors / high_instances if high_instances > 0 else 0

        metrics["high_residual"] = {
            "coverage_of_errors": float(coverage),
            "concentration_of_errors": float(concentration),
            "high_instances": int(high_instances)
        }

    return metrics

def main():
    parser = argparse.ArgumentParser(description="Evaluate pattern sets and calculate quantitative set-level metrics")
    parser.add_argument("--residual-csv", required=True, help="Path to residual CSV file")
    parser.add_argument("--label", required=True, help="Experiment label/tag")
    parser.add_argument("--output-json", required=True, help="Path to output metrics JSON")
    parser.add_argument("--output-table", required=True, help="Path to append leaderboard CSV")
    parser.add_argument("--pattern-membership", help="Optional pattern membership CSV (Stage 4 output)")
    parser.add_argument("--pattern-catalog", help="Optional pattern catalog JSON (Stage 4 output)")
    parser.add_argument("--stability-catalogs", help="Optional comma-separated list of catalog JSONs to measure stability")
    parser.add_argument("--judge-json", help="Optional judge JSON for external LLM judging metrics")

    args = parser.parse_args()

    df = pd.read_csv(args.residual_csv)
    if 'is_error' not in df.columns:
        if 'ai_correct' in df.columns:
            df['is_error'] = (~df['ai_correct'].astype(bool)).astype(int)
        else:
            raise ValueError("CSV must contain 'is_error' or 'ai_correct'")

    metrics = calculate_metrics(df)

    if args.judge_json and os.path.exists(args.judge_json):
        with open(args.judge_json, 'r') as f:
            judge_data = json.load(f)
            first_key = list(judge_data.keys())[0] if judge_data else None
            if first_key:
                metrics["judge_metrics"] = {
                    "f1": judge_data[first_key].get("f1", 0),
                    "avg_rating_hyps": judge_data[first_key].get("avg_rating_hyps", 0)
                }

    final_output = {
        "label": args.label,
        "residual_metrics_from_eval": metrics,
        # Placeholders for future expanded set-level metrics
        "final_set_level_metrics": {
            "coverage_concentration": {
                "coverage": metrics.get("high_residual", {}).get("coverage_of_errors", 0),
                "concentration": metrics.get("high_residual", {}).get("concentration_of_errors", 0)
            },
            "predictive_utility": {"auc": None},
            "redundancy": {"avg_pairwise_jaccard": 0.0},
            "stability": {"overlap_at_k_mean": None}
        }
    }

    os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
    with open(args.output_json, 'w') as f:
        json.dump(final_output, f, indent=4)

    leaderboard_path = args.output_table
    record = {
        "label": args.label,
        "error_rate": metrics.get("overall_error_rate", 0),
        "coverage": final_output["final_set_level_metrics"]["coverage_concentration"]["coverage"],
        "concentration": final_output["final_set_level_metrics"]["coverage_concentration"]["concentration"]
    }
    if "judge_metrics" in metrics:
        record["judge_f1"] = metrics["judge_metrics"]["f1"]

    record_df = pd.DataFrame([record])
    os.makedirs(os.path.dirname(leaderboard_path), exist_ok=True)
    record_df.to_csv(leaderboard_path, mode='a', header=not os.path.exists(leaderboard_path), index=False)

    print(f"Metrics evaluated and saved for label '{args.label}'")

if __name__ == "__main__":
    main()