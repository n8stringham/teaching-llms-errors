# Preprocess 
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import itertools
from collections import defaultdict

class MMLUDataset:
    '''Preprocessing MMLU data from Mozannar et al.'''
    def __init__(self, dataset_id, model_id='chatgpt', accuracy=0) -> None:
        self.model_id = model_id
        if dataset_id == 'mmlu':
            self.pre_process_mmlu(self)
        elif dataset_id == 'mmlu-math-reg':
            self.pre_process_mmlu(self)
            self.choose_subcat_mmlu(subcat='math')
        elif dataset_id == 'mmlu-health-reg':
            self.pre_process_mmlu(self)
            self.choose_subcat_mmlu(subcat='health')
        elif dataset_id == 'mmlu-other':
            self.pre_process_mmlu(self)
            self.choose_subcat_mmlu(subcat='other')
        elif dataset_id == 'mmlu-virology-reg':
            self.pre_process_mmlu(self)
            self.choose_subject_mmlu(subject='virology')
        elif dataset_id == 'mmlu-philosophy':
            self.pre_process_mmlu(self)
            self.choose_subcat_mmlu(subcat="philosophy")
        elif dataset_id == 'mmlu-math-syn':
            self.pre_process_mmlu(self)
            self.make_synthetic_mmlu(subcat='math', bad_subj='abstract_algebra', p=accuracy)
        elif dataset_id == 'mmlu-philosophy-syn':
            self.pre_process_mmlu(self)
            self.make_synthetic_mmlu(subcat='philosophy', bad_subj='logical_fallacies', p=accuracy)
        elif dataset_id == 'mmlu-health-syn':
            self.pre_process_mmlu(self)
            self.make_synthetic_mmlu(subcat='health', bad_subj='anatomy', p=accuracy)
        elif dataset_id == 'mmlu-health-syn-multi':
            self.pre_process_mmlu(self)
            self.make_synthetic_mmlu_multi(subcat='health', bad_subjs=['anatomy', 'nutrition'])

        else:
            raise NotImplementedError('only mmlu implemented at this time')

    def pre_process_mmlu(self, subject: str):
        base_name = 'stage1_do_errors_exist/datasets/mmlu_df_'
        if self.model_id == 'flan':
            model_name = 'flant5xl'

        elif self.model_id  == 'chatgpt':
            model_name = 'gpt35'

        else:
            raise NotImplementedError(f'Do not have data with with predictions from {self.model_id }.')
        
        df = pd.read_pickle(base_name + model_name + '.pkl')

        # split metadata levels into their own cols
        df['subject'] = df['metadata'].apply(lambda x: x[0])
        df['subcat'] = df['metadata'].apply(lambda x: x[1])
        df['cat'] = df['metadata'].apply(lambda x: x[2])

        # add a column indicating whether ai was correct for that question
        df['ai_correct'] = df.apply(lambda row: row['data_y'] == row['ai_preds'], axis=1)

        # create a test split with 30% of the data
        df, val_df = train_test_split(df, test_size=0.3, random_state=42)
        self.val_data = val_df
        self.data = df

    def make_synthetic_mmlu_multi(self, subcat, bad_subjs):
        '''
        Alter the predictions so that AI is 100% correct within `subcat`
        except for questions from `bad_subj`
        set self.data to be the dataframe filtered to `subcat`
        '''
        assert isinstance(bad_subjs, list)
        # synthetically alter
        print(self.data['ai_correct'].dtype)
        condition = self.data['subcat']  == subcat
        copy = self.data.loc[condition].copy()
        self.data.loc[condition, 'ai_correct'] = np.where(copy['subject'].isin(bad_subjs), False, True)

        # verifying - uncommennt
        grouped = self.data.groupby('subject')
        assert (self.data.loc[self.data['subject'].isin(bad_subjs), 'ai_correct'].mean()
 == 0)
        # filter dataset to only contain subcat
        self.data = self.data.loc[condition]

    def make_synthetic_mmlu(self, subcat, bad_subj, p=0):
        '''
        Alter the predictions so that AI is 100% correct within `subcat`
        except for questions from `bad_subj`
        set self.data to be the dataframe filtered to `subcat`
        p - the accuracy rate for bad_subj. Defaults to 0 to make accuracy 0%
        '''
        # synthetically alter
        condition = self.data['subcat']  == subcat
        val_condition = self.val_data['subcat'] == subcat

        copy = self.data.loc[condition].copy()
        val_copy = self.val_data.loc[condition].copy()
        # self.data.loc[condition, 'ai_correct'] = np.where(copy['subject'] == bad_subj, False, True)
        self.data.loc[condition, 'ai_correct'] = np.where((copy['subject'] == bad_subj) & (np.random.rand(len(copy)) > p), False, True)
        self.val_data.loc[val_condition, 'ai_correct'] = np.where((val_copy['subject'] == bad_subj) & (np.random.rand(len(val_copy)) > p), False, True)
        
        # verifying - uncommennt
        grouped = self.data.groupby('subject')
        val_grouped = self.val_data.groupby('subject')
        if p == 0:
            assert (self.data.loc[self.data['subject'] == bad_subj, 'ai_correct'].mean()
 == 0)
            assert (self.val_data.loc[self.val_data['subject'] == bad_subj, 'ai_correct'].mean()
 == 0)
            
        # filter dataset to only contain subcat
        self.data = self.data.loc[condition]
        self.val_data = self.val_data.loc[val_condition]

    def choose_subcat_mmlu(self, subcat):
        '''
        set self.data to be the dataframe filtered to `subcat`
        '''
        condition = self.data['subcat']  == subcat
        val_condition = self.val_data['subcat'] == subcat    
        # filter dataset to only contain subcat
        self.data = self.data.loc[condition]
        self.val_data = self.val_data.loc[val_condition]

    def choose_subject_mmlu(self, subject):
        '''
        set self.data to be the dataframe filtered to `subcat`
        '''
        condition = self.data['subject']  == subject
        val_condition = self.val_data['subject'] == subject    
        # filter dataset to only contain subcat
        self.data = self.data.loc[condition]
        self.val_data = self.val_data.loc[val_condition]