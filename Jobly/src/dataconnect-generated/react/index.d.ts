import { ListAllJobsData, CreateNewJobData, CreateNewJobVariables, GetUserApplicationsData, GetUserApplicationsVariables, ApplyToJobData, ApplyToJobVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useListAllJobs(options?: useDataConnectQueryOptions<ListAllJobsData>): UseDataConnectQueryResult<ListAllJobsData, undefined>;
export function useListAllJobs(dc: DataConnect, options?: useDataConnectQueryOptions<ListAllJobsData>): UseDataConnectQueryResult<ListAllJobsData, undefined>;

export function useCreateNewJob(options?: useDataConnectMutationOptions<CreateNewJobData, FirebaseError, CreateNewJobVariables>): UseDataConnectMutationResult<CreateNewJobData, CreateNewJobVariables>;
export function useCreateNewJob(dc: DataConnect, options?: useDataConnectMutationOptions<CreateNewJobData, FirebaseError, CreateNewJobVariables>): UseDataConnectMutationResult<CreateNewJobData, CreateNewJobVariables>;

export function useGetUserApplications(vars: GetUserApplicationsVariables, options?: useDataConnectQueryOptions<GetUserApplicationsData>): UseDataConnectQueryResult<GetUserApplicationsData, GetUserApplicationsVariables>;
export function useGetUserApplications(dc: DataConnect, vars: GetUserApplicationsVariables, options?: useDataConnectQueryOptions<GetUserApplicationsData>): UseDataConnectQueryResult<GetUserApplicationsData, GetUserApplicationsVariables>;

export function useApplyToJob(options?: useDataConnectMutationOptions<ApplyToJobData, FirebaseError, ApplyToJobVariables>): UseDataConnectMutationResult<ApplyToJobData, ApplyToJobVariables>;
export function useApplyToJob(dc: DataConnect, options?: useDataConnectMutationOptions<ApplyToJobData, FirebaseError, ApplyToJobVariables>): UseDataConnectMutationResult<ApplyToJobData, ApplyToJobVariables>;
