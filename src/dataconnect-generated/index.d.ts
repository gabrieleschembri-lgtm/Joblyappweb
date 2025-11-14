import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Application_Key {
  id: UUIDString;
  __typename?: 'Application_Key';
}

export interface ApplyToJobData {
  application_insert: Application_Key;
}

export interface ApplyToJobVariables {
  jobId: UUIDString;
  workerId: UUIDString;
  coverLetter: string;
}

export interface CreateNewJobData {
  job_insert: Job_Key;
}

export interface CreateNewJobVariables {
  employerId: UUIDString;
  title: string;
  description: string;
  location: string;
  hourlyRate: number;
  startTime: TimestampString;
  endTime: TimestampString;
  date: DateString;
}

export interface GetUserApplicationsData {
  applications: ({
    id: UUIDString;
    job: {
      id: UUIDString;
      title: string;
      description: string;
      location: string;
      hourlyRate: number;
    } & Job_Key;
      coverLetter?: string | null;
      createdAt: TimestampString;
      status: string;
  } & Application_Key)[];
}

export interface GetUserApplicationsVariables {
  workerId: UUIDString;
}

export interface Job_Key {
  id: UUIDString;
  __typename?: 'Job_Key';
}

export interface ListAllJobsData {
  jobs: ({
    id: UUIDString;
    title: string;
    description: string;
    location: string;
    hourlyRate: number;
    startTime: TimestampString;
    endTime: TimestampString;
    date: DateString;
    employer: {
      id: UUIDString;
      displayName: string;
    } & User_Key;
  } & Job_Key)[];
}

export interface Message_Key {
  id: UUIDString;
  __typename?: 'Message_Key';
}

export interface Review_Key {
  id: UUIDString;
  __typename?: 'Review_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface ListAllJobsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAllJobsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAllJobsData, undefined>;
  operationName: string;
}
export const listAllJobsRef: ListAllJobsRef;

export function listAllJobs(): QueryPromise<ListAllJobsData, undefined>;
export function listAllJobs(dc: DataConnect): QueryPromise<ListAllJobsData, undefined>;

interface CreateNewJobRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewJobVariables): MutationRef<CreateNewJobData, CreateNewJobVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNewJobVariables): MutationRef<CreateNewJobData, CreateNewJobVariables>;
  operationName: string;
}
export const createNewJobRef: CreateNewJobRef;

export function createNewJob(vars: CreateNewJobVariables): MutationPromise<CreateNewJobData, CreateNewJobVariables>;
export function createNewJob(dc: DataConnect, vars: CreateNewJobVariables): MutationPromise<CreateNewJobData, CreateNewJobVariables>;

interface GetUserApplicationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserApplicationsVariables): QueryRef<GetUserApplicationsData, GetUserApplicationsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserApplicationsVariables): QueryRef<GetUserApplicationsData, GetUserApplicationsVariables>;
  operationName: string;
}
export const getUserApplicationsRef: GetUserApplicationsRef;

export function getUserApplications(vars: GetUserApplicationsVariables): QueryPromise<GetUserApplicationsData, GetUserApplicationsVariables>;
export function getUserApplications(dc: DataConnect, vars: GetUserApplicationsVariables): QueryPromise<GetUserApplicationsData, GetUserApplicationsVariables>;

interface ApplyToJobRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ApplyToJobVariables): MutationRef<ApplyToJobData, ApplyToJobVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ApplyToJobVariables): MutationRef<ApplyToJobData, ApplyToJobVariables>;
  operationName: string;
}
export const applyToJobRef: ApplyToJobRef;

export function applyToJob(vars: ApplyToJobVariables): MutationPromise<ApplyToJobData, ApplyToJobVariables>;
export function applyToJob(dc: DataConnect, vars: ApplyToJobVariables): MutationPromise<ApplyToJobData, ApplyToJobVariables>;

