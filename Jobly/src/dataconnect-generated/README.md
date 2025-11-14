# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListAllJobs*](#listalljobs)
  - [*GetUserApplications*](#getuserapplications)
- [**Mutations**](#mutations)
  - [*CreateNewJob*](#createnewjob)
  - [*ApplyToJob*](#applytojob)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListAllJobs
You can execute the `ListAllJobs` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllJobs(): QueryPromise<ListAllJobsData, undefined>;

interface ListAllJobsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAllJobsData, undefined>;
}
export const listAllJobsRef: ListAllJobsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllJobs(dc: DataConnect): QueryPromise<ListAllJobsData, undefined>;

interface ListAllJobsRef {
  ...
  (dc: DataConnect): QueryRef<ListAllJobsData, undefined>;
}
export const listAllJobsRef: ListAllJobsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllJobsRef:
```typescript
const name = listAllJobsRef.operationName;
console.log(name);
```

### Variables
The `ListAllJobs` query has no variables.
### Return Type
Recall that executing the `ListAllJobs` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllJobsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListAllJobs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllJobs } from '@dataconnect/generated';


// Call the `listAllJobs()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllJobs();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllJobs(dataConnect);

console.log(data.jobs);

// Or, you can use the `Promise` API.
listAllJobs().then((response) => {
  const data = response.data;
  console.log(data.jobs);
});
```

### Using `ListAllJobs`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllJobsRef } from '@dataconnect/generated';


// Call the `listAllJobsRef()` function to get a reference to the query.
const ref = listAllJobsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllJobsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.jobs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.jobs);
});
```

## GetUserApplications
You can execute the `GetUserApplications` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserApplications(vars: GetUserApplicationsVariables): QueryPromise<GetUserApplicationsData, GetUserApplicationsVariables>;

interface GetUserApplicationsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserApplicationsVariables): QueryRef<GetUserApplicationsData, GetUserApplicationsVariables>;
}
export const getUserApplicationsRef: GetUserApplicationsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserApplications(dc: DataConnect, vars: GetUserApplicationsVariables): QueryPromise<GetUserApplicationsData, GetUserApplicationsVariables>;

interface GetUserApplicationsRef {
  ...
  (dc: DataConnect, vars: GetUserApplicationsVariables): QueryRef<GetUserApplicationsData, GetUserApplicationsVariables>;
}
export const getUserApplicationsRef: GetUserApplicationsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserApplicationsRef:
```typescript
const name = getUserApplicationsRef.operationName;
console.log(name);
```

### Variables
The `GetUserApplications` query requires an argument of type `GetUserApplicationsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserApplicationsVariables {
  workerId: UUIDString;
}
```
### Return Type
Recall that executing the `GetUserApplications` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserApplicationsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetUserApplications`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserApplications, GetUserApplicationsVariables } from '@dataconnect/generated';

// The `GetUserApplications` query requires an argument of type `GetUserApplicationsVariables`:
const getUserApplicationsVars: GetUserApplicationsVariables = {
  workerId: ..., 
};

// Call the `getUserApplications()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserApplications(getUserApplicationsVars);
// Variables can be defined inline as well.
const { data } = await getUserApplications({ workerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserApplications(dataConnect, getUserApplicationsVars);

console.log(data.applications);

// Or, you can use the `Promise` API.
getUserApplications(getUserApplicationsVars).then((response) => {
  const data = response.data;
  console.log(data.applications);
});
```

### Using `GetUserApplications`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserApplicationsRef, GetUserApplicationsVariables } from '@dataconnect/generated';

// The `GetUserApplications` query requires an argument of type `GetUserApplicationsVariables`:
const getUserApplicationsVars: GetUserApplicationsVariables = {
  workerId: ..., 
};

// Call the `getUserApplicationsRef()` function to get a reference to the query.
const ref = getUserApplicationsRef(getUserApplicationsVars);
// Variables can be defined inline as well.
const ref = getUserApplicationsRef({ workerId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserApplicationsRef(dataConnect, getUserApplicationsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.applications);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.applications);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateNewJob
You can execute the `CreateNewJob` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createNewJob(vars: CreateNewJobVariables): MutationPromise<CreateNewJobData, CreateNewJobVariables>;

interface CreateNewJobRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewJobVariables): MutationRef<CreateNewJobData, CreateNewJobVariables>;
}
export const createNewJobRef: CreateNewJobRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createNewJob(dc: DataConnect, vars: CreateNewJobVariables): MutationPromise<CreateNewJobData, CreateNewJobVariables>;

interface CreateNewJobRef {
  ...
  (dc: DataConnect, vars: CreateNewJobVariables): MutationRef<CreateNewJobData, CreateNewJobVariables>;
}
export const createNewJobRef: CreateNewJobRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createNewJobRef:
```typescript
const name = createNewJobRef.operationName;
console.log(name);
```

### Variables
The `CreateNewJob` mutation requires an argument of type `CreateNewJobVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `CreateNewJob` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateNewJobData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateNewJobData {
  job_insert: Job_Key;
}
```
### Using `CreateNewJob`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createNewJob, CreateNewJobVariables } from '@dataconnect/generated';

// The `CreateNewJob` mutation requires an argument of type `CreateNewJobVariables`:
const createNewJobVars: CreateNewJobVariables = {
  employerId: ..., 
  title: ..., 
  description: ..., 
  location: ..., 
  hourlyRate: ..., 
  startTime: ..., 
  endTime: ..., 
  date: ..., 
};

// Call the `createNewJob()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createNewJob(createNewJobVars);
// Variables can be defined inline as well.
const { data } = await createNewJob({ employerId: ..., title: ..., description: ..., location: ..., hourlyRate: ..., startTime: ..., endTime: ..., date: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createNewJob(dataConnect, createNewJobVars);

console.log(data.job_insert);

// Or, you can use the `Promise` API.
createNewJob(createNewJobVars).then((response) => {
  const data = response.data;
  console.log(data.job_insert);
});
```

### Using `CreateNewJob`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createNewJobRef, CreateNewJobVariables } from '@dataconnect/generated';

// The `CreateNewJob` mutation requires an argument of type `CreateNewJobVariables`:
const createNewJobVars: CreateNewJobVariables = {
  employerId: ..., 
  title: ..., 
  description: ..., 
  location: ..., 
  hourlyRate: ..., 
  startTime: ..., 
  endTime: ..., 
  date: ..., 
};

// Call the `createNewJobRef()` function to get a reference to the mutation.
const ref = createNewJobRef(createNewJobVars);
// Variables can be defined inline as well.
const ref = createNewJobRef({ employerId: ..., title: ..., description: ..., location: ..., hourlyRate: ..., startTime: ..., endTime: ..., date: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createNewJobRef(dataConnect, createNewJobVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.job_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.job_insert);
});
```

## ApplyToJob
You can execute the `ApplyToJob` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
applyToJob(vars: ApplyToJobVariables): MutationPromise<ApplyToJobData, ApplyToJobVariables>;

interface ApplyToJobRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ApplyToJobVariables): MutationRef<ApplyToJobData, ApplyToJobVariables>;
}
export const applyToJobRef: ApplyToJobRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
applyToJob(dc: DataConnect, vars: ApplyToJobVariables): MutationPromise<ApplyToJobData, ApplyToJobVariables>;

interface ApplyToJobRef {
  ...
  (dc: DataConnect, vars: ApplyToJobVariables): MutationRef<ApplyToJobData, ApplyToJobVariables>;
}
export const applyToJobRef: ApplyToJobRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the applyToJobRef:
```typescript
const name = applyToJobRef.operationName;
console.log(name);
```

### Variables
The `ApplyToJob` mutation requires an argument of type `ApplyToJobVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ApplyToJobVariables {
  jobId: UUIDString;
  workerId: UUIDString;
  coverLetter: string;
}
```
### Return Type
Recall that executing the `ApplyToJob` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ApplyToJobData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ApplyToJobData {
  application_insert: Application_Key;
}
```
### Using `ApplyToJob`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, applyToJob, ApplyToJobVariables } from '@dataconnect/generated';

// The `ApplyToJob` mutation requires an argument of type `ApplyToJobVariables`:
const applyToJobVars: ApplyToJobVariables = {
  jobId: ..., 
  workerId: ..., 
  coverLetter: ..., 
};

// Call the `applyToJob()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await applyToJob(applyToJobVars);
// Variables can be defined inline as well.
const { data } = await applyToJob({ jobId: ..., workerId: ..., coverLetter: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await applyToJob(dataConnect, applyToJobVars);

console.log(data.application_insert);

// Or, you can use the `Promise` API.
applyToJob(applyToJobVars).then((response) => {
  const data = response.data;
  console.log(data.application_insert);
});
```

### Using `ApplyToJob`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, applyToJobRef, ApplyToJobVariables } from '@dataconnect/generated';

// The `ApplyToJob` mutation requires an argument of type `ApplyToJobVariables`:
const applyToJobVars: ApplyToJobVariables = {
  jobId: ..., 
  workerId: ..., 
  coverLetter: ..., 
};

// Call the `applyToJobRef()` function to get a reference to the mutation.
const ref = applyToJobRef(applyToJobVars);
// Variables can be defined inline as well.
const ref = applyToJobRef({ jobId: ..., workerId: ..., coverLetter: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = applyToJobRef(dataConnect, applyToJobVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.application_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.application_insert);
});
```

